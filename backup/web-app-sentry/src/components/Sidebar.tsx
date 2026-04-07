import { useState, useEffect, useRef } from 'react';
import {
  Database,
  Code2,
  Terminal,
  Trash2,
  TableProperties,
  Plus,
  MessageSquare,
  LogOut,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../hooks/useSession';
import type { SessionSummary } from '../hooks/useSession';

interface SidebarProps {
  debugMode: boolean;
  onToggleDebug: () => void;
  onSendCommand: (text: string) => void;
}

const MOCK_QUESTIONS = [
  '星辰基金2024上半年的收益率是多少？',
  '哪些企业本季度净利润增长率最高？',
  '国盛保险的实缴总额是多少？',
  '今天北京天气怎么样？ (测试拦截)',
];

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export default function Sidebar({ debugMode, onToggleDebug, onSendCommand }: SidebarProps) {
  const { username, logout } = useAuth();
  const {
    sessions,
    currentSessionId,
    loading,
    createSession,
    switchSession,
    deleteCurrentSession,
    deleteSession,
  } = useSession();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sessionsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions]);

  const handleNewSession = async () => {
    if (loading) return;
    await createSession();
  };

  const handleClear = async () => {
    await deleteCurrentSession();
  };

  const handleSessionClick = (session: SessionSummary) => {
    if (session.session_id !== currentSessionId) {
      switchSession(session.session_id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteSession(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  return (
    <div 
      className="w-80 flex flex-col z-10 hidden md:flex relative"
      style={{
        backgroundColor: '#150f23',
        borderRight: '1px solid #362d59',
      }}
    >
      {/* Ambient top glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#6a5fc1]/10 to-transparent pointer-events-none" />

      {/* Logo */}
      <div 
        className="p-5 flex items-center gap-3 relative z-10"
        style={{ borderBottom: '1px solid #362d59' }}
      >
        <div 
          className="p-2.5 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #6a5fc1 0%, #422082 100%)',
            boxShadow: 'rgba(22, 15, 36, 0.9) 0px 4px 12px 4px',
          }}
        >
          <Database size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 
            className="text-white font-bold text-lg leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Matrix VC
          </h1>
          <p className="text-xs text-[#e5e7eb]/60 font-medium uppercase tracking-[0.2px]">
            Text-to-SQL
          </p>
        </div>
        <Sparkles size={16} className="text-[#c2ef4e] animate-pulse-lime" />
      </div>

      <div className="flex-1 overflow-y-auto py-4 relative z-10">
        {/* New Chat Button */}
        <div className="px-4 mb-5">
          <button
            onClick={handleNewSession}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.2px] rounded-[13px] text-white transition-all disabled:opacity-50"
            style={{
              backgroundColor: '#79628c',
              border: '1px solid #584674',
              boxShadow: 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.18) 0px 0.5rem 1.5rem';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Plus size={16} />
            新建对话
          </button>
        </div>

        {/* History Sessions */}
        <div className="px-4 mb-3">
          <div 
            className="text-[10px] font-semibold uppercase tracking-[0.25px] mb-2 flex items-center gap-2"
            style={{ color: '#e5e7eb', opacity: 0.6 }}
          >
            <MessageSquare size={12} />
            历史对话
          </div>
        </div>
        <div 
          className="space-y-1 px-3 max-h-80 overflow-y-auto mb-5"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: '#362d59 #150f23'
          }}
        >
          {sessions.length === 0 && (
            <div 
              className="px-3 py-3 text-xs italic text-center rounded-lg"
              style={{ color: '#e5e7eb', opacity: 0.4 }}
            >
              暂无历史对话
            </div>
          )}
          {sessions.map((s) => (
            <div key={s.session_id} className="relative group">
              <button
                onClick={() => handleSessionClick(s)}
                className="w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all truncate pr-8"
                style={{
                  backgroundColor: s.session_id === currentSessionId ? 'rgba(106, 95, 193, 0.25)' : 'transparent',
                  color: s.session_id === currentSessionId ? '#ffffff' : '#e5e7eb',
                  fontWeight: s.session_id === currentSessionId ? 500 : 400,
                  border: s.session_id === currentSessionId ? '1px solid rgba(106, 95, 193, 0.5)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (s.session_id !== currentSessionId) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (s.session_id !== currentSessionId) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare 
                    size={13} 
                    className="shrink-0" 
                    style={{ 
                      opacity: s.session_id === currentSessionId ? 1 : 0.5,
                      color: s.session_id === currentSessionId ? '#c2ef4e' : undefined
                    }} 
                  />
                  <span className="truncate flex-1">
                    {s.title || '新对话'}
                  </span>
                </div>
                {s.updated_at && (
                  <div 
                    className="ml-5 text-[10px] mt-1 uppercase tracking-[0.25px]"
                    style={{ color: '#e5e7eb', opacity: 0.4 }}
                  >
                    {formatTime(s.updated_at)}
                  </div>
                )}
              </button>
              <button
                onClick={(e) => handleDeleteClick(e, s.session_id)}
                className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: '#e5e7eb', opacity: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fa7faa';
                  e.currentTarget.style.backgroundColor = 'rgba(250, 127, 170, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#e5e7eb';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="删除对话"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div ref={sessionsEndRef} />
        </div>

        {/* Mock Questions */}
        <div className="px-4 mb-3">
          <div 
            className="text-[10px] font-semibold uppercase tracking-[0.25px] mb-2 flex items-center gap-2"
            style={{ color: '#e5e7eb', opacity: 0.6 }}
          >
            <Zap size={12} />
            快捷提问
          </div>
        </div>
        <div className="space-y-1 px-3 mb-6">
          {MOCK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onSendCommand(q)}
              className="w-full text-left px-3 py-2 text-sm rounded-lg transition-all truncate"
              style={{ color: '#e5e7eb', opacity: 0.85 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(194, 239, 78, 0.1)';
                e.currentTarget.style.color = '#c2ef4e';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#e5e7eb';
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Quick Commands */}
        <div className="px-4 mb-3">
          <div 
            className="text-[10px] font-semibold uppercase tracking-[0.25px] mb-2 flex items-center gap-2"
            style={{ color: '#e5e7eb', opacity: 0.6 }}
          >
            <Terminal size={12} />
            快捷指令
          </div>
        </div>
        <div className="space-y-1 px-3">
          <button
            onClick={() => onSendCommand('/tables')}
            className="w-full text-left px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-2"
            style={{ color: '#e5e7eb' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#6a5fc1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#e5e7eb';
            }}
          >
            <TableProperties size={14} /> 查看所有表 (/tables)
          </button>
          <button
            onClick={() => onSendCommand('/schema')}
            className="w-full text-left px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-2"
            style={{ color: '#e5e7eb' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#6a5fc1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#e5e7eb';
            }}
          >
            <Code2 size={14} /> 查看表结构 (/schema)
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="w-full text-left px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
            style={{ color: '#fa7faa' }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'rgba(250, 127, 170, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} /> 清空会话
          </button>
        </div>
      </div>

      {/* Bottom Section */}
      <div 
        className="relative z-10"
        style={{ 
          borderTop: '1px solid #362d59',
          backgroundColor: 'rgba(21, 15, 35, 0.95)'
        }}
      >
        {/* Debug Toggle */}
        <div 
          className="px-4 py-3"
          style={{ 
            borderBottom: '1px solid #362d59',
            backgroundColor: 'rgba(106, 95, 193, 0.08)'
          }}
        >
          <button
            onClick={onToggleDebug}
            className="flex items-center gap-3 cursor-pointer group w-full"
          >
            <div
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                backgroundColor: debugMode ? '#6a5fc1' : '#362d59'
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm"
                style={{
                  transform: debugMode ? 'translateX(18px)' : 'translateX(4px)'
                }}
              />
            </div>
            <span 
              className="text-sm font-medium transition-colors flex items-center gap-2 uppercase tracking-[0.2px]"
              style={{ color: debugMode ? '#c2ef4e' : '#e5e7eb' }}
            >
              <Terminal size={14} />
              开发者模式
            </span>
          </button>
        </div>

        {/* User Info + Logout */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: 'rgba(106, 95, 193, 0.3)',
                color: '#c2ef4e',
                border: '1px solid rgba(194, 239, 78, 0.3)'
              }}
            >
              {username?.charAt(0).toUpperCase() || '?'}
            </div>
            <span 
              className="truncate font-medium"
              style={{ color: '#e5e7eb' }}
            >
              {username}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg transition-all"
            style={{ color: '#e5e7eb' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fa7faa';
              e.currentTarget.style.backgroundColor = 'rgba(250, 127, 170, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#e5e7eb';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(21, 15, 35, 0.8)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            className="rounded-xl p-6 w-80 mx-4"
            style={{
              backgroundColor: '#1f1633',
              border: '1px solid #362d59',
              boxShadow: 'rgba(0, 0, 0, 0.3) 0px 20px 40px -10px'
            }}
          >
            <h3 className="text-base font-semibold text-white mb-2">删除对话</h3>
            <p className="text-sm mb-5" style={{ color: '#e5e7eb', opacity: 0.7 }}>
              确定要删除这个对话吗？此操作不可撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                style={{ 
                  color: '#e5e7eb',
                  border: '1px solid #362d59'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-bold uppercase tracking-[0.2px] rounded-lg transition-all text-white"
                style={{ backgroundColor: '#fa7faa' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff8fb8';
                  e.currentTarget.style.boxShadow = 'rgba(250, 127, 170, 0.4) 0px 4px 12px';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fa7faa';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
