import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface DebugPanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  colorClass: string;
}

export default function DebugPanel({ title, icon, children, colorClass }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${isOpen ? 'shadow-md' : 'shadow-sm'} bg-white`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${colorClass} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50">{children}</div>
      )}
    </div>
  );
}
