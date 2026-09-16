"use client";

import React, { useState } from "react";
import { Download, Share2, X, Sparkles, Check } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (ratio: "1:1" | "9:16") => Promise<string>;
  outfitTitle: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  outfitTitle,
}: ExportModalProps) {
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "9:16">("9:16");
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (ratio: "1:1" | "9:16") => {
    if (isExporting) return;
    setError(null);
    setExportedImageUrl(null);
    setAspectRatio(ratio);
    setIsExporting(true);
    try {
      const dataUrl = await onExport(ratio);
      setExportedImageUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất được ảnh. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedImageUrl) return;
    const a = document.createElement("a");
    a.href = exportedImageUrl;
    a.download = `vietstylist-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!exportedImageUrl) return;
    setError(null);
    try {
      const blob = await (await fetch(exportedImageUrl)).blob();
      const file = new File([blob], "vietstylist.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: outfitTitle || "Bản phối VietStylist", files: [file] });
      } else {
        handleDownload();
        setError("Trình duyệt chưa hỗ trợ chia sẻ ảnh trực tiếp. Ảnh đã được tải xuống để bạn gửi đi.");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError("Chưa chia sẻ được ảnh. Bạn có thể tải PNG để gửi đi.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-heritage-gold" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Xuất Bản Phối Ảnh 2D (F03)
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Chọn tỷ lệ khung hình */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
              Chọn tỷ lệ khung hình
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isExporting}
                onClick={() => handleGenerate("9:16")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center space-y-1.5 ${
                  aspectRatio === "9:16"
                    ? "border-heritage-red bg-heritage-red/10 text-heritage-red font-semibold"
                    : "border-stone-200 hover:border-stone-400 text-stone-700"
                }`}
              >
                <div className="w-6 h-10 border-2 border-current rounded-sm flex items-center justify-center text-[9px] font-bold">
                  9:16
                </div>
                <span className="text-xs">Story / Reels (9:16)</span>
              </button>

              <button
                disabled={isExporting}
                onClick={() => handleGenerate("1:1")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center space-y-1.5 ${
                  aspectRatio === "1:1"
                    ? "border-heritage-red bg-heritage-red/10 text-heritage-red font-semibold"
                    : "border-stone-200 hover:border-stone-400 text-stone-700"
                }`}
              >
                <div className="w-8 h-8 border-2 border-current rounded-sm flex items-center justify-center text-[9px] font-bold">
                  1:1
                </div>
                <span className="text-xs">Vuông (Instagram / Post)</span>
              </button>
            </div>
          </div>

          {/* Vùng xem trước ảnh đã xuất */}
          <div className="flex justify-center items-center min-h-[220px] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 p-2">
            {isExporting ? (
              <div className="flex flex-col items-center space-y-2 text-stone-500 text-xs">
                <div className="w-6 h-6 border-2 border-heritage-red border-t-transparent rounded-full animate-spin" />
                <span>Đang kết xuất ảnh chất lượng cao...</span>
              </div>
            ) : exportedImageUrl ? (
              <img
                src={exportedImageUrl}
                alt="Bản phối xuất"
                className="max-h-[300px] w-auto object-contain rounded-lg shadow-md"
              />
            ) : (
              <button
                disabled={isExporting}
                onClick={() => handleGenerate(aspectRatio)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-heritage-red transition-colors"
              >
                Nhấn để tạo ảnh xem trước
              </button>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-amber-900">{error}</p>}
          {/* Nút hành động */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={!exportedImageUrl || isExporting}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-heritage-red text-white font-semibold text-xs hover:bg-heritage-red-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Tải ảnh PNG</span>
            </button>

            <button
              onClick={handleShare}
              disabled={!exportedImageUrl || isExporting}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-all disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
