import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../../domain/types';
import { api, getStoredAuthToken } from '../../client/api';
import { getPendingOutboxItems } from '../../client/offline/outbox';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeEventId: string | null;
  setActiveEventId: (id: string | null) => void;
  login: (u: string, p: string, remember?: boolean) => Promise<User>;
  logout: (force?: boolean) => Promise<{ pendingBlocked?: boolean }>;
  showPendingLogoutModal: boolean;
  cancelLogout: () => void;
  confirmForceLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showPendingLogoutModal, setShowPendingLogoutModal] = useState(false);

  const refreshUser = async () => {
    try {
      const token = getStoredAuthToken();
      if (token) {
        const me = await api.getMe();
        setUser(me);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (u: string, p: string, remember: boolean = true) => {
    const data = await api.login(u, p, remember);
    setUser(data.user);
    return data.user;
  };

  const logout = async (force: boolean = false) => {
    if (!force) {
      // Check for pending outbox items
      try {
        const pending = await getPendingOutboxItems();
        if (pending.length > 0) {
          setShowPendingLogoutModal(true);
          return { pendingBlocked: true };
        }
      } catch (e) {
        console.warn(e);
      }
    }

    await api.logout();
    setUser(null);
    setActiveEventId(null);
    setShowPendingLogoutModal(false);
    return { pendingBlocked: false };
  };

  const cancelLogout = () => {
    setShowPendingLogoutModal(false);
  };

  const confirmForceLogout = async () => {
    await logout(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeEventId,
        setActiveEventId,
        login,
        logout,
        showPendingLogoutModal,
        cancelLogout,
        confirmForceLogout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
