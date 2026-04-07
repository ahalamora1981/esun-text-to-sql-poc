import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface DebugPanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  colorClass: string;
}

export default function DebugPanel({ title, icon, children, colorClass }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(54, 45, 89, 0.8)',
        boxShadow: isOpen ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-[0.2px] transition-all hover:opacity-80"
        style={{ 
          color: colorClass,
          backgroundColor: 'rgba(21, 15, 35, 0.5)'
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: '#6a5fc1' }}>{icon}</span>
          <span style={{ color: '#e5e7eb' }}>{title}</span>
        </div>
        <span style={{ color: '#6a5fc1' }}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {isOpen && (
        <div style={{ borderTop: '1px solid rgba(54, 45, 89, 0.5)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
