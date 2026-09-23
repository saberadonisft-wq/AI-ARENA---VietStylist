"use client";

import React, { useEffect, useState } from "react";
import { OutfitSnapshot } from "@/lib/types/api";
import { v3Api } from "@/lib/api/v3Client";
import {
  mappingIssues,
  snapshotV1ToSpecV2,
} from "@/features/composer/adapters/snapshotAdapter";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

interface GeminiTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: OutfitSnapshot;
  outfitTitle: string;
}

type GenerationStatus = "uploading" | "generating" | "succeeded" | "failed" | null;

const GEMINI_IMAGE_MODELS = [
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    description: "Gemini 3.1 Flash Image - khuyến nghị, cân bằng chất lượng và tốc độ",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    description: "Gemini 3.1 Flash Lite Image - nhanh và tiết kiệm nhất",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    description: "Gemini 3 Pro Image - chất lượng cao cho yêu cầu phức tạp",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana",
    description: "Gemini 2.5 Flash Image - tương thích và độ trễ thấp",
  },
] as const;

export default function GeminiTryOnModal({
  isOpen,
  onClose,
  snapshot,
  outfitTitle,
}: GeminiTryOnModalProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(GEMINI_IMAGE_MODELS[0].id);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrorMessage("Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setResultImageUrl(null);
    setErrorMessage(null);
    setMappingNotice(null);
    setStatus(null);
  };

  const handleStartTryOn = async () => {
    if (!photo || status === "uploading" || status === "generating") return;
    setErrorMessage(null);
    setMappingNotice(null);
    setResultImageUrl(null);
    try {
      const datasetVersion = snapshot.culturalSettings?.dataset_version || "dev";
      const mappings = await v3Api.getLegacyMappings(datasetVersion);
      const outfit = snapshotV1ToSpecV2(snapshot, mappings);
      const issues = mappingIssues(outfit).filter((issue) => issue.slot !== "context");
      if (!outfit.selections.length) {
        throw new Error(
          "Bộ phối chưa có món dữ liệu thí điểm đã được ánh xạ. Hãy chọn một mẫu Áo dài hoặc Áo tứ thân trước.",
        );
      }
      if (issues.length) {
        setMappingNotice(
          `${issues.length} món phụ chưa có dữ liệu V3 nên không được đưa vào prompt thử nghiệm.`,
        );
      }

      setStatus("uploading");
      const userImageId = await v3Api.uploadPrivateImage(photo);
      setStatus("generating");
      const result = await v3Api.synthesize(outfit, userImageId, modelId);
      if (result.status !== "completed" || !result.result_media_id) {
        throw new Error("Gemini chưa trả về ảnh kết quả hợp lệ.");
      }
      setResultImageUrl(await v3Api.getMediaAccessUrl(result.result_media_id));
      setStatus("succeeded");
    } catch (error: any) {
      setStatus("failed");
      setErrorMessage(error?.message || "Không thể tạo ảnh thử đồ.");
    }
  };

  if (!isOpen) return null;
  const isBusy = status === "uploading" || status === "generating";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2 min-w-0">
            <Sparkles className="w-5 h-5 text-heritage-gold shrink-0" />
            <div className="min-w-0">
              <h3 className="font-serif text-base font-bold text-stone-900">Thử đồ bằng Gemini</h3>
              <p className="text-xs text-stone-500 truncate">{outfitTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700" title="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Chọn ảnh toàn thân, đứng thẳng và đủ sáng. Ảnh được lưu riêng tư và chỉ dùng cho lần tạo ảnh này.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="gemini-image-model" className="block text-xs font-semibold text-stone-700">
              Model tạo ảnh
            </label>
            <select
              id="gemini-image-model"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              disabled={isBusy}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition-colors focus:border-heritage-red focus:ring-2 focus:ring-heritage-red/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {GEMINI_IMAGE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500">
              {GEMINI_IMAGE_MODELS.find((model) => model.id === modelId)?.description}
            </p>
          </div>

          <label className="block border border-dashed border-stone-300 rounded-lg p-4 cursor-pointer hover:border-heritage-red hover:bg-stone-50 transition-colors">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => handlePhoto(event.target.files?.[0])}
            />
            <span className="flex items-center justify-center gap-2 text-sm font-semibold text-stone-700">
              <UploadCloud className="w-5 h-5 text-heritage-red" />
              {photo ? "Đổi ảnh người mẫu" : "Chọn ảnh người mẫu từ máy"}
            </span>
            {photo && <span className="mt-1 block text-center text-xs text-stone-500 truncate">{photo.name}</span>}
          </label>

          {photoPreview && (
            <div className={`grid gap-4 ${resultImageUrl ? "sm:grid-cols-2" : "max-w-xs mx-auto"}`}>
              <div className="space-y-1.5">
                <span className="text-xs text-stone-500 font-medium">Ảnh gốc</span>
                <img src={photoPreview} alt="Ảnh người mẫu đã chọn" className="w-full h-72 object-contain bg-stone-50 rounded-lg border border-stone-200" />
              </div>
              {resultImageUrl && (
                <div className="space-y-1.5">
                  <span className="text-xs text-heritage-red font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Kết quả Gemini
                  </span>
                  <img src={resultImageUrl} alt="Kết quả thử đồ Gemini" className="w-full h-72 object-contain bg-stone-50 rounded-lg border-2 border-heritage-red" />
                </div>
              )}
            </div>
          )}

          {mappingNotice && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{mappingNotice}</span>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{errorMessage}</span>
            </div>
          )}
          {isBusy && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
              <RefreshCw className="w-4 h-4 animate-spin text-heritage-red" />
              <span>{status === "uploading" ? "Đang tải và kiểm tra ảnh..." : "Gemini đang tạo ảnh..."}</span>
            </div>
          )}
          {status === "succeeded" && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /><span>Đã tạo xong ảnh thử nghiệm.</span>
            </div>
          )}

          <div className="text-[11px] text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">
            <strong>Lưu ý:</strong> Dữ liệu Áo dài và Áo tứ thân đang ở giai đoạn thí điểm. Kết quả AI dùng để đánh giá chất lượng hình ảnh, không phải xác nhận học thuật hay độ vừa vặn thực tế.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-medium hover:bg-stone-50">Đóng</button>
            <button
              onClick={handleStartTryOn}
              disabled={!photo || isBusy}
              className="px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{status === "succeeded" ? "Tạo lại" : "Tạo ảnh thử đồ"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
