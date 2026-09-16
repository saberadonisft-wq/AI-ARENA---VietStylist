"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Lookbook, OutfitResponse } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { FolderHeart, Plus, Share2, Eye, Lock, Globe, Sparkles, Check } from "lucide-react";
import { LookbookCardSkeleton } from "@/components/ui/Skeleton";

export default function LookbookPage() {
  const { user, isLoggedIn, login } = useAuth();
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [userOutfits, setUserOutfits] = useState<OutfitResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal tạo lookbook mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVisibility, setNewVisibility] = useState<"private" | "unlisted" | "public">("unlisted");
  const [selectedOutfitVersionIds, setSelectedOutfitVersionIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Share link
  const [activeShareData, setActiveShareData] = useState<{ id: string; url: string } | null>(null);

  const fetchLookbooks = () => {
    if (!isLoggedIn) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    Promise.all([api.listLookbooks(), api.listUserOutfits()])
      .then(([lbs, outfits]) => {
        setLookbooks(lbs);
        setUserOutfits(outfits);
      })
      .catch((err) => console.error("Lỗi lấy lookbooks:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchLookbooks();
  }, [isLoggedIn]);

  const handleCreateLookbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const entries = selectedOutfitVersionIds.map((vId, idx) => ({
        outfit_version_id: vId,
        sort_order: idx + 1,
      }));

      await api.createLookbook({
        title: newTitle,
        description: newDesc,
        visibility: newVisibility,
        entries,
      });

      setIsCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setSelectedOutfitVersionIds([]);
      fetchLookbooks();
    } catch (err: any) {
      alert("Lỗi khi tạo lookbook: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async (lookbookId: string) => {
    try {
      const res = await api.shareLookbook(lookbookId, 30);
      setActiveShareData({ id: lookbookId, url: res.share_url });
    } catch (err: any) {
      alert("Lỗi tạo link chia sẻ: " + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
            <FolderHeart className="w-4 h-4" />
            <span>Bộ sưu tập cá nhân (F09)</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
            Lookbook Việt Phục
          </h1>
          <p className="text-stone-600 text-xs leading-relaxed max-w-xl">
            Tập hợp các bộ phối tâm đắc thành bộ sưu tập chủ đề (Kỷ yếu, Lễ cưới, Du xuân) và tạo liên kết chia sẻ bảo mật cao cho bạn bè.
          </p>
        </div>

        {isLoggedIn ? (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Lookbook Mới</span>
          </button>
        ) : (
          <button
            onClick={() => login("sinh_vien_01", "user")}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <Sparkles className="w-4 h-4 text-heritage-gold" />
            <span>Đăng nhập để quản lý Lookbook</span>
          </button>
        )}
      </div>

      {/* Thông báo chia sẻ vừa tạo */}
      {activeShareData && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
          <div className="space-y-0.5">
            <div className="font-bold flex items-center space-x-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Đã tạo liên kết chia sẻ công khai có bảo mật (Token Hash):</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-700 select-all">
              {activeShareData.url}
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(activeShareData.url);
              alert("Đã copy link chia sẻ vào bộ nhớ tạm!");
            }}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shrink-0"
          >
            Copy Link
          </button>
        </div>
      )}

      {/* Danh sách Lookbooks */}
      {!isLoggedIn ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-4 shadow-sm">
          <FolderHeart className="w-12 h-12 text-stone-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Bạn đang ở chế độ Khách (Guest)
            </h3>
            <p className="text-stone-500 text-xs max-w-md mx-auto">
              Đăng nhập để lưu nhiều Lookbook, đồng bộ giữa các thiết bị và cấp liên kết chia sẻ công khai không lộ ID tài khoản.
            </p>
          </div>
          <button
            onClick={() => login("sinh_vien_01", "user")}
            className="px-5 py-2 bg-heritage-red text-white text-xs font-semibold rounded-xl hover:bg-heritage-red-dark transition-all"
          >
            Đăng nhập ngay
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <LookbookCardSkeleton key={i} />
          ))}
        </div>
      ) : lookbooks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-4 shadow-sm">
          <FolderHeart className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-bold text-stone-900">Chưa có Lookbook nào</h3>
          <p className="text-stone-500 text-xs max-w-sm mx-auto">
            Bắt đầu bằng cách tạo một bộ sưu tập và chọn các bộ phối từ Studio để đính kèm.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2 bg-heritage-red text-white text-xs font-semibold rounded-xl hover:bg-heritage-red-dark transition-all"
          >
            Tạo Lookbook đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lookbooks.map((lb) => (
            <div
              key={lb.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      lb.visibility === "public"
                        ? "bg-emerald-100 text-emerald-800"
                        : lb.visibility === "unlisted"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {lb.visibility === "public" ? (
                      <Globe className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    <span>{lb.visibility}</span>
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {new Date(lb.created_at).toLocaleDateString("vi-VN")}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-base text-stone-900">{lb.title}</h3>
                <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                  {lb.description || "Chưa có mô tả"}
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="font-medium text-stone-500">
                  {lb.entries.length} bộ phối đính kèm
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleShare(lb.id)}
                    className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 transition-colors"
                    title="Chia sẻ link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <Link
                    href={`/lookbook/${lb.id}`}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-heritage-red text-white font-semibold transition-colors"
                  >
                    Quản lý →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Lookbook */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Tạo Bộ Sưu Tập Lookbook Mới
            </h3>

            <form onSubmit={handleCreateLookbook} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Tên Lookbook *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kỷ yếu Cố đô Huế 2026..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Mô tả chủ đề</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả phong cách, bối cảnh chụp ảnh..."
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Quyền riêng tư</label>
                <select
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red bg-stone-50"
                >
                  <option value="unlisted">Có liên kết mới xem được (Unlisted - Khuyên dùng)</option>
                  <option value="public">Công khai toàn mạng (Public)</option>
                  <option value="private">Riêng tư chỉ mình tôi (Private)</option>
                </select>
              </div>

              {/* Chọn bộ phối đính kèm */}
              {userOutfits.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-700">
                    Chọn bộ phối đính kèm ({selectedOutfitVersionIds.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-stone-200 p-2 rounded-lg bg-stone-50">
                    {userOutfits.map((outfit) => {
                      if (!outfit.current_version_id) return null;
                      const isChecked = selectedOutfitVersionIds.includes(outfit.current_version_id);
                      return (
                        <label
                          key={outfit.id}
                          className="flex items-center space-x-2 text-stone-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOutfitVersionIds([...selectedOutfitVersionIds, outfit.current_version_id!]);
                              } else {
                                setSelectedOutfitVersionIds(
                                  selectedOutfitVersionIds.filter((id) => id !== outfit.current_version_id)
                                );
                              }
                            }}
                            className="rounded border-stone-300 text-heritage-red focus:ring-heritage-red"
                          />
                          <span className="truncate">{outfit.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
                >
                  {isCreating ? "Đang tạo..." : "Xác nhận tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
