import { Bot, User, AlertCircle, Terminal, Code2, TableProperties, Loader2 } from 'lucide-react';
import DebugPanel from './DebugPanel';
import { formatText } from '../utils/formatText';
import type { Message } from '../hooks/useChat';

interface MessageBubbleProps {
  msg: Message;
  debugMode: boolean;
}

export default function MessageBubble({ msg, debugMode }: MessageBubbleProps) {
  const isUser = msg.role === 'user';
  const isError = msg.content.startsWith('Error:');

  return (
    <div className={`flex gap-4 max-w-4xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${
          isUser
            ? 'bg-slate-900 text-white'
            : isError
              ? 'bg-red-100 text-red-600'
              : 'bg-slate-200 text-slate-600'
        }`}
      >
        {isUser ? (
          <User size={18} />
        ) : isError ? (
          <AlertCircle size={18} />
        ) : (
          <Bot size={18} />
        )}
      </div>

      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`p-4 text-[15px] leading-relaxed shadow-sm ${
            isUser
              ? 'bg-slate-900 text-white rounded-2xl rounded-tr-none'
              : isError
                ? 'bg-red-50 text-red-800 border border-red-200 rounded-2xl rounded-tl-none'
                : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-none'
          }`}
        >
          {isUser ? null : !msg.content || msg.content === '正在执行查询...' || msg.content === '正在分析查询结果...' || msg.content === '正在生成回答...' ? (
            <span className="flex items-center gap-2 text-slate-500">
              <Loader2 size={15} className="animate-spin" />
              {msg.content || '思考中...'}
            </span>
          ) : null}
          {(isUser || (msg.content && msg.content !== '正在执行查询...' && msg.content !== '正在分析查询结果...' && msg.content !== '正在生成回答...')) && (
            <div dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
          )}
        </div>

        {!isUser && debugMode && msg.metadata && (
          <div className="w-full mt-1 space-y-2">
            {msg.metadata.thought && (
              <div className="text-xs text-slate-500 flex items-start gap-1.5 px-1 font-mono">
                <Terminal size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">{msg.metadata.thought}</span>
              </div>
            )}

            {msg.metadata.sql && (
              <DebugPanel
                title="Generated SQL"
                icon={<Code2 size={14} />}
                colorClass="text-slate-700 bg-slate-50 border-slate-200"
              >
                <pre className="text-xs font-mono text-slate-700 overflow-x-auto p-3 whitespace-pre-wrap">
                  {msg.metadata.sql}
                </pre>
              </DebugPanel>
            )}

            {msg.metadata.data && msg.metadata.data.length > 0 && (
              <DebugPanel
                title="Raw Data Result"
                icon={<TableProperties size={14} />}
                colorClass="text-slate-700 bg-slate-50 border-slate-200"
              >
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-left border-collapse text-xs font-mono text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {Object.keys(msg.metadata.data[0]).map((key) => (
                          <th
                            key={key}
                            className="py-2 px-3 font-semibold text-slate-700 bg-slate-100"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.metadata.data.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="py-1.5 px-3">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DebugPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
