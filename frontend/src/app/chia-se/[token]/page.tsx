"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { FolderHeart, Sparkles, ArrowLeft, Shield, Globe, Share2 } from "lucide-react";

export default function PublicSharePage() {
  const params = useParams();
  const token = params.token as string;

  const [shareData, setShareData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);

    api
      .getSharedLookbook(token)
      .then((data) => setShareData(data))
      .catch((err) => {
        setErrorMsg(err.message || "Liên kết chia sẻ không tồn tại hoặc đã hết hạn");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return <div className="py-24 text-center text-xs text-stone-500">Đang giải mã liên kết chia sẻ...</div>;
  }

  if (errorMsg || !shareData) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <FolderHeart className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-stone-900">Liên kết không khả dụng</h2>
        <p className="text-xs text-stone-600">{errorMsg || "Liên kết có thể đã bị thu hồi hoặc đã hết hạn sử dụng."}</p>
        <Link href="/" className="inline-block px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold">
          Khám phá Studio Phối đồ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner Khách xem bản chia sẻ */}
      <div className="p-3.5 bg-heritage-indigo/10 border border-heritage-indigo/20 rounded-2xl flex items-center justify-between text-xs text-heritage-indigo">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4" />
          <span>Bạn đang xem bản phối được chia sẻ công khai qua liên kết bảo mật (F09).</span>
        </div>
        <Link href="/" className="font-bold underline hover:text-heritage-red">
          Tự phối đồ của riêng bạn →
        </Link>
      </div>

      {/* Header Thông tin bộ sưu tập */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 text-xs text-stone-500">
          <span className="font-semibold text-stone-900">{shareData.owner_display_name}</span>
          <span>•</span>
          <span>Xuất bản: {new Date(shareData.created_at).toLocaleDateString("vi-VN")}</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900">{shareData.title}</h1>
        {shareData.description && (
          <p className="text-stone-600 text-xs leading-relaxed max-w-2xl">{shareData.description}</p>
        )}
      </div>

      {/* Danh sách các bộ phối */}
      <div className="space-y-6">
        <h3 className="font-serif text-lg font-bold text-stone-900">
          Danh sách các bản phối ({shareData.entries.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shareData.entries.map((entry: any, idx: number) => (
            <div
              key={entry.id}
              className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-heritage-red tracking-wider">
                  Bản phối #{idx + 1}
                </span>
                <h4 className="font-serif font-bold text-base text-stone-900">{entry.outfit_title}</h4>
              </div>

              {/* Chi tiết từng món trong bản phối */}
              <div className="space-y-2 bg-[#FAF8F5] p-4 rounded-2xl border border-stone-100 text-xs">
                {entry.snapshot.items.map((it: any) => (
                  <div key={it.slot} className="flex items-center justify-between">
                    <span className="text-stone-500 capitalize">{it.slot}:</span>
                    <div className="flex items-center space-x-1.5 font-medium text-stone-800">
                      {it.colorHex && (
                        <div
                          className="w-3 h-3 rounded-full border border-black/20"
                          style={{ backgroundColor: it.colorHex }}
                        />
                      )}
                      <span>{it.itemId}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-stone-500">
                <span>Phong cách: <strong className="capitalize">{entry.snapshot.styleMode}</strong></span>
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-lg bg-stone-900 text-white font-semibold hover:bg-heritage-red transition-colors"
                >
                  Mở thử trong Studio
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
