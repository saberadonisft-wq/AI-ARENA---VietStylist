"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import Logo from "@/components/Logo";
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ShieldCheck,
  Palette,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
  defaultRole?: "admin" | "stylist" | "user";
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultTab = "login",
}: AuthModalProps) {
  const {
    loginWithCredentials,
    registerWithCredentials,
    googleLogin,
    isLoading: authContextLoading,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"user" | "stylist">("user");

  // UI status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Identity Services (GSI)
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [isGsiReady, setIsGsiReady] = useState(false);

  const initGoogleButton = () => {
    if (typeof window === "undefined") return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      "336358137441-abj1lpeeogkpjmdr3hhr0i29di40e3b6.apps.googleusercontent.com";

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential) {
            setErrorMsg("Không nhận được token xác thực từ Google.");
            return;
          }
          setIsSubmitting(true);
          setErrorMsg(null);
          try {
            const res = await googleLogin({ credential: response.credential });
            setSuccessMsg(
              `Đăng nhập Google thành công! Chào mừng ${
                res?.user?.display_name || "bạn"
              }.`
            );
            setTimeout(() => {
              handleClose();
            }, 600);
          } catch (err: any) {
            console.error("Google authentication error:", err);
            setErrorMsg(
              err?.message || "Xác thực Google thất bại. Vui lòng thử lại."
            );
          } finally {
            setIsSubmitting(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = "";
        const parentWidth = googleBtnContainerRef.current.parentElement?.clientWidth || 360;
        const targetWidth = Math.min(Math.max(parentWidth, 240), 380);
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "continue_with",
          logo_alignment: "left",
          width: targetWidth,
        });
        setIsGsiReady(true);
      }
    } catch (err) {
      console.warn("Could not initialize Google Identity Services:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setErrorMsg(null);
      setSuccessMsg(null);

      // Dynamic on-demand loading of Google Identity Services (GSI)
      if ((window as any).google?.accounts?.id) {
        setTimeout(initGoogleButton, 80);
      } else {
        const existingScript = document.getElementById("gsi-client-script") as HTMLScriptElement | null;
        if (!existingScript) {
          const script = document.createElement("script");
          script.id = "gsi-client-script";
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = () => setTimeout(initGoogleButton, 80);
          document.head.appendChild(script);
        } else {
          existingScript.addEventListener("load", () => setTimeout(initGoogleButton, 80), { once: true });
        }
      }
    } else {
      setIsGsiReady(false);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (activeTab === "login") {
        if (!email.trim() || !password) {
          setErrorMsg("Vui lòng nhập đầy đủ Email và Mật khẩu.");
          setIsSubmitting(false);
          return;
        }
        await loginWithCredentials(email.trim(), password);
        setSuccessMsg("Đăng nhập thành công!");
        setTimeout(() => {
          handleClose();
        }, 600);
      } else {
        if (!displayName.trim() || !email.trim() || !password) {
          setErrorMsg("Vui lòng điền họ tên, email và mật khẩu.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự.");
          setIsSubmitting(false);
          return;
        }
        await registerWithCredentials({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          role: selectedRole,
        });
        setSuccessMsg("Đăng ký tài khoản thành công! Đang kích hoạt phiên...");
        setTimeout(() => {
          handleClose();
        }, 700);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Xác thực thất bại. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleFallbackClick = async () => {
    setErrorMsg(null);
    if (typeof window === "undefined") return;
    const google = (window as any).google;
    if (google?.accounts?.id) {
      initGoogleButton();
      try {
        google.accounts.id.prompt();
      } catch {
        // One-tap prompt might not show if dismissed
      }
    } else {
      setErrorMsg(
        "Dịch vụ Google Identity đang được kết nối. Vui lòng thử lại sau vài giây hoặc chọn Đăng nhập 1-chạm / Mật khẩu."
      );
    }
  };

  const isBusy = isSubmitting || authContextLoading;

  return (
    <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-stone-50/90 border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="sm" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-heritage-red/10 text-heritage-red border border-heritage-red/20">
              Xác thực & Phân quyền RBAC
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Notification banners */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Sign-in Official GSI Button & Fallback */}
          <div className="w-full flex flex-col items-center justify-center min-h-[44px]">
            <div
              ref={googleBtnContainerRef}
              className={`w-full flex justify-center ${isGsiReady ? "block" : "hidden"}`}
            />
            {!isGsiReady && (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleGoogleFallbackClick}
                className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 font-medium text-xs text-stone-700 shadow-sm transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Tiếp tục với Google OAuth</span>
              </button>
            )}
          </div>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-white px-3 text-[10px] text-stone-500 uppercase font-semibold tracking-wider absolute">
              hoặc tài khoản mật khẩu
            </span>
          </div>

          {/* Tab Switcher: Đăng nhập / Đăng ký */}
          <div className="flex border-b border-stone-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
                activeTab === "login"
                  ? "border-heritage-red text-heritage-red"
                  : "border-transparent text-stone-600 hover:text-stone-800"
              }`}
            >
              Đăng nhập Mật khẩu
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
                activeTab === "register"
                  ? "border-heritage-red text-heritage-red"
                  : "border-transparent text-stone-600 hover:text-stone-800"
              }`}
            >
              Tạo tài khoản Mới
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            {activeTab === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Họ và tên / Tên hiển thị
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn An"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {activeTab === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Vai trò phân quyền (Role)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex flex-col items-center p-2 rounded-lg border cursor-pointer text-center transition-all ${
                      selectedRole === "user"
                        ? "border-heritage-red bg-red-50/40 text-heritage-red font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={selectedRole === "user"}
                      onChange={() => setSelectedRole("user")}
                      className="sr-only"
                    />
                    <span className="text-[11px]">Sinh viên</span>
                    <span className="text-[9px] text-stone-600">Người dùng</span>
                  </label>

                  <label
                    className={`flex flex-col items-center p-2 rounded-lg border cursor-pointer text-center transition-all ${
                      selectedRole === "stylist"
                        ? "border-heritage-red bg-red-50/40 text-heritage-red font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="stylist"
                      checked={selectedRole === "stylist"}
                      onChange={() => setSelectedRole("stylist")}
                      className="sr-only"
                    />
                    <span className="text-[11px]">Stylist</span>
                    <span className="text-[9px] text-stone-600">Tạo mẫu</span>
                  </label>

                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full mt-2 py-2.5 px-4 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-60"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực tài khoản...</span>
                </>
              ) : activeTab === "login" ? (
                <>
                  <span>Đăng nhập vào VietStylist</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Hoàn tất Đăng ký</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-stone-50 px-6 py-3 border-t border-stone-200 text-[11px] text-stone-600 text-center">
          Đăng nhập để lưu và quản lý bộ phối của bạn.
        </div>
      </div>
    </div>
  );
}
