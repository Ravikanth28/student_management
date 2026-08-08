import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginResponse, Role } from '../types';

type AuthContextValue = {
  token: string | null;
  username: string | null;
  name: string | null;
  /** Display name if set, otherwise the username. */
  displayName: string | null;
  photoUrl: string | null;
  role: Role | null;
  studentId: number | null;
  staffProfile: any | null;
  login: (payload: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'student-portal-auth';

/** Decode the (untrusted) JWT payload just to read name/username/role for the UI.
 *  The server still verifies the token on every request. */
function decodeToken(token: string | null): { username: string | null; name: string | null; role: Role | null; studentId: number | null; photoUrl: string | null; staffProfile: any | null } {
  if (!token) return { username: null, name: null, role: null, studentId: null, photoUrl: null, staffProfile: null };
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return { 
      username: payload.username ?? null, 
      name: payload.name ?? null, 
      role: (payload.role as Role) ?? null,
      studentId: payload.student_id ? Number(payload.student_id) : null,
      photoUrl: payload.photo_url ?? null,
      staffProfile: payload.staff_profile ?? null,
    };
  } catch {
    return { username: null, name: null, role: null, studentId: null, photoUrl: null, staffProfile: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  const value = useMemo<AuthContextValue>(() => {
    const { username, name, role, studentId, photoUrl, staffProfile } = decodeToken(token);
    return {
      token,
      username,
      name,
      displayName: name || username,
      photoUrl,
      role,
      studentId,
      staffProfile,
      login: (payload) => setToken(payload.token),
      logout: () => setToken(null),
      isAuthenticated: Boolean(token),
    };
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
