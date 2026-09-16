"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import { AuthUser, AuthResponse } from "@/lib/types/api";

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
  loginWithCredentials: (email: string, password: string) => Promise<AuthResponse>;
  registerWithCredentials: (payload: {
    email: string;
    password: string;
    displayName: string;
    role?: string;
  }) => Promise<AuthResponse>;
  googleLogin: (payload?: {
    credential?: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
  }) => Promise<AuthResponse>;
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

  // Khôi phục phiên từ localStorage khi load trang và kiểm tra token với backend
  useEffect(() => {
    const savedToken = localStorage.getItem("viet_stylist_auth_token");
    const savedUser = localStorage.getItem("viet_stylist_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));

        // Kiểm tra tính hợp lệ của token với /api/auth/me
        api.getMe()
          .then((meUser) => {
            const mapped = mapAuthUserToUser(meUser);
            setUser(mapped);
            localStorage.setItem("viet_stylist_user", JSON.stringify(mapped));
          })
          .catch((err) => {
            console.warn("Phiên đăng nhập hết hạn hoặc không hợp lệ:", err?.message);
            // Nếu lỗi 401 hoặc xác thực thất bại
            if (err?.statusCode === 401) {
              logout();
            }
          });
      } catch {
        logout();
      }
    }
  }, []);

  const handleAuthSuccess = (res: AuthResponse): User => {
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
    email?: string;
    display_name?: string;
    avatar_url?: string;
  }): Promise<AuthResponse> => {
    if (!payload?.credential) {
      throw new Error("Đăng nhập Google chưa sẵn sàng. Vui lòng dùng email và mật khẩu.");
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

  const quickDemoLogin = async (role: "admin" | "stylist" | "user"): Promise<void> => {
    setIsLoading(true);
    const credentials = {
      admin: { email: "admin@vietstylist.vn", password: "admin123" },
      stylist: { email: "stylist@vietstylist.vn", password: "stylist123" },
      user: { email: "user@vietstylist.vn", password: "user123" },
    }[role];

    try {
      const res = await api.login(credentials);
      handleAuthSuccess(res);
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm tương thích ngược với các component cũ
  const login = async (userIdOrEmail: string = "user_sinh_vien_01", role: string = "user"): Promise<void> => {
    if (role === "admin" || userIdOrEmail.includes("admin")) {
      await quickDemoLogin("admin");
    } else if (role === "stylist" || userIdOrEmail.includes("stylist")) {
      await quickDemoLogin("stylist");
    } else {
      await quickDemoLogin("user");
    }
  };

  const logout = () => {
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
