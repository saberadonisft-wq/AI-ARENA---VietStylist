"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { OutfitResponse } from "@/lib/types/api";
import AuthModal from "@/components/AuthModal";
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
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Server,
  Palette,
  Crown,
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
  const { user, isLoggedIn, isAdmin, isStylist, logout, token } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Dynamic initial tab based on role
  const [activeTab, setActiveTab] = useState<string>("outfits");
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [localDraft, setLocalDraft] = useState<any | null>(null);
  const [backendHealth, setBackendHealth] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      setActiveTab("admin_hub");
    } else {
      setActiveTab("outfits");
    }
  }, [isAdmin]);

  // Lấy dữ liệu outfits và trạng thái hệ thống
  useEffect(() => {
    fetchOutfits();
    checkLocalDraft();
    checkBackend();
  }, [user]);

  const showNotification = (text: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchOutfits = async () => {
    setLoadingOutfits(true);
    try {
      const data = await api.listUserOutfits();
      setOutfits(data || []);
    } catch (err: any) {
      console.warn("Không thể tải danh sách outfit:", err?.message);
      setOutfits([]);
    } finally {
      setLoadingOutfits(false);
    }
  };

  const checkLocalDraft = () => {
    try {
      const draft = localStorage.getItem("viet_stylist_current_draft");
      if (draft) {
        setLocalDraft(JSON.parse(draft));
      } else {
        setLocalDraft(null);
      }
    } catch {
      setLocalDraft(null);
    }
  };

  const checkBackend = async () => {
    try {
      const res = await fetch("http://localhost:4000/health");
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
    if (!confirm(`Bạn có chắc chắn muốn xóa bộ phối "${title}" không?`)) return;
    try {
      await api.deleteOutfit(outfitId);
      setOutfits((prev) => prev.filter((o) => o.id !== outfitId));
      showNotification(`Đã xóa bộ phối "${title}" thành công.`, "success");
    } catch (err: any) {
      showNotification(`Lỗi khi xóa: ${err.message}`, "error");
    }
  };

  // Mở trong Studio
  const handleOpenInStudio = (outfit: OutfitResponse) => {
    try {
      localStorage.setItem("viet_stylist_current_draft", JSON.stringify({
        title: outfit.title,
        occasionId: outfit.occasion_id,
        styleMode: outfit.style_mode,
        snapshot: outfit.current_snapshot,
      }));
    } catch (e) {
      console.error(e);
    }
    router.push(`/?loadOutfit=${outfit.id}`);
  };

  // Đồng bộ draft lên server
  const handleSyncDraftToServer = async () => {
    if (!localDraft) return;
    try {
      await api.createOutfit({
        title: localDraft.title || "Bộ phối từ bản nháp Studio",
        occasion_id: localDraft.occasionId || "ky_yeu",
        style_mode: localDraft.styleMode || "traditional",
        snapshot: localDraft.snapshot || {
          schemaVersion: 1,
          avatarId: "avatar_nam_chuan",
          poseId: "front_01",
          occasionId: "ky_yeu",
          styleMode: "traditional",
          overlapDirection: "right_over_left",
          items: [],
        },
      });
      showNotification("Đã đồng bộ bản nháp lên tài khoản thành công!", "success");
      fetchOutfits();
    } catch (err: any) {
      showNotification(`Lỗi đồng bộ: ${err.message}`, "error");
    }
  };

  // Xóa sạch draft cục bộ
  const handleClearLocalDraft = () => {
    localStorage.removeItem("viet_stylist_current_draft");
    setLocalDraft(null);
    showNotification("Đã dọn sạch bản nháp trên thiết bị này.", "info");
  };

  // Xóa dữ liệu cá nhân theo quyền riêng tư
  const handlePurgePersonalData = () => {
    if (!confirm("Cảnh báo: Hành động này sẽ dọn sạch toàn bộ cache ảnh khuôn mặt AI, token và lịch sử cục bộ. Bạn có muốn tiếp tục?")) return;
    localStorage.removeItem("viet_stylist_auth_token");
    localStorage.removeItem("viet_stylist_user");
    localStorage.removeItem("viet_stylist_current_draft");
    localStorage.removeItem("viet_stylist_recent_looks");
    logout();
    showNotification("Đã xóa toàn bộ dữ liệu cá nhân và đăng xuất an toàn.", "success");
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
                      Quản trị viên Di sản (Admin F15)
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
                    ? "Toàn quyền quản trị hệ thống: Thẩm định quy tắc di sản triều Nguyễn, quản lý danh mục cổ phục số hóa và phân quyền người dùng."
                    : roleType === "stylist"
                    ? "Nhà sáng tạo cổ phong: Phối đồ ngũ hành, xuất bản Lookbook chia sẻ và đăng tải câu chuyện cổ phục trên tạp chí di sản."
                    : roleType === "member"
                    ? "Học sinh, sinh viên yêu nét đẹp cổ phục Việt: Trải nghiệm thử đồ 2D trực quan, lưu giữ bộ phối cá nhân và chia sẻ cùng bạn bè."
                    : "Đăng nhập bằng tài khoản Google để bảo lưu các bộ phối, đồng bộ đa thiết bị và trải nghiệm đầy đủ quyền năng."}
                </p>

                {user && (
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-stone-500">
                    <span className="font-mono">{user.email}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-600" /> Xác thực an toàn Google OAuth
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
                    <span>Cổng Quản trị F15</span>
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
                    href="/"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all flex items-center space-x-1.5 shadow-md"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Studio Phối đồ Mới</span>
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
                    href="/"
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
                  <span className="text-xl font-bold text-heritage-red font-serif mt-0.5 block">17 Cổ phục Chuẩn</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Quy tắc Thẩm định (F10)</span>
                  <span className="text-xl font-bold text-amber-700 font-serif mt-0.5 block">5 Bộ luật Di sản</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Tác phẩm Toàn sàn</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">{outfits.length} Bộ phối / 5 BST</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-red-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Đám mây & Media (R2)</span>
                  <span className="text-xl font-bold text-emerald-700 font-serif mt-0.5 flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span className="text-xs font-semibold">R2 + Supabase OK</span>
                  </span>
                </div>
              </>
            ) : roleType === "stylist" ? (
              <>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Tác phẩm Sáng tạo</span>
                  <span className="text-xl font-bold text-amber-800 font-serif mt-0.5 block">{outfits.length} Bộ phối</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bộ sưu tập Lookbook</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">5 Bộ sưu tập</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Hòa hợp Ngũ hành (F07)</span>
                  <span className="text-xl font-bold text-emerald-700 font-serif mt-0.5 block">Đạt chuẩn 96%</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bản nháp Studio</span>
                  <span className="text-xl font-bold text-amber-700 font-serif mt-0.5 block">
                    {localDraft ? "1 bản đang sửa" : "Sẵn sàng phối"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Tủ đồ của bạn</span>
                  <span className="text-xl font-bold text-heritage-red font-serif mt-0.5 block">{outfits.length} Bộ đã lưu</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Bản nháp đang thử</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">
                    {localDraft ? "1 bản nháp" : "Chưa có"}
                  </span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Cổ phục Khám phá</span>
                  <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">17 Mẫu truyền thống</span>
                </div>
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold block">Quyền riêng tư AI (F14)</span>
                  <span className="text-xl font-bold text-emerald-700 font-serif mt-0.5 block">Bảo vệ an toàn</span>
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

          {/* Tab Bộ phối */}
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
                ? `Kho Bộ phối Toàn quyền (${outfits.length})`
                : roleType === "stylist"
                ? `Tác phẩm Sáng tạo (${outfits.length})`
                : `Tủ đồ Cổ phục của tôi (${outfits.length})`}
            </span>
          </button>

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
            <span>Bản nháp Studio ({localDraft ? "1" : "0"})</span>
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

          {/* Tab Quyền riêng tư & Media (F14) */}
          <button
            onClick={() => setActiveTab("privacy")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "privacy"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Quyền riêng tư & Media (F14)</span>
          </button>

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
            {/* 4 Khối hành động quản trị cốt lõi */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-heritage-red flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">Kho Cổ Phục Di Sản</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Quản lý 17 bộ cổ phục số hóa, thêm biến thể màu sắc ngũ hành và kiểm duyệt metadata lịch sử.
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
                  <h3 className="font-serif font-bold text-stone-900 text-base">Quy Tắc Văn Hóa (F10)</h3>
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
                    Kiểm soát bucket Cloudflare R2 công khai và riêng tư, bảo vệ token ký tạm và ảnh người dùng.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("privacy")}
                  className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-blue-700 hover:underline text-left"
                >
                  <span>Xem báo cáo Media R2</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Banner Lối Tắt Vào Cổng Quản Trị F15 Toàn Năng */}
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-stone-700">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-stone-900">
                    Phân Quyền Admin Tuyệt Đối
                  </span>
                  <span className="text-xs text-stone-400 font-mono">ID: {user?.id}</span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                  Cổng Quản Trị Hệ Thống F15 (Admin Dashboard)
                </h2>
                <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
                  Trang chuyên dụng để thêm mới mẫu trang phục số hóa (F01), gắn tầng SVG/PNG (F02), định nghĩa quy tắc văn hóa (F10) và duyệt bài viết chuyên sâu.
                </p>
              </div>
              <Link
                href="/quan-tri"
                className="px-6 py-3 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center space-x-2 shrink-0"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Mở Cổng Quản Trị F15 Ngay</span>
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
                  Mỗi bộ phối lưu trữ snapshot cấu hình trang phục, màu sắc ngũ hành, hướng vạt và các phiên bản sửa đổi (F08, F13).
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
                  href="/"
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
                  href="/"
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
                  const occasionName =
                    outfit.occasion_id === "ky_yeu"
                      ? "Kỷ yếu Cổ phong"
                      : outfit.occasion_id === "tet_nguyen_dan"
                      ? "Tết Nguyên Đán"
                      : outfit.occasion_id === "le_hoi_truong"
                      ? "Lễ hội trường"
                      : outfit.occasion_id || "Chung";
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

                        <div className="flex items-center space-x-2 mt-2">
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
                            {outfit.style_mode === "remix" ? "Phối Remix" : "Cổ phong Chuẩn"}
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
                                  {it.itemId.replace("item_", "").replaceAll("_", " ")}
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
                  Tập hợp các bộ phối thành album chủ đề (Tết, Kỷ yếu, Lễ hội), xuất bản liên kết chia sẻ bảo mật (Token Hash) với thời hạn tự hủy (F09).
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
                <span>Bản nháp Studio hiện hành (Client LocalStorage)</span>
              </h2>
              <p className="text-xs text-stone-500 mb-6 leading-relaxed">
                Toàn bộ thao tác phối đồ, xoay vạt và màu sắc được lưu an toàn trong trình duyệt của bạn để không mất mát khi tải lại trang (F13).
              </p>

              {localDraft ? (
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-stone-900 text-sm">
                        {localDraft.title || "Bản phối Studio chưa đặt tên"}
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Sự kiện: {localDraft.occasionId || "kỷ yếu"} | Phong cách:{" "}
                        {localDraft.styleMode || "traditional"}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Chưa lưu lên máy chủ
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-stone-200/80 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs text-stone-500">
                      Số lượng món trang phục: <strong>{localDraft.snapshot?.items?.length || 0}</strong> món
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSyncDraftToServer}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Đồng bộ lên tài khoản</span>
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
                    href="/"
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
                <span>Quy chuẩn cách ly phiên & bảo mật F13</span>
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
        {activeTab === "privacy" && (
          <div className="mt-8 max-w-3xl space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif font-bold text-lg text-stone-900 mb-2 flex items-center space-x-2">
                <Lock className="w-5 h-5 text-heritage-red" />
                <span>Quyền được lãng quên & Bảo vệ khuôn mặt cá nhân</span>
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed mb-6">
                Khi sử dụng tính năng <strong>Thử đồ AI (AI Try-on)</strong> hoặc tải ảnh lên hệ thống, ảnh cá nhân của bạn được lưu trong bucket riêng tư (Private Storage) và chỉ được cấp liên kết ký tạm (Presigned URL) có thời hạn hiệu lực tối đa 60 phút. Hệ thống cam kết không bao giờ lưu trữ liên kết tạm thời làm URL bền vững hoặc chia sẻ cho bên thứ ba.
              </p>

              <div className="border-t border-stone-100 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Hành động dọn dẹp dữ liệu tức thì:
                </h4>
                <p className="text-xs text-stone-500 mb-4">
                  Xóa toàn bộ các phiên làm việc, xóa bản nháp và dọn các dữ liệu khuôn mặt đã lưu trữ cục bộ.
                </p>
                <button
                  onClick={handlePurgePersonalData}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa toàn bộ dữ liệu cá nhân & Đăng xuất an toàn</span>
                </button>
              </div>
            </div>

            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
              <h3 className="font-serif font-bold text-base text-stone-800 mb-3 flex items-center space-x-2">
                <Database className="w-4 h-4 text-stone-600" />
                <span>Kiến trúc lưu trữ Cloudflare R2 (F14)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <span className="font-semibold text-stone-800 block mb-1">Bucket Công khai (Catalog)</span>
                  <p className="text-stone-500 leading-relaxed">
                    Chứa các vector SVG tà áo, tư liệu di sản công khai, phục vụ qua CDN tối ưu hóa cho hiển thị 2D Studio tức thì.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <span className="font-semibold text-stone-800 block mb-1">Bucket Riêng tư (User Media)</span>
                  <p className="text-stone-500 leading-relaxed">
                    Chứa ảnh khuôn mặt người dùng tải lên, ảnh kết quả thử đồ AI. Bắt buộc kiểm tra token và phân quyền chủ sở hữu trước khi cấp URL truy cập có thời hạn.
                  </p>
                </div>
              </div>
            </div>
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
                    http://localhost:4000
                  </code>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-medium text-stone-700">Tài liệu OpenAPI Interactive (Swagger)</span>
                  <a
                    href="http://localhost:4000/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-heritage-red hover:underline font-medium"
                  >
                    <span>Mở /docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-medium text-stone-700">Mã Token xác thực hiện tại</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-stone-300 text-stone-600 font-mono text-[11px] truncate max-w-[200px]">
                    {token || "Không có token (Khách)"}
                  </code>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-medium text-stone-700">Mô hình AI Gemini tích hợp</span>
                  <span className="font-mono text-emerald-700 font-semibold">gemini-2.5-flash</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-serif font-bold text-stone-800 text-sm">Tài liệu Báo cáo Giải pháp F12</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Xem báo cáo tổng hợp kiến trúc, đối chiếu đề thi và cam kết kỹ thuật của đội thi.
                </p>
              </div>
              <Link
                href="/giai-phap"
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-semibold hover:bg-stone-900 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xem Form Giải pháp F12</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Modal Đăng nhập / Phân quyền */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
