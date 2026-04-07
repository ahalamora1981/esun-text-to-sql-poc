const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchSSE(
  path: string,
  body: unknown,
  onEvent: (data: any) => void,
  onError?: (err: string) => void,
  onDone?: () => void,
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        window.location.reload();
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const jsonStr = trimmed.slice(6);
            const data = JSON.parse(jsonStr);
            if (data.type === 'done') {
              onDone?.();
              return;
            }
            if (data.type === 'error') {
              onError?.(data.content);
              return;
            }
            onEvent(data);
          } catch {
            // skip malformed lines
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError?.(err.message);
      }
    });

  return controller;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    apiFetch<{ status: string }>('/api/auth/logout', { method: 'POST' }),
};

export const sessionApi = {
  list: () =>
    apiFetch<
      { session_id: string; title: string; created_at: string; updated_at: string }[]
    >('/api/sessions'),
  create: () =>
    apiFetch<{ session_id: string; title: string }>('/api/sessions', {
      method: 'POST',
    }),
  delete: (id: string) =>
    apiFetch<{ status: string }>(`/api/sessions/${id}`, { method: 'DELETE' }),
  updateTitle: (id: string, title: string) =>
    apiFetch<{ status: string }>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  getMessages: (id: string) =>
    apiFetch<
      { id: string; role: string; content: string; metadata: any; created_at: string }[]
    >(`/api/sessions/${id}/messages`),
  saveMessage: (sessionId: string, role: string, content: string, metadata?: any) =>
    apiFetch<{ status: string }>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content, metadata }),
    }),
  summarizeTitle: (id: string) =>
    apiFetch<{ title: string }>(`/api/sessions/${id}/summarize-title`, {
      method: 'POST',
    }),
};

export const dataApi = {
  getTables: () =>
    apiFetch<{ name: string; description: string }[]>('/api/tables'),
  getSchema: () =>
    apiFetch<{ ddl: string }>('/api/schema'),
  health: () => apiFetch<{ status: string }>('/health'),
};
