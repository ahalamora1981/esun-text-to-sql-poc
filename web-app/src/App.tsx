import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { useSession } from './hooks/useSession';
import { useChat } from './hooks/useChat';
import { dataApi } from './api/client';

function ChatPage() {
  const { currentSessionId, createSession, refreshSessions } = useSession();
  const { messages, isStreaming, loadMessages, clearMessages, send } = useChat(currentSessionId, refreshSessions);
  const [debugMode, setDebugMode] = useState(true);

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      clearMessages();
    }
  }, [currentSessionId, loadMessages, clearMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      let sid = currentSessionId;
      if (!sid) {
        sid = await createSession();
        await loadMessages(sid);
      }
      send(text, debugMode, sid);
    },
    [currentSessionId, createSession, loadMessages, send, debugMode],
  );

  const handleCommand = useCallback(
    async (text: string) => {
      if (text === '/tables') {
        try {
          const tables = await dataApi.getTables();
          const content =
            '**数据库中包含以下 ' +
            tables.length +
            ' 张表：**\n' +
            tables.map((t, i) => i + 1 + '. `' + t.name + '`: ' + t.description).join('\n');
          await handleSend(content);
        } catch {
          await handleSend('获取表信息失败。');
        }
        return;
      }
      if (text === '/schema') {
        try {
          const res = await dataApi.getSchema();
          await handleSend('已获取完整表结构：\n\n```sql\n' + res.ddl + '\n```');
        } catch {
          await handleSend('获取表结构失败。');
        }
        return;
      }
      if (text === '/clear') {
        return;
      }
      handleSend(text);
    },
    [handleSend],
  );

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans">
      <Sidebar
        debugMode={debugMode}
        onToggleDebug={() => setDebugMode((v) => !v)}
        onSendCommand={handleCommand}
      />
      <ChatArea
        messages={messages}
        isStreaming={isStreaming}
        onSend={handleSend}
        debugMode={debugMode}
      />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <ChatPage />;
}
