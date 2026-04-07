import { Bot, Loader2, Sparkles } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-4 max-w-4xl mx-auto">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          backgroundColor: 'rgba(194, 239, 78, 0.15)',
          border: '1px solid rgba(194, 239, 78, 0.3)'
        }}
      >
        <Bot size={18} style={{ color: '#c2ef4e' }} />
      </div>

      {/* Loading bubble */}
      <div 
        className="flex items-center gap-3 px-5 py-3 rounded-[18px] rounded-tl-[4px]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <Loader2 size={16} className="animate-spin" style={{ color: '#6a5fc1' }} />
        <span 
          className="text-sm flex items-center gap-2"
          style={{ color: '#e5e7eb', opacity: 0.7 }}
        >
          Agent 正在解析语义并生成 SQL
          <Sparkles size={12} className="text-[#c2ef4e] animate-pulse" />
        </span>
      </div>
    </div>
  );
}
