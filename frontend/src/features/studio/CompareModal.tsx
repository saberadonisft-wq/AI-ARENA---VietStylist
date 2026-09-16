"use client";

import React, { useState, useEffect } from "react";
import { OutfitSnapshot } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { X, ArrowRightLeft, Check, Sparkles } from "lucide-react";

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotA: OutfitSnapshot;
  snapshotB: OutfitSnapshot;
  onSelectOutfit: (chosenSnapshot: OutfitSnapshot) => void;
}

export default function CompareModal({
  isOpen,
  onClose,
  snapshotA,
  snapshotB,
  onSelectOutfit,
}: CompareModalProps) {
  const [diffData, setDiffData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"side_by_side" | "diff">("side_by_side");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setDiffData(null);
    api
      .compareOutfits({ snapshot_a: snapshotA, snapshot_b: snapshotB })
      .then((data) => { if (!cancelled) setDiffData(data); })
      .catch((err) => console.error("Lỗi so sánh:", err));
    return () => { cancelled = true; };
  }, [isOpen, snapshotA, snapshotB]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-300 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <ArrowRightLeft className="w-5 h-5 text-heritage-indigo" />
            <h3 className="font-serif text-lg font-bold text-stone-900">
              So sánh Hai Phương án Phối Đồ (F08)
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tóm tắt so sánh */}
          {diffData && (
            <div className="p-3 bg-heritage-indigo/10 border border-heritage-indigo/20 rounded-xl text-xs text-heritage-indigo font-medium flex items-center justify-between">
              <span>{diffData.summary_message}</span>
              {diffData.style_changed && (
                <span className="bg-white/80 px-2 py-0.5 rounded text-[10px] font-bold">
                  Khác phong cách
                </span>
              )}
            </div>
          )}

          {/* Hai cột Phương án A & B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phương án A */}
            <div className="border border-stone-200 rounded-xl p-4 bg-[#FAF8F5] space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-stone-900">
                  Phương án A (Bản đã ghim)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-medium">
                  {snapshotA.styleMode}
                </span>
              </div>

              <div className="space-y-2 text-xs divide-y divide-stone-200/60">
                {snapshotA.items.map((it) => (
                  <div key={it.slot} className="pt-2 first:pt-0 flex items-center justify-between">
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

              <button
                onClick={() => {
                  onSelectOutfit(snapshotA);
                  onClose();
                }}
                className="w-full py-2 px-4 rounded-lg bg-stone-800 hover:bg-stone-900 text-white font-medium text-xs transition-colors"
              >
                Tiếp tục chỉnh sửa Phương án A
              </button>
            </div>

            {/* Phương án B */}
            <div className="border-2 border-heritage-red/40 rounded-xl p-4 bg-red-50/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-heritage-red">
                  Phương án B (Bản đang chỉnh)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-heritage-red/10 text-heritage-red font-medium">
                  {snapshotB.styleMode}
                </span>
              </div>

              <div className="space-y-2 text-xs divide-y divide-stone-200/60">
                {snapshotB.items.map((it) => (
                  <div key={it.slot} className="pt-2 first:pt-0 flex items-center justify-between">
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

              <button
                onClick={() => {
                  onSelectOutfit(snapshotB);
                  onClose();
                }}
                className="w-full py-2 px-4 rounded-lg bg-heritage-red hover:bg-heritage-red-dark text-white font-medium text-xs transition-colors"
              >
                Tiếp tục chỉnh sửa Phương án B
              </button>
            </div>
          </div>

          {/* Bảng đối chiếu chi tiết từng Slot */}
          {diffData && diffData.diffs && (
            <div className="space-y-2">
              <h4 className="font-serif font-bold text-xs text-stone-800 uppercase tracking-wider">
                Bảng Đối Chiếu Thay Đổi Từng Vị Trí
              </h4>
              <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                {diffData.diffs.map((d: any) => (
                  <div
                    key={d.slot}
                    className={`grid grid-cols-3 p-2.5 items-center ${
                      d.is_changed ? "bg-amber-50/40" : "bg-white"
                    }`}
                  >
                    <span className="font-semibold text-stone-700 capitalize">{d.slot}</span>
                    <span className="text-stone-600 truncate">{d.item_a_name || d.item_a_id || "—"}</span>
                    <div className="flex items-center justify-between">
                      <span className={`truncate ${d.is_changed ? "font-bold text-heritage-red" : "text-stone-600"}`}>
                        {d.item_b_name || d.item_b_id || "—"}
                      </span>
                      {d.is_changed && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold ml-2">
                          Đã đổi
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
