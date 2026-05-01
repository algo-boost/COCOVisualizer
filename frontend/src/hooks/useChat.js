import { useCallback, useRef, useState } from 'react';
import { startChatStream } from '../api/chat.js';

/**
 * 聊天 Hook：维护 messages、当前 conclusion/状态、附件、abort。
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState(null);
  const ctrlRef = useRef(null);

  const send = useCallback(async (payload) => {
    if (streaming) return;
    setStreaming(true);
    setError(null);
    setStatuses([]);
    let conclusion = '';
    const ctrl = startChatStream(payload, {
      onEvent: (ev) => {
        if (ev.type === 'status') setStatuses((s) => [...s, ev.msg || '']);
        else if (ev.type === 'conclusion_start') conclusion = '';
        else if (ev.type === 'conclusion') {
          conclusion += ev.content || '';
          setMessages((prev) => {
            if (!prev.length || prev[prev.length - 1].role !== 'assistant') {
              return [...prev, { role: 'assistant', content: conclusion }];
            }
            const next = prev.slice(0, -1);
            next.push({ ...prev[prev.length - 1], content: conclusion });
            return next;
          });
        } else if (ev.type === 'error') setError(new Error(ev.msg || 'chat error'));
      },
      onDone: () => setStreaming(false),
    });
    ctrlRef.current = ctrl;
    try {
      await ctrl.done;
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
      setStreaming(false);
    }
  }, [streaming]);

  const abort = useCallback(() => {
    ctrlRef.current?.abort();
    setStreaming(false);
  }, []);

  return { messages, streaming, statuses, error, send, abort, setMessages };
}
