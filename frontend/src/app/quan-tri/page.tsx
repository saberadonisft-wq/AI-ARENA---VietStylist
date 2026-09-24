"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import AuthModal from "@/components/AuthModal";
import AdminWorkspace from "@/features/admin/AdminWorkspace";
import { ShieldCheck, Lock } from "lucide-react";

export default function QuanTriPage() {
  const { user, isLoggedIn, isAdmin } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-heritage-red flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Khu vực quản trị
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {isLoggedIn ? (
              <>
                Bạn đang đăng nhập với tài khoản <strong>{user?.displayName}</strong> ({user?.roles.join(", ")}).
                Trang này yêu cầu quyền <strong>Admin / Biên tập viên Di sản</strong>.
              </>
            ) : (
              <>
                Chức năng quản trị hệ thống, nội dung và quyền người dùng yêu cầu quyền Ban Quản Trị (Admin).
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-2.5 px-4 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Đăng nhập tài khoản Quản trị</span>
          </button>

          <Link
            href="/"
            className="w-full py-2 px-4 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-medium border border-stone-300 transition-all flex items-center justify-center space-x-1.5 text-center"
          >
            <span>Quay về Trang chủ</span>
          </Link>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultRole="admin"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4" />
          <span>Ban Quản trị</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
          Quản Trị Hệ Thống
        </h1>
        <p className="text-stone-600 text-xs leading-relaxed max-w-xl">
          Cấp quyền stylist, quản lý trang phục và bộ phối, đồng thời duyệt các mẫu gửi vào thư viện.
        </p>
      </div>

      <AdminWorkspace />
    </div>
  );
}
