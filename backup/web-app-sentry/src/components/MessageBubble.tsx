import { Bot, User, AlertCircle, Code2, TableProperties, Loader2, Sparkles } from 'lucide-react';
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
  const isLoading = !msg.content || msg.content === '正在执行查询...' || msg.content === '正在分析查询结果...' || msg.content === '正在生成回答...';

  return (
    <div className={`flex gap-4 max-w-4xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          backgroundColor: isUser 
            ? '#6a5fc1' 
            : isError 
              ? 'rgba(250, 127, 170, 0.2)' 
              : 'rgba(194, 239, 78, 0.15)',
          border: isUser 
            ? '1px solid rgba(106, 95, 193, 0.5)' 
            : isError 
              ? '1px solid rgba(250, 127, 170, 0.4)' 
              : '1px solid rgba(194, 239, 78, 0.3)',
          boxShadow: isUser 
            ? '0 4px 12px rgba(106, 95, 193, 0.3)' 
            : 'none'
        }}
      >
        {isUser ? (
          <User size={18} style={{ color: '#ffffff' }} />
        ) : isError ? (
          <AlertCircle size={18} style={{ color: '#fa7faa' }} />
        ) : (
          <Bot size={18} style={{ color: '#c2ef4e' }} />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message Bubble */}
        <div
          className="px-5 py-3.5 text-[15px] leading-relaxed"
          style={{
            backgroundColor: isUser 
              ? '#6a5fc1' 
              : isError 
                ? 'rgba(250, 127, 170, 0.1)' 
                : 'rgba(255, 255, 255, 0.08)',
            border: isUser 
              ? '1px solid rgba(106, 95, 193, 0.5)' 
              : isError 
                ? '1px solid rgba(250, 127, 170, 0.3)' 
                : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            color: isUser ? '#ffffff' : isError ? '#fa7faa' : '#e5e7eb',
            boxShadow: isUser 
              ? '0 4px 16px rgba(106, 95, 193, 0.25)' 
              : '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: '#6a5fc1' }} />
              <span style={{ color: '#e5e7eb', opacity: 0.7 }}>{msg.content || '思考中...'}</span>
            </span>
          ) : (
            <div 
              dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
              className="prose prose-invert prose-sm max-w-none"
              style={{
                '--tw-prose-body': '#e5e7eb',
                '--tw-prose-headings': '#ffffff',
                '--tw-prose-links': '#c2ef4e',
                '--tw-prose-code': '#dcdcaa',
                '--tw-prose-pre-bg': '#150f23',
                '--tw-prose-pre-border': '#362d59',
              } as React.CSSProperties}
            />
          )}
        </div>

        {/* Debug Panels */}
        {!isUser && debugMode && msg.metadata && (
          <div className="w-full mt-2 space-y-2">
            {/* Thought Process */}
            {msg.metadata.thought && (
              <div 
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: 'rgba(106, 95, 193, 0.08)',
                  border: '1px solid rgba(106, 95, 193, 0.2)',
                  color: '#e5e7eb'
                }}
              >
                <Sparkles size={12} className="mt-0.5 shrink-0 text-[#c2ef4e]" />
                <span className="break-all font-mono opacity-80">{msg.metadata.thought}</span>
              </div>
            )}

            {/* SQL Panel */}
            {msg.metadata.sql && (
              <DebugPanel
                title="Generated SQL"
                icon={<Code2 size={14} />}
                colorClass="text-[#e5e7eb]"
              >
                <pre 
                  className="text-xs font-mono overflow-x-auto p-4 whitespace-pre-wrap"
                  style={{ 
                    color: '#dcdcaa',
                    backgroundColor: '#150f23'
                  }}
                >
                  {msg.metadata.sql}
                </pre>
              </DebugPanel>
            )}

            {/* Data Table Panel */}
            {msg.metadata.data && msg.metadata.data.length > 0 && (
              <DebugPanel
                title="Query Results"
                icon={<TableProperties size={14} />}
                colorClass="text-[#e5e7eb]"
              >
                <div className="overflow-x-auto p-2" style={{ backgroundColor: '#150f23' }}>
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #362d59' }}>
                        {Object.keys(msg.metadata.data[0]).map((key) => (
                          <th
                            key={key}
                            className="py-2 px-3 font-semibold uppercase tracking-[0.2px]"
                            style={{ 
                              color: '#c2ef4e',
                              backgroundColor: 'rgba(194, 239, 78, 0.05)'
                            }}
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.metadata!.data!.map((row, i) => (
                        <tr
                          key={i}
                          style={{ 
                            borderBottom: i < (msg.metadata!.data!.length - 1) ? '1px solid rgba(54, 45, 89, 0.5)' : 'none'
                          }}
                        >
                          {Object.values(row).map((val, j) => (
                            <td 
                              key={j} 
                              className="py-2 px-3"
                              style={{ color: '#e5e7eb' }}
                            >
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
