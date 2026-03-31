import { useState, useRef, useEffect } from 'react';
import { Send, Database, HelpCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import type { Message } from '../hooks/useChat';

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  debugMode: boolean;
}

export default function ChatArea({
  messages,
  isStreaming,
  onSend,
  debugMode,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setInputValue('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 flex items-center px-4 justify-between bg-white z-10">
        <div className="flex items-center gap-2 text-slate-700 font-semibold md:hidden">
          <Database size={18} className="text-slate-900" /> Matrix VC Assistant
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            数据库已连接 (SQLite)
          </span>
          {debugMode && (
            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200">
              Debug
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400">
              <Database size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">输入您的问题开始查询</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} debugMode={debugMode} />
        ))}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400 transition-all">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="用自然语言提问，例如：星辰基金上一季度总收入是多少？"
            className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 resize-none py-2 px-3 text-sm text-slate-700 placeholder:text-slate-400"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition-colors shrink-0 mb-0.5"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-center text-xs text-slate-400">
          通过大模型将自然语言转换为 SQL 查询，数据准确性取决于底层数据库。
        </div>
      </div>
    </div>
  );
}
