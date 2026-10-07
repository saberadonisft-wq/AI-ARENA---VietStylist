"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { occasionLabel, styleLabel, itemLabel } from "@/lib/catalog/display";
import { useAuth } from "@/lib/auth/context";
import { api, API_ORIGIN } from "@/lib/api/client";
import { OutfitResponse } from "@/lib/types/api";
import type { AIMediaItem } from "@/lib/types/api";
import AuthModal from "@/components/AuthModal";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import OutfitPreview from "@/features/studio/OutfitPreview";
import { CommunityAvatar } from "@/features/lookbook/PostCard";
import "@/features/account/account-workspace.css";
import {
  Sparkles,
  Layers,
  Trash2,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FolderHeart,
  ArrowRight,
  Server,
  Crown,
  Camera,
} from "lucide-react";

const AdminWorkspace = dynamic(() => import("@/features/admin/AdminWorkspace"), {
  loading: () => <p role="status" className="text-sm text-stone-500">Đang tải công cụ quản trị…</p>,
});

export default function TaiKhoanPage() {
  const router = useRouter();
  const { user, isLoggedIn, isAdmin, isStylist, isReady, logout } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const { catalogItems, occasions, itemsLoading: catalogLoading, itemsLoaded: catalogLoaded, itemsError, refreshCatalog } = useCatalog();
  const currentOwnerId = useRef(user?.id);
  currentOwnerId.current = user?.id;
  const outfitsRequestId = useRef(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Dynamic initial tab based on role
  const [activeTab, setActiveTab] = useState<string>("outfits");
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [outfitsCursor, setOutfitsCursor] = useState<string | null>(null);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [backendHealth, setBackendHealth] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [outfitLoadError, setOutfitLoadError] = useState<string | null>(null);
  const [aiMedia, setAiMedia] = useState<AIMediaItem[]>([]);
  const [aiMediaUrls, setAiMediaUrls] = useState<Record<string, string>>({});
  const [aiMediaError, setAiMediaError] = useState<string | null>(null);
  const [loadingAiMedia, setLoadingAiMedia] = useState(false);
  const [hasMoreAiMedia, setHasMoreAiMedia] = useState(false);
  const [deletingAiMediaId, setDeletingAiMediaId] = useState<string | null>(null);
  const [pendingAiMediaDelete, setPendingAiMediaDelete] = useState<AIMediaItem | null>(null);
  const [aiMediaDeleteError, setAiMediaDeleteError] = useState<string | null>(null);
  const cancelAiMediaDeleteRef = useRef<HTMLButtonElement>(null);
  const aiMediaDeleteDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setActiveTab("privacy");
    } else if (isAdmin) {
      setActiveTab("admin_hub");
    } else {
      setActiveTab("outfits");
    }
  }, [isAdmin, isLoggedIn]);

  useEffect(() => {
    setAiMedia([]);
    setAiMediaUrls({});
    setAiMediaError(null);
    setHasMoreAiMedia(false);
    setPendingAiMediaDelete(null);
    setAiMediaDeleteError(null);
  }, [user?.id]);

  useEffect(() => {
    if (!pendingAiMediaDelete || activeTab !== "ai_media") return;
    cancelAiMediaDeleteRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingAiMediaId) {
        setPendingAiMediaDelete(null);
        setAiMediaDeleteError(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingAiMediaDelete, activeTab, deletingAiMediaId]);

  // Lấy dữ liệu outfits và trạng thái hệ thống
  useEffect(() => {
    fetchOutfits();
    checkBackend();
  }, [user?.id]);

  const showNotification = (text: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchOutfits = async (append = false) => {
    const ownerId = user?.id;
    const requestId = ++outfitsRequestId.current;
    if (!ownerId) {
      setOutfits([]);
      setOutfitsCursor(null);
      setOutfitLoadError(null);
      setLoadingOutfits(false);
      return;
    }
    setLoadingOutfits(true);
    setOutfitLoadError(null);
    if (!append) {
      setOutfits([]);
      setOutfitsCursor(null);
    }
    try {
      const data = await api.listUserOutfitsPage(append ? outfitsCursor : null);
      if (currentOwnerId.current !== ownerId || requestId !== outfitsRequestId.current) return;
      setOutfits(current => append ? [...current.filter(outfit => !data.items.some(row => row.id === outfit.id)), ...data.items] : data.items);
      setOutfitsCursor(data.next_cursor);
    } catch (err: any) {
      if (currentOwnerId.current !== ownerId || requestId !== outfitsRequestId.current) return;
      console.warn("Không thể tải danh sách outfit:", err?.message);
      setOutfitLoadError(err?.message || "Không tải được danh sách bộ phối.");
    } finally {
      if (currentOwnerId.current === ownerId && requestId === outfitsRequestId.current) setLoadingOutfits(false);
    }
  };

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/ready`);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: "degraded", code: res.status });
      }
    } catch {
      setBackendHealth({ status: "unreachable" });
    }
  };

  // Xóa bộ phối
  const handleDeleteOutfit = async (outfitId: string, title: string) => {
    if (!await confirm({
      title: "Xóa bộ phối đã lưu?",
      description: `“${title}” sẽ bị xóa khỏi Tủ đồ của bạn.`,
      confirmLabel: "Xóa bộ phối",
      tone: "danger",
    })) return;
    try {
      await api.deleteOutfit(outfitId);
      setOutfits((prev) => prev.filter((o) => o.id !== outfitId));
      showNotification(`Đã xóa bộ phối "${title}" thành công.`, "success");
    } catch (err: any) {
      showNotification(`Lỗi khi xóa: ${err.message}`, "error");
    }
  };

  // Open the saved server version in Studio.
  const handleOpenInStudio = (outfit: OutfitResponse) => {
    router.push(`/studio?loadOutfit=${encodeURIComponent(outfit.id)}`);
  };

  // Xóa dữ liệu cá nhân theo quyền riêng tư
  const handlePurgePersonalData = async () => {
    if (!await confirm({
      title: "Dọn dữ liệu ViệtStylist trên thiết bị này?",
      description: "Xóa thông tin phiên AI và đăng xuất khỏi trình duyệt này. Bộ phối, Lookbook và ảnh AI trên máy chủ vẫn còn trong tài khoản.",
      confirmLabel: "Dọn dữ liệu trên thiết bị",
      tone: "danger",
    })) return;
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("viet_stylist_") || key.startsWith("vietstylist_")) localStorage.removeItem(key);
      }
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("vietstylist_") || key.startsWith("viet_stylist_")) sessionStorage.removeItem(key);
      }
      logout();
      showNotification("Đã dọn dữ liệu ViệtStylist trên thiết bị này. Ảnh AI trong tài khoản vẫn còn.", "success");
    } catch {
      showNotification("Chưa dọn hết được dữ liệu trên thiết bị. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.", "error");
    }
  };

  const loadAiMedia = useCallback(async (offset = 0, append = false) => {
    const ownerId = user?.id;
    if (!isLoggedIn || !ownerId) return;
    setLoadingAiMedia(true);
    setAiMediaError(null);
    try {
      const rows = await api.listAiMedia(100, offset);
      if (currentOwnerId.current !== ownerId) return;
      setAiMedia(current => append ? [...current.filter(item => !rows.some(row => row.media_id === item.media_id)), ...rows] : rows);
      setHasMoreAiMedia(rows.length === 100);
      const entries = await Promise.all(rows.filter(row => row.status === "ready").map(async row => {
        try { return [row.media_id, (await api.getMediaAccess(row.media_id)).access_url] as const; }
        catch { return [row.media_id, ""] as const; }
      }));
      if (currentOwnerId.current !== ownerId) return;
      setAiMediaUrls(current => ({ ...(!append ? {} : current), ...Object.fromEntries(entries.filter(([, url]) => url)) }));
    } catch (err: any) {
      if (currentOwnerId.current === ownerId) setAiMediaError(err?.message || "Không tải được danh sách ảnh AI.");
    } finally {
      if (currentOwnerId.current === ownerId) setLoadingAiMedia(false);
    }
  }, [user?.id, isLoggedIn]);

  useEffect(() => {
    if (activeTab === "ai_media" && isLoggedIn) void loadAiMedia();
    else setLoadingAiMedia(false);
  }, [activeTab, isLoggedIn, user?.id, loadAiMedia]);

  const requestDeleteAiMedia = (item: AIMediaItem) => {
    setAiMediaDeleteError(null);
    setPendingAiMediaDelete(item);
  };

  const handleDeleteAiMedia = async () => {
    const item = pendingAiMediaDelete;
    const ownerId = user?.id;
    if (!ownerId || !item || deletingAiMediaId) return;
    setDeletingAiMediaId(item.media_id);
    setAiMediaDeleteError(null);
    try {
      await api.deleteMedia(item.media_id);
      if (currentOwnerId.current !== ownerId) return;
      setAiMedia(rows => rows.map(row => row.media_id === item.media_id ? { ...row, status: "deleted" } : row));
      setAiMediaUrls(urls => { const next = { ...urls }; delete next[item.media_id]; return next; });
      showNotification("Đã xóa ảnh AI khỏi tài khoản.", "success");
      setPendingAiMediaDelete(null);
    } catch (err: any) {
      if (currentOwnerId.current === ownerId) setAiMediaDeleteError(err?.message || "Chưa xóa được ảnh AI. Hãy thử lại.");
    } finally {
      if (currentOwnerId.current === ownerId) setDeletingAiMediaId(null);
    }
  };

  // Xác định định danh giao diện theo vai trò (Role Identity)
  const roleType = !isLoggedIn
    ? "guest"
    : isAdmin
    ? "admin"
    : isStylist
    ? "stylist"
    : "member";
  return (
    <div className="account-workspace bg-page text-stone-900">
      {/* Thông báo nổi */}
      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          className={`fixed top-20 left-3 right-3 z-50 sm:left-auto sm:right-6 sm:max-w-md px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : statusMessage.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {statusMessage.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {statusMessage.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="account-wrap">
        <section className="account-panel account-profile" aria-label="Hồ sơ tài khoản">
          <div className="account-avatar"><CommunityAvatar name={user?.displayName || "Tài khoản"} imageUrl={user?.avatarUrl} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold [overflow-wrap:anywhere]">{user?.displayName || "Tài khoản"}</h1>
            {user ? <p className="mt-1 text-sm text-stone-500 [overflow-wrap:anywhere]">{user.email}</p>
              : <p className="mt-1 text-sm text-stone-500">Đăng nhập để xem bộ phối và ảnh đã lưu.</p>}
            {isReady && !isLoggedIn && <button type="button" className="account-action mt-3 bg-heritage-red text-white hover:bg-heritage-red-dark" onClick={() => setShowAuthModal(true)}>Đăng nhập</button>}
          </div>
        </section>

        <nav aria-label="Các mục tài khoản" className={`account-panel account-navigation ${roleType === "admin" ? "account-admin-navigation" : roleType === "guest" ? "account-guest-navigation" : ""}`}>
          {roleType !== "guest" && <>
            <button type="button" aria-pressed={activeTab === "outfits"} aria-label={`Bộ phối của tôi${isReady && !loadingOutfits && !outfitLoadError ? ` (${outfits.length}${outfitsCursor ? "+" : ""})` : ""}`} onClick={() => setActiveTab("outfits")} className="account-nav-item">
              <Layers size={18} aria-hidden="true" /><span>Bộ phối</span>{isReady && !loadingOutfits && !outfitLoadError && <span className="account-count" aria-hidden="true">{outfits.length}{outfitsCursor ? "+" : ""}</span>}
            </button>
            <Link href="/lookbook?tab=collections" aria-label="Bộ sưu tập Lookbook" className="account-nav-item"><FolderHeart size={18} aria-hidden="true" /><span>Lookbook</span></Link>
            <button type="button" aria-pressed={activeTab === "ai_media"} onClick={() => setActiveTab("ai_media")} className="account-nav-item"><Camera size={18} aria-hidden="true" /><span>Ảnh AI</span></button>
          </>}
          <button type="button" aria-label="Quyền riêng tư" aria-pressed={activeTab === "privacy"} onClick={() => setActiveTab("privacy")} className="account-nav-item"><Lock size={18} aria-hidden="true" /><span>Riêng tư</span></button>
          {roleType === "admin" && <>
            <button type="button" aria-pressed={activeTab === "admin_hub"} onClick={() => setActiveTab("admin_hub")} className="account-nav-item"><Crown size={18} aria-hidden="true" /><span>Quản trị</span></button>
            <button type="button" aria-pressed={activeTab === "system"} onClick={() => setActiveTab("system")} className="account-nav-item"><Server size={18} aria-hidden="true" /><span>Hệ thống</span></button>
          </>}
        </nav>

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: ADMIN HUB (DÀNH RIÊNG CHO QUẢN TRỊ VIÊN) */}
        {/* ========================================================================= */}
        {activeTab === "admin_hub" && roleType === "admin" && (
          <div className="mt-5"><AdminWorkspace /></div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: DANH SÁCH BỘ PHỐI (CHUNG CHO CÁC ROLE) */}
        {/* ========================================================================= */}
        {activeTab === "outfits" && (
          <div className="mt-5 animate-in fade-in duration-200">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Bộ phối đã lưu</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void fetchOutfits()}
                  disabled={loadingOutfits}
                  className="account-action border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-800 disabled:opacity-50"
                  title="Tải lại danh sách" aria-label="Tải lại bộ phối"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOutfits ? "animate-spin" : ""}`} />
                </button>
                <Link
                  href="/studio"
                  className="account-action bg-heritage-red text-white hover:bg-heritage-red-dark"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo bộ phối</span>
                </Link>
              </div>
            </div>

            {loadingOutfits && outfits.length === 0 ? (
              <div role="status" className="account-panel p-8 text-center">
                <div className="w-8 h-8 border-2 border-heritage-red border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-stone-500">Đang tải danh sách bộ phối...</p>
              </div>
            ) : outfitLoadError && outfits.length === 0 ? (
              <div role="alert" className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-center">
                <p className="text-sm text-rose-800">{outfitLoadError}</p>
                <button type="button" onClick={() => void fetchOutfits()} className="mt-3 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800">Thử tải lại</button>
              </div>
            ) : outfits.length === 0 ? (
              <div className="account-panel flex min-h-60 flex-col items-center justify-center p-6 text-center">
                <Layers className="mb-4 h-9 w-9 text-stone-300" aria-hidden="true" />
                <h3 className="text-base font-semibold text-stone-800">Chưa có bộ phối nào được lưu</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500">Những bộ phối bạn lưu trong Studio sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              <div className="account-outfit-grid">
                {outfits.map((outfit) => {
                  const outfitTitle = outfit.title.trim() || "Bộ phối chưa đặt tên";
                  const items = outfit.current_snapshot?.items || [];
                  const occasionName = occasionLabel(outfit.occasion_id, occasions);
                  return (
                    <div
                      key={outfit.id}
                      data-testid="saved-outfit-card"
                      className="bg-white rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                    >
                      <OutfitPreview outfit={{ ...outfit, title: outfitTitle }} catalogItems={catalogItems}
                        catalogLoading={catalogLoading || !catalogLoaded} catalogError={itemsError}
                        onRetryCatalog={refreshCatalog} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 text-base font-semibold text-stone-900 line-clamp-2">
                            {outfitTitle}
                          </h3>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {occasionName}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              outfit.style_mode === "remix"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {styleLabel(outfit.style_mode)}
                          </span>
                        </div>

                        <details className="mt-3 border-t border-stone-100">
                          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-stone-500">Trang phục · {items.length} món</summary>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center space-x-1 text-[11px] bg-stone-50 border border-stone-200 px-2 py-0.5 rounded text-stone-700"
                              >
                                <span
                                  className="w-2 h-2 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: it.colorHex || "#CBD5E0" }}
                                ></span>
                                <span className="truncate max-w-[120px]">
                                  {itemLabel(it.itemId, catalogItems)}
                                </span>
                              </span>
                            ))}
                          </div>
                        </details>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 p-3 text-sm">
                        <span className="flex items-center text-xs text-stone-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(outfit.updated_at).toLocaleDateString("vi-VN")}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenInStudio(outfit)}
                            className="account-action bg-heritage-red text-white hover:bg-heritage-red-dark"
                          >
                            <span>Mở Studio</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteOutfit(outfit.id, outfitTitle)}
                            className="account-action text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Xóa bộ phối" aria-label={`Xóa bộ phối ${outfitTitle}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {outfits.length > 0 && outfitLoadError && <p role="alert" className="mt-4 text-sm text-rose-800">{outfitLoadError}</p>}
            {outfitsCursor && <div className="mt-6 flex justify-center"><button type="button" disabled={loadingOutfits} onClick={() => void fetchOutfits(true)} className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50">{loadingOutfits ? "Đang tải bộ phối…" : outfitLoadError ? "Thử tải thêm bộ phối" : "Tải thêm bộ phối"}</button></div>}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: QUYỀN RIÊNG TƯ & MEDIA R2 (F14) */}
        {/* ========================================================================= */}
        {activeTab === "ai_media" && roleType !== "guest" && (
          <section className="mt-5 space-y-4" aria-labelledby="ai-media-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="ai-media-title" className="text-lg font-serif font-bold text-stone-900">Ảnh AI trong tài khoản</h2>
                <p className="mt-1 text-sm text-stone-600">Xem và xóa ảnh nhân vật, ảnh bản phối và kết quả được ghi nhận trong các lượt thử đồ của bạn.</p>
              </div>
              <button type="button" onClick={() => void loadAiMedia()} disabled={loadingAiMedia} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loadingAiMedia ? "animate-spin" : ""}`} /> Tải lại
              </button>
            </div>
            {aiMediaError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{aiMediaError}</div>}
            {loadingAiMedia ? <div role="status" className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Đang tải ảnh…</div>
              : !aiMediaError && aiMedia.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">Chưa có ảnh AI trong tài khoản.</div>
              : aiMedia.length > 0 ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{aiMedia.map(item => {
                const purposeNames = { person: "Ảnh nhân vật", outfit: "Ảnh bảng phối", result: "Kết quả AI" };
                const title = item.purposes.map(purpose => purposeNames[purpose]).join(" · ");
                return <article key={item.media_id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="flex aspect-[4/3] items-center justify-center bg-stone-50">
                    {item.status === "ready" && aiMediaUrls[item.media_id] ? <img src={aiMediaUrls[item.media_id]} alt={title} className="h-full w-full object-contain" />
                      : <span className="px-4 text-center text-sm text-stone-500">{item.status === "deleted" ? "Ảnh đã được xóa" : item.status === "ready" ? "Không tải được ảnh xem trước" : `Trạng thái: ${item.status}`}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-stone-900">{title}</h3><p className="text-xs text-stone-500">{new Date(item.created_at).toLocaleDateString("vi-VN")}</p></div>
                    {item.status !== "deleted" && <button type="button" disabled={deletingAiMediaId !== null} onClick={() => requestDeleteAiMedia(item)} className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Xóa ảnh</button>}
                  </div>
                </article>;
              })}</div> : null}
            {!loadingAiMedia && !aiMediaError && hasMoreAiMedia && <div className="flex justify-center"><button type="button" onClick={() => void loadAiMedia(aiMedia.length, true)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700">Tải thêm ảnh</button></div>}
          </section>
        )}

        {activeTab === "privacy" && (
          <div className="mt-5 max-w-3xl space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif font-bold text-lg text-stone-900 mb-2 flex items-center space-x-2">
                <Lock className="w-5 h-5 text-heritage-red" />
                <span>Dữ liệu và quyền riêng tư</span>
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed mb-6">
                Ảnh nhân vật và ảnh bảng phối được gửi đến Gemini khi bạn yêu cầu thử đồ AI. Ảnh được dùng cho lượt tạo ảnh và có thể được lưu trong tài khoản để bạn xem hoặc xóa tại mục Ảnh AI.
              </p>

              <div className="border-t border-stone-100 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Dọn dữ liệu trên thiết bị này
                </h4>
                <p className="text-xs text-stone-500 mb-4">
                  Xóa thông tin phiên AI và đăng xuất khỏi trình duyệt này. Ảnh AI trên máy chủ không bị xóa.
                </p>
                <button
                  onClick={handlePurgePersonalData}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dọn dữ liệu trên thiết bị</span>
                </button>
              </div>
            </div>

            <div className="account-panel p-5">
              <p className="text-sm leading-relaxed text-stone-600">
                Xóa ảnh AI chỉ tác động đến ảnh trong tài khoản. Bộ phối đã lưu và Lookbook vẫn được giữ nguyên.
                {roleType !== "guest" && <button type="button" onClick={() => setActiveTab("ai_media")} className="ml-1 font-semibold text-heritage-red underline underline-offset-2">Quản lý ảnh AI</button>}
              </p>
            </div>
          </div>
        )}

        {pendingAiMediaDelete && activeTab === "ai_media" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !deletingAiMediaId) setPendingAiMediaDelete(null); }}>
            <section ref={aiMediaDeleteDialogRef} role="dialog" aria-modal="true" aria-busy={deletingAiMediaId !== null} aria-labelledby="delete-ai-media-title" aria-describedby="delete-ai-media-description" onKeyDown={event => {
              if (event.key !== "Tab" || deletingAiMediaId) return;
              const controls = aiMediaDeleteDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
              if (!controls?.length) return;
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }} className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
              <div className="border-b border-stone-200 px-5 py-4">
                <h2 id="delete-ai-media-title" className="font-serif text-lg font-bold text-stone-900">Xóa ảnh AI khỏi tài khoản?</h2>
                <p id="delete-ai-media-description" className="mt-1 text-sm text-stone-600">Ảnh này sẽ bị xóa khỏi máy chủ. Bộ phối đã lưu và Lookbook được giữ nguyên.</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  {pendingAiMediaDelete.status === "ready" && aiMediaUrls[pendingAiMediaDelete.media_id]
                    ? <img src={aiMediaUrls[pendingAiMediaDelete.media_id]} alt="Ảnh sẽ bị xóa khỏi tài khoản" className="max-h-64 w-full object-contain" />
                    : <span className="px-5 py-10 text-center text-sm text-stone-500">{pendingAiMediaDelete.status === "deleted" ? "Ảnh đã được xóa" : "Không tải được ảnh xem trước; xác nhận vẫn sẽ xóa media này khỏi máy chủ."}</span>}
                </div>
                <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                  <p className="font-semibold">Phạm vi ảnh</p>
                  <p className="mt-1">{pendingAiMediaDelete.purposes.map(purpose => ({ person: "Ảnh nhân vật", outfit: "Ảnh bảng phối", result: "Kết quả AI" })[purpose]).join(" · ")}</p>
                  <p className="mt-1 text-xs text-stone-500">Các công việc cũ có tham chiếu đến ảnh này sẽ hiển thị trạng thái ảnh đã xóa.</p>
                </div>
                {aiMediaDeleteError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{aiMediaDeleteError}</div>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button ref={cancelAiMediaDeleteRef} type="button" disabled={deletingAiMediaId !== null} onClick={() => { setPendingAiMediaDelete(null); setAiMediaDeleteError(null); }} className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 disabled:opacity-50">Giữ ảnh</button>
                  <button type="button" disabled={deletingAiMediaId !== null} onClick={() => void handleDeleteAiMedia()} className="min-h-11 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{deletingAiMediaId ? "Đang xóa…" : aiMediaDeleteError ? "Thử xóa lại" : "Xóa ảnh khỏi tài khoản"}</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: HỆ THỐNG & API (ADMIN ONLY) */}
        {/* ========================================================================= */}
        {activeTab === "system" && roleType === "admin" && (
          <div className="mt-8 max-w-3xl space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif font-bold text-lg text-stone-900 mb-4 flex items-center space-x-2">
                <Server className="w-5 h-5 text-heritage-red" />
                <span>Trạng thái Hệ thống & Hợp đồng OpenAPI 3.0</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="account-system-row rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <span className="font-medium text-stone-700">FastAPI Backend URL</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-stone-300 text-stone-800 font-mono">
                    {API_ORIGIN}
                  </code>
                </div>
                <div className="account-system-row rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <span className="font-medium text-stone-700">Tài liệu OpenAPI Interactive (Swagger)</span>
                  <a
                    href={`${API_ORIGIN}/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-heritage-red hover:underline font-medium"
                  >
                    <span>Mở /docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="account-system-row rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <span className="font-medium text-stone-700">Trạng thái xác thực</span>
                  <span className="font-medium text-emerald-700">Đã đăng nhập</span>
                </div>
                <div className="account-system-row rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <span className="font-medium text-stone-700">Mô hình AI Gemini tích hợp</span>
                  <span className="text-stone-600">Theo cấu hình backend</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Modal Đăng nhập / Phân quyền */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
        }}
      />
      {dialog}
    </div>
  );
}
