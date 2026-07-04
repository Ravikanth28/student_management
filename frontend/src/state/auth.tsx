import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginResponse } from '../types';

type AuthContextValue = {
  token: string | null;
  login: (payload: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'student-portal-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    login: (payload) => setToken(payload.token),
    logout: () => setToken(null),
    isAuthenticated: Boolean(token)
  }), [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
