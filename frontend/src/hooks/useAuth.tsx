import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  has_calendar: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Promise-chain zamiast async/await — setState tylko w callbackach,
  // zeby wywolanie z efektu nie bylo synchronicznym setState (react-hooks/set-state-in-effect)
  const fetchUser = useCallback((): Promise<void> => {
    return fetch('/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch user:', err);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- utrwalony wzorzec projektu: hook useAuth eksportowany obok AuthProvider z jednego pliku
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
