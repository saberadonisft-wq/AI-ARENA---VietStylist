"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lookbook } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { ArrowLeft, Share2, Trash2, Globe, Lock, Sparkles, Check } from "lucide-react";

export default function LookbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lookbookId = params.id as string;
  const { user } = useAuth();

  const [lookbook, setLookbook] = useState<Lookbook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lookbookId) return;
    setIsLoading(true);

    api
      .getLookbook(lookbookId)
      .then((data) => setLookbook(data))
      .catch((err) => console.error("Lỗi lấy lookbook:", err))
      .finally(() => setIsLoading(false));
  }, [lookbookId]);

  const handleShare = async () => {
    try {
      const res = await api.shareLookbook(lookbookId, 30);
      setShareUrl(res.share_url);
    } catch (err: any) {
      alert("Lỗi chia sẻ: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa Lookbook này không?")) return;
    try {
      await api.deleteLookbook(lookbookId);
      router.push("/lookbook");
    } catch (err: any) {
      alert("Lỗi xóa: " + err.message);
    }
  };

  if (isLoading) {
    return <div className="py-24 text-center text-xs text-stone-500">Đang tải chi tiết Lookbook...</div>;
  }

  if (!lookbook) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-serif font-bold text-stone-900">Không tìm thấy Lookbook</h2>
        <Link href="/lookbook" className="text-xs text-heritage-red font-semibold hover:underline">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/lookbook"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-heritage-red transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Lookbooks</span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleShare}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors"
          >
            <Share2 className="w-4 h-4 text-heritage-indigo" />
            <span>Tạo link chia sẻ (F09)</span>
          </button>

          <button
            onClick={handleDelete}
            className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Xóa Lookbook"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thông báo chia sẻ */}
      {shareUrl && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
          <div className="space-y-0.5">
            <span className="font-bold flex items-center space-x-1">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Link chia sẻ công khai có thời hạn:</span>
            </span>
            <span className="font-mono text-emerald-700 select-all block text-[11px]">{shareUrl}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              alert("Đã copy link!");
            }}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            Copy Link
          </button>
        </div>
      )}

      {/* Header thông tin Lookbook */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 text-stone-700 flex items-center space-x-1">
            {lookbook.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            <span>{lookbook.visibility}</span>
          </span>
          <span className="text-xs text-stone-400">
            Khởi tạo ngày: {new Date(lookbook.created_at).toLocaleDateString("vi-VN")}
          </span>
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">{lookbook.title}</h1>
        <p className="text-stone-600 text-xs leading-relaxed max-w-2xl">{lookbook.description}</p>
      </div>

      {/* Danh sách các bộ phối trong Lookbook */}
      <div className="space-y-4">
        <h3 className="font-serif text-lg font-bold text-stone-900">
          Các bộ phối trong bộ sưu tập ({lookbook.entries.length})
        </h3>

        {lookbook.entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-xs text-stone-500">
            Chưa có bộ phối nào được thêm vào Lookbook này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lookbook.entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-stone-900">
                    #{idx + 1}. {entry.outfit_title}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    Phiên bản v{entry.version_number}
                  </span>
                </div>

                {/* Tóm tắt các món trong bộ phối */}
                <div className="space-y-1.5 text-xs bg-[#FAF8F5] p-3 rounded-xl border border-stone-100">
                  {entry.snapshot.items.map((it) => (
                    <div key={it.slot} className="flex items-center justify-between">
                      <span className="text-stone-500 capitalize">{it.slot}:</span>
                      <span className="font-medium text-stone-800 truncate max-w-[200px]">
                        {it.itemId}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                  <span className="text-[11px] text-stone-500">
                    Phong cách: <strong className="capitalize">{entry.snapshot.styleMode}</strong>
                  </span>
                  <Link
                    href="/"
                    className="px-3 py-1 bg-stone-100 hover:bg-stone-900 hover:text-white rounded-lg font-medium text-stone-700 transition-colors"
                  >
                    Mở lại trong Studio
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
