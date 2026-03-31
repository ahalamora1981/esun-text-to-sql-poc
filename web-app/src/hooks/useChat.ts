import { useState, useCallback, useRef } from 'react';
import { fetchSSE, sessionApi } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    thought?: string;
    sql?: string;
    data?: Record<string, any>[];
  };
}

const STREAMING_ID = 'streaming-assistant-msg';

export function useChat(sessionId: string | null, onStreamComplete?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isFirstMessageRef = useRef(true);
  const onStreamCompleteRef = useRef(onStreamComplete);
  onStreamCompleteRef.current = onStreamComplete;

  const loadMessages = useCallback(
    async (sid: string) => {
      if (!sid) return;
      try {
        const msgs = await sessionApi.getMessages(sid);
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            metadata: m.metadata || undefined,
          })),
        );
        isFirstMessageRef.current = msgs.length === 0;
      } catch {
        setMessages([]);
        isFirstMessageRef.current = true;
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    isFirstMessageRef.current = true;
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, debugMode: boolean, explicitSessionId?: string | null) => {
      const sid = explicitSessionId ?? sessionId;
      if (!text.trim() || !sid || isStreaming) return;

      const effectiveId: string = sid;

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const sqls: string[] = [];
      const dataResults: any[] = [];
      const thoughts: string[] = [];
      let responseContent = '';

      function updateStreamingMsg(content: string, meta: Message['metadata']) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === STREAMING_ID) {
            return [...prev.slice(0, -1), { id: STREAMING_ID, role: 'assistant' as const, content, metadata: meta }];
          }
          return [...prev, { id: STREAMING_ID, role: 'assistant' as const, content, metadata: meta }];
        });
      }

      function getStreamingMeta(): Message['metadata'] {
        return debugMode
          ? {
              thought: thoughts.join('\n') || undefined,
              sql: sqls.join('\n\n') || undefined,
              data: dataResults.length > 0 ? dataResults : undefined,
            }
          : undefined;
      }

      updateStreamingMsg('思考中...', undefined);

      const controller = fetchSSE(
        '/api/query/stream',
        { message: text, session_id: effectiveId },
        (data) => {
          switch (data.type) {
            case 'ai_tool_call':
              if (data.tool_name === 'execute_sql_tool' && data.args?.query) {
                sqls.push(data.args.query);
                updateStreamingMsg('正在执行查询...', getStreamingMeta());
              }
              break;
            case 'tool_result':
              if (data.tool_name === 'execute_sql_tool') {
                try {
                  const parsed = JSON.parse(data.content);
                  if (Array.isArray(parsed)) dataResults.push(...parsed);
                } catch {
                  // not JSON data
                }
                updateStreamingMsg('正在分析查询结果...', getStreamingMeta());
              }
              break;
            case 'ai_thinking':
              thoughts.push(data.content);
              if (!sqls.length && !dataResults.length) {
                updateStreamingMsg(data.content, getStreamingMeta());
              } else {
                updateStreamingMsg('正在生成回答...', getStreamingMeta());
              }
              break;
            case 'ai_response':
              responseContent = data.content;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].id === STREAMING_ID) {
                  updated[lastIdx] = {
                    id: `msg-${Date.now()}-ai`,
                    role: 'assistant',
                    content: data.content,
                    metadata: getStreamingMeta(),
                  };
                } else {
                  updated.push({
                    id: `msg-${Date.now()}-ai`,
                    role: 'assistant',
                    content: data.content,
                    metadata: getStreamingMeta(),
                  });
                }
                return updated;
              });
              break;
          }
        },
        (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].id === STREAMING_ID) {
              updated[updated.length - 1] = {
                id: `msg-${Date.now()}-err`,
                role: 'assistant',
                content: `Error: ${err}`,
              };
            } else {
              updated.push({
                id: `msg-${Date.now()}-err`,
                role: 'assistant',
                content: `Error: ${err}`,
              });
            }
            return updated;
          });
          setIsStreaming(false);
        },
        async () => {
          setIsStreaming(false);
          onStreamCompleteRef.current?.();

          try {
            await sessionApi.saveMessage(effectiveId, 'user', text);

            const meta = getStreamingMeta();
            await sessionApi.saveMessage(effectiveId, 'assistant', responseContent || '(no response)', meta);

            if (isFirstMessageRef.current) {
              isFirstMessageRef.current = false;
              try {
                const res = await sessionApi.summarizeTitle(effectiveId);
                if (res.title) {
                  await sessionApi.updateTitle(effectiveId, res.title);
                }
              } catch {
                // title generation failed, keep default
              }
            }
          } catch {
            // message save failed, not critical
          }
        },
      );

      abortRef.current = controller;
    },
    [sessionId, isStreaming],
  );

  return { messages, setMessages, isStreaming, loadMessages, clearMessages, send, stopStreaming };
}
