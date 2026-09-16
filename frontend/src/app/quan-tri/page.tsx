"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import AuthModal from "@/components/AuthModal";
import {
  ShieldCheck,
  Plus,
  Shirt,
  BookOpen,
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Check,
  Lock,
} from "lucide-react";

export default function QuanTriPage() {
  const { user, isLoggedIn, isAdmin } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "rules" | "articles">("items");

  // Form thêm item mới
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemSlot, setItemSlot] = useState("outerwear");
  const [itemGarmentType, setItemGarmentType] = useState("ngu_than");
  const [itemGender, setItemGender] = useState("unisex");
  const [itemDesc, setItemDesc] = useState("");

  // Form thêm rule mới
  const [ruleCode, setRuleCode] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState("warning");
  const [ruleExplanation, setRuleExplanation] = useState("");

  // Form thêm bài viết mới
  const [artId, setArtId] = useState("");
  const [artTitle, setArtTitle] = useState("");
  const [artSlug, setArtSlug] = useState("");
  const [artSummary, setArtSummary] = useState("");

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch("/api/admin/items", {
        method: "POST",
        body: JSON.stringify({
          id: itemId,
          garment_type_id: itemGarmentType,
          slot: itemSlot,
          name: itemName,
          gender: itemGender,
          description: itemDesc,
          era: "Nguyễn",
          is_published: true,
          metadata: {},
        }),
      });
      setStatusMsg(`Đã tạo thành công trang phục: ${itemName}`);
      setItemId("");
      setItemName("");
      setItemDesc("");
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch("/api/admin/cultural-rules", {
        method: "POST",
        body: JSON.stringify({
          id: `rule_${Date.now()}`,
          code: ruleCode,
          name: ruleName,
          severity: ruleSeverity,
          condition_json: { custom: true },
          explanation: ruleExplanation,
          source_id: "src_ngan_nam_ao_mu",
        }),
      });
      setStatusMsg(`Đã tạo quy tắc văn hóa: ${ruleName}`);
      setRuleCode("");
      setRuleName("");
      setRuleExplanation("");
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch("/api/admin/heritage-articles", {
        method: "POST",
        body: JSON.stringify({
          id: artId,
          title: artTitle,
          slug: artSlug,
          short_summary: artSummary,
          status: "published",
        }),
      });
      setStatusMsg(`Đã xuất bản bài viết di sản: ${artTitle}`);
      setArtId("");
      setArtTitle("");
      setArtSlug("");
      setArtSummary("");
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-heritage-red flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Cổng Quản Trị Viên (Admin Portal F15)
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {isLoggedIn ? (
              <>
                Bạn đang đăng nhập với tài khoản <strong>{user?.displayName}</strong> ({user?.roles.join(", ")}).
                Trang này yêu cầu quyền <strong>Admin / Biên tập viên Di sản</strong>.
              </>
            ) : (
              <>
                Chức năng quản trị kho đồ, duyệt bài viết và cấu hình quy tắc văn hóa yêu cầu quyền Ban Quản Trị (Admin).
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-2.5 px-4 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Đăng nhập tài khoản Quản trị</span>
          </button>

          <Link
            href="/"
            className="w-full py-2 px-4 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-medium border border-stone-300 transition-all flex items-center justify-center space-x-1.5 text-center"
          >
            <span>Quay về Trang chủ</span>
          </Link>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultRole="admin"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4" />
          <span>Ban Quản Trị & Biên Tập Nội Dung (F15)</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
          Quản Trị Kho Đồ & Di Sản
        </h1>
        <p className="text-stone-600 text-xs leading-relaxed max-w-xl">
          Thêm trang phục mới, khai báo quy tắc văn hóa, xuất bản bài viết nghiên cứu và quản lý tài nguyên số mà không cần sửa mã nguồn.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Tabs Quản trị */}
      <div className="flex items-center space-x-2 border-b border-stone-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("items")}
          className={`pb-3 px-3 transition-colors border-b-2 ${
            activeTab === "items"
              ? "border-heritage-red text-heritage-red"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          Thêm Món Đồ Mới (Catalog Item)
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-3 transition-colors border-b-2 ${
            activeTab === "rules"
              ? "border-heritage-red text-heritage-red"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          Thêm Quy Tắc Văn Hóa (Cultural Rule)
        </button>

        <button
          onClick={() => setActiveTab("articles")}
          className={`pb-3 px-3 transition-colors border-b-2 ${
            activeTab === "articles"
              ? "border-heritage-red text-heritage-red"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          Xuất Bản Bài Viết Di Sản (Heritage Article)
        </button>
      </div>

      {/* Tab 1: Thêm Item */}
      {activeTab === "items" && (
        <form onSubmit={handleCreateItem} className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-5 text-xs">
          <h3 className="font-serif font-bold text-base text-stone-900">
            Khai Báo Trang Phục Hoặc Phụ Kiện Mới
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Mã định danh ID (ví dụ: item_ngu_than_moi) *</label>
              <input
                type="text"
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Tên trang phục *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Nhóm áo</label>
              <select
                value={itemGarmentType}
                onChange={(e) => setItemGarmentType(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red bg-stone-50"
              >
                <option value="ngu_than">Áo ngũ thân tay chẽn</option>
                <option value="ao_tac">Áo tấc</option>
                <option value="nhat_binh">Áo Nhật bình</option>
                <option value="ao_dai_remix">Áo dài Remix</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Vị trí (Slot)</label>
              <select
                value={itemSlot}
                onChange={(e) => setItemSlot(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red bg-stone-50"
              >
                <option value="outerwear">Áo ngoài (outerwear)</option>
                <option value="undergarment">Áo lót trong (undergarment)</option>
                <option value="bottom">Quần (bottom)</option>
                <option value="headwear">Khăn vấn / Mũ (headwear)</option>
                <option value="accessory_front">Phụ kiện trước (accessory_front)</option>
                <option value="footwear">Giày / Guốc (footwear)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-700">Mô tả đặc trưng & chất liệu</label>
            <textarea
              rows={3}
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? "Đang xử lý..." : "Lưu vào Kho Đồ"}
          </button>
        </form>
      )}

      {/* Tab 2: Thêm Rule */}
      {activeTab === "rules" && (
        <form onSubmit={handleCreateRule} className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-5 text-xs">
          <h3 className="font-serif font-bold text-base text-stone-900">
            Thêm Quy Tắc Kiểm Tra Di Sản Văn Hóa
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Mã quy tắc (CODE, ví dụ: RULE_PHUC_SAC) *</label>
              <input
                type="text"
                required
                value={ruleCode}
                onChange={(e) => setRuleCode(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Tên quy tắc *</label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Mức độ nghiêm trọng</label>
              <select
                value={ruleSeverity}
                onChange={(e) => setRuleSeverity(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red bg-stone-50"
              >
                <option value="warning">Cảnh báo (Warning)</option>
                <option value="strict">Nghiêm cấm vi phạm (Strict)</option>
                <option value="info">Gợi ý thông tin (Info)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-700">Lời giải thích chuẩn mực văn hóa *</label>
            <textarea
              rows={3}
              required
              value={ruleExplanation}
              onChange={(e) => setRuleExplanation(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? "Đang xử lý..." : "Lưu Quy Tắc"}
          </button>
        </form>
      )}

      {/* Tab 3: Thêm Bài viết */}
      {activeTab === "articles" && (
        <form onSubmit={handleCreateArticle} className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-5 text-xs">
          <h3 className="font-serif font-bold text-base text-stone-900">
            Xuất Bản Bài Viết Di Sản Mới Đã Thẩm Định
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Mã bài viết (ID) *</label>
              <input
                type="text"
                required
                value={artId}
                onChange={(e) => setArtId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Tiêu đề bài viết *</label>
              <input
                type="text"
                required
                value={artTitle}
                onChange={(e) => setArtTitle(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Đường dẫn tĩnh (Slug) *</label>
              <input
                type="text"
                required
                value={artSlug}
                onChange={(e) => setArtSlug(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-700">Tóm tắt ngắn (Dưới 80 từ theo tiêu chuẩn đề bài) *</label>
            <textarea
              rows={3}
              required
              value={artSummary}
              onChange={(e) => setArtSummary(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? "Đang xử lý..." : "Xuất Bản Bài Viết"}
          </button>
        </form>
      )}
    </div>
  );
}
