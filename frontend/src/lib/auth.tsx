"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User } from "@/types";
import {
  apiLogin,
  apiRegister,
  apiGetMe,
  getReporterToken,
  setReporterToken,
  clearReporterToken,
  isValidReporterJwt,
  REPORTER_TOKEN_KEY,
  REPORTER_AUTH_INVALID_EVENT,
} from "./api";

const REPORTER_SESSION_CHECK_MS = 60_000;

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (name: string, email: string, password?: string, role?: string) => Promise<User>;
  logout: () => void;
  refreshSession: () => Promise<User | null>;
  isAuthenticated: boolean;
  isReporter: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not ready");
  },
  register: async () => {
    throw new Error("AuthProvider not ready");
  },
  logout: () => {},
  refreshSession: async () => null,
  isAuthenticated: false,
  isReporter: false,
});

function isStrictReporterUser(user: User | null | undefined): user is User {
  if (!user) return false;
  if (user.aud && user.aud !== "reporter") return false;
  return user.role === "student" || user.role === "faculty";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const validateSession = useCallback(async (): Promise<User | null> => {
    const storedToken = getReporterToken();
    if (!storedToken || !isValidReporterJwt(storedToken)) {
      if (storedToken) clearReporterToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await apiGetMe();
      if (isStrictReporterUser(res?.user) && res.user.aud === "reporter") {
        setToken(storedToken);
        setUser(res.user);
        setLoading(false);
        return res.user;
      }
      clearReporterToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    } catch {
      clearReporterToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    void validateSession();

    const intervalId = window.setInterval(() => {
      void validateSession();
    }, REPORTER_SESSION_CHECK_MS);

    const handleFocus = () => {
      void validateSession();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void validateSession();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === REPORTER_TOKEN_KEY || e.key === null) {
        void validateSession();
      }
    };
    const handleInvalid = () => {
      clearReporterToken();
      setToken(null);
      setUser(null);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(REPORTER_AUTH_INVALID_EVENT, handleInvalid);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(REPORTER_AUTH_INVALID_EVENT, handleInvalid);
    };
  }, [validateSession]);

  const login = useCallback(async (email: string, password?: string): Promise<User> => {
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      const jwt = res.access_token || res.token;
      if (!jwt || !isValidReporterJwt(jwt) || !isStrictReporterUser(res.user)) {
        clearReporterToken();
        setToken(null);
        setUser(null);
        throw new Error("Reporter account credentials required");
      }
      setReporterToken(jwt);
      setToken(jwt);
      setUser({ ...res.user, aud: "reporter" });
      return res.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password?: string, role: string = "student"): Promise<User> => {
      setLoading(true);
      try {
        const safeRole = role === "faculty" ? "faculty" : "student";
        const res = await apiRegister(name, email, password, safeRole);
        const jwt = res.access_token || res.token;
        if (!jwt || !isValidReporterJwt(jwt) || !isStrictReporterUser(res.user)) {
          clearReporterToken();
          setToken(null);
          setUser(null);
          throw new Error("Registration did not return a valid reporter session");
        }
        setReporterToken(jwt);
        setToken(jwt);
        setUser({ ...res.user, aud: "reporter" });
        return res.user;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearReporterToken();
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshSession: validateSession,
        isAuthenticated: !!user && isStrictReporterUser(user),
        isReporter: isStrictReporterUser(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
