import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../../types';
import api from '../../lib/api';
import { DEMO_USER, activateDemoMode, deactivateDemoMode, isDemoMode } from '../../lib/demo';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
}

interface AuthContextValue extends AuthState {
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  loginDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Demo mode — skip the network call entirely
    if (isDemoMode()) {
      setUser(DEMO_USER);
      setIsDemo(true);
      setIsLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const loginDemo = () => {
    activateDemoMode();
    setUser(DEMO_USER);
    setIsDemo(true);
  };

  const logout = async () => {
    if (isDemo) {
      deactivateDemoMode();
      setUser(null);
      setIsDemo(false);
      return;
    }
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, isDemo, setUser, logout, loginDemo }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
