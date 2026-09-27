"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CatalogItem, OutfitSnapshot } from "@/lib/types/api";
import type { OutfitSpecV2 } from "@/lib/types/v3";
import { v3Api, type GenerationRequest } from "@/lib/api/v3Client";
import { buildManualTryOnPrompt } from "@/features/studio/tryOnPrompt";
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
  catalogItems: CatalogItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  onReloadCatalog: () => Promise<void>;
  ownerId?: string;
  onReplaceUnavailableItems: () => void;
  onExportOutfit: () => Promise<string>;
  onSaveOutfit: () => Promise<boolean>;
  isLoggedIn: boolean;
}

type GenerationStatus = "uploading" | "generating" | "loading_result" | "succeeded" | "failed" | null;
type SavedGeneration = { request: GenerationRequest; jobId?: string; fingerprint: string };

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
  catalogItems,
  catalogLoading,
  catalogError,
  onReloadCatalog,
  ownerId,
  onReplaceUnavailableItems,
  onExportOutfit,
  onSaveOutfit,
  isLoggedIn,
}: GeminiTryOnModalProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultMediaId, setResultMediaId] = useState<string | null>(null);
  const [hasPendingJob, setHasPendingJob] = useState(false);
  const inFlight = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const savedGeneration = useRef<SavedGeneration | null>(null);
  const fingerprint = JSON.stringify(snapshot);
  const storageKey = ownerId ? `vietstylist_generation:${ownerId}` : null;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(GEMINI_IMAGE_MODELS[0].id);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [generationAvailable, setGenerationAvailable] = useState<boolean | null>(null);
  const availableItemIds = useMemo(() => new Set(catalogItems.filter(item => item.is_published).map(item => item.id)), [catalogItems]);
  const unavailableItems = useMemo(
    () => catalogLoading || catalogError ? [] : snapshot.items.filter(item => !availableItemIds.has(item.itemId)),
    [snapshot.items, availableItemIds, catalogLoading, catalogError],
  );
  const photoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const manualPrompt = useMemo(
    () => buildManualTryOnPrompt(outfitTitle, snapshot, catalogItems, !!photo),
    [outfitTitle, snapshot, catalogItems, photo],
  );

  const persistGeneration = (value: SavedGeneration | null) => {
    savedGeneration.current = value;
    if (!storageKey) return;
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Keep the in-memory receipt if browser storage is unavailable. */ }
  };

  const followGeneration = async (saved: SavedGeneration, signal: AbortSignal) => {
    const active = () => { if (signal.aborted) throw new DOMException("Aborted", "AbortError"); };
    let job = saved.jobId ? await v3Api.getGenerationJob(saved.jobId, signal) : await v3Api.startGeneration(saved.request, signal);
    active();
    saved = { ...saved, jobId: job.job_id };
    persistGeneration(saved);
    const deadline = Date.now() + 250000;
    while (job.status === "running") {
      if (Date.now() >= deadline) throw new Error("Chưa nhận được kết quả. Chọn Kiểm tra lại kết quả để tiếp tục theo dõi lần tạo này.");
      const pollStarted = Date.now();
      job = await v3Api.getGenerationJob(job.job_id, signal, 10);
      active();
      // Older servers may ignore long polling. Keep the original request-rate
      // bound on running receipts without delaying an already finished result.
      const delay = Math.max(0, 1500 - (Date.now() - pollStarted));
      if (job.status === "running" && delay) {
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, delay);
          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
      }
    }
    if (job.status === "failed") {
      persistGeneration(null);
      setHasPendingJob(false);
      throw new Error(job.error?.message || "Không thể hoàn tất lần tạo ảnh.");
    }
    if (!job.result?.result_media_id) throw new Error("Máy chủ chưa trả về ảnh kết quả hợp lệ.");
    setHasPendingJob(false);
    setResultMediaId(job.result.result_media_id);
    const url = await v3Api.getMediaAccessUrl(job.result.result_media_id);
    active();
    setStatus("loading_result");
    setResultImageUrl(url);
  };

  const resumeGeneration = async (saved: SavedGeneration) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setHasPendingJob(true);
    setErrorMessage(null);
    setStatus("generating");
    try { await followGeneration(saved, controller.signal); }
    catch (error) {
      if (!controller.signal.aborted) { setStatus("failed"); setErrorMessage((error as Error).message); }
    } finally { if (operation.current === controller) inFlight.current = false; }
  };

  useEffect(() => {
    setPhoto(null); setPhotoPreview(null); setResultImageUrl(null); setResultMediaId(null); setStatus(null); setErrorMessage(null);
    setHasPendingJob(false); savedGeneration.current = null;
    return () => { operation.current?.abort(); operation.current = null; inFlight.current = false; };
  }, [fingerprint, ownerId]);

  useEffect(() => {
    if (!isOpen || !storageKey || inFlight.current) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as SavedGeneration | null;
      if (saved?.fingerprint === fingerprint && saved.request?.idempotency_key) {
        savedGeneration.current = saved;
        void resumeGeneration(saved);
      }
    } catch { /* Ignore an unreadable local receipt. */ }
    // Resume when opening the outfit, not when polling changes state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storageKey, fingerprint]);

  useEffect(() => {
    if (status !== "loading_result") return;
    const timer = setTimeout(() => { setStatus("failed"); setErrorMessage("Ảnh đã được tạo nhưng tải quá lâu. Chọn Tải lại ảnh kết quả."); }, 20000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setGenerationAvailable(null);
    v3Api.getGenerationStatus()
      .then(result => { if (active) setGenerationAvailable(result.enabled); })
      .catch(() => { if (active) setGenerationAvailable(false); });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (photoPreview) photoRef.current?.scrollIntoView({ block: "center" });
  }, [photoPreview]);

  useEffect(() => {
    if (resultImageUrl) resultRef.current?.scrollIntoView({ block: "center" });
  }, [resultImageUrl]);

  useEffect(() => {
    if (errorMessage) errorRef.current?.scrollIntoView({ block: "center" });
  }, [errorMessage]);

  const handlePhoto = (file?: File) => {
    if (inFlight.current || hasPendingJob || status === "loading_result") return;
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrorMessage("Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setErrorMessage("Ảnh nhân vật phải nhỏ hơn hoặc bằng 10 MB."); return; }
    setResultMediaId(null);
    persistGeneration(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setResultImageUrl(null);
    setErrorMessage(null);
    setMappingNotice(null);
    setStatus(null);
  };

  const handleStartTryOn = async () => {
    if (inFlight.current || hasPendingJob || !snapshot.items.length || catalogLoading || catalogError || unavailableItems.length || generationAvailable !== true || status === "loading_result") return;
    if (!isLoggedIn) { setErrorMessage("Vui lòng đăng nhập trước khi tạo ảnh thử đồ."); return; }
    inFlight.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setStatus("uploading");
    setResultMediaId(null);
    setErrorMessage(null);
    setMappingNotice(null);
    setResultImageUrl(null);
    try {
      const datasetVersion = snapshot.culturalSettings?.dataset_version || "dev";
      let outfit: OutfitSpecV2;
      let unmappedCount = 0;
      try {
        const mappings = await v3Api.getLegacyMappings(datasetVersion);
        outfit = snapshotV1ToSpecV2(snapshot, mappings);
        unmappedCount = mappingIssues(outfit).filter((issue) => issue.slot !== "context").length;
      } catch (error) {
        if (snapshot.culturalSettings) throw error;
        // The visual try-on can use published catalog items even when the
        // optional V3 cultural mappings are unavailable.
        outfit = { schema_version: "2.0", dataset_version: "dev", selections: [] };
        unmappedCount = snapshot.items.length;
      }
      if (controller.signal.aborted) return;
      if (unmappedCount) {
        setMappingNotice(
          `${unmappedCount} món chưa có thẩm định V3. AI vẫn dùng ảnh bản phối và thông tin kho trang phục; kết quả chưa được xác nhận về văn hóa.`,
        );
      }

      setStatus("uploading");
      const boardUrl = await onExportOutfit();
      if (controller.signal.aborted) return;
      const boardBlob = await (await fetch(boardUrl)).blob();
      if (boardBlob.size > 10 * 1024 * 1024) {
        throw new Error("Ảnh bản phối vượt 10 MB. Hãy chọn ít món hoặc ảnh nhỏ hơn rồi thử lại.");
      }
      const board = new File([boardBlob], "studio-outfit.png", { type: "image/png" });
      const [outfitImageId, userImageId] = await v3Api.uploadTryOnImages(board, photo, controller.signal);
      if (controller.signal.aborted) return;
      setStatus("generating");
      const saved: SavedGeneration = { fingerprint, request: {
        outfit, legacy_item_ids: snapshot.items.map(item => item.itemId), outfit_image_id: outfitImageId,
        user_image_id: userImageId, model_id: modelId, options: {}, idempotency_key: crypto.randomUUID(),
      } };
      persistGeneration(saved);
      setHasPendingJob(true);
      await followGeneration(saved, controller.signal);
    } catch (error: any) {
      if (!controller.signal.aborted) {
        setStatus("failed");
        setErrorMessage(error?.message || "Không thể tạo ảnh thử đồ.");
      }
    } finally {
      if (operation.current === controller) inFlight.current = false;
    }
  };

  const handleDownloadOutfit = async () => {
    setManualBusy(true);
    setManualNotice(null);
    try {
      const url = await onExportOutfit();
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "vietstylist-ban-phoi.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setManualNotice("Đã tải ảnh bản phối. Hãy đính kèm ảnh này khi dùng prompt ở công cụ khác.");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setManualBusy(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!isLoggedIn) {
      setManualNotice("Bản nháp vẫn ở trình duyệt. Đăng nhập rồi chọn Lưu bộ phối để lưu lên tài khoản.");
      return;
    }
    setManualBusy(true);
    setManualNotice(null);
    try {
      const saved = await onSaveOutfit();
      setManualNotice(saved ? "Đã lưu bộ phối vào tài khoản." : "Chưa lưu được bộ phối; bản nháp vẫn được giữ trong Studio.");
    } finally {
      setManualBusy(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(manualPrompt);
      setManualNotice("Đã sao chép prompt. Đính kèm ảnh bản phối, và ảnh nhân vật nếu có.");
    } catch {
      setManualNotice("Không thể sao chép tự động. Hãy chọn và sao chép nội dung trong ô prompt.");
    }
  };

  if (!isOpen) return null;
  const isBusy = status === "uploading" || status === "generating" || status === "loading_result";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Thử đồ bằng Gemini">
      <div className="bg-white rounded-lg max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2 min-w-0">
            <Sparkles className="w-5 h-5 text-heritage-gold shrink-0" />
            <div className="min-w-0">
              <h3 className="font-serif text-base font-bold text-stone-900">Thử đồ bằng Gemini</h3>
              <p className="text-xs text-stone-500 truncate">{outfitTitle}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isBusy} className="p-1 text-stone-400 hover:text-stone-700" title="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ảnh bản phối đang xem sẽ được gửi làm ảnh tham chiếu. Ảnh nhân vật là tùy chọn; nếu có, hãy chọn ảnh toàn thân, đứng thẳng và đủ sáng. Ảnh tải lên được lưu riêng tư trong tài khoản và gửi đến Gemini khi tạo ảnh.
            </p>
          </div>

          {catalogError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p>{catalogError}</p><button onClick={() => void onReloadCatalog()} disabled={catalogLoading} className="mt-2 underline">Tải lại kho trang phục</button>
          </div>}
          {unavailableItems.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-2">
              <p>{unavailableItems.length} món trong bản phối không còn trong danh mục đã xuất bản. Chúng vẫn được giữ trong bản phối, nhưng chưa thể xuất hoặc gửi cho AI.</p>
              <ul className="list-disc space-y-1 pl-5 text-xs">{unavailableItems.map(item => (
                <li key={`${item.slot}:${item.itemId}`}>{catalogItems.find(candidate => candidate.id === item.itemId)?.name || item.itemId} · vị trí {item.slot}</li>
              ))}</ul>
              <button type="button" onClick={onReplaceUnavailableItems} disabled={!catalogItems.length} className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
                Đóng và chọn món thay thế
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="gemini-image-model" className="block text-xs font-semibold text-stone-700">
              Model tạo ảnh
            </label>
            <select
              disabled={isBusy || hasPendingJob}
              id="gemini-image-model"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
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
              disabled={isBusy || hasPendingJob}
              accept="image/png,image/jpeg,image/webp"
              aria-label={photo ? "Chọn ảnh nhân vật khác" : "Chọn ảnh nhân vật"}
              className="sr-only"
              onChange={(event) => {
                handlePhoto(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <span className="flex items-center justify-center gap-2 text-sm font-semibold text-stone-700">
              <UploadCloud className="w-5 h-5 text-heritage-red" />
              {photo ? "Đổi ảnh nhân vật" : "Tùy chọn: tải ảnh nhân vật"}
            </span>
            {photo && <span className="mt-1 block text-center text-xs text-stone-500 truncate">{photo.name}</span>}
          </label>
          {photo && <button type="button" disabled={isBusy || hasPendingJob} onClick={() => { setPhoto(null); setPhotoPreview(null); setResultImageUrl(null); setResultMediaId(null); setStatus(null); persistGeneration(null); }} className="text-xs text-heritage-red underline">Bỏ ảnh nhân vật để AI tự chọn người mặc</button>}

          {(photoPreview || resultImageUrl) && (
            <div ref={resultRef} className={`grid gap-4 ${photoPreview && resultImageUrl ? "sm:grid-cols-2" : "max-w-xs mx-auto"}`}>
              {photoPreview && (
                <div ref={photoRef} className="space-y-1.5">
                  <span className="text-xs text-stone-500 font-medium">Ảnh gốc</span>
                  <img src={photoPreview} alt="Ảnh người mẫu đã chọn" onError={() => setErrorMessage("Không đọc được ảnh đã chọn. Hãy chọn một file JPEG, PNG hoặc WebP hợp lệ.")} className="w-full h-72 object-contain bg-stone-50 rounded-lg border border-stone-200" />
                </div>
              )}
              {resultImageUrl && (
                <div className="space-y-1.5">
                  <span className="text-xs text-heritage-red font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Kết quả Gemini
                  </span>
                  <img key={resultImageUrl} src={resultImageUrl} alt="Kết quả thử đồ Gemini" onLoad={() => { setStatus("succeeded"); setErrorMessage(null); }} onError={() => { setStatus("failed"); setErrorMessage("Ảnh đã được tạo nhưng chưa tải được. Chọn Tải lại ảnh kết quả."); }} className="w-full h-72 object-contain bg-stone-50 rounded-lg border-2 border-heritage-red" />
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
            <div ref={errorRef} role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{errorMessage}</span>
            </div>
          )}
          {isBusy && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
              <RefreshCw className="w-4 h-4 animate-spin text-heritage-red" />
              <span>{status === "uploading" ? "Đang tải và kiểm tra ảnh..." : status === "loading_result" ? "Đang tải ảnh kết quả..." : "Gemini đang tạo ảnh..."}</span>
            </div>
          )}
          {status === "succeeded" && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /><span>Ảnh đã tạo và tải thành công. Ảnh kết quả được lưu trong Tài khoản → Ảnh AI.</span>
            </div>
          )}

          {!isBusy && hasPendingJob && <button className="text-sm underline" onClick={() => { if (savedGeneration.current) void resumeGeneration(savedGeneration.current); }}>Kiểm tra lại kết quả</button>}
          {!isBusy && resultMediaId && <button className="text-sm underline" onClick={() => { setResultImageUrl(null); if (savedGeneration.current) void resumeGeneration(savedGeneration.current); }}>Tải lại ảnh kết quả</button>}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-stone-900">Chế độ thủ công khi Gemini không khả dụng</h4>
              <p className="text-xs text-stone-600">Lưu bộ phối, tải ảnh bản phối và dán prompt vào công cụ tạo ảnh khác. Nếu có ảnh nhân vật, đính kèm ảnh đó làm ảnh thứ hai.</p>
            </div>
            <textarea aria-label="Prompt thử đồ thủ công" readOnly value={manualPrompt} rows={6} className="w-full rounded-md border border-stone-300 bg-white p-2 text-xs text-stone-800" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={manualBusy || !snapshot.items.length} onClick={handleSaveOutfit} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Lưu bộ phối</button>
              <button type="button" disabled={manualBusy || !snapshot.items.length || catalogLoading || unavailableItems.length > 0} onClick={handleDownloadOutfit} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Tải ảnh bản phối</button>
              <button type="button" disabled={!snapshot.items.length || catalogLoading || unavailableItems.length > 0} onClick={handleCopyPrompt} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Sao chép prompt</button>
            </div>
            {manualNotice && <p role="status" className="text-xs text-stone-700">{manualNotice}</p>}
          </div>

          {generationAvailable === false && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Gemini chưa được bật hoặc không thể kiểm tra trạng thái. Bạn vẫn có thể tải ảnh bản phối và sao chép prompt ở chế độ thủ công.
            </div>
          )}

          <div className="text-[11px] text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">
            <strong>Lưu ý:</strong> Dữ liệu Áo dài và Áo tứ thân đang ở giai đoạn thí điểm. Kết quả AI dùng để đánh giá chất lượng hình ảnh, không phải xác nhận học thuật hay độ vừa vặn thực tế.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} disabled={isBusy} className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-medium hover:bg-stone-50">Đóng</button>
            <button
              onClick={handleStartTryOn}
              disabled={!snapshot.items.length || catalogLoading || !!catalogError || unavailableItems.length > 0 || generationAvailable !== true || isBusy || hasPendingJob}
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
