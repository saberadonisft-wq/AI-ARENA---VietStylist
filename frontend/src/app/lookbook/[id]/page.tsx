"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lookbook } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { shareUrlForOrigin } from "@/lib/shareUrl";
import { useAuth } from "@/lib/auth/context";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { ArrowLeft, Share2, Trash2, Globe, Lock, Sparkles, Check } from "lucide-react";
import { slotLabel, styleLabel, itemLabel } from "@/lib/catalog/display";
import AuthModal from "@/components/AuthModal";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import LookbookShell from "@/features/lookbook/LookbookShell";
import { control, primary } from "@/features/lookbook/PostCard";
import OutfitPreview from "@/features/studio/OutfitPreview";

export default function LookbookDetailPage() {
  const { confirm, dialog } = useConfirmDialog();
  const params = useParams();
  const router = useRouter();
  const lookbookId = params.id as string;
  const { user, isLoggedIn, isReady } = useAuth();
  const catalog = useCatalog();
  const { catalogItems, ensureLoaded } = catalog;
  const currentOwnerId = useRef(user?.id);
  currentOwnerId.current = user?.id;
  const requestGeneration = useRef(0);

  const [lookbook, setLookbook] = useState<Lookbook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  useEffect(() => { if (lookbook?.entries.length) void ensureLoaded(); }, [lookbook, ensureLoaded]);

  const loadLookbook = useCallback(async () => {
    const generation = ++requestGeneration.current;
    if (!isReady) return;
    if (!isLoggedIn || !user?.id) {
      setLookbook(null);
      setLoadedOwnerId(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    if (!lookbookId) return;
    const ownerId = user.id;
    setIsLoading(true);
    setLoadError(null);
    setLookbook(null);
    setLoadedOwnerId(null);
    setShareUrl(null);
    setActionMessage(null);
    try {
      const result = await api.getLookbook(lookbookId);
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) {
        setLookbook(result);
        setLoadedOwnerId(ownerId);
      }
    } catch (err: any) {
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) {
        setLookbook(null);
        setLoadError(err?.statusCode === 401
          ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tải Lookbook."
          : err?.message || "Không tải được Lookbook.");
      }
    } finally {
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) setIsLoading(false);
    }
  }, [isLoggedIn, isReady, lookbookId, user?.id]);

  useEffect(() => {
    void loadLookbook();
    return () => { requestGeneration.current++; };
  }, [loadLookbook]);

  const handleShare = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    const ownerId = user?.id;
    if (!ownerId || loadedOwnerId !== ownerId || isSharing) return;
    setIsSharing(true);
    setActionMessage(null);
    try {
      const res = await api.shareLookbook(lookbookId, 30);
      if (ownerId === currentOwnerId.current && loadedOwnerId === ownerId) {
        setShareUrl(shareUrlForOrigin(res.share_token, window.location.origin));
      setActionMessage("Đã tạo liên kết xem có hiệu lực trong 30 ngày.");
      }
    } catch (err: any) {
      if (ownerId === currentOwnerId.current) setActionMessage("Không tạo được liên kết chia sẻ: " + (err?.message || "Máy chủ không khả dụng."));
    } finally {
      if (ownerId === currentOwnerId.current) setIsSharing(false);
    }
  };

  const changeVisibility = async (visibility: string) => {
    const ownerId = user?.id;
    if (!ownerId || lookbook?.owner_id !== ownerId || isChangingVisibility) return;
    setIsChangingVisibility(true);
    try {
      const updated = await api.updateLookbook(lookbookId, { visibility });
      if (ownerId !== currentOwnerId.current) return;
      setLookbook(updated); setShareUrl(null);
      setActionMessage(visibility === 'private' ? 'Đã chuyển riêng tư và thu hồi các link chia sẻ.' : 'Đã cập nhật quyền xem bộ sưu tập.');
    } catch (err: any) { if (ownerId === currentOwnerId.current) setActionMessage(err.message); }
    finally { if (ownerId === currentOwnerId.current) setIsChangingVisibility(false); }
  };

  const handleDelete = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    const ownerId = user?.id;
    const currentLookbook = lookbook;
    if (!ownerId || !currentLookbook || loadedOwnerId !== ownerId || isDeleting) return;
    if (!await confirm({
      title: "Xóa Lookbook này?",
      description: `“${currentLookbook.title}” sẽ bị xóa khỏi danh sách Lookbook. Các bộ phối đã lưu trong Tủ đồ vẫn được giữ.`,
      confirmLabel: "Xóa Lookbook",
      tone: "danger",
    })) return;
    setIsDeleting(true);
    try {
      await api.deleteLookbook(lookbookId);
      if (ownerId === currentOwnerId.current) router.push("/lookbook");
    } catch (err: any) {
      if (ownerId === currentOwnerId.current) setActionMessage("Không xóa được Lookbook: " + (err?.message || "Máy chủ không khả dụng."));
    } finally {
      if (ownerId === currentOwnerId.current) setIsDeleting(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Đã sao chép liên kết chia sẻ.");
    } catch { setActionMessage("Trình duyệt không cho phép sao chép. Bôi đen liên kết bên dưới để sao chép thủ công."); }
  };

  if (!isReady || isLoading || (isLoggedIn && lookbook && loadedOwnerId !== user?.id)) {
    return <LookbookShell activeTab="collections"><p role="status" className="lookbook-panel p-5 text-sm text-stone-500">Đang tải chi tiết Lookbook...</p></LookbookShell>;
  }

  if (!isLoggedIn) {
    return (
      <LookbookShell activeTab="collections"><div className="lookbook-panel space-y-4 p-6 text-center">
        <h2 className="text-xl font-semibold text-stone-900">Đăng nhập để xem Lookbook của bạn</h2>
        <p className="text-sm text-stone-600">Lookbook thuộc tài khoản cá nhân. Đăng nhập để tiếp tục xem và quản lý.</p>
        <button type="button" onClick={() => setShowAuthModal(true)} className={primary}>Đăng nhập</button>
        <Link href="/lookbook" className="block text-sm text-heritage-red font-semibold hover:underline">Quay lại danh sách</Link>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div></LookbookShell>
    );
  }

  if (!lookbook) {
    return (
      <LookbookShell activeTab="collections"><div className="lookbook-panel space-y-4 p-6 text-center">
        <h2 className="text-xl font-semibold text-stone-900">{loadError ? "Không tải được Lookbook" : "Không tìm thấy Lookbook"}</h2>
        {loadError && <p role="alert" className="text-sm text-rose-800">{loadError}</p>}
        {loadError && <button type="button" onClick={() => void loadLookbook()} className={control}>Thử tải lại</button>}
        <Link href="/lookbook" className="text-xs text-heritage-red font-semibold hover:underline">
          ← Quay lại danh sách
        </Link>
      </div></LookbookShell>
    );
  }

  return (
    <LookbookShell activeTab="collections">
      {/* Top bar */}
      <div className="lookbook-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <Link
          href="/lookbook?tab=collections"
          className="inline-flex min-h-11 items-center space-x-1.5 text-sm font-semibold text-stone-600 hover:text-heritage-red"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Lookbook</span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleShare}
            disabled={isSharing}
            aria-label="Tạo liên kết chia sẻ Lookbook"
            title={isSharing ? "Đang tạo liên kết" : "Tạo liên kết chia sẻ"}
            className={control}
          >
            <Share2 className="w-4 h-4 text-heritage-indigo" />
            <span>{isSharing ? "Đang tạo liên kết…" : "Tạo liên kết chia sẻ"}</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50"
            title="Xóa Lookbook"
            aria-label="Xóa Lookbook"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thông báo chia sẻ */}
      {shareUrl && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-emerald-900">
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="font-bold flex items-center space-x-1">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Liên kết xem có hiệu lực trong 30 ngày:</span>
            </span>
            <span className="font-mono text-emerald-700 select-all block break-all text-[11px]">{shareUrl}</span>
          </div>
          <button
            onClick={() => void copyShareLink()}
            className="min-h-11 shrink-0 whitespace-nowrap px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            Sao chép liên kết
          </button>
        </div>
      )}

      {actionMessage && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{actionMessage}</div>}

      {/* Header thông tin Lookbook */}
      <div className="lookbook-panel space-y-4 p-5">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 text-stone-700 flex items-center space-x-1">
            {lookbook.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            <span>{lookbook.visibility === "public" ? "Công khai" : lookbook.visibility === "unlisted" ? "Người có liên kết" : "Riêng tư"}</span>
          </span>
          <span className="text-xs text-stone-400">
            Khởi tạo ngày: {new Date(lookbook.created_at).toLocaleDateString("vi-VN")}
          </span>
        </div>

        <h2 className="text-xl font-semibold text-stone-900 [overflow-wrap:anywhere]">{lookbook.title}</h2>
        <p className="text-stone-600 text-sm leading-relaxed [overflow-wrap:anywhere]">{lookbook.description}</p>
        {lookbook.owner_id === user?.id && <label className="block max-w-sm space-y-2 text-sm"><span className="font-semibold">Quyền xem bộ sưu tập</span><select value={lookbook.visibility} disabled={isChangingVisibility} onChange={event => void changeVisibility(event.target.value)} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2"><option value="private">Riêng tư — chỉ mình tôi</option><option value="unlisted">Người có liên kết</option><option value="public">Công khai</option></select><span className="block text-xs text-stone-600">Link cũ của bộ sưu tập riêng tư đã được thu hồi. Chọn Người có liên kết để tạo link mới.</span></label>}
      </div>

      {/* Danh sách các bộ phối trong Lookbook */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-stone-900">
          Các bộ phối trong bộ sưu tập ({lookbook.entries.length})
        </h3>

        {lookbook.entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-xs text-stone-500">
            Chưa có bộ phối nào được thêm vào Lookbook này.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {lookbook.entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="lookbook-panel flex min-w-0 flex-col justify-between space-y-4 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-900 [overflow-wrap:anywhere]">
                    #{idx + 1}. {entry.outfit_title.trim() || "Bộ phối chưa đặt tên"}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    Phiên bản v{entry.version_number}
                  </span>
                </div>

                <OutfitPreview
                  outfit={{
                    id: entry.outfit_id, owner_id: lookbook.owner_id,
                    title: entry.outfit_title.trim() || "Bộ phối chưa đặt tên",
                    style_mode: entry.snapshot.styleMode,
                    occasion_id: entry.snapshot.occasionId,
                    revision: entry.version_number,
                    current_version_id: entry.outfit_version_id,
                    current_snapshot: entry.snapshot,
                    preview_image_url: entry.preview_image_url,
                    created_at: lookbook.created_at, updated_at: lookbook.updated_at,
                  }}
                  catalogItems={catalogItems} catalogLoading={catalog.itemsLoading}
                  catalogError={catalog.itemsError} onRetryCatalog={() => void catalog.refreshCatalog()} />

                {/* Tóm tắt các món trong bộ phối */}
                <div className="space-y-1.5 text-xs bg-page p-3 rounded-xl border border-stone-100">
                  {entry.snapshot.items.map((it) => (
                    <div key={it.slot} className="flex min-w-0 items-start justify-between gap-3">
                      <span className="shrink-0 text-stone-500">{slotLabel(it.slot)}:</span>
                      <span className="min-w-0 break-words text-right font-medium text-stone-800 [overflow-wrap:anywhere]" title={itemLabel(it.itemId, catalogItems)}>
                        {itemLabel(it.itemId, catalogItems)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 text-xs">
                  <span className="text-[11px] text-stone-500">
                    Phong cách: <strong className="capitalize">{styleLabel(entry.snapshot.styleMode)}</strong>
                  </span>
                  <Link
                    href={`/studio?loadOutfit=${encodeURIComponent(entry.outfit_id)}`}
                    className={control + ' px-3'}
                  >
                    Mở lại trong Studio
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      {dialog}
    </LookbookShell>
  );
}
