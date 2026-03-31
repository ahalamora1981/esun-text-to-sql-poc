import { Bot, Loader2 } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-4 max-w-3xl animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
        <Bot size={18} className="text-slate-600" />
      </div>
      <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Agent 正在解析语义并生成 SQL...
      </div>
    </div>
  );
}
