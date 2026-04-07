import { useState, useCallback, useEffect } from 'react';
import { sessionApi } from '../api/client';

export interface SessionSummary {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useSession() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await sessionApi.list();
      setSessions(list);
    } catch {
      // ignore
    }
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    setLoading(true);
    try {
      const res = await sessionApi.create();
      setCurrentSessionId(res.session_id);
      await refreshSessions();
      return res.session_id;
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  const switchSession = useCallback(
    (id: string) => {
      setCurrentSessionId(id);
    },
    [],
  );

  const deleteCurrentSession = useCallback(async () => {
    if (!currentSessionId) return;
    setLoading(true);
    try {
      await sessionApi.delete(currentSessionId);
      setCurrentSessionId(null);
      await refreshSessions();
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, refreshSessions]);

  const deleteSession = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await sessionApi.delete(id);
        if (currentSessionId === id) {
          setCurrentSessionId(null);
        }
        await refreshSessions();
      } finally {
        setLoading(false);
      }
    },
    [currentSessionId, refreshSessions],
  );

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    loading,
    refreshSessions,
    createSession,
    switchSession,
    deleteCurrentSession,
    deleteSession,
  };
}
