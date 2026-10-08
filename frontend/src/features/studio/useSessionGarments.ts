"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { CatalogItem } from "@/lib/types/api";
import { SESSION_GARMENT_LIMIT, SESSION_GARMENT_PREFIX, SESSION_IMAGE_MAX_BYTES } from "./sessionGarments";

/** Private assets live only in this root provider's RAM, including across routes. */
export function useSessionGarments(ownerId: string | undefined, authReady: boolean) {
  const [state, setState] = useState<{ ownerId?: string; items: CatalogItem[]; uploading: boolean; error: string | null }>({ ownerId, items: [], uploading: false, error: null });
  const scope = useRef({ ownerId, epoch: 0 });
  const items = useRef<CatalogItem[]>([]);
  const request = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    scope.current = { ownerId, epoch: scope.current.epoch + 1 };
    items.current = [];
    setState({ ownerId, items: [], uploading: false, error: null });
    const ownedUrls = urls.current;
    return () => {
      scope.current.epoch++;
      request.current?.abort();
      request.current = null;
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
      ownedUrls.clear();
      items.current = [];
    };
  }, [ownerId]);

  const upload = useCallback(async (file: File, slot: string) => {
    if (!ownerId || !authReady || scope.current.ownerId !== ownerId || request.current) return;
    const fail = (error: string) => setState(previous => ({ ...previous, error }));
    if (!["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "footwear"].includes(slot)) return;
    if (items.current.length >= SESSION_GARMENT_LIMIT) return fail(`Mỗi phiên dùng tối đa ${SESSION_GARMENT_LIMIT} ảnh trang phục.`);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return fail("Chọn ảnh PNG, JPG hoặc WebP.");
    if (!file.size || file.size > SESSION_IMAGE_MAX_BYTES) return fail("Chọn ảnh có dung lượng từ 1 byte đến 10 MB.");
    const controller = new AbortController();
    request.current = controller;
    const epoch = scope.current.epoch;
    const current = () => scope.current.epoch === epoch && scope.current.ownerId === ownerId && !controller.signal.aborted;
    setState(previous => ({ ...previous, uploading: true, error: null }));
    try {
      const blob = await api.cutoutSessionImage(file, controller.signal);
      if (!current()) return;
      if (blob.type !== "image/png" || !blob.size || blob.size > SESSION_IMAGE_MAX_BYTES) throw new Error("Ảnh tách nền không hợp lệ. Vui lòng thử lại.");
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const item: CatalogItem = {
        id: `${SESSION_GARMENT_PREFIX}${id}`, slot,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Trang phục cá nhân",
        gender: "unisex", is_published: false, variants: [],
        color_change_supported: false, color_change_reason: "Ảnh cá nhân được giữ nguyên màu và họa tiết.",
        metadata: { real_image_url: url, session_only: true },
      };
      items.current = [...items.current, item];
      setState({ ownerId, items: items.current, uploading: false, error: null });
    } catch (error) {
      if (current()) fail((error as Error).message || "Không tải được ảnh. Vui lòng thử lại.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setState(previous => ({ ...previous, uploading: false }));
      }
    }
  }, [ownerId, authReady]);

  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setState(previous => ({ ...previous, uploading: false }));
  }, []);
  return { items: state.ownerId === ownerId ? state.items : [], uploading: state.ownerId === ownerId && state.uploading, error: state.ownerId === ownerId ? state.error : null, upload, cancel };
}
