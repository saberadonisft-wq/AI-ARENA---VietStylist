"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { occasionLabel, styleLabel, itemLabel } from "@/lib/catalog/display";
import { useAuth } from "@/lib/auth/context";
import { api, API_ORIGIN } from "@/lib/api/client";
import { OutfitResponse } from "@/lib/types/api";
import type { AIMediaItem } from "@/lib/types/api";
import AuthModal from "@/components/AuthModal";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import AdminWorkspace from "@/features/admin/AdminWorkspace";
import { sameDocument } from "@/features/studio/state";
import { DRAFT_KEY } from "@/features/studio/state";
import { ownerDraftKey, readStudioDraft, removeStudioDraft, saveOutfitDocument, writeStudioDraft } from "@/features/studio/persistence";
import type { AdminOverview } from "@/lib/api/admin";
import {
  User,
  Shield,
  Sparkles,
  Layers,
  Trash2,
  ExternalLink,
  RefreshCw,
  Clock,
  HardDrive,
  Database,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  FolderHeart,
  ArrowRight,
  ShieldAlert,
  Server,
  Palette,
  Crown,
  Camera,
  Feather,
  BookOpen,
  Share2,
  Compass,
  FileText,
  Sliders,
  Check,
  Plus,
} from "lucide-react";

export default function TaiKhoanPage() {
  const router = useRouter();
  const { user, isLoggedIn, isAdmin, isStylist, logout } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const { catalogItems, occasions } = useCatalog();
  const currentOwnerId = useRef(user?.id);
  currentOwnerId.current = user?.id;
  const outfitsRequestId = useRef(0);
  const savingDraftOwners = useRef(new Set<string>());
  const pendingDraftToSave = useRef<any | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Dynamic initial tab based on role
  const [activeTab, setActiveTab] = useState<string>("outfits");
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [localDraft, setLocalDraft] = useState<any | null>(null);
  const [backendHealth, setBackendHealth] = useState<any | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [outfitLoadError, setOutfitLoadError] = useState<string | null>(null);
  const [isSyncingDraft, setIsSyncingDraft] = useState(false);
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
      setActiveTab("drafts");
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
    setIsSyncingDraft(false);
    fetchOutfits();
    checkLocalDraft();
    checkBackend();
  }, [user?.id]);

  const showNotification = (text: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchOutfits = async () => {
    const ownerId = user?.id;
    const requestId = ++outfitsRequestId.current;
    if (!ownerId) {
      setOutfits([]);
      setOutfitLoadError(null);
      setLoadingOutfits(false);
      return;
    }
    setLoadingOutfits(true);
    setOutfitLoadError(null);
    try {
      const data = await api.listUserOutfits();
      if (currentOwnerId.current !== ownerId || requestId !== outfitsRequestId.current) return;
      setOutfits(data || []);
    } catch (err: any) {
      if (currentOwnerId.current !== ownerId || requestId !== outfitsRequestId.current) return;
      console.warn("Không thể tải danh sách outfit:", err?.message);
      setOutfitLoadError(err?.message || "Không tải được danh sách bộ phối.");
    } finally {
      if (currentOwnerId.current === ownerId && requestId === outfitsRequestId.current) setLoadingOutfits(false);
    }
  };

  const checkLocalDraft = () => {
    try {
      const ownerDraft = user?.id ? readStudioDraft(ownerDraftKey(user.id)) : null;
      const activeDraft = readStudioDraft(DRAFT_KEY);
      const visibleActive = activeDraft && ((user && activeDraft.ownerId === user.id) || (!user && !activeDraft.ownerId)) ? activeDraft : null;
      setLocalDraft(ownerDraft?.ownerId === user?.id ? ownerDraft : visibleActive);
    } catch {
      setLocalDraft(null);
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

  // Studio loads the server copy through its guarded draft resolver. Do not
  // write to the active browser draft before the user makes that choice.
  const handleOpenInStudio = (outfit: OutfitResponse) => {
    router.push(`/studio?loadOutfit=${encodeURIComponent(outfit.id)}`);
  };

  // Đồng bộ draft lên server
  const handleSyncDraftToServer = async (draftOverride?: any) => {
    const ownerId = user?.id;
    const draft = draftOverride || localDraft;
    if (!draft?.snapshot || !ownerId || savingDraftOwners.current.has(ownerId)) return;
    savingDraftOwners.current.add(ownerId);
    setIsSyncingDraft(true);
    const document = { title: draft.title || "Bộ phối từ bản nháp Studio", snapshot: draft.snapshot };
    let checkpoint = { ...draft, ownerId };
    try {
      const result = await saveOutfitDocument({
        document,
        identity: { ...draft, ownerId },
        create: (payload, idempotencyKey) => api.createOutfit(payload, idempotencyKey),
        update: (id, payload) => api.updateOutfit(id, payload),
        onPendingCreate: pending => {
          checkpoint = { ...draft, ...pending, ownerId };
          if (currentOwnerId.current === ownerId) setLocalDraft(checkpoint);
          if (!writeStudioDraft(ownerDraftKey(ownerId), checkpoint)) {
            throw new Error("Không thể lưu mã thử lại trên thiết bị. Hãy kiểm tra dung lượng lưu trữ rồi thử lại.");
          }
          if (localStorage.getItem("viet_stylist_auth_token")) writeStudioDraft(DRAFT_KEY, checkpoint);
        },
      });
      const syncedDraft = {
        ...draft,
        ...result.identity,
        ownerId,
        title: document.title,
        snapshot: document.snapshot,
        createIdempotencyKey: undefined,
        createDocument: undefined,
      };
      const ownerDraftStored = writeStudioDraft(ownerDraftKey(ownerId), syncedDraft);
      if (currentOwnerId.current === ownerId) {
        if (localStorage.getItem("viet_stylist_auth_token")) writeStudioDraft(DRAFT_KEY, syncedDraft);
        setLocalDraft(syncedDraft);
        showNotification(ownerDraftStored ? "Đã lưu bộ phối vào Tủ đồ của bạn." : "Bộ phối đã lưu trên máy chủ, nhưng bản nháp trên thiết bị chưa cập nhật được.", ownerDraftStored ? "success" : "info");
        void fetchOutfits();
      }
    } catch (err: any) {
      if (checkpoint.createIdempotencyKey && currentOwnerId.current === ownerId) setLocalDraft(checkpoint);
      const message = err?.statusCode === 401
        ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại; bản nháp vẫn được giữ."
        : err?.statusCode === 409
          ? "Bộ phối đã được thay đổi ở nơi khác. Bản nháp vẫn được giữ để bạn xử lý xung đột."
          : err?.code === "NETWORK_ERROR"
            ? "Không xác nhận được kết quả lưu do mất kết nối. Mã chống trùng vẫn được giữ để có thể thử lại."
            : `Lỗi lưu bộ phối: ${err?.message || "Máy chủ không khả dụng."}`;
      if (currentOwnerId.current === ownerId) showNotification(message, "error");
    } finally {
      savingDraftOwners.current.delete(ownerId);
      if (currentOwnerId.current === ownerId) setIsSyncingDraft(false);
    }
  };

  const requestDraftSave = () => {
    if (!visibleLocalDraft?.snapshot) return;
    if (!isLoggedIn) {
      pendingDraftToSave.current = visibleLocalDraft;
      setShowAuthModal(true);
      return;
    }
    void handleSyncDraftToServer(visibleLocalDraft);
  };

  useEffect(() => {
    const pendingDraft = pendingDraftToSave.current;
    if (!isLoggedIn || !user?.id || !pendingDraft) return;
    pendingDraftToSave.current = null;
    void handleSyncDraftToServer(pendingDraft);
  }, [isLoggedIn, user?.id]);

  // Xóa sạch draft cục bộ
  const handleClearLocalDraft = () => {
    removeStudioDraft(DRAFT_KEY);
    if (user?.id) removeStudioDraft(ownerDraftKey(user.id));
    setLocalDraft(null);
    showNotification("Đã dọn sạch bản nháp trên thiết bị này.", "info");
  };

  // Xóa dữ liệu cá nhân theo quyền riêng tư
  const handlePurgePersonalData = async () => {
    if (!await confirm({
      title: "Dọn dữ liệu ViệtStylist trên thiết bị này?",
      description: "Xóa nháp, bản khôi phục, thông tin phiên AI và đăng xuất khỏi trình duyệt này. Bộ phối, Lookbook và ảnh AI trên máy chủ vẫn còn trong tài khoản.",
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
      setLocalDraft(null);
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
  const visibleLocalDraft = localDraft && (user?.id ? localDraft.ownerId === user.id : !localDraft.ownerId) ? localDraft : null;
  const localDraftMatchesSavedCopy = Boolean(
    visibleLocalDraft?.ownerId === user?.id && visibleLocalDraft?.outfitId && visibleLocalDraft?.savedDocument
      && sameDocument({ title: visibleLocalDraft.title, snapshot: visibleLocalDraft.snapshot }, visibleLocalDraft.savedDocument),
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      {/* Thông báo nổi */}
      {statusMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
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

      {/* Header Hồ Sơ Cá Nhân Tùy Biến Theo Vai Trò */}
      <section
        className={`border-b pt-8 pb-10 transition-colors ${
          roleType === "admin"
            ? "bg-gradient-to-r from-red-50/80 via-white to-amber-50/60 border-red-200/70"
            : roleType === "stylist"
            ? "bg-gradient-to-r from-amber-50/80 via-white to-orange-50/50 border-amber-200/70"
            : roleType === "member"
            ? "bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 border-emerald-200/60"
            : "bg-white border-stone-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* User Info Block */}
            <div className="flex items-start sm:items-center space-x-4">
              {/* Avatar tùy biến theo vai trò */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-serif text-2xl font-bold shadow-md relative ${
                  roleType === "admin"
                    ? "bg-gradient-to-br from-heritage-red to-red-800 text-white border-2 border-amber-300"
                    : roleType === "stylist"
                    ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white border-2 border-amber-200"
                    : roleType === "member"
                    ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-2 border-emerald-200"
                    : "bg-stone-200 text-stone-600 border border-stone-300"
                }`}
              >
                {user ? user.displayName.charAt(0).toUpperCase() : "K"}
                {roleType === "admin" && (
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-stone-900 flex items-center justify-center shadow-xs border border-white">
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                )}
                {roleType === "stylist" && (
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-300 text-amber-900 flex items-center justify-center shadow-xs border border-white">
                    <Palette className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <h1 className="font-serif text-2xl font-bold text-stone-900">
                    {user ? user.displayName : "Khách vãng lai"}
                  </h1>

                  {/* Badge theo vai trò */}
                  {roleType === "admin" && (
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-heritage-red text-white shadow-xs border border-amber-300">
                      <Crown className="w-3.5 h-3.5 mr-1 text-amber-300" />
                      Quản trị viên
                    </span>
                  )}
                  {roleType === "stylist" && (
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white shadow-xs border border-amber-300">
                      <Palette className="w-3.5 h-3.5 mr-1" />
                      Chuyên gia Stylist (Stylist Pro)
                    </span>
                  )}
                  {roleType === "member" && (
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Thành viên / Học sinh - Sinh viên
                    </span>
                  )}
                  {roleType === "guest" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      Chưa đăng nhập
                    </span>
                  )}
                </div>

                {/* Subtitle & Mission theo vai trò */}
                <p className="text-xs text-stone-600 mt-1 max-w-xl leading-relaxed">
                  {roleType === "admin"
                    ? "Quản lý nội dung và dữ liệu theo quyền được cấp."
                    : roleType === "stylist"
                    ? "Quản lý bộ phối và Lookbook của bạn."
                    : roleType === "member"
                    ? "Phối trang phục, lưu bộ phối và quản lý Lookbook của bạn."
                    : "Bạn có thể phối đồ và giữ nháp trên thiết bị. Đăng nhập để lưu vào tài khoản."}
                </p>

                {user && (
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-stone-500">
                    <span className="font-mono">{user.email}</span>
                    <span>•</span>
                    <span className="text-stone-600 font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3 text-stone-500" /> Đã đăng nhập
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions theo vai trò */}
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2 justify-start md:justify-end">
              {roleType === "admin" && (
                <>
                  <Link
                    href="/quan-tri"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-heritage-red text-white hover:bg-heritage-red-dark transition-all flex items-center space-x-1.5 shadow-md hover:shadow-lg"
                  >
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span>Cổng quản trị</span>
                  </Link>
                  <Link
                    href="/chuyen-co-phuc"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition-all flex items-center space-x-1.5"
                  >
                    <Feather className="w-3.5 h-3.5 text-heritage-red" />
                    <span>Duyệt Chuyện Cổ phục</span>
                  </Link>
                </>
              )}

              {roleType === "stylist" && (
                <>
                  <Link
                    href="/stylist"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all flex items-center space-x-1.5 shadow-md"
                  >
                    <Palette className="w-4 h-4" />
                    <span>Workplace Stylist</span>
                  </Link>
                  <Link
                    href="/studio"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 transition-all flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Mở Studio</span>
                  </Link>
                  <Link
                    href="/chuyen-co-phuc"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 transition-all flex items-center space-x-1.5"
                  >
                    <Feather className="w-3.5 h-3.5 text-amber-600" />
                    <span>Viết bài Chuyện Cổ phục</span>
                  </Link>
                </>
              )}

              {roleType === "member" && (
                <>
                  <Link
                    href="/studio"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-heritage-red text-white hover:bg-heritage-red-dark transition-all flex items-center space-x-1.5 shadow-md"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Thử đồ trong Studio</span>
                  </Link>
                  <Link
                    href="/thu-vien"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition-all flex items-center space-x-1.5"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thư viện Cổ phục</span>
                  </Link>
                </>
              )}

              {isLoggedIn ? (
                <button
                  onClick={logout}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white text-stone-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 transition-all flex items-center space-x-1"
                  title="Đăng xuất khỏi phiên hiện tại"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-heritage-red text-white hover:bg-heritage-red-dark transition-all flex items-center space-x-1.5 shadow-md"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Đăng nhập tài khoản</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Grid Tùy Biến Theo Vai Trò */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-stone-200/60">
            {roleType === "admin" ? (
              <>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Kho Di sản Phục chế</span>
                  <span className="text-xl font-bold text-heritage-red font-serif mt-0.5 block">{adminOverview?.items ?? "—"} trang phục</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Quy tắc văn hóa</span>
                  <span className="text-xl font-bold text-amber-700 font-serif mt-0.5 block">{adminOverview?.rules ?? "—"} quy tắc đang bật</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Tác phẩm Toàn sàn</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">{adminOverview?.outfits ?? "—"} bộ phối / {adminOverview?.lookbooks ?? "—"} BST</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Đám mây & Media (R2)</span>
                  <span className="text-xl font-bold text-emerald-700 font-serif mt-0.5 flex items-center space-x-1">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${backendHealth?.status === "ready" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                    <span className="text-xs font-semibold">{backendHealth?.status === "ready" ? `DB kết nối · Media ${backendHealth.checks?.media_storage || "sẵn sàng"}` : "Chưa xác nhận kết nối"}</span>
                  </span>
                </div>
              </>
            ) : roleType === "stylist" ? (
              <>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Tác phẩm Sáng tạo</span>
                  <span className="text-xl font-bold text-amber-800 font-serif mt-0.5 block">{loadingOutfits ? "Đang tải…" : outfitLoadError ? "Chưa tải được" : `${outfits.length} bộ phối`}</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bộ sưu tập Lookbook</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">Quản lý trong Workspace</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Đóng góp kho trang phục</span>
                  <span className="text-xl font-bold text-amber-800 font-serif mt-0.5 block">Mở danh mục trang phục</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bản nháp Studio</span>
                  <span className="text-xl font-bold text-amber-700 font-serif mt-0.5 block">
                    {visibleLocalDraft ? "1 bản đang sửa" : "Sẵn sàng phối"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">{roleType === "guest" ? "Bộ phối đã lưu" : "Tủ đồ của bạn"}</span>
                  {roleType === "guest"
                    ? <button type="button" onClick={() => setShowAuthModal(true)} className="mt-1 text-left text-sm font-bold text-heritage-red hover:underline">Đăng nhập để xem</button>
                    : <span className="text-xl font-bold text-heritage-red font-serif mt-0.5 block">{loadingOutfits ? "Đang tải…" : outfitLoadError ? "Chưa tải được" : `${outfits.length} bộ đã lưu`}</span>}
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bản nháp đang thử</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">
                    {visibleLocalDraft ? "1 bản nháp" : "Chưa có"}
                  </span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Thư viện</span>
                  <Link href="/thu-vien" className="inline-block text-sm font-bold text-heritage-red font-serif mt-1 hover:underline">Mở thư viện cổ phục</Link>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">{roleType === "guest" ? "Thử đồ AI" : "Ảnh AI"}</span>
                  <button type="button" onClick={() => roleType === "guest" ? setShowAuthModal(true) : setActiveTab("ai_media")} className="text-sm font-bold text-stone-900 font-serif mt-1 hover:text-heritage-red">{roleType === "guest" ? "Đăng nhập để tiếp tục" : "Xem và xóa ảnh"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Tabs Navigation Thích Ứng Theo Vai Trò */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex border-b border-stone-200 space-x-6 overflow-x-auto">
          {/* Tabs dành riêng cho Admin */}
          {roleType === "admin" && (
            <button
              onClick={() => setActiveTab("admin_hub")}
              className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
                activeTab === "admin_hub"
                  ? "border-heritage-red text-heritage-red"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Bảng Điều Hành Quản Trị (Admin Hub)</span>
            </button>
          )}

          {/* Tab bộ phối dành cho tài khoản */}
          {roleType !== "guest" && (
          <button
            onClick={() => setActiveTab("outfits")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "outfits"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>
              {roleType === "admin"
                ? `Bộ phối của tôi (${outfits.length})`
                : roleType === "stylist"
                ? `Tác phẩm Sáng tạo (${outfits.length})`
                : `Tủ đồ Cổ phục của tôi (${outfits.length})`}
            </span>
          </button>
          )}

          {/* Tab Bản nháp */}
          <button
            onClick={() => setActiveTab("drafts")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "drafts"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Nháp trên thiết bị ({visibleLocalDraft ? "1" : "0"})</span>
          </button>

          {/* Tab Lookbook (cho Stylist & Member) */}
          {(roleType === "stylist" || roleType === "member" || roleType === "admin") && (
            <button
              onClick={() => setActiveTab("lookbooks")}
              className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
                activeTab === "lookbooks"
                  ? "border-heritage-red text-heritage-red"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              <FolderHeart className="w-4 h-4 text-rose-500" />
              <span>
                {roleType === "stylist" ? "Lookbook Sáng tạo & Chia sẻ" : "Bộ sưu tập Lookbook"}
              </span>
            </button>
          )}

          {/* Tab quyền riêng tư và media */}
          <button
            onClick={() => setActiveTab("privacy")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "privacy"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Quyền riêng tư</span>
          </button>

          {roleType !== "guest" && (
            <button
              onClick={() => setActiveTab("ai_media")}
              className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${activeTab === "ai_media" ? "border-heritage-red text-heritage-red" : "border-transparent text-stone-500 hover:text-stone-800"}`}
            >
              <Camera className="w-4 h-4" />
              <span>Ảnh AI</span>
            </button>
          )}

          {/* Tab Hệ thống & Hợp đồng API */}
          {roleType === "admin" && (
            <button
              onClick={() => setActiveTab("system")}
              className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
                activeTab === "system"
                  ? "border-heritage-red text-heritage-red"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Hạ tầng & Hợp đồng API</span>
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: ADMIN HUB (DÀNH RIÊNG CHO QUẢN TRỊ VIÊN) */}
        {/* ========================================================================= */}
        {activeTab === "admin_hub" && roleType === "admin" && (
          <div className="mt-8 space-y-8 animate-in fade-in duration-200">
            <AdminWorkspace onOverview={setAdminOverview} />
            {/* 4 Khối hành động quản trị cốt lõi */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-heritage-red flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Kho Cổ Phục Di Sản</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Quản lý kho cổ phục số hóa, thêm biến thể màu sắc ngũ hành và kiểm duyệt metadata lịch sử.
                  </p>
                </div>
                <Link
                  href="/quan-tri"
                  className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-heritage-red hover:underline"
                >
                  <span>Mở kho quản lý đồ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Quy tắc văn hóa</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Cấu hình luật thẩm định hữu nhậm, cấm kỵ hoa văn hoàng gia và bảo toàn quy chuẩn triều Nguyễn.
                  </p>
                </div>
                <Link
                  href="/quan-tri"
                  className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-amber-700 hover:underline"
                >
                  <span>Cấu hình quy tắc</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                    <Feather className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Chuyện Cổ Phục & Blog</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Biên tập các câu chuyện cổ phục, xuất bản bài viết của Stylist và quản lý nguồn trích dẫn lịch sử.
                  </p>
                </div>
                <Link
                  href="/chuyen-co-phuc"
                  className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <span>Đến Tạp chí Di sản</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Hạ Tầng Media R2</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Xem tình trạng kết nối dịch vụ và các API đang được ứng dụng sử dụng.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("system")}
                  className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-blue-700 hover:underline text-left"
                >
                  <span>Xem trạng thái dịch vụ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Lối tắt vào các công cụ quản trị */}
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-stone-700">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-stone-900">
                    Khu vực quản trị
                  </span>
                  <span className="text-xs text-stone-400 font-mono">ID: {user?.id}</span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                  Cổng quản trị
                </h2>
                <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
                  Quản lý danh mục trang phục, quy tắc văn hóa và nội dung theo quyền được cấp.
                </p>
              </div>
              <Link
                href="/quan-tri"
                className="px-6 py-3 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center space-x-2 shrink-0"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Mở cổng quản trị</span>
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: DANH SÁCH BỘ PHỐI (CHUNG CHO CÁC ROLE) */}
        {/* ========================================================================= */}
        {activeTab === "outfits" && (
          <div className="mt-8 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-serif font-bold text-stone-900">
                  {roleType === "admin"
                    ? "Danh sách Bộ phối Quản trị & Mẫu Di sản"
                    : roleType === "stylist"
                    ? "Tác phẩm Sáng tạo Stylist"
                    : "Tủ đồ Cổ phục Cá nhân"}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Bộ phối lưu lại trang phục, màu sắc, bố cục và phiên bản để bạn tiếp tục chỉnh sửa.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchOutfits}
                  disabled={loadingOutfits}
                  className="p-2 text-stone-500 hover:text-stone-800 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  title="Tải lại danh sách"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOutfits ? "animate-spin" : ""}`} />
                </button>
                <Link
                  href="/studio"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-heritage-red text-white text-xs font-semibold rounded-lg hover:bg-red-800 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Phối đồ mới trong Studio</span>
                </Link>
              </div>
            </div>

            {loadingOutfits ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <div className="w-8 h-8 border-2 border-heritage-red border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-stone-500">Đang tải danh sách bộ phối...</p>
              </div>
            ) : outfitLoadError ? (
              <div role="alert" className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-center">
                <p className="text-sm text-rose-800">{outfitLoadError}</p>
                <button type="button" onClick={fetchOutfits} className="mt-3 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800">Thử tải lại</button>
              </div>
            ) : outfits.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-800">Chưa có bộ phối nào được lưu</h3>
                <p className="text-xs text-stone-500 mt-2 mb-6 leading-relaxed">
                  Hãy vào Studio Phối đồ để lựa chọn trang phục, tùy biến màu sắc ngũ hành và bấm &quot;Lưu bộ phối&quot; để lưu lại vào tài khoản của bạn.
                </p>
                <Link
                  href="/studio"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-heritage-red text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Mở Studio Phối đồ ngay</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {outfits.map((outfit) => {
                  const items = outfit.current_snapshot?.items || [];
                  const occasionName = occasionLabel(outfit.occasion_id, occasions);
                  return (
                    <div
                      key={outfit.id}
                      className="bg-white rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif font-bold text-stone-900 text-base line-clamp-1">
                            {outfit.title}
                          </h3>
                          <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            v{outfit.revision}
                          </span>
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

                        <div className="mt-4 pt-4 border-t border-stone-100">
                          <span className="text-[11px] font-medium text-stone-400 block mb-2">
                            Các món trang phục ({items.length} món):
                          </span>
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
                        </div>
                      </div>

                      <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-stone-400 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(outfit.updated_at).toLocaleDateString("vi-VN")}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenInStudio(outfit)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-heritage-red text-white rounded-lg hover:bg-red-800 transition-colors font-medium shadow-sm"
                          >
                            <span>Mở Studio</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteOutfit(outfit.id, outfit.title)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Xóa bộ phối"
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: LOOKBOOK SÁNG TẠO & CHIA SẺ */}
        {/* ========================================================================= */}
        {activeTab === "lookbooks" && (
          <div className="mt-8 animate-in fade-in duration-200 max-w-4xl space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-serif font-bold text-lg text-stone-900 flex items-center space-x-2">
                  <FolderHeart className="w-5 h-5 text-rose-600" />
                  <span>Bộ Sưu Tập Lookbook Cá Nhân</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
                  Nhóm các bộ phối thành bộ sưu tập và quản lý quyền chia sẻ trên trang Lookbook.
                </p>
              </div>
              <Link
                href="/lookbook"
                className="px-4 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Xem & Tạo Lookbook Mới</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                  Chia Sẻ Công Khai An Toàn
                </span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Mỗi Lookbook khi chia sẻ sẽ tạo ra URL ngẫu nhiên kèm mã băm SHA-256 (Token Hash), không làm lộ ID tài khoản và cho phép thu hồi bất kỳ lúc nào.
                </p>
              </div>
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                  Đóng Góp Câu Chuyện Di Sản
                </span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Bạn có thể đính kèm câu chuyện lịch sử cho từng mẫu áo trong Lookbook để tạo nên cuốn tạp chí thời trang cổ phong sinh động.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: BẢN NHÁP & ĐỒNG BỘ CỤC BỘ */}
        {/* ========================================================================= */}
        {activeTab === "drafts" && (
          <div className="mt-8 max-w-3xl animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
              <h2 className="font-serif font-bold text-lg text-stone-900 mb-1 flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-heritage-red" />
                <span>Bản nháp trên thiết bị</span>
              </h2>
              <p className="text-xs text-stone-500 mb-6 leading-relaxed">
                Bản nháp được giữ trên thiết bị này. Đăng nhập để lưu bộ phối vào Tủ đồ của tài khoản.
              </p>

              {visibleLocalDraft ? (
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-stone-900 text-sm">
                        {visibleLocalDraft.title || "Bản phối Studio chưa đặt tên"}
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Hoàn cảnh: {occasionLabel(visibleLocalDraft.snapshot?.occasionId, occasions)} | Phong cách:{" "}
                        {styleLabel(visibleLocalDraft.snapshot?.styleMode)}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      {localDraftMatchesSavedCopy ? "Đã lưu trong Tủ đồ" : visibleLocalDraft.ownerId === user?.id && visibleLocalDraft.outfitId ? "Có thay đổi chưa lưu" : "Chưa lưu vào tài khoản"}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-stone-200/80 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs text-stone-500">
                      Số lượng món trang phục: <strong>{visibleLocalDraft.snapshot?.items?.length || 0}</strong> món
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={requestDraftSave}
                        disabled={isSyncingDraft || localDraftMatchesSavedCopy}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isSyncingDraft ? "Đang lưu…" : localDraftMatchesSavedCopy ? "Đã lưu vào Tủ đồ" : !isLoggedIn ? "Đăng nhập để lưu vào Tủ đồ" : visibleLocalDraft.ownerId === user?.id && visibleLocalDraft.outfitId ? "Cập nhật bộ phối đã lưu" : "Lưu vào Tủ đồ"}</span>
                      </button>
                      <button
                        onClick={handleClearLocalDraft}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-stone-200 text-stone-600 rounded-lg text-xs font-medium hover:bg-stone-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-stone-400" />
                        <span>Xóa bản nháp này</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-300">
                  <p className="text-sm text-stone-500">Hiện không có bản nháp cục bộ nào cần đồng bộ.</p>
                  <Link
                    href="/studio"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-heritage-red hover:underline mt-2"
                  >
                    <span>Vào Studio để bắt đầu phối trang phục</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quy chuẩn an toàn dữ liệu */}
            <div className="bg-amber-50/60 rounded-2xl border border-amber-200/80 p-6">
              <h3 className="font-serif font-bold text-base text-amber-900 mb-2 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>Về bản nháp trên thiết bị</span>
              </h3>
              <ul className="text-xs text-amber-900/80 space-y-2 list-disc pl-5 leading-relaxed">
                <li>
                  <strong>Tách biệt cache theo tài khoản:</strong> Đăng xuất sẽ dọn sạch dữ liệu cá nhân, ngăn người dùng tiếp theo trên máy dùng chung nhìn thấy ảnh cá nhân hoặc trang phục chưa công khai.
                </li>
                <li>
                  <strong>Optimistic Concurrency Control:</strong> Mỗi lần cập nhật bộ phối đều đối soát chỉ số revision để phát hiện kịp thời xung đột khi mở đồng thời trên nhiều tab hoặc thiết bị.
                </li>
                <li>
                  <strong>Bảo vệ dữ liệu chủ sở hữu:</strong> Endpoint backend kiểm soát quyền truy cập chặt chẽ, không cho phép đọc hoặc sửa đổi dữ liệu người khác bằng cách thay đổi mã định danh trên URL.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB NỘI DUNG: QUYỀN RIÊNG TƯ & MEDIA R2 (F14) */}
        {/* ========================================================================= */}
        {activeTab === "ai_media" && roleType !== "guest" && (
          <section className="mt-8 space-y-5" aria-labelledby="ai-media-title">
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
          <div className="mt-8 max-w-3xl space-y-6 animate-in fade-in duration-200">
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
                  Xóa nháp, bản khôi phục, thông tin phiên AI và đăng xuất khỏi trình duyệt này. Ảnh AI trên máy chủ không bị xóa.
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

            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
              <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
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
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-medium text-stone-700">FastAPI Backend URL</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-stone-300 text-stone-800 font-mono">
                    {API_ORIGIN}
                  </code>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
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
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-medium text-stone-700">Trạng thái xác thực</span>
                  <span className="font-medium text-emerald-700">Đã đăng nhập</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
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
          if (!isLoggedIn) pendingDraftToSave.current = null;
        }}
      />
      {dialog}
    </div>
  );
}
