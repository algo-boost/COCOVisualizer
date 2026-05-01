import { postForm, postJSON } from './client.js';

export const runCode = (code, datasetId) =>
  postJSON('/api/chat/run_code', { code, dataset_id: datasetId });

export const uploadChatAttachment = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return postForm('/api/chat/upload', fd);
};

export const buildChatDownloadURL = (fileId) => `/api/chat/download/${fileId}`;

/**
 * 启动 SSE 聊天流。
 * 返回 {abort, done} —— done 是 Promise，外部可 await。
 */
export function startChatStream(payload, handlers = {}) {
  const ctrl = new AbortController();
  const done = (async () => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    while (true) {
      const { done: end, value } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        for (const ln of block.split('\n')) {
          if (!ln.startsWith('data: ')) continue;
          const data = ln.slice(6).trim();
          if (data === '[DONE]') {
            handlers.onDone && handlers.onDone();
            return;
          }
          try {
            const obj = JSON.parse(data);
            handlers.onEvent && handlers.onEvent(obj);
          } catch (_) { /* swallow malformed */ }
        }
      }
    }
    handlers.onDone && handlers.onDone();
  })();
  return { abort: () => ctrl.abort(), done };
}
