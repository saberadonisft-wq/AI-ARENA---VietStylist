"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { OutfitResponse } from "@/lib/types/api";
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
} from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoggedIn, isAdmin, isEditor, login, logout, token } = useAuth();

  const [activeTab, setActiveTab] = useState<"outfits" | "drafts" | "privacy" | "system">("outfits");
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [localDraft, setLocalDraft] = useState<any | null>(null);
  const [backendHealth, setBackendHealth] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Lấy dữ liệu outfits
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
      console.warn("Không thể tải danh sách outfit:", err.message);
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
    // Lưu vào draft và chuyển trang
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
    showNotification("Đã dọn sạch bản nháp và bộ nhớ tạm trên thiết bị này.", "info");
  };

  // Xóa dữ liệu cá nhân theo quyền riêng tư
  const handlePurgePersonalData = () => {
    if (!confirm("Cảnh báo: Hành động này sẽ dọn sạch toàn bộ cache ảnh khuôn mặt AI, token và lịch sử cục bộ. Bạn có muốn tiếp tục?")) return;
    localStorage.removeItem("viet_stylist_auth_token");
    localStorage.removeItem("viet_stylist_user");
    localStorage.removeItem("viet_stylist_current_draft");
    setLocalDraft(null);
    logout();
    showNotification("Đã dọn dẹp sạch toàn bộ dữ liệu cá nhân và cache thiết bị.", "success");
  };

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

      {/* Header Hồ sơ */}
      <section className="bg-white border-b border-stone-200 pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-heritage-red/10 border-2 border-heritage-red/30 flex items-center justify-center text-heritage-red font-serif text-2xl font-bold shadow-sm">
                {user ? user.displayName.charAt(0) : "K"}
              </div>
              <div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <h1 className="font-serif text-2xl font-bold text-stone-900">
                    {user ? user.displayName : "Khách vãng lai"}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      <Shield className="w-3 h-3 mr-1" /> Quản trị viên Di sản
                    </span>
                  )}
                  {isLoggedIn && !isAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Sparkles className="w-3 h-3 mr-1" /> Học sinh / Sinh viên
                    </span>
                  )}
                  {!isLoggedIn && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      Chưa đăng nhập
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500 mt-1">
                  {user ? user.email : "Dữ liệu lưu tạm trên trình duyệt hiện tại. Đăng nhập để bảo vệ & đồng bộ đa thiết bị."}
                </p>
              </div>
            </div>

            {/* Chuyển đổi tài khoản mô phỏng (Dành cho kiểm thử & đánh giá) */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Chuyển đổi vai trò kiểm thử (F13 & F15):
              </span>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <button
                  onClick={() => login("user_sinh_vien_01", "user")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isLoggedIn && !isAdmin
                      ? "bg-heritage-red text-white shadow-sm"
                      : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
                  }`}
                >
                  Sinh viên (Học viên)
                </button>
                <button
                  onClick={() => login("admin_vietphuc_01", "admin")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isAdmin
                      ? "bg-purple-700 text-white shadow-sm"
                      : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
                  }`}
                >
                  Quản trị viên (F15)
                </button>
                {isLoggedIn && (
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 transition-all flex items-center space-x-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-stone-100">
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/70">
              <span className="text-xs text-stone-500 block">Bộ phối đã lưu</span>
              <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">{outfits.length}</span>
            </div>
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/70">
              <span className="text-xs text-stone-500 block">Bản nháp cục bộ</span>
              <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">
                {localDraft ? "1 bản chưa lưu" : "Trống"}
              </span>
            </div>
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/70">
              <span className="text-xs text-stone-500 block">Máy chủ FastAPI</span>
              <span className="text-xl font-bold text-emerald-700 font-serif mt-0.5 flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span className="text-sm font-semibold">{backendHealth?.status || "Đang kết nối"}</span>
              </span>
            </div>
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/70">
              <span className="text-xs text-stone-500 block">Dữ liệu di sản</span>
              <span className="text-xl font-bold text-stone-900 font-serif mt-0.5 block">17 Cổ phục Chuẩn</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex border-b border-stone-200 space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("outfits")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "outfits"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Bộ phối của tôi ({outfits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("drafts")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "drafts"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Bản nháp & Đồng bộ ({localDraft ? "1" : "0"})</span>
          </button>
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
          <button
            onClick={() => setActiveTab("system")}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === "system"
                ? "border-heritage-red text-heritage-red"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Hệ thống & Hợp đồng API</span>
          </button>
        </div>

        {/* Tab 1: Bộ phối của tôi */}
        {activeTab === "outfits" && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-serif font-bold text-stone-900">Danh sách Bộ phối cá nhân</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Mỗi bộ phối lưu trữ snapshot cấu hình trang phục, màu sắc, hướng vạt và các phiên bản sửa đổi (F08, F13).
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
                <p className="text-sm text-stone-500">Đang tải danh sách bộ phối cá nhân...</p>
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
                  const occasionName = outfit.occasion_id === "ky_yeu" ? "Kỷ yếu Cổ phong" : outfit.occasion_id === "tet_nguyen_dan" ? "Tết Nguyên Đán" : outfit.occasion_id === "le_hoi_truong" ? "Lễ hội trường" : outfit.occasion_id || "Chung";
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
                          <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-heritage-gold/15 text-heritage-gold border border-heritage-gold/30">
                            v{outfit.revision}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {occasionName}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${outfit.style_mode === "remix" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
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
                                <span className="truncate max-w-[120px]">{it.itemId.replace("item_", "").replaceAll("_", " ")}</span>
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

        {/* Tab 2: Bản nháp & Đồng bộ cục bộ */}
        {activeTab === "drafts" && (
          <div className="mt-8 max-w-3xl">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
              <h2 className="font-serif font-bold text-lg text-stone-900 mb-1 flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-heritage-red" />
                <span>Bản nháp Studio hiện hành (Client LocalStorage)</span>
              </h2>
              <p className="text-xs text-stone-500 mb-6 leading-relaxed">
                Khi sử dụng Studio ở chế độ khách vãng lai, toàn bộ thao tác phối đồ, xoay vạt và màu sắc được lưu an toàn trong trình duyệt của bạn để không mất mát khi tải lại trang (F13).
              </p>

              {localDraft ? (
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-stone-900 text-sm">{localDraft.title || "Bản phối Studio chưa đặt tên"}</h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Sự kiện: {localDraft.occasionId || "kỷ yếu"} | Phong cách: {localDraft.styleMode || "traditional"}
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

        {/* Tab 3: Quyền riêng tư & Media R2 */}
        {activeTab === "privacy" && (
          <div className="mt-8 max-w-3xl space-y-6">
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

        {/* Tab 4: Hệ thống & API */}
        {activeTab === "system" && (
          <div className="mt-8 max-w-3xl space-y-6">
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
    </div>
  );
}
