"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import AuthModal from "@/components/AuthModal";
import StylistWorkspace from "@/features/stylist/StylistWorkspace";
import { ArrowLeft, Lock, Palette, Sparkles } from "lucide-react";

export default function StylistWorkspacePage() {
  const { user, isLoggedIn, isStylist, isAdmin } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [outfitCount, setOutfitCount] = useState(0);
  const [outfitsLoading, setOutfitsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || (!isStylist && !isAdmin)) {
      setOutfitCount(0);
      return;
    }
    let active = true;
    setOutfitsLoading(true);
    setOutfitCount(0);
    api.countUserOutfits()
      .then(result => { if (active) setOutfitCount(result.count); })
      .catch(() => { if (active) setOutfitCount(0); })
      .finally(() => { if (active) setOutfitsLoading(false); });
    return () => { active = false; };
  }, [isLoggedIn, isStylist, isAdmin, user?.id]);

  if (!isLoggedIn || (!isStylist && !isAdmin)) {
    return <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="rounded-2xl border border-amber-200 bg-white p-7 shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Palette size={27} /></span>
        <h1 className="mt-4 font-serif text-2xl font-bold text-stone-900">Workplace Stylist</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{isLoggedIn ? <>Tài khoản <strong>{user?.displayName}</strong> hiện chưa có quyền Stylist. Quản trị viên có thể cấp quyền từ Cổng Quản trị.</> : "Đăng nhập bằng tài khoản đã được cấp quyền Stylist để mở không gian sáng tạo cá nhân."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!isLoggedIn && <button type="button" onClick={() => setShowAuthModal(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white hover:bg-heritage-red-dark"><Lock size={16} />Đăng nhập</button>}
          <Link href="/tai-khoan" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"><ArrowLeft size={16} />Trang cá nhân</Link>
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultRole="stylist" />
    </main>;
  }

  return <main className="min-h-[calc(100vh-4rem)] bg-page px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-800"><Palette size={16} /> Không gian sáng tạo cá nhân</p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Workplace Stylist</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">Xin chào {user?.displayName}. Tạo bộ phối, gửi trang phục vào kho và theo dõi nội dung của bạn trong một nơi riêng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tai-khoan" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"><ArrowLeft size={16} />Trang cá nhân</Link>
          <Link href="/studio" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-heritage-red px-3 py-2 text-sm font-semibold text-white hover:bg-heritage-red-dark"><Sparkles size={16} />Mở Studio</Link>
        </div>
      </header>
      {outfitsLoading && <p role="status" className="text-sm text-stone-500">Đang tải số liệu bộ phối…</p>}
      <StylistWorkspace outfitCount={outfitCount} />
    </div>
  </main>;
}
