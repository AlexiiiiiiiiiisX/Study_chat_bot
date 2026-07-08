"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, clearAccessToken, getAccessToken } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!getAccessToken()) {
        await authApi.refresh();
      }
      const currentUser = await authApi.me();
      setUser(currentUser);
    } catch (err) {
      clearAccessToken();
      setUser(null);
      setError(err instanceof Error ? err.message : "No se pudo validar la sesión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadUser();
  }, [reloadUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      async login(email, password) {
        setError(null);
        await authApi.login(email, password);
        await reloadUser();
      },
      async register(email, password) {
        setError(null);
        const response = await authApi.register(email, password);
        return response.msg;
      },
      async logout() {
        setError(null);
        try {
          await authApi.logout();
        } finally {
          setUser(null);
          clearAccessToken();
        }
      },
      reloadUser
    }),
    [error, loading, reloadUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
