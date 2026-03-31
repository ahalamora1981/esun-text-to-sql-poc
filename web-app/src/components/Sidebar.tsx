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
    <div className="w-72 bg-white border-r border-slate-200 text-slate-700 flex flex-col z-10 hidden md:flex">
      {/* Logo */}
      <div className="p-5 border-b border-slate-200 flex items-center gap-3">
        <div className="bg-slate-900 p-2 rounded-lg">
          <Database size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-slate-900 font-bold text-lg leading-tight">Matrix VC</h1>
          <p className="text-xs text-slate-500 font-medium">Text-to-SQL PoC</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {/* New Chat Button */}
        <div className="px-3 mb-4">
          <button
            onClick={handleNewSession}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white transition-colors"
          >
            <Plus size={16} />
            新建对话
          </button>
        </div>

        {/* History Sessions */}
        <div className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          历史对话
        </div>
        <div className="space-y-0.5 px-2 max-h-96 overflow-y-auto mb-4">
          {sessions.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 italic">暂无历史对话</div>
          )}
          {sessions.map((s) => (
            <div key={s.session_id} className="relative group">
              <button
                onClick={() => handleSessionClick(s)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors truncate pr-8 ${
                  s.session_id === currentSessionId
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare size={13} className="shrink-0 opacity-50" />
                  <span className="truncate flex-1">
                    {s.title || '新对话'}
                  </span>
                </div>
                {s.updated_at && (
                  <div className="ml-5 text-[10px] text-slate-400 mt-0.5">
                    {formatTime(s.updated_at)}
                  </div>
                )}
              </button>
              <button
                onClick={(e) => handleDeleteClick(e, s.session_id)}
                className="absolute right-1.5 top-1.5 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                title="删除对话"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div ref={sessionsEndRef} />
        </div>

        {/* Mock Questions */}
        <div className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          快捷提问
        </div>
        <div className="space-y-0.5 px-2 mb-6">
          {MOCK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onSendCommand(q)}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 transition-colors truncate text-slate-600"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Quick Commands */}
        <div className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          快捷指令
        </div>
        <div className="space-y-0.5 px-2">
          <button
            onClick={() => onSendCommand('/tables')}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 flex items-center gap-2 text-slate-600"
          >
            <TableProperties size={14} /> 查看所有表 (/tables)
          </button>
          <button
            onClick={() => onSendCommand('/schema')}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 flex items-center gap-2 text-slate-600"
          >
            <Code2 size={14} /> 查看表结构 (/schema)
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 flex items-center gap-2 text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} /> 清空会话
          </button>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-slate-200">
        {/* Debug Toggle */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
          <button
            onClick={onToggleDebug}
            className="flex items-center gap-3 cursor-pointer group w-full"
          >
            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${debugMode ? 'bg-slate-900' : 'bg-slate-300'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${debugMode ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors flex items-center gap-2">
              <Terminal size={14} />
              开发者模式 (Debug)
            </span>
          </button>
        </div>

        {/* User Info + Logout */}
        <div className="px-4 py-3 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
              {username?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="truncate">{username}</span>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="absolute inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-72 mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">删除对话</h3>
            <p className="text-sm text-slate-500 mb-5">
              确定要删除这个对话吗？此操作不可撤销。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
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
