import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('auth_token'),
    username: localStorage.getItem('auth_username'),
    isAuthenticated: !!localStorage.getItem('auth_token'),
  });

  useEffect(() => {
    if (state.token) {
      localStorage.setItem('auth_token', state.token);
      localStorage.setItem('auth_username', state.username || '');
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_username');
    }
  }, [state.token, state.username]);

  const login = async (username: string, password: string) => {
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(body.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_username', data.username);
    setState({ token: data.token, username: data.username, isAuthenticated: true });
  };

  const logout = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/api/auth/logout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
        },
      );
    } catch {
      // ignore
    }
    setState({ token: null, username: null, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
