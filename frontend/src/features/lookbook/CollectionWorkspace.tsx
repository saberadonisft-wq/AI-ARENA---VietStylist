"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Lookbook, OutfitResponse } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { shareUrlForOrigin } from "@/lib/shareUrl";
import { useAuth } from "@/lib/auth/context";
import { FolderHeart, Plus, Share2, Eye, Lock, Globe, Sparkles, Check } from "lucide-react";
import { LookbookCardSkeleton } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import AuthModal from "@/components/AuthModal";

export default function CollectionWorkspace() {
  const { user, isLoggedIn, isReady } = useAuth();
  const currentOwnerId = useRef(user?.id);
  currentOwnerId.current = user?.id;
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [userOutfits, setUserOutfits] = useState<OutfitResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);

  // Modal tạo lookbook mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVisibility, setNewVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [selectedOutfitVersionIds, setSelectedOutfitVersionIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const createErrorRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isCreateOpen && createError) {
      createErrorRef.current?.focus({ preventScroll: true });
      createErrorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isCreateOpen, createError]);

  // Share link
  const [activeShareData, setActiveShareData] = useState<{ id: string; url: string } | null>(null);
  const [activeShareOwnerId, setActiveShareOwnerId] = useState<string | null>(null);
  const [sharingLookbookId, setSharingLookbookId] = useState<string | null>(null);
  const visibleUserOutfits = loadedOwnerId === user?.id ? userOutfits : [];

  useEffect(() => {
    setActiveShareData(null);
    setActiveShareOwnerId(null);
    setSharingLookbookId(null);
    setActionMessage(null);
    setIsCreateOpen(false);
    setIsCreating(false);
  }, [user?.id]);

  const fetchLookbooks = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoadError(null);
    setLookbooks([]);
    setUserOutfits([]);
    setLoadedOwnerId(null);
    if (!isReady) {
      setIsLoading(true);
      return;
    }
    if (!isLoggedIn || !user?.id) {
      setIsLoading(false);
      return;
    }
    const ownerId = user.id;
    setIsLoading(true);
    try {
      const [lbs, outfits] = await Promise.all([api.listLookbooks(), api.listUserOutfits()]);
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) {
        setLookbooks(lbs);
        setUserOutfits(outfits);
        setLoadedOwnerId(ownerId);
      }
    } catch (err: any) {
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) {
        setLoadError(err?.statusCode === 401
          ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tải Lookbook."
          : err?.message || "Không tải được Lookbook.");
      }
    } finally {
      if (generation === requestGeneration.current && ownerId === currentOwnerId.current) setIsLoading(false);
    }
  }, [isLoggedIn, isReady, user?.id]);

  useEffect(() => {
    void fetchLookbooks();
    return () => { requestGeneration.current++; };
  }, [fetchLookbooks]);

  const handleCreateLookbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError(null);
    if (!newTitle.trim()) {
      setTitleError("Nhập tên Lookbook có ít nhất một ký tự khác khoảng trắng.");
      titleRef.current?.focus();
      return;
    }
    setTitleError(null);
    const ownerId = user?.id;
    if (!isLoggedIn || !ownerId || loadedOwnerId !== ownerId) {
      setCreateError("Hãy đăng nhập và tải xong dữ liệu tài khoản trước khi tạo Lookbook.");
      return;
    }
    setIsCreating(true);
    try {
      const entries = selectedOutfitVersionIds.map((vId, idx) => ({
        outfit_version_id: vId,
        sort_order: idx + 1,
      }));

      await api.createLookbook({
        title: newTitle.trim(),
        description: newDesc,
        visibility: newVisibility,
        entries,
      });

      if (ownerId === currentOwnerId.current) {
        setIsCreateOpen(false);
        setNewTitle("");
        setNewDesc("");
        setSelectedOutfitVersionIds([]);
        setActionMessage("Đã tạo Lookbook trong tài khoản của bạn.");
        await fetchLookbooks();
      }
    } catch (err: any) {
      if (ownerId === currentOwnerId.current) setCreateError("Không tạo được Lookbook: " + (err?.message || "Máy chủ không khả dụng."));
    } finally {
      if (ownerId === currentOwnerId.current) setIsCreating(false);
    }
  };

  const handleShare = async (lookbookId: string) => {
    const ownerId = user?.id;
    if (!isLoggedIn || !ownerId) {
      setShowAuthModal(true);
      return;
    }
    if (loadedOwnerId !== ownerId || sharingLookbookId) return;
    setSharingLookbookId(lookbookId);
    try {
      const res = await api.shareLookbook(lookbookId, 30);
      if (ownerId === currentOwnerId.current && loadedOwnerId === ownerId) {
        setActiveShareData({ id: lookbookId, url: shareUrlForOrigin(res.share_token, window.location.origin) });
        setActiveShareOwnerId(ownerId);
        setActionMessage("Đã tạo liên kết chia sẻ có hiệu lực trong 30 ngày.");
      }
    } catch (err: any) {
      if (ownerId === currentOwnerId.current) setActionMessage("Không tạo được liên kết chia sẻ: " + (err?.message || "Máy chủ không khả dụng."));
    } finally {
      if (ownerId === currentOwnerId.current) setSharingLookbookId(null);
    }
  };

  const copyShareLink = async () => {
    if (!activeShareData || activeShareOwnerId !== user?.id) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(activeShareData.url);
      setActionMessage("Đã sao chép liên kết chia sẻ.");
    } catch {
      setActionMessage("Trình duyệt không cho phép sao chép. Liên kết vẫn hiển thị để bạn bôi đen và sao chép thủ công.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
            <FolderHeart className="w-4 h-4" />
              <span>Bộ sưu tập cá nhân</span>
          </div>
          <h2 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
            Bộ sưu tập của tôi
          </h2>
          <p className="text-stone-600 text-xs leading-relaxed max-w-xl">
            Tập hợp các bộ phối đã lưu thành bộ sưu tập theo chủ đề. Bạn có thể tạo liên kết chia sẻ có thời hạn và tự chọn quyền xem.
          </p>
        </div>

        {isLoggedIn ? (
          <button
            onClick={() => { setCreateError(null); setTitleError(null); setIsCreateOpen(true); }}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Lookbook Mới</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <Sparkles className="w-4 h-4 text-heritage-gold" />
            <span>Đăng nhập để quản lý Lookbook</span>
          </button>
        )}
      </div>

      {actionMessage && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{actionMessage}</div>}
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><span>Không tải được dữ liệu Lookbook: {loadError}</span><button type="button" onClick={() => void fetchLookbooks()} disabled={isLoading} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Thử tải lại</button></div>}

      {/* Thông báo chia sẻ vừa tạo */}
      {activeShareData && activeShareOwnerId === user?.id && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-emerald-900">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-bold flex items-center space-x-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Liên kết chia sẻ đã sẵn sàng:</span>
            </div>
            <div className="break-all font-mono text-[11px] text-emerald-700 select-all">
              {activeShareData.url}
            </div>
          </div>
          <button
              onClick={() => void copyShareLink()}
            className="min-h-11 whitespace-nowrap px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shrink-0"
          >
            Sao chép liên kết
          </button>
        </div>
      )}

      {/* Danh sách Lookbooks */}
      {!isReady ? (
        <div role="status" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => <LookbookCardSkeleton key={i} />)}</div>
      ) : !isLoggedIn ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-4 shadow-sm">
          <FolderHeart className="w-12 h-12 text-stone-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Bạn đang ở chế độ Khách (Guest)
            </h3>
            <p className="text-stone-500 text-xs max-w-md mx-auto">
              Đăng nhập để lưu Lookbook trong tài khoản, đồng bộ giữa các thiết bị và quản lý liên kết chia sẻ.
            </p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
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
      ) : loadError ? null : loadedOwnerId !== user?.id ? (
        <div role="status" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => <LookbookCardSkeleton key={i} />)}</div>
      ) : lookbooks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-4 shadow-sm">
          <FolderHeart className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-bold text-stone-900">Chưa có Lookbook nào</h3>
          <p className="text-stone-500 text-xs max-w-sm mx-auto">
            Bắt đầu bằng cách tạo một bộ sưu tập và chọn các bộ phối từ Studio để đính kèm.
          </p>
          <button
            onClick={() => { setCreateError(null); setTitleError(null); setIsCreateOpen(true); }}
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
                    <span>{lb.visibility === "public" ? "Công khai" : lb.visibility === "unlisted" ? "Người có liên kết" : "Riêng tư"}</span>
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
                    type="button"
                    disabled={isLoading || loadedOwnerId !== user?.id || sharingLookbookId !== null}
                    className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 transition-colors disabled:opacity-50"
                    title={sharingLookbookId === lb.id ? "Đang tạo liên kết" : "Tạo liên kết chia sẻ"}
                    aria-label={`Tạo liên kết chia sẻ ${lb.title}`}
                  >
                    <Share2 className={`w-3.5 h-3.5 ${sharingLookbookId === lb.id ? "animate-pulse" : ""}`} />
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
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} closeDisabled={isCreating} label="Tạo bộ sưu tập Lookbook mới">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-full overflow-y-auto shadow-2xl border border-stone-200 p-4 sm:p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Tạo Bộ Sưu Tập Lookbook Mới
            </h3>

            <form onSubmit={handleCreateLookbook} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label htmlFor="lookbook-title" className="font-semibold text-stone-700">Tên Lookbook *</label>
                <input
                  id="lookbook-title" ref={titleRef} disabled={isCreating} aria-invalid={!!titleError} aria-describedby={titleError ? "lookbook-title-error" : undefined}
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => { setNewTitle(e.target.value); setTitleError(null); }}
                  placeholder="Ví dụ: Kỷ yếu Cố đô Huế 2026..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
                />
                {titleError && <p id="lookbook-title-error" role="alert" className="text-sm text-red-800">{titleError}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="lookbook-description" className="font-semibold text-stone-700">Mô tả chủ đề</label>
                <textarea
                  id="lookbook-description" disabled={isCreating}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả phong cách, bối cảnh chụp ảnh..."
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="lookbook-visibility" className="font-semibold text-stone-700">Quyền riêng tư</label>
                <select
                  id="lookbook-visibility" disabled={isCreating}
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red bg-stone-50"
                >
                  <option value="unlisted">Người có liên kết (khuyên dùng)</option>
                  <option value="public">Công khai</option>
                  <option value="private">Riêng tư</option>
                </select>
              </div>

              {/* Chọn bộ phối đính kèm */}
              {visibleUserOutfits.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-700">
                    Chọn bộ phối đính kèm ({selectedOutfitVersionIds.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-stone-200 p-2 rounded-lg bg-stone-50">
                    {visibleUserOutfits.map((outfit) => {
                      if (!outfit.current_version_id) return null;
                      const isChecked = selectedOutfitVersionIds.includes(outfit.current_version_id);
                      return (
                        <label
                          key={outfit.id}
                          className="flex items-center space-x-2 text-stone-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            disabled={isCreating}
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

              {createError && <p ref={createErrorRef} tabIndex={-1} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{createError}</p>}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)} disabled={isCreating}
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
        </Modal>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
