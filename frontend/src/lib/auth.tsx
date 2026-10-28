"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { User, UserRole } from "@/types";
import { apiLogin, apiRegister, apiGetMe } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password?: string) => Promise<User>;
  register: (name: string, email: string, password?: string, role?: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => { throw new Error("AuthProvider not ready"); },
  register: async () => { throw new Error("AuthProvider not ready"); },
  logout: () => {},
  loading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate existing stored token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("cbb_user");

    if (storedToken) {
      setToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore
        }
      }

      // Verify token with backend
      apiGetMe()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem("cbb_user", JSON.stringify(res.user));
          }
        })
        .catch(() => {
          // Token expired, tampered, or server rejected
          localStorage.removeItem("token");
          localStorage.removeItem("cbb_user");
          setUser(null);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<User> => {
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      localStorage.setItem("token", res.access_token);
      localStorage.setItem("cbb_user", JSON.stringify(res.user));
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password?: string, role: string = "student"): Promise<User> => {
      setLoading(true);
      try {
        const res = await apiRegister(name, email, password, role);
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("cbb_user", JSON.stringify(res.user));
        setToken(res.access_token);
        setUser(res.user);
        return res.user;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("cbb_user");
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
        login,
        register,
        logout,
        loading,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
