"use client";

import React, { useState, useEffect } from "react";
import { StarterOutfit } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { X, Sparkles, Shirt, Check } from "lucide-react";
import { StarterOutfitCardSkeleton } from "@/components/ui/Skeleton";

interface StarterOutfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStarter: (outfit: StarterOutfit) => void;
}

export default function StarterOutfitModal({
  isOpen,
  onClose,
  onSelectStarter,
}: StarterOutfitModalProps) {
  const [starters, setStarters] = useState<StarterOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    api
      .getStarterOutfits()
      .then((data) => setStarters(data))
      .catch((err) => console.error("Lỗi lấy starter outfits:", err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-heritage-red" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Chọn Bộ Phối Mở Đầu (F01)
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-stone-600 leading-relaxed">
            Các mẫu phối mở đầu được các chuyên gia di sản văn hóa chuẩn hóa phom dáng và sự hài hòa màu sắc, giúp bạn bắt đầu phối đồ ngay mà không phải chọn từ đầu.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <StarterOutfitCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {starters.map((outfit) => (
                <div
                  key={outfit.id}
                  onClick={() => {
                    onSelectStarter(outfit);
                    onClose();
                  }}
                  className="group p-4 rounded-xl border border-stone-200 hover:border-heritage-red bg-[#FAF8F5] hover:bg-white cursor-pointer transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-stone-900 group-hover:text-heritage-red transition-colors">
                        {outfit.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                        {outfit.occasion_id}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {outfit.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                    <span>{outfit.items.length} món đồ chuẩn bị sẵn</span>
                    <span className="text-heritage-red group-hover:translate-x-0.5 transition-transform font-semibold">
                      Chọn dùng →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
