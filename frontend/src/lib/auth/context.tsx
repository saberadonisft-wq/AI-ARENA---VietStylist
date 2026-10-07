"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { AuthUser, AuthResponse } from "@/lib/types/api";
import { clearLegacyOutfitStorage } from "@/features/studio/deviceStorage";

export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  avatarUrl?: string | null;
  authProvider?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isStylist: boolean;
  isEditor: boolean;
  isLoading: boolean;
  isReady: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<AuthResponse>;
  registerWithCredentials: (payload: {
    email: string;
    password: string;
    displayName: string;
    role?: string;
  }) => Promise<AuthResponse>;
  googleLogin: (payload?: { credential?: string }) => Promise<AuthResponse>;
  quickDemoLogin: (role: "admin" | "stylist" | "user") => Promise<void>;
  login: (userIdOrEmail?: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  isAdmin: false,
  isStylist: false,
  isEditor: false,
  isLoading: false,
  isReady: false,
  loginWithCredentials: async () => {
    throw new Error("AuthProvider not found");
  },
  registerWithCredentials: async () => {
    throw new Error("AuthProvider not found");
  },
  googleLogin: async () => {
    throw new Error("AuthProvider not found");
  },
  quickDemoLogin: async () => {},
  login: async () => {},
  logout: () => {},
});

function mapAuthUserToUser(authUser: AuthUser): User {
  return {
    id: authUser.id,
    email: authUser.email,
    displayName: authUser.display_name || authUser.email.split("@")[0],
    roles: authUser.roles || ["user"],
    avatarUrl: authUser.avatar_url,
    authProvider: authUser.auth_provider,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const authGeneration = useRef(0);
  const restoredToken = useRef<string | null>(null);

  // Remove retired outfit caches, then restore identity and observe other tabs.
  useEffect(() => {
    clearLegacyOutfitStorage();
    let cancelled = false;
    const restore = async () => {
      const generation = ++authGeneration.current;
      try {
        const savedToken = localStorage.getItem("viet_stylist_auth_token");
        const savedUser = localStorage.getItem("viet_stylist_user");
        // A focus refresh of the same account must not unmount its active forms.
        if (savedToken !== restoredToken.current) setIsReady(false);
        restoredToken.current = savedToken;
        if (!savedToken || !savedUser) {
          setToken(null);
          setUser(null);
          return;
        }
        const cached = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(cached);
        try {
          const mapped = mapAuthUserToUser(await api.getMe());
          if (cancelled || generation !== authGeneration.current || localStorage.getItem("viet_stylist_auth_token") !== savedToken) return;
          setUser(mapped);
          localStorage.setItem("viet_stylist_user", JSON.stringify(mapped));
        } catch (err: any) {
          if (cancelled || generation !== authGeneration.current || localStorage.getItem("viet_stylist_auth_token") !== savedToken) return;
          if (err?.statusCode === 401) {
            setToken(null);
            setUser(null);
            localStorage.removeItem("viet_stylist_auth_token");
            localStorage.removeItem("viet_stylist_user");
          }
        }
      } catch {
        if (!cancelled && generation === authGeneration.current) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled && generation === authGeneration.current) setIsReady(true);
      }
    };
    void restore();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "viet_stylist_auth_token") void restore();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => { void restore(); };
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, []);

  const handleAuthSuccess = (res: AuthResponse): User => {
    authGeneration.current++;
    restoredToken.current = res.access_token;
    setIsReady(true);
    const mappedUser = mapAuthUserToUser(res.user);
    setToken(res.access_token);
    setUser(mappedUser);
    localStorage.setItem("viet_stylist_auth_token", res.access_token);
    localStorage.setItem("viet_stylist_user", JSON.stringify(mappedUser));
    return mappedUser;
  };

  const loginWithCredentials = async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      handleAuthSuccess(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithCredentials = async (payload: {
    email: string;
    password: string;
    displayName: string;
    role?: string;
  }): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const res = await api.register({
        email: payload.email,
        password: payload.password,
        display_name: payload.displayName,
        role: payload.role || "user",
      });
      handleAuthSuccess(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (payload?: {
    credential?: string;
  }): Promise<AuthResponse> => {
    if (!payload?.credential) {
      throw new Error("Không nhận được token xác thực từ Google.");
    }
    setIsLoading(true);
    try {
      const res = await api.googleAuth({ credential: payload.credential });
      handleAuthSuccess(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const quickDemoLogin = async (_role?: "admin" | "stylist" | "user"): Promise<void> => {
    throw new Error("Tài khoản demo đã bị gỡ bỏ theo chính sách bảo mật hệ thống.");
  };

  // Hàm tương thích ngược với các component cũ
  const login = async (_userIdOrEmail?: string, _role?: string): Promise<void> => {
    throw new Error("Vui lòng sử dụng phương thức đăng nhập chính thức bằng Google hoặc Email.");
  };

  const logout = () => {
    authGeneration.current++;
    setIsReady(true);
    setToken(null);
    setUser(null);
    localStorage.removeItem("viet_stylist_auth_token");
    localStorage.removeItem("viet_stylist_user");
  };

  const isAdmin = user?.roles?.includes("admin") || false;
  const isStylist = user?.roles?.includes("stylist") || isAdmin;
  const isEditor = user?.roles?.includes("editor") || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isAdmin,
        isStylist,
        isEditor,
        isLoading,
        isReady,
        loginWithCredentials,
        registerWithCredentials,
        googleLogin,
        quickDemoLogin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
