"use client";

import React, { useState, useEffect } from "react";
import { OutfitSnapshot } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { X, Sparkles, UploadCloud, Info, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface AITryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: OutfitSnapshot;
  outfitTitle: string;
}

const DEMO_PHOTOS = [
  {
    name: "Nữ sinh viên (Áo phông trắng)",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Nam sinh viên (Áo sơ mi nhẹ)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
  },
];

export default function AITryOnModal({
  isOpen,
  onClose,
  snapshot,
  outfitTitle,
}: AITryOnModalProps) {
  const [photoUrl, setPhotoUrl] = useState(DEMO_PHOTOS[0].url);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !jobId || jobStatus === "succeeded" || jobStatus === "failed") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      try {
        const result = await api.getTryOnJobStatus(jobId);
        if (cancelled) return;
        failures = 0;
        if (result.status === "succeeded" && !result.result_image_url) {
          setJobStatus("failed");
          setErrorMessage("Tác vụ chưa trả về ảnh kết quả. Vui lòng thử lại sau.");
          return;
        }
        setJobStatus(result.status);
        if (result.status === "succeeded") { setResultImageUrl(result.result_image_url); return; }
        if (result.status === "failed") { setErrorMessage(result.error_message || "Không tạo được ảnh."); return; }
      } catch {
        if (cancelled) return;
        if (++failures >= 3) {
          setErrorMessage("Không thể kiểm tra tiến trình. Đóng rồi mở lại cửa sổ để thử kết nối lại.");
          return;
        }
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, jobId, jobStatus]);

  const handleStartTryOn = async () => {
    if (isSubmitting || jobStatus === "queued" || jobStatus === "running") return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setResultImageUrl(null);
    try {
      const res = await api.createTryOnJob({
        user_photo_url: photoUrl,
        outfit_snapshot: snapshot,
        idempotency_key: `tryon_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      });
      setJobId(res.job_id);
      setJobStatus(res.status);
      if (res.status === "succeeded") setResultImageUrl(res.result_image_url || null);

    } catch (err: any) {
      setErrorMessage(err.message || "Không thể khởi tạo tác vụ AI");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-heritage-gold" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Thử Đồ Việt Phục Trên Ảnh Cá Nhân Bằng AI (F05)
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Hướng dẫn tiêu chuẩn ảnh */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Hướng dẫn chọn ảnh:</strong> Chụp tư thế đứng thẳng, ánh sáng tự nhiên rõ nét, mặc trang phục gọn gàng (áo phông/quần jeans) để AI nhận diện vóc dáng tốt nhất.
            </div>
          </div>

          {/* Chọn ảnh mẫu hoặc nhập URL */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
              Chọn ảnh người mẫu thử nghiệm
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DEMO_PHOTOS.map((demo, idx) => (
                <button
                  key={idx}
                  onClick={() => setPhotoUrl(demo.url)}
                  className={`p-2 rounded-xl border flex items-center space-x-3 text-left transition-all ${
                    photoUrl === demo.url
                      ? "border-heritage-red bg-heritage-red/5 ring-1 ring-heritage-red"
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                >
                  <img
                    src={demo.url}
                    alt={demo.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="text-xs font-medium text-stone-800">{demo.name}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Hoặc dán URL ảnh cá nhân của bạn..."
                className="flex-1 text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>
          </div>

          {/* Hiển thị tiến trình hoặc kết quả */}
          {errorMessage && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
          {jobStatus && (
            <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700">Trạng thái tác vụ:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    jobStatus === "succeeded"
                      ? "bg-emerald-100 text-emerald-800"
                      : jobStatus === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800 animate-pulse"
                  }`}
                >
                  {jobStatus === "succeeded"
                    ? "Đã hoàn thành"
                    : jobStatus === "running"
                    ? "Đang xử lý AI"
                    : jobStatus === "queued"
                    ? "Đang xếp hàng"
                    : "Lỗi"}
                </span>
              </div>

              {jobStatus === "succeeded" && resultImageUrl && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-stone-500 font-medium">Ảnh gốc người mặc:</span>
                    <img
                      src={photoUrl}
                      alt="Gốc"
                      className="w-full h-56 object-cover rounded-lg border border-stone-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-heritage-red font-bold flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kết quả ướm thử AI:</span>
                    </span>
                    <img
                      src={resultImageUrl}
                      alt="Kết quả"
                      className="w-full h-56 object-cover rounded-lg border-2 border-heritage-red shadow-md"
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Lưu ý quan trọng theo mục F05 trong tài liệu */}
          <div className="text-[11px] text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">
            <strong>Ghi chú văn hóa & kỹ thuật:</strong> Ảnh thử đồ AI là kết quả bổ sung hỗ trợ hình dung thẩm mỹ, không thay thế bản phối 2D Studio và không được mô tả như cam kết vừa vặn số đo thực tế.
          </div>

          {/* Nút hành động */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-medium hover:bg-stone-50"
            >
              Đóng
            </button>
            <button
              onClick={handleStartTryOn}
              disabled={isSubmitting || !photoUrl || jobStatus === "queued" || jobStatus === "running"}
              className="px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 transition-all shadow-sm"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Tạo ảnh Thử đồ AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
