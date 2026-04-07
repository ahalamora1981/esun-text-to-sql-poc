import { useState, useRef, useEffect } from 'react';
import { Send, Database, HelpCircle, Sparkles } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full relative"
      style={{ backgroundColor: '#1f1633' }}
    >
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(106, 95, 193, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(106, 95, 193, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }}
      />

      {/* Ambient glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#6a5fc1] opacity-5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-[#c2ef4e] opacity-[0.02] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div 
        className="h-16 flex items-center px-6 justify-between relative z-10"
        style={{ 
          backgroundColor: 'rgba(21, 15, 35, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #362d59'
        }}
      >
        <div className="flex items-center gap-3 md:hidden">
          <div 
            className="p-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #6a5fc1 0%, #422082 100%)'
            }}
          >
            <Database size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold">Matrix VC</span>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-[0.2px]"
            style={{
              backgroundColor: 'rgba(194, 239, 78, 0.15)',
              border: '1px solid rgba(194, 239, 78, 0.3)',
              color: '#c2ef4e'
            }}
          >
            <span 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#c2ef4e' }}
            />
            SQLite Connected
          </span>
          {debugMode && (
            <span 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-[0.2px]"
              style={{
                backgroundColor: 'rgba(106, 95, 193, 0.15)',
                border: '1px solid rgba(106, 95, 193, 0.3)',
                color: '#6a5fc1'
              }}
            >
              Debug Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            className="p-2 rounded-lg transition-all"
            style={{ color: '#e5e7eb' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#6a5fc1';
              e.currentTarget.style.backgroundColor = 'rgba(106, 95, 193, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#e5e7eb';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scroll-smooth relative z-10">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center" style={{ color: '#e5e7eb', opacity: 0.4 }}>
              <div 
                className="mx-auto mb-6 w-20 h-20 rounded-[18px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(106, 95, 193, 0.2) 0%, rgba(66, 32, 130, 0.2) 100%)',
                  border: '1px solid rgba(106, 95, 193, 0.3)'
                }}
              >
                <Database size={40} style={{ color: '#6a5fc1', opacity: 0.6 }} />
              </div>
              <p className="text-sm mb-2">输入您的问题开始查询</p>
              <p className="text-xs" style={{ opacity: 0.6 }}>
                支持自然语言转 SQL，实时数据分析
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Sparkles size={14} className="text-[#c2ef4e]" />
                <span className="text-xs text-[#c2ef4e] uppercase tracking-[0.2px]">AI Powered</span>
              </div>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} debugMode={debugMode} />
        ))}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input */}
      <div 
        className="px-4 sm:px-6 py-4 relative z-10"
        style={{
          backgroundColor: 'rgba(21, 15, 35, 0.95)',
          borderTop: '1px solid #362d59'
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div 
            className="relative flex items-end gap-2 rounded-xl p-2 transition-all"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #362d59',
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="用自然语言提问，例如：星辰基金上一季度总收入是多少？"
              className="flex-1 min-h-[44px] max-h-32 bg-transparent border-none focus:outline-none resize-none py-2.5 px-3 text-sm"
              style={{ 
                color: '#ffffff',
                lineHeight: 1.5
              }}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              className="p-2.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
              style={{
                backgroundColor: inputValue.trim() && !isStreaming ? '#c2ef4e' : 'rgba(255, 255, 255, 0.1)',
                color: inputValue.trim() && !isStreaming ? '#1f1633' : '#e5e7eb',
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isStreaming) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(194, 239, 78, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 text-center">
            <p 
              className="text-xs uppercase tracking-[0.25px]"
              style={{ color: '#e5e7eb', opacity: 0.4 }}
            >
              通过大模型将自然语言转换为 SQL 查询
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
