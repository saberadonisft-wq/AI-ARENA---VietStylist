"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import Logo from "@/components/Logo";
import {
  Sparkles,
  BookOpen,
  FolderHeart,
  FileSpreadsheet,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Compass,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoggedIn, isAdmin, login, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navLinks = [
    { href: "/", label: "Studio Phối đồ", icon: Sparkles },
    { href: "/thu-vien", label: "Thư viện Cổ phục", icon: BookOpen },
    { href: "/lookbook", label: "Lookbook", icon: FolderHeart },
    { href: "/giai-phap", label: "Giải pháp F12", icon: FileSpreadsheet },
    ...(isAdmin ? [{ href: "/quan-tri", label: "Quản trị F15", icon: ShieldCheck }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#FAF8F5] border-b border-stone-200/80 shadow-sm transition-colors will-change-transform">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand VietStylist */}
          <Link href="/" className="group flex items-center">
            <Logo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-heritage-red/10 text-heritage-red font-semibold border-b-2 border-heritage-red"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/80"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-heritage-red" : "text-stone-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Auth Control */}
          <div className="hidden md:flex items-center space-x-3">
            {isLoggedIn ? (
              <div className="flex items-center space-x-2 bg-stone-100 pl-2 pr-3 py-1.5 rounded-full border border-stone-200 text-sm">
                <Link
                  href="/tai-khoan"
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                  title="Quản lý tài khoản & bộ phối đã lưu"
                >
                  <div className="w-7 h-7 rounded-full bg-heritage-indigo flex items-center justify-center text-white text-xs font-bold">
                    {user?.displayName.charAt(0)}
                  </div>
                  <span className="font-medium text-stone-800 text-xs truncate max-w-[130px]">
                    {user?.displayName}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  title="Đăng xuất"
                  className="text-stone-400 hover:text-heritage-red transition-colors ml-1 p-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-800 text-white hover:bg-heritage-red transition-all shadow-sm"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-stone-200 bg-[#FAF8F5] px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-md text-base font-medium ${
                  isActive
                    ? "bg-heritage-red/10 text-heritage-red font-semibold"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                <Icon className="w-5 h-5 text-heritage-red" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-3 border-t border-stone-200">
            {isLoggedIn ? (
              <div className="flex items-center justify-between px-3 py-2">
                <Link
                  href="/tai-khoan"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-stone-800 hover:text-heritage-red"
                >
                  {user?.displayName} (Tài khoản)
                </Link>
                <button
                  onClick={logout}
                  className="text-xs text-heritage-red font-medium flex items-center space-x-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowAuthModal(true);
                }}
                className="w-full text-center py-2 px-4 rounded-md bg-stone-800 text-white text-sm font-medium hover:bg-heritage-red"
              >
                Đăng nhập tài khoản
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Đăng nhập / Chọn vai trò Demo */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Đăng nhập tài khoản (F13)
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-5 leading-relaxed">
              Bạn có thể thử nghiệm tính năng với tư cách là <strong>Học sinh / Sinh viên</strong> để lưu bộ phối cá nhân hoặc <strong>Quản trị viên</strong> để thử CRUD kho đồ F15.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  login("sinh_vien_kỷ_yeu", "user");
                  setShowAuthModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-lg border-2 border-stone-200 hover:border-heritage-indigo text-left flex items-center justify-between transition-all group"
              >
                <div>
                  <div className="font-semibold text-stone-900 group-hover:text-heritage-indigo">
                    Tài khoản Học sinh / Sinh viên
                  </div>
                  <div className="text-xs text-stone-500">Lưu bản nháp, tạo Lookbook & Form F12</div>
                </div>
                <Sparkles className="w-5 h-5 text-heritage-indigo opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => {
                  login("admin_heritage_editor", "admin");
                  setShowAuthModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-lg border-2 border-stone-200 hover:border-heritage-red text-left flex items-center justify-between transition-all group"
              >
                <div>
                  <div className="font-semibold text-stone-900 group-hover:text-heritage-red">
                    Tài khoản Ban Quản trị Di sản (Admin/Editor)
                  </div>
                  <div className="text-xs text-stone-500">Toàn quyền CRUD kho đồ, thẩm định bài viết & rule văn hóa</div>
                </div>
                <ShieldCheck className="w-5 h-5 text-heritage-red opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
