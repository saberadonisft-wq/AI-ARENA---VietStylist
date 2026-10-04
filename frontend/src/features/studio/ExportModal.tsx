"use client";

import React, { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Download, Share2, X, Sparkles } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (ratio: "1:1" | "9:16") => Promise<Blob>;
  outfitTitle: string;
  documentKey: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  outfitTitle,
  documentKey,
}: ExportModalProps) {
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "9:16">("9:16");
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationId = useRef(0);

  useEffect(() => {
    operationId.current++;
    setExportedImageUrl(null);
    setExportedBlob(null);
    setError(null);
    setIsExporting(false);
    return () => { operationId.current++; };
  }, [isOpen, documentKey]);

  useEffect(() => () => { if (exportedImageUrl) URL.revokeObjectURL(exportedImageUrl); }, [exportedImageUrl]);

  const handleGenerate = async (ratio: "1:1" | "9:16") => {
    if (isExporting) return;
    const generation = ++operationId.current;
    setError(null);
    setExportedImageUrl(null);
    setAspectRatio(ratio);
    setExportedBlob(null);
    setIsExporting(true);
    try {
      const blob = await onExport(ratio);
      if (generation === operationId.current) {
        setExportedBlob(blob);
        setExportedImageUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      if (generation === operationId.current) setError(err instanceof Error ? err.message : "Không xuất được ảnh. Vui lòng thử lại.");
    } finally {
      if (generation === operationId.current) setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedImageUrl || !exportedBlob) return;
    const a = document.createElement("a");
    a.href = exportedImageUrl;
    a.download = `vietstylist-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!exportedImageUrl || !exportedBlob) return;
    setError(null);
    try {
      const file = new File([exportedBlob], "vietstylist.png", { type: "image/png" });
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
    <Modal isOpen={isOpen} onClose={onClose} label="Xuất ảnh bản phối">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-heritage-gold" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Xuất ảnh bản phối
            </h3>
          </div>
          <button type="button" aria-label="Đóng xuất ảnh" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Chọn tỷ lệ khung hình */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
              Chọn tỷ lệ khung hình
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                aria-pressed={aspectRatio === "9:16"}
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
                aria-pressed={aspectRatio === "1:1"}
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

        </div>
        <div className="shrink-0 space-y-2 border-t border-stone-200 px-4 py-3 sm:px-6">
          {error && <p role="alert" className="text-sm text-amber-900">{error}</p>}
          {/* Nút hành động */}
          <div className="flex items-center space-x-3">
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
    </Modal>
  );
}
