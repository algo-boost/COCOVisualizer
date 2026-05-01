// 通用 API 客户端：所有调用走相对路径，由 Flask（dev 5173 → 6010 代理 / prod 同源）转发。

async function jsonOrThrow(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.error || `HTTP ${res.status}`), {
        status: res.status, data: err,
      });
    }
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(text || `HTTP ${res.status}`), { status: res.status });
  }
  if (contentType.includes('application/json')) return res.json();
  return res;
}

export async function getJSON(url) {
  const res = await fetch(url, { method: 'GET' });
  return jsonOrThrow(res);
}

export async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return jsonOrThrow(res);
}

export async function postForm(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  return jsonOrThrow(res);
}

export async function deleteJSON(url) {
  const res = await fetch(url, { method: 'DELETE' });
  return jsonOrThrow(res);
}

/**
 * 流式 NDJSON 读取：每行一条 JSON，对每行调用 onLine。
 * 用于 /api/export_experiment_dataset?stream=1。
 */
export async function readNDJSON(url, body, onLine) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { onLine(JSON.parse(line)); } catch (_) { /* swallow */ }
    }
  }
  if (buf.trim()) {
    try { onLine(JSON.parse(buf.trim())); } catch (_) { /* swallow */ }
  }
}
