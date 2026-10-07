"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import Logo from "@/components/Logo";
import dynamic from "next/dynamic";
const AuthModal = dynamic(() => import("@/components/AuthModal"), { ssr: false });
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
  Palette,
  ChevronDown,
  Feather,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoggedIn, isAdmin, isStylist, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Tự động tắt trạng thái điều hướng khi route đã thay đổi
  React.useEffect(() => {
    setNavigatingTo(null);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/studio", label: "Studio Phối đồ", icon: Sparkles },
    { href: "/thu-vien", label: "Thư viện Cổ phục", icon: BookOpen },
    { href: "/lookbook", label: "Lookbook", icon: FolderHeart },
    { href: "/chuyen-co-phuc", label: "Chuyện Cổ phục", icon: Feather },
  ];

  const getRoleBadge = () => {
    if (isAdmin) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-heritage-red text-white shadow-xs">
          <ShieldCheck className="w-3 h-3" />
          <span>Quản trị</span>
        </span>
      );
    }
    if (isStylist) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-xs">
          <Palette className="w-3 h-3" />
          <span>Stylist Pro</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-700 text-white shadow-xs">
        <UserIcon className="w-3 h-3" />
        <span>Sinh viên</span>
      </span>
    );
  };

  return (
    <>
      <header className={`site-navbar ${pathname === "/studio" ? "studio-navbar " : ""}sticky top-0 z-50 bg-page border-b border-stone-200/80 shadow-xs transition-colors will-change-transform relative`}>
        {/* Thanh chỉ báo điều hướng tức thì khi người dùng click chuyển trang */}
        {navigatingTo && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-heritage-red to-amber-500 animate-shimmer z-50">
            <div className="w-full h-full bg-heritage-red/60 animate-pulse" />
          </div>
        )}

        <div className="site-navbar-container w-full px-4 sm:px-6 lg:px-8">
          <div className="site-nav-row flex items-center justify-between h-[58px]">
            {/* Logo Brand VietStylist */}
            <Link
              href="/"
              prefetch={true}
              onClick={() => {
                if (pathname !== "/") setNavigatingTo("/");
              }}
              className="group flex items-center outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-none"
            >
              <Logo size="header" className="site-brand" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex items-center space-x-1 lg:space-x-2">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isNavigatingThis = navigatingTo === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    prefetch={true}
                    onClick={() => {
                      if (pathname !== item.href) setNavigatingTo(item.href);
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-[13px] leading-5 font-medium transition-all ${
                      isActive
                        ? "bg-heritage-red/10 text-heritage-red font-semibold border-b-2 border-heritage-red"
                        : isNavigatingThis
                        ? "bg-amber-100/70 text-heritage-red font-semibold animate-pulse"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/80"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive || isNavigatingThis ? "text-heritage-red" : "text-stone-400"}`} />
                    <span>{item.label}</span>
                    {isNavigatingThis && (
                      <span className="w-1.5 h-1.5 rounded-full bg-heritage-red animate-ping ml-0.5" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Auth Control */}
            <div className="hidden xl:flex items-center space-x-3 relative">
              {isLoggedIn && (isStylist || isAdmin) && (
                <Link
                  href="/stylist"
                  onClick={() => {
                    if (pathname !== "/stylist") setNavigatingTo("/stylist");
                  }}
                  className={`hidden lg:inline-flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                    pathname === "/stylist"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:text-amber-800"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Workplace Stylist</span>
                </Link>
              )}
              {isLoggedIn ? (
                <div className="relative">
                  <div className="flex items-center space-x-2 bg-stone-100/90 pl-1.5 pr-2.5 py-1 rounded-full border border-stone-200 text-sm hover:border-stone-300 transition-all">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-heritage-red to-red-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {user?.displayName?.charAt(0).toUpperCase() || "V"}
                    </div>

                    {/* Name & Role badge */}
                    <button
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className="flex items-center space-x-1.5 text-left focus:outline-none"
                    >
                      <span className="font-semibold text-stone-800 text-xs truncate max-w-[120px]">
                        {user?.displayName}
                      </span>
                      {getRoleBadge()}
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 ml-0.5" />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div
                      onMouseLeave={() => setShowUserDropdown(false)}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      <div className="px-3 py-2 border-b border-stone-100 text-xs">
                        <div className="font-semibold text-stone-900 truncate">{user?.displayName}</div>
                        <div className="text-[11px] text-stone-600 truncate">{user?.email}</div>
                        <div className="mt-1.5 flex items-center gap-1">{getRoleBadge()}</div>
                      </div>

                      <Link
                        href="/tai-khoan"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center space-x-2 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 hover:text-heritage-red transition-colors"
                      >
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Trang cá nhân & Bộ phối</span>
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/quan-tri"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center space-x-2 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 hover:text-heritage-red transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-heritage-red" />
                          <span>Khu vực quản trị</span>
                        </Link>
                      )}

                      {(isStylist || isAdmin) && (
                        <Link
                          href="/stylist"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center space-x-2 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 hover:text-heritage-red transition-colors"
                        >
                          <Palette className="w-3.5 h-3.5 text-amber-600" />
                          <span>Workplace Stylist</span>
                        </Link>
                      )}

                      <div className="border-t border-stone-100 my-1" />

                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full text-left flex items-center space-x-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Đăng xuất tài khoản</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setAuthModalTab("login");
                      setShowAuthModal(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-heritage-red text-white hover:bg-heritage-red-dark transition-all shadow-xs"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Đăng nhập</span>
                  </button>
                  <button
                    onClick={() => {
                      setAuthModalTab("register");
                      setShowAuthModal(true);
                    }}
                    className="hidden lg:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold text-stone-700 hover:text-heritage-red hover:bg-stone-100 transition-all border border-stone-200"
                  >
                    <span>Đăng ký</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="xl:hidden flex items-center">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation"
                className="min-h-11 min-w-11 p-2 rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <nav id="mobile-navigation" aria-label="Điều hướng trên điện thoại" className="xl:hidden max-h-[calc(100dvh-59px)] overflow-y-auto overscroll-contain border-b border-stone-200 bg-page px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-1 [&_a]:min-h-11 [&_button]:min-h-11">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const isNavigatingThis = navigatingTo === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  prefetch={true}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (pathname !== item.href) setNavigatingTo(item.href);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-md text-base font-medium transition-all ${
                    isActive
                      ? "bg-heritage-red/10 text-heritage-red font-semibold"
                      : isNavigatingThis
                      ? "bg-amber-100/70 text-heritage-red font-semibold animate-pulse"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive || isNavigatingThis ? "text-heritage-red" : "text-stone-500"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 border-t border-stone-200 space-y-2">
              {isLoggedIn ? (
                <div className="space-y-2 bg-stone-100/70 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-stone-900">{user?.displayName}</div>
                      <div className="text-xs text-stone-600">{user?.email}</div>
                    </div>
                    {getRoleBadge()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href="/tai-khoan"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex-1 py-1.5 px-3 text-center rounded-lg bg-white border border-stone-300 text-xs font-medium text-stone-700"
                    >
                      Trang cá nhân
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/quan-tri"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex-1 py-1.5 px-3 text-center rounded-lg bg-white border border-stone-300 text-xs font-medium text-stone-700"
                      >
                        Quản trị
                      </Link>
                    )}
                    {(isStylist || isAdmin) && (
                      <Link
                        href="/stylist"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex-1 py-1.5 px-3 text-center rounded-lg bg-white border border-stone-300 text-xs font-medium text-stone-700"
                      >
                        Workplace Stylist
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        logout();
                      }}
                      className={`py-1.5 px-3 rounded-lg bg-red-100 text-xs font-medium text-red-700 hover:bg-red-200 flex items-center justify-center space-x-1 ${(isAdmin || isStylist) ? "col-span-2" : ""}`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Thoát</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setAuthModalTab("login");
                      setShowAuthModal(true);
                    }}
                    className="w-full text-center py-2 px-3 rounded-lg bg-heritage-red text-white text-xs font-semibold shadow-xs"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setAuthModalTab("register");
                      setShowAuthModal(true);
                    }}
                    className="w-full text-center py-2 px-3 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-semibold"
                  >
                    Đăng ký
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Auth Modal Component */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authModalTab}
        />
      )}
    </>
  );
}
