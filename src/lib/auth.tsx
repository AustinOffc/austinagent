'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getStoredRefreshToken, logoutRequest, onSession, refreshSession } from './api';

interface AuthState {
  status: 'loading' | 'authed' | 'anon';
  username: string | null;
}

interface AuthContextValue {
  state: AuthState;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: 'loading', username: null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const off = onSession((s) => {
      clearTimeout(timer.current);
      if (s) {
        setState({ status: 'authed', username: s.owner.username });
        // Perbarui access token sedikit sebelum habis (minimal 5 detik lagi).
        timer.current = setTimeout(() => void refreshSession(), Math.max((s.expires_in - 60) * 1000, 5000));
      } else {
        setState({ status: 'anon', username: null });
      }
    });
    (async () => {
      if (getAccessToken()) return;
      if (!getStoredRefreshToken()) {
        setState({ status: 'anon', username: null });
        return;
      }
      const ok = await refreshSession();
      if (!ok && !getAccessToken()) setState((cur) => (cur.status === 'loading' ? { status: 'anon', username: null } : cur));
    })();
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, []);

  const logout = async () => {
    await logoutRequest();
    router.replace('/login');
  };

  return <AuthContext.Provider value={{ state, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
