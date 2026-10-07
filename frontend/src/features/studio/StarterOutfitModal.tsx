"use client";

import Modal from "@/components/ui/Modal";
import React, { useState, useEffect } from "react";
import { StarterOutfit } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { X, Sparkles, Shirt, Check } from "lucide-react";
import { StarterOutfitCardSkeleton } from "@/components/ui/Skeleton";

interface StarterOutfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStarter: (outfit: StarterOutfit) => boolean | void;
}

export default function StarterOutfitModal({
  isOpen,
  onClose,
  onSelectStarter,
}: StarterOutfitModalProps) {
  const [starters, setStarters] = useState<StarterOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    api.getStarterOutfits()
      .then(data => { if (active) setStarters(data); })
      .catch(err => { if (active) setError(err?.message || "Không tải được danh sách mẫu phối."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [isOpen, retry]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Chọn mẫu phối mở đầu">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-heritage-red" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Chọn mẫu phối mở đầu
            </h3>
          </div>
          <button type="button" aria-label="Đóng mẫu phối mở đầu" onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 min-h-0 overflow-y-auto">
          <p className="text-xs text-stone-600 leading-relaxed">
            Chọn mẫu sẽ thay bản phối đang mở. Nếu có thay đổi chưa lưu, bạn sẽ được yêu cầu xác nhận trước khi bỏ những thay đổi đó.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <StarterOutfitCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
              <p>Không tải được mẫu phối: {error}</p>
              <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold">Thử tải lại</button>
            </div>
          ) : starters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-600">Hiện chưa có mẫu phối mở đầu. Bạn có thể thêm trang phục từ thư viện.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {starters.map((outfit) => (
                <button
                  type="button"
                  key={outfit.id}
                  onClick={() => { if (onSelectStarter(outfit) !== false) onClose(); }}
                  className="group p-4 text-left rounded-xl border border-stone-200 hover:border-heritage-red bg-page hover:bg-white transition-all shadow-sm hover:shadow-md flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-red"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif font-bold text-sm text-stone-900 group-hover:text-heritage-red transition-colors">
                        {outfit.title}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-stone-500">{outfit.items.length} món</span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {outfit.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                    <span>Mẫu phối có sẵn</span>
                    <span className="text-heritage-red group-hover:translate-x-0.5 transition-transform font-semibold">
                      Chọn dùng →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
