"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  login: (userId?: string, role?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  isAdmin: false,
  isEditor: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Khôi phục phiên từ localStorage nếu có
    const savedToken = localStorage.getItem("viet_stylist_auth_token");
    const savedUser = localStorage.getItem("viet_stylist_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("viet_stylist_auth_token");
        localStorage.removeItem("viet_stylist_user");
      }
    }
  }, []);

  const login = (userId: string = "user_sinh_vien_01", role: string = "user") => {
    const devToken = `dev-user-${userId}`;
    const newUser: User = {
      id: userId,
      email: `${userId}@vietphuc.edu.vn`,
      displayName: role === "admin" ? "Quản trị viên Di sản" : "Học sinh / Sinh viên",
      roles: role === "admin" ? ["admin", "editor", "user"] : [role],
    };
    setToken(devToken);
    setUser(newUser);
    localStorage.setItem("viet_stylist_auth_token", devToken);
    localStorage.setItem("viet_stylist_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("viet_stylist_auth_token");
    localStorage.removeItem("viet_stylist_user");
  };

  const isAdmin = user?.roles.includes("admin") || false;
  const isEditor = user?.roles.includes("editor") || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isAdmin,
        isEditor,
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
