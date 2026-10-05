"use client";

import "@/features/studio/studio-workspace.css";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GarmentType,
  Occasion,
  CatalogItem,
  ItemVariant,
  Avatar,
  AssetLayer,
  OutfitSnapshot,
  SnapshotItem,
  CulturalCheckResponse,
  StarterOutfit,
} from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { useStudioDocument } from "@/features/studio/useStudioDocument";
import { mergeUnlockedItems } from "@/features/studio/state";
import { occasionBackgroundPatch, neutralBackground, type BackgroundTheme } from "@/features/studio/backgrounds";
import { useAuth } from "@/lib/auth/context";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import Canvas2D, { Canvas2DHandle } from "@/features/studio/Canvas2D";
import BackgroundFadeControl from "@/features/studio/BackgroundFadeControl";
import SwatchPicker from "@/features/studio/SwatchPicker";
import CulturalCheckBadge from "@/features/studio/CulturalCheckBadge";
const StudioComposerPanel = dynamic(() => import("@/features/composer/components/StudioComposerPanel"), { ssr: false });
import WeatherWidget from "@/features/studio/WeatherWidget";
import ColorAnalysisPanel from "@/features/studio/ColorAnalysisPanel";
const CompareModal = dynamic(() => import("@/features/studio/CompareModal"), { ssr: false });
const ExportModal = dynamic(() => import("@/features/studio/ExportModal"), { ssr: false });
const StarterOutfitModal = dynamic(() => import("@/features/studio/StarterOutfitModal"), { ssr: false });
import StylingQuestionnaire, { INITIAL_STYLING_PREFERENCES, type StylingPreferences } from "@/features/studio/StylingQuestionnaire";
import GeminiTryOnModal from "@/features/studio/GeminiTryOnModal";
import Modal from "@/components/ui/Modal";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { eraLabel, slotLabel, itemLabel, STYLE_LABELS } from "@/lib/catalog/display";
import { catalogImageUrl, catalogThumbnailUrl } from "@/lib/catalog/images";
import AuthModal from "@/components/AuthModal";
import ToastContainer, { type ToastItem } from "@/components/ui/Toast";
import {
  Skeleton,
  GarmentItemSkeleton,
  OccasionGridSkeleton,
} from "@/components/ui/Skeleton";
import {
  Undo2,
  Redo2,
  Lock,
  Unlock,
  Save,
  Download,
  Sparkles,
  ArrowRightLeft,
  Camera,
  Layers,
  Check,
  RefreshCw,
  SlidersHorizontal,
  BookmarkPlus,
  Compass,
  X,
  Info,
} from "lucide-react";

type ColorPatchResult = { supported: true; patch: Partial<SnapshotItem> } | { supported: false; reason: string };

async function resolveColorPatch(item: CatalogItem, colorHex: string, variantId?: string): Promise<ColorPatchResult> {
  const defaultVariant = item.variants.find(variant => variant.is_default) || item.variants[0];
  const defaultHex = defaultVariant?.hex_color;
  const selectedVariantId = variantId || item.variants.find(variant => variant.hex_color.toLowerCase() === colorHex.toLowerCase())?.id;
  if (defaultHex?.toLowerCase() === colorHex.toLowerCase()) {
    return { supported: true, patch: { variantId: defaultVariant?.id, colorHex: defaultHex,
      originalColorHex: undefined, colorAlgorithmVersion: undefined, colorSourceVersion: undefined } };
  }
  if (item.metadata?.catalog_media_id) {
    const preview = await api.previewCatalogColor(item.id, colorHex);
    if (!preview.supported) return { supported: false, reason: preview.reason || "Ảnh chưa đủ điều kiện để đổi màu tự động." };
    return { supported: true, patch: { variantId: selectedVariantId, colorHex,
      originalColorHex: defaultHex, colorAlgorithmVersion: preview.algorithm_version,
      colorSourceVersion: preview.source_version } };
  }
  const svg = item.default_layer?.svg_content || "";
  if (svg.includes("VAR_COLOR_PRIMARY")) {
    return { supported: true, patch: { variantId: selectedVariantId, colorHex,
      originalColorHex: defaultHex, colorAlgorithmVersion: undefined, colorSourceVersion: undefined } };
  }
  return { supported: false, reason: "Ảnh trang phục này chưa có xử lý đổi màu an toàn." };
}

export default function StudioPage() {
  const { confirm: confirmWeatherReplacement, dialog: weatherReplacementDialog } = useConfirmDialog();
  const { user, isLoggedIn, isAdmin, isReady: authReady } = useAuth();
  const studio = useStudioDocument(user?.id, authReady, isAdmin);
  const document = studio.history.present;
  const snapshot = document.snapshot;
  const canvasRef = useRef<Canvas2DHandle | null>(null);
  const catalogListRef = useRef<HTMLDivElement | null>(null);

  // Dữ liệu danh mục từ CatalogProvider dùng chung
  const {
    garmentTypes,
    occasions,
    catalogItems,
    avatars,
    isLoading: isInitialLoading,
    error: catalogError,
    itemsError: catalogItemsError,
    refreshCatalog,
  } = useCatalog();
  const currentAvatar = avatars.find(a => a.id === snapshot.avatarId) || null;
  const [selectedGarmentType, setSelectedGarmentType] = useState("all");
  const [mobilePanel, setMobilePanel] = useState<"catalog" | "properties" | "tools">("catalog");
  const [activeSlot, setActiveSlot] = useState("outerwear");
  const outfitTitle = document.title;
  const selectedOccasion = snapshot.occasionId;
  const styleMode = snapshot.styleMode;
  const overlapDirection = snapshot.overlapDirection;
  const equippedItems = snapshot.items;
  const unavailableSnapshotItems = useMemo(() => {
    if (isInitialLoading || catalogItemsError) return [];
    const publishedIds = new Set(catalogItems.filter(item => item.is_published).map(item => item.id));
    return equippedItems.filter(item => !publishedIds.has(item.itemId));
  }, [equippedItems, catalogItems, catalogItemsError, isInitialLoading]);
  const lockedSlots = useMemo(() => new Set(snapshot.lockedSlots || []), [snapshot.lockedSlots]);
  const setOutfitTitle = (title: string) => studio.dispatch({ type: "commit", update: doc => ({ ...doc, title }) });
  const setSelectedOccasion = (occasionId?: string) => studio.dispatch({ type: "commit", update: doc => ({
    ...doc, snapshot: { ...doc.snapshot, ...occasionBackgroundPatch(doc.snapshot, occasionId) },
  }) });
  const setStyleMode = (styleMode: OutfitSnapshot["styleMode"]) => studio.updateSnapshot({ styleMode });
  const setOverlapDirection = (overlapDirection: OutfitSnapshot["overlapDirection"]) => studio.updateSnapshot({ overlapDirection });
  const setEquippedItems = (items: SnapshotItem[]) => studio.updateSnapshot({ items });
  const setLockedSlots = (slots: Set<string>) => studio.updateSnapshot({ lockedSlots: [...slots] });
  const layers = useMemo(() => equippedItems.flatMap(it => {
    const layer = catalogItems.find(ci => ci.id === it.itemId)?.default_layer;
    return layer ? [layer] : [];
  }), [equippedItems, catalogItems]);

  // Kiểm tra văn hóa thời gian thực (F10)
  const [culturalCheck, setCulturalCheck] = useState<CulturalCheckResponse | null>(null);
  const [culturalCheckStatus, setCulturalCheckStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [culturalCheckError, setCulturalCheckError] = useState<string | null>(null);
  const [culturalCheckRetry, setCulturalCheckRetry] = useState(0);

  // Ghim Phương án A để so sánh A/B (F08)
  const [pinnedSnapshotA, setPinnedSnapshotA] = useState<OutfitSnapshot | null>(null);

  // Modals
  const [isStarterOpen, setIsStarterOpen] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<StarterOutfit | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<"save" | "save-new" | "export" | "try-on" | "recommendations" | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [guestNoticeDismissed, setGuestNoticeDismissed] = useState(false);
  const [dismissedRecoveryList, setDismissedRecoveryList] = useState<string | null>(null);
  useEffect(() => {
    if (!studio.hydrated || isLoggedIn || guestNoticeDismissed) return;
    const timer = window.setTimeout(() => setGuestNoticeDismissed(true), 8000);
    return () => window.clearTimeout(timer);
  }, [studio.hydrated, isLoggedIn, guestNoticeDismissed]);
  const [starterState, setStarterState] = useState<"loading" | "available" | "empty" | "error">("loading");
  const [requestedCatalogItemId, setRequestedCatalogItemId] = useState<string | null>(null);
  const [pendingCatalogReplacement, setPendingCatalogReplacement] = useState<CatalogItem | null>(null);
  const [isApplyingColor, setIsApplyingColor] = useState(false);
  const isSaving = studio.saving;
  const saveSuccessMessage = studio.message;

  const [stylingPreferences, setStylingPreferences] = useState<StylingPreferences>(INITIAL_STYLING_PREFERENCES);
  const questionnaire = { ...stylingPreferences, occasionId: stylingPreferences.occasionId ?? selectedOccasion,
    styleMode: stylingPreferences.styleMode ?? styleMode };
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const recommendationRequest = useRef<AbortController | null>(null);
  const [pendingRecommendation, setPendingRecommendation] = useState<{
    title: string; explanation: string; source: string; model: string; items: SnapshotItem[];
    occasionId: string; styleMode: OutfitSnapshot["styleMode"];
  } | null>(null);
  const [isApplyingRecommendation, setIsApplyingRecommendation] = useState(false);

  useEffect(() => {
    setPendingRecommendation(null);
    setRecommendationNotice(null);
    setRecommendationError(null);
    setIsAiLoading(false);
    return () => {
      recommendationRequest.current?.abort();
      recommendationRequest.current = null;
    };
  }, [user?.id]);

  // Tỷ lệ khung hình hiển thị
  const displayRatio = snapshot.aspectRatio || "9:16";
  const setDisplayRatio = (aspectRatio: "1:1" | "9:16") => studio.updateSnapshot({ aspectRatio });

  const canvasBackgroundTheme = snapshot.backgroundTheme || "white";
  const setCanvasBackgroundTheme = (backgroundTheme: BackgroundTheme) => studio.updateSnapshot({
    backgroundTheme, neutralBackgroundTheme: backgroundTheme === "occasion" ? neutralBackground(snapshot) : backgroundTheme,
  });

  useEffect(() => {
    let active = true;
    api.getStarterOutfits().then(rows => {
      if (active) setStarterState(rows.length ? "available" : "empty");
    }).catch(() => { if (active) setStarterState("error"); });
    const itemId = new URLSearchParams(window.location.search).get("itemId");
    if (itemId) setRequestedCatalogItemId(itemId);
    return () => { active = false; };
  }, []);

  const refreshStarterOutfits = () => {
    setStarterState("loading");
    api.getStarterOutfits().then(rows => setStarterState(rows.length ? "available" : "empty"))
      .catch(() => setStarterState("error"));
  };

  useEffect(() => {
    if (!requestedCatalogItemId || !catalogItems.length) return;
    const item = catalogItems.find(candidate => candidate.id === requestedCatalogItemId && candidate.is_published);
    if (!item) {
      setActionNotice("Trang phục từ liên kết không còn trong danh mục. Bản phối hiện tại vẫn được giữ.");
      setRequestedCatalogItemId(null);
      return;
    }
    setSelectedGarmentType("all");
    setActiveSlot(item.slot);
  }, [requestedCatalogItemId, catalogItems]);

  const requestAccountAction = (action: "save" | "save-new" | "export" | "try-on" | "recommendations") => {
    if (studio.accountDraftChoice) return;
    if ((action === "export" || action === "try-on") && equippedItems.length === 0) {
      setActionNotice("Thêm ít nhất một món trang phục trước khi xuất ảnh hoặc thử đồ AI.");
      return;
    }
    if (isLoggedIn) {
      if (action === "save" || action === "save-new") void studio.save(action === "save-new");
      else if (action === "export") setIsExportOpen(true);
      else if (action === "try-on") setIsTryOnOpen(true);
      else void handleAskAIStylist();
      return;
    }
    setPendingAccountAction(action);
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (!isLoggedIn || !studio.hydrated || studio.accountDraftChoice || !pendingAccountAction) return;
    const action = pendingAccountAction;
    setPendingAccountAction(null);
    if (action === "save" || action === "save-new") void studio.save(action === "save-new");
    else if (action === "export") setIsExportOpen(true);
    else if (action === "try-on") setIsTryOnOpen(true);
    else void handleAskAIStylist();
  }, [isLoggedIn, studio.hydrated, studio.accountDraftChoice, pendingAccountAction, studio.save]);

  // Thông báo khôi phục bản nháp & giải thích văn hóa Hữu nhậm
  const draftNotice = studio.draftNotice;
  const [showHuuNhamInfo, setShowHuuNhamInfo] = useState(false);

  // Bảng phối màu Ngũ Hành 1 chạm (Tối ưu trải nghiệm F02/F07)
  const NGU_HANH_PALETTES = [
    {
      name: "Mộc",
      element: "wood",
      desc: "Sinh sôi, thanh nhã",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      colors: { outerwear: "#276749", undergarment: "#FFFFFF", bottom: "#FFFFFF", headwear: "#171923" },
    },
    {
      name: "Hỏa",
      element: "fire",
      desc: "Rực rỡ, may mắn",
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      colors: { outerwear: "#9B2C2C", undergarment: "#FFFFFF", bottom: "#FFFFFF", headwear: "#171923" },
    },
    {
      name: "Thổ",
      element: "earth",
      desc: "Hoàng gia, uy nghi",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      colors: { outerwear: "#D69E2E", undergarment: "#FFFFFF", bottom: "#1A202C", headwear: "#171923" },
    },
    {
      name: "Kim",
      element: "metal",
      desc: "Thuần khiết, đoan trang",
      badge: "bg-stone-100 text-stone-800 border-stone-300",
      colors: { outerwear: "#E2E8F0", undergarment: "#FFFFFF", bottom: "#FFFFFF", headwear: "#171923" },
    },
    {
      name: "Thủy",
      element: "water",
      desc: "Trầm mặc, thâm sâu",
      badge: "bg-sky-100 text-sky-800 border-sky-300",
      colors: { outerwear: "#1A365D", undergarment: "#FFFFFF", bottom: "#FFFFFF", headwear: "#171923" },
    },
  ];

  const applyColorPatches = (changes: Array<{ slot: string; itemId: string; previousColor?: string; patch: Partial<SnapshotItem> }>) => {
    let applied = 0;
    studio.dispatch({ type: "commit", update: doc => {
      const currentLocks = new Set(doc.snapshot.lockedSlots || []);
      const items = doc.snapshot.items.map(item => {
        const change = changes.find(candidate => candidate.slot === item.slot);
        if (!change || currentLocks.has(item.slot) || item.itemId !== change.itemId || item.colorHex !== change.previousColor) return item;
        applied++;
        return { ...item, ...change.patch };
      });
      return applied ? { ...doc, snapshot: { ...doc.snapshot, items } } : doc;
    } });
    return applied;
  };

  const handleColorLoadFailure = (itemId: string, requestedColor: string) => {
    const item = equippedItems.find(candidate => candidate.itemId === itemId && candidate.colorHex?.toUpperCase() === requestedColor.toUpperCase());
    const catalogItem = catalogItems.find(candidate => candidate.id === itemId);
    if (!item || !catalogItem) return;
    const original = catalogItem.variants.find(variant => variant.is_default) || catalogItem.variants[0];
    if (!original) return;
    const applied = applyColorPatches([{ slot: item.slot, itemId, previousColor: item.colorHex, patch: {
      variantId: original.id, colorHex: original.hex_color, originalColorHex: undefined,
      colorAlgorithmVersion: undefined, colorSourceVersion: undefined,
    } }]);
    if (applied) setActionNotice("Ảnh đổi màu không còn khả dụng. Đã khôi phục ảnh và màu gốc để bản phối, ảnh xuất và ảnh tham chiếu AI tiếp tục thống nhất.");
  };

  const applyNguHanhPalette = async (palette: (typeof NGU_HANH_PALETTES)[0]) => {
    if (isApplyingColor) return;
    setIsApplyingColor(true);
    let unsupported = 0;
    try {
      const changes = await Promise.all(equippedItems.map(async item => {
        const colorHex = (palette.colors as Record<string, string>)[item.slot];
        if (!colorHex || colorHex.toLowerCase() === item.colorHex?.toLowerCase() || lockedSlots.has(item.slot)) return null;
        const catalogItem = catalogItems.find(candidate => candidate.id === item.itemId);
        if (catalogItem) {
          try {
            const resolved = await resolveColorPatch(catalogItem, colorHex, item.variantId);
            if (resolved.supported) return { slot: item.slot, itemId: item.itemId, previousColor: item.colorHex, patch: resolved.patch };
          } catch { /* Leave this garment unchanged if its image cannot be checked. */ }
        }
        unsupported += 1;
        return null;
      }));
      const applied = applyColorPatches(changes.filter((change): change is NonNullable<typeof change> => change !== null));
      setActionNotice(unsupported || applied < changes.filter(Boolean).length
        ? `Đã đổi ${applied} món. ${unsupported + changes.filter(Boolean).length - applied} món không đổi vì ảnh chưa đủ an toàn hoặc bản phối vừa được chỉnh ở nơi khác.`
        : applied ? `Đã đổi màu ${applied} món; các vị trí đang khóa được giữ nguyên.` : "Không có món nào cần đổi màu.");
    } finally { setIsApplyingColor(false); }
  };



  // Only inputs that influence cultural rules trigger a request. Ignore stale responses.
  const culturalPayload = JSON.stringify({
    garment_type_id: selectedGarmentType === "all" ? undefined : selectedGarmentType,
    occasion_id: selectedOccasion, style_mode: styleMode, overlap_direction: overlapDirection,
    items: equippedItems.map(it => ({ slot: it.slot, item_id: it.itemId, variant_id: it.variantId, color_hex: it.colorHex })),
  });
  useEffect(() => {
    if (!studio.hydrated) return;
    let active = true;
    setCulturalCheck(null);
    setCulturalCheckError(null);
    if (!equippedItems.length) {
      setCulturalCheckStatus("empty");
      return () => { active = false; };
    }
    setCulturalCheckStatus("loading");
    const timer = setTimeout(() => {
      api.checkCulturalCompliance(JSON.parse(culturalPayload))
        .then(result => { if (active) { setCulturalCheck(result); setCulturalCheckStatus("ready"); } })
        .catch((error: any) => { if (active) { setCulturalCheck(null); setCulturalCheckError(error?.message || "Không nhận được phản hồi."); setCulturalCheckStatus("error"); } });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [culturalPayload, studio.hydrated, culturalCheckRetry, equippedItems.length]);

  const pushHistory = setEquippedItems;
  const handleUndo = () => studio.dispatch({ type: "undo" });
  const handleRedo = () => studio.dispatch({ type: "redo" });

  // Lắng nghe phím tắt: Ctrl+Z, Ctrl+Y, Esc, Phím số 1-6 đổi slot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || window.document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Escape") {
        setIsStarterOpen(false);
        setIsCompareOpen(false);
        setIsExportOpen(false);
        setIsTryOnOpen(false);
        setShowHuuNhamInfo(false);
        setPendingStarter(null);
      } else if (e.key >= "1" && e.key <= "6") {
        const slots = ["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "footwear"];
        const idx = parseInt(e.key) - 1;
        if (slots[idx]) setActiveSlot(slots[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [studio.dispatch]);

  const toggleLockSlot = (slot: string) => {
    const next = new Set(lockedSlots);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    setLockedSlots(next);
  };

  // Chọn món từ catalog
  const handleSelectItem = (item: CatalogItem) => {
    if (lockedSlots.has(item.slot)) return;
    setActiveSlot(item.slot);
    setMobilePanel("properties");

    const defaultVar = item.variants[0];
    const newItems = equippedItems.filter((it) => it.slot !== item.slot);
    newItems.push({
      slot: item.slot,
      itemId: item.id,
      variantId: defaultVar?.id,
      assetVersion: 1,
      colorHex: defaultVar?.hex_color,
    });
    pushHistory(newItems);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => window.document.getElementById("studio-board")?.scrollIntoView({ block: "start" }));
    }
  };

  const addRequestedCatalogItem = () => {
    if (!requestedCatalogItem) return;
    if (lockedSlots.has(requestedCatalogItem.slot)) return;
    const currentItem = equippedItems.find(item => item.slot === requestedCatalogItem.slot);
    if (currentItem && currentItem.itemId !== requestedCatalogItem.id) {
      setPendingCatalogReplacement(requestedCatalogItem);
      return;
    }
    handleSelectItem(requestedCatalogItem);
    setRequestedCatalogItemId(null);
  };

  const confirmCatalogReplacement = () => {
    if (!pendingCatalogReplacement) return;
    if (studio.isDirty && !studio.archiveCurrentDraft()) return;
    handleSelectItem(pendingCatalogReplacement);
    setRequestedCatalogItemId(null);
    setPendingCatalogReplacement(null);
    setActionNotice("Đã thay món trong bản phối. Bản trước đó được giữ trong mục khôi phục trên thiết bị.");
  };

  // Chọn biến thể màu
  const handleSelectVariant = async (variant: ItemVariant) => {
    const activeItemConfig = equippedItems.find((it) => it.slot === activeSlot);
    if (!activeItemConfig || lockedSlots.has(activeSlot)) return;
    const item = catalogItems.find(candidate => candidate.id === activeItemConfig.itemId);
    if (!item) return;
    const defaultVariant = item.variants.find(candidate => candidate.is_default) || item.variants[0];
    if (item.color_change_supported === false && variant.hex_color.toLowerCase() !== defaultVariant?.hex_color.toLowerCase()) {
      setActionNotice(item.color_change_reason || "Ảnh trang phục này chưa hỗ trợ đổi màu an toàn. Màu gốc được giữ nguyên.");
      return;
    }
    setIsApplyingColor(true);
    try {
      const resolved = await resolveColorPatch(item, variant.hex_color, variant.id);
      if (!resolved.supported) {
        setActionNotice(`${resolved.reason} Màu và họa tiết được giữ nguyên.`);
        return;
      }
      const applied = applyColorPatches([{ slot: activeSlot, itemId: activeItemConfig.itemId,
        previousColor: activeItemConfig.colorHex, patch: resolved.patch }]);
      setActionNotice(applied ? null : "Bản phối vừa được chỉnh ở nơi khác hoặc vị trí đã khóa; màu chưa được thay đổi.");
    } catch (error: any) {
      setActionNotice(error?.message || "Không kiểm tra được ảnh đổi màu. Màu và họa tiết được giữ nguyên.");
    } finally { setIsApplyingColor(false); }
  };

  // Áp dụng sửa nhanh từ cảnh báo văn hóa (F10)
  const handleApplyCulturalFix = (fix: any) => {
    if (!fix) return;
    if (fix.action === "set_direction") {
      setOverlapDirection("right_over_left");
    } else if (fix.action === "equip_headwear" || fix.action === "equip_undergarment") {
      const targetItem = catalogItems.find((ci) => ci.id === fix.item_id);
      if (targetItem) handleSelectItem(targetItem);
    }
  };

  // Nạp Starter Outfit (F01)
  const applyStarter = (starter: StarterOutfit) => {
    const hadUnsavedDraft = studio.isDirty;
    if (hadUnsavedDraft && !studio.archiveCurrentDraft()) return false;
    const newItems: SnapshotItem[] = starter.items.map(it => {
      const dbItem = catalogItems.find(ci => ci.id === it.item_id)!;
      const chosenVar = it.variant_id ? dbItem.variants.find(variant => variant.id === it.variant_id) : dbItem.variants.find(variant => variant.is_default) || dbItem.variants[0];
      return { slot: it.slot, itemId: it.item_id, variantId: chosenVar?.id, assetVersion: 1, colorHex: chosenVar?.hex_color };
    });
    const occasionId = occasions.some(occasion => occasion.id === starter.occasion_id) ? starter.occasion_id : undefined;
    setSelectedGarmentType(garmentTypes.some(type => type.id === starter.garment_type_id) ? starter.garment_type_id : "all");
    const started = studio.startNewDocument({
      title: starter.title,
      snapshot: { ...snapshot, ...occasionBackgroundPatch(snapshot, occasionId), items: mergeUnlockedItems(snapshot.items, newItems, snapshot.lockedSlots || []) },
    });
    if (!started) {
      setActionNotice("Chưa thể mở mẫu phối khi bản nháp chưa sẵn sàng. Nội dung hiện tại vẫn được giữ.");
      return false;
    }
    setPendingStarter(null);
    setIsStarterOpen(false);
    setActionNotice(hadUnsavedDraft ? "Đã mở mẫu phối. Bản nháp trước đó được giữ trong mục khôi phục trên thiết bị." : "Đã mở mẫu phối.");
    return true;
  };

  const handleLoadStarter = (starter: StarterOutfit) => {
    const missing = starter.items.some(it => {
      const item = catalogItems.find(candidate => candidate.id === it.item_id && candidate.is_published);
      return !item || item.slot !== it.slot || (it.variant_id && !item.variants.some(variant => variant.id === it.variant_id));
    });
    if (missing) {
      setActionNotice("Mẫu này có món không còn trong danh mục đã xuất bản. Bản phối hiện tại được giữ nguyên.");
      return false;
    }
    if (studio.isDirty) {
      setPendingStarter(starter);
      return false;
    }
    return applyStarter(starter);
  };

  const handleSaveOutfit = () => requestAccountAction("save");
  const saveFromTryOn = async () => {
    if (!isLoggedIn) { requestAccountAction("save"); return false; }
    return studio.save();
  };

  // Trợ lý AI Gemini gợi ý phối đồ (F11)
  const handleAskAIStylist = async () => {
    if (!isLoggedIn) { requestAccountAction("recommendations"); return; }
    if (recommendationRequest.current || isApplyingRecommendation) return;
    const occasion = occasions.find(item => item.id === questionnaire.occasionId);
    const garmentType = garmentTypes.find(item => item.id === questionnaire.garmentTypeId);
    if (!occasion || (questionnaire.garmentTypeId && !garmentType)) {
      setRecommendationError("Hãy chọn dịp sử dụng và loại trang phục có trong danh mục hiện tại.");
      return;
    }
    const prompt = [
      "Hãy đề xuất bộ phối Việt phục từ danh mục theo phiếu nhu cầu sau:",
      `Dịp sử dụng: ${occasion.name}.`,
      `Phong cách: ${{ traditional: "Truyền thống", remix: "Remix, kết hợp hiện đại", modern_fusion: "Cách tân hiện đại" }[questionnaire.styleMode]}.`,
      `Đối tượng: ${questionnaire.gender === "male" ? "Nam" : questionnaire.gender === "female" ? "Nữ" : "Không giới hạn"}.`,
      `Loại trang phục ưu tiên: ${garmentType?.name || "Đề xuất loại phù hợp với dịp sử dụng"}.`,
      `Tông màu mong muốn: ${questionnaire.palette}.`,
      `Ưu tiên: ${questionnaire.priority}.`,
      "Giữ nguyên các món đã khóa. Nếu danh mục không đáp ứng một sở thích, giải thích rõ giới hạn; không tự tạo trang phục hoặc biến thể ngoài danh mục.",
    ].join("\n");
    const controller = new AbortController();
    recommendationRequest.current = controller;
    setIsAiLoading(true);
    setPendingRecommendation(null);
    setRecommendationNotice(null);
    setRecommendationError(null);
    try {
      const lockedList = equippedItems.filter(item => lockedSlots.has(item.slot)).map(item => ({
        slot: item.slot, item_id: item.itemId, variant_id: item.variantId,
      }));

      const res = await api.getAIRecommendations({
        prompt,
        occasion_id: occasion.id,
        style_mode: questionnaire.styleMode,
        gender: questionnaire.gender || undefined,
        locked_items: lockedList,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setRecommendationNotice(res.notice || (res.source !== "gemini" ? "Đây là gợi ý dự phòng từ bộ quy tắc, chưa phân tích đầy đủ yêu cầu bằng Gemini." : null));

      if (res.outfits && res.outfits.length > 0) {
        const recOutfit = res.outfits[0];
        const newItems: SnapshotItem[] = recOutfit.items.map(it => ({
          slot: it.slot,
          itemId: it.item_id,
          variantId: it.variant_id || undefined,
          assetVersion: 1,
          colorHex: it.hex_color || undefined,
        }));
        setPendingRecommendation({ title: recOutfit.title, explanation: recOutfit.explanation || "", source: res.source, model: res.model, items: newItems,
          occasionId: occasion.id, styleMode: questionnaire.styleMode });
      } else setRecommendationNotice(res.notice || "Chưa có gợi ý phù hợp từ danh mục hiện tại. Bản phối chưa thay đổi.");
    } catch (err: any) {
      if (!controller.signal.aborted) setRecommendationError(err?.statusCode === 401 ? "Phiên đăng nhập hết hạn. Hãy đăng nhập lại để dùng gợi ý AI." : `Không lấy được gợi ý phối đồ: ${err.message}`);
    } finally {
      if (recommendationRequest.current === controller) {
        recommendationRequest.current = null;
        setIsAiLoading(false);
      }
    }
  };

  const applyPendingRecommendation = async () => {
    if (!pendingRecommendation || isApplyingRecommendation) return;
    const recommendation = pendingRecommendation;
    setIsApplyingRecommendation(true);
    try {
      const checked = await Promise.all(recommendation.items.map(async suggested => {
        const item = catalogItems.find(candidate => candidate.id === suggested.itemId && candidate.is_published && candidate.slot === suggested.slot);
        if (!item) return null;
        const variant = item.variants.find(candidate => candidate.id === suggested.variantId) || item.variants.find(candidate => candidate.is_default) || item.variants[0];
        if (!variant) return { ...suggested, itemId: item.id, variantId: undefined, colorHex: undefined };
        try {
          const resolved = await resolveColorPatch(item, suggested.colorHex || variant.hex_color, variant.id);
          if (resolved.supported) return { ...suggested, itemId: item.id, ...resolved.patch };
        } catch { /* Keep the published catalog default when optional recoloring cannot be checked. */ }
        const fallback = item.variants.find(candidate => candidate.is_default) || item.variants[0];
        return fallback ? { ...suggested, itemId: item.id, variantId: fallback.id, colorHex: fallback.hex_color } : null;
      }));
      const available = checked.filter((item): item is SnapshotItem => item !== null);
      if (!available.length) {
        setActionNotice("Gợi ý không còn khớp với trang phục đang xuất bản. Bản phối chưa thay đổi.");
        return;
      }
      studio.dispatch({ type: "commit", update: doc => ({ ...doc, title: recommendation.title,
        snapshot: { ...doc.snapshot, ...occasionBackgroundPatch(doc.snapshot, recommendation.occasionId), styleMode: recommendation.styleMode,
          items: mergeUnlockedItems(doc.snapshot.items, available, doc.snapshot.lockedSlots || []) } }) });
      setActionNotice(`Đã áp dụng gợi ý từ ${recommendation.source === "gemini" ? "Gemini" : "bộ quy tắc"}; các vị trí khóa được giữ nguyên. Màu chỉ đổi khi ảnh vượt kiểm tra an toàn.`);
      setPendingRecommendation(null);
    } catch (error: any) {
      setActionNotice(`Không áp dụng được gợi ý. Bản phối hiện tại vẫn được giữ: ${error?.message || "lỗi xử lý"}`);
    } finally { setIsApplyingRecommendation(false); }
  };

  // Danh sách màu hiện tại phục vụ ColorAnalysis (Memoized)
  const currentColorsForAnalysis = useMemo(() => {
    return equippedItems
      .filter((it) => it.colorHex)
      .map((it) => ({
        slot: it.slot,
        hex_color: it.colorHex!,
        item_id: it.itemId,
        variant_id: it.variantId,
      }));
  }, [equippedItems]);

  // Món đồ của slot đang kích hoạt để chọn biến thể
  const activeEquippedItem = equippedItems.find((it) => it.slot === activeSlot);
  const activeCatalogItem = catalogItems.find((ci) => ci.id === activeEquippedItem?.itemId);
  const requestedCatalogItem = catalogItems.find(item => item.id === requestedCatalogItemId && item.is_published);

  // Lọc danh mục hiển thị bên trái (Memoized)
  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((ci) => {
      if (selectedGarmentType !== "all" && ci.garment_type_id && ci.garment_type_id !== selectedGarmentType) {
        return false;
      }
      if (activeSlot && ci.slot !== activeSlot) {
        return false;
      }
      return true;
    });
  }, [catalogItems, selectedGarmentType, activeSlot]);

  const handleWeatherSuggestion = async (accessories: string[]) => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const requested = accessories.map(normalize).filter(value => value.length > 2);
    const candidates = catalogItems.filter(item => ["accessory_front", "accessory_back", "headwear", "footwear"].includes(item.slot) && item.is_published);
    const matches = candidates.filter(item => {
      const name = normalize(item.name);
      return requested.some(suggestion => name.includes(suggestion) || suggestion.includes(name));
    });
    const availableMatches = matches.filter(item => !lockedSlots.has(item.slot));
    if (!availableMatches.length) {
      const lockedSlotsWithMatches = [...new Set(matches.map(item => item.slot).filter(slot => lockedSlots.has(slot)))];
      setActionNotice(lockedSlotsWithMatches.length
        ? `Có phụ kiện phù hợp nhưng ${lockedSlotsWithMatches.map(slotLabel).join(", ")} đang khóa. Hãy mở khóa vị trí rồi thử lại.`
        : accessories.length ? `Danh mục đang xuất bản chưa có phụ kiện khớp gợi ý: ${accessories.join(", ")}.` : "Thời tiết hiện không gợi ý thêm phụ kiện.");
      return;
    }
    const bySlot = new Map(availableMatches.map(item => [item.slot, item]));
    const replacements = equippedItems.filter(item => bySlot.has(item.slot) && bySlot.get(item.slot)?.id !== item.itemId);
    if (replacements.length && !await confirmWeatherReplacement({
      title: "Thay phụ kiện theo thời tiết?",
      description: `Các vị trí ${replacements.map(item => slotLabel(item.slot)).join(", ")} đang có trang phục. Bạn có muốn thay bằng phụ kiện gợi ý?`,
      confirmLabel: "Thay phụ kiện", cancelLabel: "Giữ bộ phối",
    })) return;
    const additions = [...bySlot.values()].map(item => {
      const variant = item.variants.find(candidate => candidate.is_default) || item.variants[0];
      return { slot: item.slot, itemId: item.id, variantId: variant?.id, assetVersion: 1, colorHex: variant?.hex_color };
    });
    studio.dispatch({ type: "commit", update: doc => {
      // A confirmation must not overwrite edits made while it was open.
      if (JSON.stringify(doc.snapshot.items) !== JSON.stringify(equippedItems) ||
          JSON.stringify(doc.snapshot.lockedSlots || []) !== JSON.stringify(snapshot.lockedSlots || [])) return doc;
      const items = [...doc.snapshot.items.filter(item => !bySlot.has(item.slot)), ...additions.map(item =>
        doc.snapshot.items.find(current => current.slot === item.slot && current.itemId === item.itemId) || item)];
      return { ...doc, snapshot: { ...doc.snapshot, items } };
    } });
    setActionNotice(`Đã thêm ${additions.map(item => catalogItems.find(catalog => catalog.id === item.itemId)?.name).filter(Boolean).join(", ")}.`);
  };

  if (!studio.hydrated) return <div role="status" className="p-8">Đang khôi phục bộ phối…</div>;

  const notifications: ToastItem[] = [];
  const recoveryListKey = JSON.stringify(studio.recoveryDrafts.map(entry => entry.key));
  if (saveSuccessMessage) notifications.push({
    id: "save-success", type: "success", message: saveSuccessMessage,
    dismissLabel: "Đóng thông báo thành công",
  });
  if (studio.recoveryDrafts.length > 0 && dismissedRecoveryList !== recoveryListKey) notifications.push({
    id: "recovery", title: "Bản khôi phục trên thiết bị",
    message: "Các bản phối trước vẫn được giữ trên thiết bị. Chọn bản bạn muốn khôi phục.",
    dismissLabel: "Đóng thông báo bản khôi phục",
    actions: <ul className="w-full space-y-3">
      {studio.recoveryDrafts.map(entry => <li key={entry.key} className="space-y-2 border-t border-stone-100 pt-3">
        <p className="break-words text-sm font-medium text-stone-900">{entry.draft.title}</p>
        <p className="text-xs text-stone-600">{entry.draft.snapshot.items.length} món · {{ recovery: "Bản trước khi tạo mới", "account-choice": "Bản còn lại sau khi chọn nháp", "tab-recovery": "Bản từ tab khác", conflict: "Bản trước xung đột phiên bản" }[entry.kind]}</p>
        <button type="button" disabled={isSaving} aria-label={`Khôi phục ${entry.draft.title}`} onClick={() => studio.restoreRecoveryDraft(entry.key)} className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50">Khôi phục</button>
      </li>)}
    </ul>,
  });
  if (draftNotice) notifications.push({
    id: "draft", type: "success", title: "Đã mở lại bản nháp",
    message: `“${draftNotice.title}” · ${draftNotice.snapshot?.items?.length || 0} món. Bạn có thể tiếp tục chỉnh sửa; tạo bản trống sẽ giữ bản này trong mục khôi phục.`,
    dismissLabel: "Đóng thông báo bản nháp",
    actions: <>
      <button type="button" onClick={studio.dismissDraft} className="min-h-11 flex-1 whitespace-nowrap rounded-lg bg-heritage-red px-3 text-xs font-semibold text-white hover:bg-heritage-red-dark">Tiếp tục bản nháp</button>
      <button type="button" onClick={studio.startFreshDraft} className="min-h-11 flex-1 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50">Tạo bản phối trống</button>
    </>,
  });
  if (!isLoggedIn && !guestNoticeDismissed) notifications.push({
    id: "guest", title: "Bạn đang dùng chế độ khách",
    message: "Bạn có thể phối đồ và lưu nháp trên thiết bị. Đăng nhập để lưu vào Tủ đồ, xuất ảnh, tạo Lookbook hoặc thử đồ AI.",
    dismissLabel: "Đóng thông báo chế độ khách",
  });
  if (actionNotice) notifications.push({ id: "action", message: actionNotice, type: "info" });

  return (
    <div className="studio-workspace w-full mx-auto px-3 sm:px-5 py-4 space-y-4">
      <ToastContainer toasts={notifications} onDismiss={id => {
        if (id === "draft") studio.dismissDraft();
        else if (id === "guest") setGuestNoticeDismissed(true);
        else if (id === "action") setActionNotice(null);
        else if (id === "save-success") studio.dismissMessage();
        else if (id === "recovery") setDismissedRecoveryList(recoveryListKey);
      }} />
      {studio.accountDraftChoice && <Modal isOpen onClose={() => {}} closeDisabled label="Chọn bản phối cần tiếp tục">
        <section className="w-full max-w-lg max-h-full overflow-y-auto space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
          <div>
            <h2 id="account-draft-choice-title" className="font-serif text-xl font-bold text-stone-900">Chọn bản phối cần tiếp tục</h2>
            <p id="account-draft-choice-description" className="mt-2 text-sm leading-relaxed text-stone-600">Thiết bị và tài khoản đều có nháp riêng. Chọn một bản trước khi tiếp tục thao tác; bản còn lại sẽ được giữ trong mục khôi phục trên thiết bị.</p>
          </div>
          <div className="space-y-2 rounded-xl border border-stone-200 p-3">
            <p className="font-semibold text-stone-900">Nháp trên thiết bị: {studio.accountDraftChoice.deviceDraft.title}</p>
            <p className="text-xs text-stone-600">{studio.accountDraftChoice.deviceDraft.snapshot.items.length} món · Chưa lưu vào tài khoản</p>
            <button type="button" autoFocus onClick={() => studio.chooseAccountDraft("device")} className="min-h-11 w-full rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white">Tiếp tục nháp trên thiết bị</button>
          </div>
          <div className="space-y-2 rounded-xl border border-stone-200 p-3">
            <p className="font-semibold text-stone-900">Nháp của tài khoản: {studio.accountDraftChoice.accountDraft.title}</p>
            <p className="text-xs text-stone-600">{studio.accountDraftChoice.accountDraft.snapshot.items.length} món · Thuộc tài khoản đang đăng nhập</p>
            <button type="button" onClick={() => studio.chooseAccountDraft("account")} className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50">Tiếp tục nháp của tài khoản</button>
          </div>
          {studio.error && <p role="alert" className="text-sm text-red-700">{studio.error}</p>}
        </section>
      </Modal>}
      {requestedCatalogItem && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-heritage-red/20 bg-white p-4 text-sm"><span>Đã mở <strong>{requestedCatalogItem.name}</strong>. Thêm món này vào vị trí {slotLabel(requestedCatalogItem.slot)} trong bản phối?</span><div className="flex gap-2"><button type="button" disabled={lockedSlots.has(requestedCatalogItem.slot)} onClick={addRequestedCatalogItem} className="rounded-lg bg-heritage-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{lockedSlots.has(requestedCatalogItem.slot) ? "Mở khóa vị trí trước" : "Thêm vào bản phối"}</button><button type="button" onClick={() => setRequestedCatalogItemId(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold">Để sau</button></div></div>}
      {studio.isManaging && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Bạn đang chỉnh sửa bộ phối với quyền quản trị. Khi lưu, thay đổi được áp dụng vào bộ phối của chủ sở hữu.</div>}
      {studio.error && <div role="alert" aria-label="Lưu bộ phối" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <p>{studio.error}</p>
        {studio.conflict && <div className="mt-3 flex gap-3">
          <button onClick={() => studio.loadServerCopy()} className="underline">Tải bản máy chủ</button>
          <button onClick={() => studio.save(true)} disabled={isSaving} className="underline">Lưu thành bộ mới</button>
        </div>}
      </div>}
      {studio.requestedOutfit && !studio.conflict && <div role="status" className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <p>Bạn đang có bản nháp chưa lưu. Liên kết vừa mở yêu cầu tải bộ phối trên máy chủ.</p>
        <div className="mt-3 flex gap-3">
          <button onClick={() => studio.loadServerCopy()} className="underline">Mở bộ phối từ liên kết</button>
          <button onClick={studio.keepLocal} className="underline">Tiếp tục bản nháp</button>
        </div>
      </div>}

      {/* Top Toolbar: Tên bộ phối, Chế độ, Undo/Redo, Nút Lưu & Xuất */}
      <div className="studio-toolbar bg-white rounded-xl border border-stone-200 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="studio-document flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <input
            type="text"
            aria-label="Tên bản phối"
            value={outfitTitle}
            onChange={(e) => setOutfitTitle(e.target.value)}
            className="studio-title min-w-0 w-full max-w-full sm:w-48 font-serif font-bold text-xl text-stone-900 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-heritage-red focus:outline-none px-1 py-0.5 tracking-tight"
          />

          <div role="group" aria-label="Phong cách bản phối" className="flex max-w-full flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
            {Object.entries(STYLE_LABELS).map(([mode, label]) => <button key={mode} type="button"
              aria-pressed={styleMode === mode} onClick={() => setStyleMode(mode as OutfitSnapshot["styleMode"])}
              className={`px-3 py-1 rounded-lg transition-all ${styleMode === mode ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-800"}`}>
              {label}
            </button>)}
          </div>
        </div>

        {/* Nút thao tác nhanh: Undo, Redo, Mở đầu, So sánh, Thử đồ, Lưu, Xuất */}
        <div className="studio-actions flex items-center flex-wrap gap-2">
          {studio.recoveryDrafts.length > 0 && <button type="button" onClick={() => setDismissedRecoveryList(null)}
            aria-label="Xem bản khôi phục trên thiết bị"
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">
            Bản khôi phục ({studio.recoveryDrafts.length})
          </button>}
          {/* Undo / Redo & Phím tắt */}
          <div className="flex items-center space-x-1.5">
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
              <button
                onClick={handleUndo}
                disabled={!studio.history.past.length}
                className="p-1.5 rounded-md hover:bg-white text-stone-700 disabled:opacity-30 transition-all"
                title="Hoàn tác (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!studio.history.future.length}
                className="p-1.5 rounded-md hover:bg-white text-stone-700 disabled:opacity-30 transition-all"
                title="Làm lại (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            <span
              className="sr-only"
              title="Phím tắt: Ctrl+Z (Undo), Ctrl+Y (Redo), 1-6 (Đổi slot trang phục), Esc (Đóng bảng)"
            >
              ⌨️ Ctrl+Z / 1-6
            </span>
          </div>

          {starterState === "available" && <button
            onClick={() => setIsStarterOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-heritage-gold" />
            <span>Mẫu phối có sẵn</span>
          </button>}
          {starterState === "error" && <button type="button" onClick={refreshStarterOutfits} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">Không tải được mẫu phối · Thử lại</button>}

          {/* Ghim / So sánh A/B */}
          <button
            onClick={() => {
              if (!pinnedSnapshotA) {
                setPinnedSnapshotA(structuredClone(snapshot));
              } else {
                setIsCompareOpen(true);
              }
            }}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              pinnedSnapshotA
                ? "border-heritage-indigo bg-heritage-indigo/10 text-heritage-indigo"
                : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{pinnedSnapshotA ? "So sánh hai bản" : "Lưu bản A để so sánh"}</span>
          </button>

          {pinnedSnapshotA && <>
            <button type="button" onClick={() => { setPinnedSnapshotA(structuredClone(snapshot)); setActionNotice("Đã ghim bản hiện tại làm phương án A."); }} className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-xs font-semibold">Ghim lại bản A</button>
            <button type="button" onClick={() => { setPinnedSnapshotA(null); setIsCompareOpen(false); }} className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-xs font-semibold">Bỏ ghim bản A</button>
          </>}
          {/* Thử đồ AI */}
          <button
            onClick={() => requestAccountAction("try-on")}
            disabled={equippedItems.length === 0}
            title={equippedItems.length === 0 ? "Thêm ít nhất một món trang phục trước" : undefined}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-heritage-gold bg-amber-50/50 hover:bg-amber-100/60 text-xs font-semibold text-amber-900 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 text-heritage-gold" />
            <span>Thử đồ AI</span>
          </button>

          {/* Xuất ảnh 2D */}
          <button
            onClick={() => requestAccountAction("export")}
            disabled={equippedItems.length === 0}
            title={equippedItems.length === 0 ? "Thêm ít nhất một món trang phục trước" : undefined}
            className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất ảnh</span>
          </button>

          {/* Lưu bộ phối */}
          <button
            onClick={handleSaveOutfit}
            disabled={isSaving || !studio.hydrated}
            className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-heritage-red hover:bg-heritage-red-dark text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Đang lưu..." : "Lưu bộ phối"}</span>
          </button>
          <button
            type="button"
            onClick={() => requestAccountAction("save-new")}
            disabled={isSaving || !studio.hydrated}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 disabled:opacity-50"
            title="Tạo một bộ phối mới từ bản đang mở"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Lưu thành bản mới</span>
          </button>
        </div>
      </div>


      {studio.externalDraft && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <span>Tab khác đã cập nhật bản nháp này. Bản đang mở được giữ nguyên cho đến khi bạn chọn.</span>
        <div className="flex gap-2"><button type="button" onClick={studio.acceptExternalDraft} className="rounded-lg bg-sky-800 px-3 py-2 text-xs font-semibold text-white">Tiếp tục bản từ tab khác</button><button type="button" onClick={studio.keepCurrentDraft} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold">Giữ bản đang mở</button></div>
      </div>}
      {catalogItemsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><span>{catalogItemsError}</span><button type="button" onClick={() => void refreshCatalog()} disabled={isInitialLoading} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Tải lại kho trang phục</button></div>}
      {unavailableSnapshotItems.length > 0 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Một số món trong bản phối không còn được xuất bản. Bản nháp vẫn giữ nguyên các món đó.</p>
        <ul className="mt-2 space-y-2">{unavailableSnapshotItems.map(item => <li key={`${item.slot}:${item.itemId}`} className="flex flex-wrap items-center justify-between gap-2">
          <span>{itemLabel(item.itemId, catalogItems)} · vị trí {slotLabel(item.slot)}</span>
          <button type="button" onClick={() => { setActiveSlot(item.slot); setSelectedGarmentType("all"); setMobilePanel("catalog"); }} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950">Chọn món thay thế</button>
        </li>)}</ul>
      </div>}

      {/* Main Studio 3-Column Layout: Trái (Danh mục & Sự kiện) | Giữa (Canvas 2D) | Phải (Màu sắc, Cảnh báo văn hóa, Thời tiết) */}
      <div className="studio-panels grid min-w-0 grid-cols-1 gap-3 items-start">
        <div role="tablist" aria-label="Bảng Studio trên điện thoại" className="sticky top-16 z-30 order-2 grid grid-cols-3 gap-2 rounded-xl border border-stone-200 bg-white p-1 shadow-sm lg:hidden">
          {([{ id: "catalog", label: "Chọn trang phục" }, { id: "properties", label: "Món đang chọn" }, { id: "tools", label: "Công cụ" }] as const).map(tab => <button key={tab.id} type="button" role="tab" aria-selected={mobilePanel === tab.id} onClick={() => setMobilePanel(tab.id)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold touch-manipulation ${mobilePanel === tab.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{tab.label}</button>)}
        </div>
        {/* CỘT TRÁI (3 cols): Bối cảnh sự kiện & Kho đồ */}
        <div aria-label="Kho trang phục và hoàn cảnh" role="region" tabIndex={0} className={`studio-rail studio-library ${mobilePanel === "catalog" ? "" : "hidden"} order-3 min-w-0 space-y-3 lg:order-1 lg:block`}>
          {/* Lọc Sự Kiện & Bối Cảnh (F01) */}
          <div className="studio-occasions bg-white p-4 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Hoàn cảnh sử dụng
              </span>
              {selectedOccasion && <button type="button" onClick={() => setSelectedOccasion(undefined)} className="text-xs text-stone-500 underline hover:text-heritage-red">Bỏ chọn hoàn cảnh</button>}
            </div>
            {isInitialLoading ? (
              <OccasionGridSkeleton />
            ) : occasions.length === 0 ? (
              catalogError ? <div className="space-y-2 text-xs text-amber-900"><p>Không tải được danh sách hoàn cảnh. Bạn vẫn có thể phối trang phục.</p><button type="button" onClick={() => void refreshCatalog()} className="rounded border border-amber-300 bg-white px-2 py-1 font-semibold">Thử lại</button></div> :
              <p className="text-xs text-stone-500">Chưa có lựa chọn hoàn cảnh. Bạn vẫn có thể lưu bộ phối.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {occasions.map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    aria-pressed={selectedOccasion === occ.id}
                    aria-label={occ.name}
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedOccasion === occ.id
                        ? "border-heritage-red bg-heritage-red/10 text-heritage-red font-semibold shadow-xs"
                        : "border-stone-200 hover:border-stone-300 text-stone-700 bg-stone-50/50"
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900 break-words">{occ.name}</div>
                    <div className="text-[11px] text-stone-500 font-normal mt-0.5">{({ all: "Quanh năm", spring: "Mùa xuân", summer: "Mùa hè", autumn: "Mùa thu", fall: "Mùa thu", winter: "Mùa đông" } as Record<string, string>)[occ.season] || "Theo dịp sử dụng"}</div>
                  </button>
                ))}
              </div>
            )}
            {occasions.find(occasion => occasion.id === selectedOccasion)?.description && <p className="text-xs leading-relaxed text-stone-600" role="status">{occasions.find(occasion => occasion.id === selectedOccasion)?.description}</p>}
          </div>

          {/* Lọc Nhóm Áo & Slot */}
          <div className="studio-catalog bg-white p-4 rounded-xl border border-stone-200 space-y-3">
            {/* Tiêu đề mục phân loại */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Kho trang phục
              </span>
              <span className="text-xs text-stone-400 font-medium">
                {filteredCatalogItems.length} món có sẵn
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-stone-500">Nhóm trang phục</span>
              <select
                value={selectedGarmentType}
                onChange={(event) => setSelectedGarmentType(event.target.value)}
                className="w-full h-9 rounded-lg border border-stone-300 bg-white px-3 text-xs font-medium text-stone-800 focus:outline-none focus:border-heritage-red"
              >
                <option value="all">Tất cả nhóm trang phục</option>
                {garmentTypes.map((garmentType) => (
                  <option key={garmentType.id} value={garmentType.id}>
                    {garmentType.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Tabs Slot sắp xếp lưới 3 cột x 2 hàng đều đặn, khóa slot tinh gọn */}
            <div className="studio-slot-grid grid grid-cols-3 gap-1.5">
              {[
                { slot: "outerwear", label: "Áo ngoài" },
                { slot: "undergarment", label: "Áo lót trong" },
                { slot: "bottom", label: "Quần" },
                { slot: "headwear", label: "Khăn vấn" },
                { slot: "accessory_front", label: "Phụ kiện" },
                { slot: "footwear", label: "Giày/Guốc" },
              ].map((s) => {
                const isLocked = lockedSlots.has(s.slot);
                const isSelected = activeSlot === s.slot;
                return (
                  <div key={s.slot} className="flex min-w-0 items-stretch gap-0.5">
                    <button type="button" aria-pressed={isSelected} onClick={() => setActiveSlot(s.slot)}
                      className={`min-h-11 min-w-0 flex-1 rounded-xl border px-1 py-2 text-xs font-semibold ${isSelected ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"}`}>
                      {s.label}
                    </button>
                    <button type="button" aria-label={`${isLocked ? "Mở khóa" : "Khóa"} vị trí ${s.label.toLowerCase()}`}
                      aria-pressed={isLocked} onClick={() => toggleLockSlot(s.slot)}
                      className={`flex min-h-11 min-w-8 shrink-0 items-center justify-center rounded-lg border ${isLocked ? "border-amber-300 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:bg-stone-100"}`}>
                      {isLocked ? <Lock aria-hidden="true" className="h-3.5 w-3.5" /> : <Unlock aria-hidden="true" className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Structural closure data is recorded for checks/prompts; it never flips the source image. */}
            <div className="studio-closure space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-heritage-red shrink-0" />
                <span className="font-semibold text-stone-700">Cấu trúc · hướng khép vạt</span>
                <button
                  type="button"
                  onClick={() => setShowHuuNhamInfo(true)}
                  className="text-stone-400 hover:text-heritage-red transition-colors inline-flex items-center"
                  aria-label="Tìm hiểu quy chuẩn Hữu nhậm"
                  title="Tìm hiểu ý nghĩa quy chuẩn Hữu nhậm cổ truyền"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-stone-300 text-[9px] flex items-center justify-center font-bold text-stone-500 hover:border-heritage-red hover:text-heritage-red">?</span>
                </button>
              </div>
              <button
                type="button"
                aria-label={`Đổi hướng khép vạt sang ${overlapDirection === "right_over_left" ? "Tả nhậm" : "Hữu nhậm"}`}
                aria-pressed={overlapDirection === "right_over_left"}
                onClick={() =>
                  setOverlapDirection(
                    overlapDirection === "right_over_left" ? "left_over_right" : "right_over_left"
                  )
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 border shadow-2xs ${
                  overlapDirection === "right_over_left"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${overlapDirection === "right_over_left" ? "bg-emerald-600" : "bg-red-600"}`} />
                <span>{overlapDirection === "right_over_left" ? "Hữu nhậm (Phải)" : "Tả nhậm (Trái)"}</span>
              </button>
              </div>
              <p className="pl-5 text-[11px] leading-relaxed text-stone-600">Dùng cho kiểm tra văn hóa và gợi ý AI. Ảnh trên bảng phối không đổi hướng; ứng dụng không lật ảnh để giả lập cài vạt.</p>
            </div>

            {/* Danh sách items có sẵn theo slot */}
            {isInitialLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <GarmentItemSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div ref={catalogListRef} tabIndex={-1} role="region" aria-label="Danh sách trang phục" className="studio-garment-list space-y-2">
                {filteredCatalogItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">
                    Chưa có trang phục trong nhóm và lớp đang chọn.
                  </div>
                )}
                {filteredCatalogItems.map((item) => {
                  const isEquipped = equippedItems.some((it) => it.itemId === item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-label={`Chọn ${item.name}`}
                      aria-pressed={isEquipped}
                      disabled={lockedSlots.has(item.slot)}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center space-x-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150 ${
                        isEquipped
                          ? "border-heritage-red bg-heritage-red/5 ring-1.5 ring-heritage-red shadow-xs"
                          : "border-stone-200 hover:border-stone-400 bg-white hover:bg-[#FAF8F5]"
                      }`}
                    >
                      {/* Thumbnail ảnh minh họa thật hoặc SVG */}
                      <div className="w-14 h-14 rounded-lg bg-[#FAF8F5] border border-stone-200/80 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {catalogImageUrl(item) ? (
                          <img
                            src={catalogThumbnailUrl(item, 112)}
                            srcSet={item.metadata?.catalog_media_id ? `${catalogThumbnailUrl(item, 112)} 1x, ${catalogThumbnailUrl(item, 224)} 2x` : undefined}
                            onError={event => {
                              const original = catalogImageUrl(item);
                              if (original && event.currentTarget.src !== new URL(original, window.location.href).href) {
                                event.currentTarget.removeAttribute("srcset");
                                event.currentTarget.src = original;
                              }
                            }}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : item.default_layer?.svg_content ? (
                          <svg
                            viewBox="0 0 800 1200"
                            className="w-full h-full object-contain p-1 pointer-events-none"
                            dangerouslySetInnerHTML={{ __html: item.default_layer.svg_content }}
                          />
                        ) : (
                          <div className="text-[10px] text-stone-400 text-center font-serif">Cổ phục</div>
                        )}
                        {catalogImageUrl(item) && (
                          <span className="absolute bottom-0 right-0 bg-heritage-red text-[8px] font-bold text-white px-1 rounded-tl">
                            Ảnh trang phục
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="font-semibold text-[13px] text-stone-900 truncate tracking-tight" title={item.name}>
                          {item.name}
                        </div>
                        {item.metadata?.pilot_dataset && (
                          <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                            Dữ liệu thí điểm
                          </span>
                        )}
                        <div className="flex items-center space-x-2 text-xs text-stone-500">
                          <span className="line-clamp-2">{eraLabel(item.era)}</span>
                          {item.variants.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span>•</span>
                              <div className="flex -space-x-1">
                                {item.variants.map((v) => (
                                  <div
                                    key={v.id}
                                    className="w-2.5 h-2.5 rounded-full border border-white shadow-xs"
                                    style={{ backgroundColor: v.hex_color }}
                                    title={v.color_name}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {isEquipped && (
                        <div className="w-6 h-6 rounded-full bg-heritage-red text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CỘT GIỮA (6 cols): Vùng Artboard Canvas 2D (F03) - Trọng tâm thiết kế */}
        <div id="studio-board" className="studio-center order-1 min-w-0 scroll-mt-20 space-y-3 lg:order-2">
          {/* Thanh công cụ Artboard: Chế độ Flat-lay, Nền, Tỉ lệ */}
          <div className="studio-board-toolbar bg-white p-3 rounded-xl border border-stone-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Tiêu đề Bảng phối Flat-lay OOTD */}
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-heritage-red/10 text-heritage-red flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-stone-900 tracking-tight">Bảng phối</span>
              </div>

              {/* Tỉ lệ khung hình */}
              <div className="flex items-center space-x-1 text-xs">
                <button
                  aria-pressed={displayRatio === "9:16"}
                  onClick={() => setDisplayRatio("9:16")}
                  className={`min-h-11 min-w-11 px-2.5 py-1 rounded-lg font-mono font-semibold text-xs transition-all ${
                    displayRatio === "9:16" ? "bg-stone-900 text-white shadow-xs" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title="Tỉ lệ dọc (Story / TikTok / Reels)"
                >
                  9:16
                </button>
                <button
                  aria-pressed={displayRatio === "1:1"}
                  onClick={() => setDisplayRatio("1:1")}
                  className={`min-h-11 min-w-11 px-2.5 py-1 rounded-lg font-mono font-semibold text-xs transition-all ${
                    displayRatio === "1:1" ? "bg-stone-900 text-white shadow-xs" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title="Tỉ lệ vuông (Instagram / Feed)"
                >
                  1:1
                </button>
              </div>
            </div>

            {/* Tùy chọn nền & Nút đặt lại vị trí */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-xs text-stone-500">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Nền bảng phối">
                <span className="font-medium text-stone-600">Nền:</span>
                <button type="button" onClick={() => setCanvasBackgroundTheme("occasion")}
                  aria-pressed={canvasBackgroundTheme === "occasion"}
                  title={selectedOccasion ? "Dùng nền của hoàn cảnh đã chọn" : "Chọn hoàn cảnh để hiện nền tương ứng"}
                  className={`min-h-11 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${canvasBackgroundTheme === "occasion" ? "bg-heritage-red text-white border-heritage-red" : "bg-white text-stone-700 border-stone-200"}`}>
                  Theo hoàn cảnh
                </button>
                <button
                  aria-pressed={canvasBackgroundTheme === "white"}
                  onClick={() => setCanvasBackgroundTheme("white")}
                  className={`min-h-11 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    canvasBackgroundTheme === "white"
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  Trắng Studio
                </button>
                <button
                  onClick={() => setCanvasBackgroundTheme("dopaper")}
                  aria-pressed={canvasBackgroundTheme === "dopaper"}
                  className={`min-h-11 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    canvasBackgroundTheme === "dopaper"
                      ? "bg-heritage-red text-white border-heritage-red shadow-xs"
                      : "bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  Giấy Dó
                </button>
              </div>

              <button
                onClick={() => canvasRef.current?.resetAllTransforms()}
                aria-label="Căn lại vị trí ban đầu"
                className="inline-flex min-h-11 items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-heritage-red transition-colors"
                title="Khôi phục toàn bộ trang phục về vị trí sắp xếp OOTD ban đầu"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Căn lại vị trí ban đầu</span>
              </button>
            </div>
          </div>

          {canvasBackgroundTheme === "occasion" && (
            <BackgroundFadeControl value={snapshot.backgroundFade ?? 0}
              onPreview={value => canvasRef.current?.previewBackgroundFade(value)}
              onCommit={backgroundFade => studio.updateSnapshot({ backgroundFade })} />
          )}

          <Canvas2D
            ref={canvasRef}
            avatar={currentAvatar}
            layers={layers}
            equippedItems={equippedItems}
            catalogItems={catalogItems}
            aspectRatio={displayRatio}
            viewMode="flatlay"
            backgroundTheme={canvasBackgroundTheme}
            neutralBackgroundTheme={neutralBackground(snapshot)}
            backgroundFade={snapshot.backgroundFade ?? 0}
            occasionId={selectedOccasion}
            selectedSlot={activeSlot}
            onSelectItem={(slot) => setActiveSlot(slot)}
            onRemoveItem={(slot) => {
              if (lockedSlots.has(slot)) return;
              pushHistory(equippedItems.filter(item => item.slot !== slot));
            }}
            onBrowseCatalog={() => {
              setMobilePanel("catalog");
              requestAnimationFrame(() => {
                catalogListRef.current?.focus({ preventScroll: true });
                catalogListRef.current?.scrollIntoView({ block: "center" });
              });
            }}
            onToggleLock={toggleLockSlot}
            lockedSlots={[...lockedSlots]}
            onColorLoadFailure={handleColorLoadFailure}
            onTransformsCommit={(changes) => studio.dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: { ...doc.snapshot, items: doc.snapshot.items.map(item => item.slot in changes ? { ...item, transform: changes[item.slot] } : item) } }) })}
            className="w-full"
          />

          {/* Trợ lý Gemini gợi ý nhanh */}
          <section aria-label="Gợi ý phối đồ" className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-stone-900">
              <Sparkles className="w-3.5 h-3.5 text-heritage-red" />
              <span>Gợi ý phối đồ</span>
            </div>
            <StylingQuestionnaire value={questionnaire} occasions={occasions} garmentTypes={garmentTypes.filter(type => type.is_active !== false)}
              disabled={isAiLoading || isApplyingRecommendation || isInitialLoading || !!catalogError || !!catalogItemsError}
              loading={isAiLoading} onSubmit={() => void handleAskAIStylist()}
              onChange={value => { setStylingPreferences(value); setPendingRecommendation(null); setRecommendationNotice(null); setRecommendationError(null); }} />
            {isAiLoading && (
              <div role="status" className="flex items-center space-x-2 text-xs text-heritage-red pt-1">
                <span className="w-2 h-2 rounded-full bg-heritage-red animate-ping shrink-0" />
                <span className="font-medium animate-pulse">Đang lấy gợi ý từ Gemini… Khi dịch vụ bận, có thể mất đến 2 phút.</span>
              </div>
            )}
            {recommendationError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{recommendationError} Nhấn “Gợi ý” để thử lại.</p>}
            {recommendationNotice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{recommendationNotice}</p>}
            {pendingRecommendation && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
              <div><strong>{pendingRecommendation.title}</strong><span className="ml-2 text-stone-500">Nguồn: {pendingRecommendation.source === "gemini" ? "Gemini" : "bộ quy tắc"}</span></div>
              {pendingRecommendation.explanation && <p className="text-stone-700">{pendingRecommendation.explanation}</p>}
              <ul className="space-y-1 text-stone-700">{pendingRecommendation.items.map(item => <li key={item.slot}>{slotLabel(item.slot)}: {itemLabel(item.itemId, catalogItems)}</li>)}</ul>
              <div className="flex gap-2"><button type="button" disabled={isApplyingRecommendation} onClick={applyPendingRecommendation} className="rounded-lg bg-heritage-red px-3 py-1.5 font-semibold text-white">{isApplyingRecommendation ? "Đang áp dụng…" : "Áp dụng gợi ý"}</button><button type="button" disabled={isApplyingRecommendation} onClick={() => setPendingRecommendation(null)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold">Bỏ qua</button></div>
            </div>}
          </section>


        </div>

        {/* CỘT PHẢI (3 cols): Swatch Màu (F02), Cảnh báo văn hóa (F10), Hài hòa màu (F07), Thời tiết (F06) */}
        <div aria-label="Thuộc tính và gợi ý" role="region" tabIndex={0} className="studio-rail studio-inspector order-4 min-w-0 space-y-3 lg:order-3">
          {/* Bộ chọn Biến thể màu sắc & Chất liệu cho món đang chọn (F02) */}
          <div className={mobilePanel === "properties" ? "" : "hidden lg:block"}>{isInitialLoading ? (
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            </div>
          ) : activeCatalogItem && activeCatalogItem.variants.length > 0 ? (
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
              <SwatchPicker
                variants={activeCatalogItem.variants}
                selectedVariantId={activeEquippedItem?.variantId}
                selectedColorHex={activeEquippedItem?.colorHex}
                disabled={isApplyingColor || lockedSlots.has(activeSlot) || activeCatalogItem.color_change_supported === false}
                onSelectVariant={variant => void handleSelectVariant(variant)}
              />
              {activeCatalogItem.color_change_supported === false && <p role="status" className="mt-3 text-xs text-amber-800">{activeCatalogItem.color_change_reason || "Ảnh này chưa được kiểm tra đổi màu an toàn; đang giữ màu gốc."}</p>}
              {activeEquippedItem?.colorAlgorithmVersion && <button type="button" disabled={isApplyingColor || lockedSlots.has(activeSlot)}
                onClick={() => {
                  const defaultVariant = activeCatalogItem.variants.find(variant => variant.is_default) || activeCatalogItem.variants[0];
                  if (!defaultVariant || !activeEquippedItem) return;
                  applyColorPatches([{ slot: activeSlot, itemId: activeEquippedItem.itemId, previousColor: activeEquippedItem.colorHex,
                    patch: { variantId: defaultVariant.id, colorHex: defaultVariant.hex_color, originalColorHex: undefined, colorAlgorithmVersion: undefined, colorSourceVersion: undefined } }]);
                  setActionNotice("Đã khôi phục màu gốc của ảnh trang phục.");
                }} className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:opacity-50">Về màu gốc</button>}
            </div>
          ) : (
            <div role="status" className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">
              {activeCatalogItem
                ? "Món này chưa có biến thể màu để chỉnh."
                : `Chọn một món ở mục “Chọn trang phục” để xem thuộc tính của vị trí ${slotLabel(activeSlot)}.`}
            </div>
          )}</div>

          {/* Cảnh báo Quy Chuẩn Văn Hóa (F10) */}
          <div className={mobilePanel === "tools" ? "" : "hidden lg:block"}>{process.env.NEXT_PUBLIC_STUDIO_V3 === "true" ? <StudioComposerPanel snapshot={snapshot} onSettingsChange={culturalSettings => studio.dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: { ...doc.snapshot, culturalSettings } }) })} /> : <CulturalCheckBadge
            checkData={culturalCheck}
            status={culturalCheckStatus}
            error={culturalCheckError}
            onRetry={() => setCulturalCheckRetry(value => value + 1)}
            onApplyFix={handleApplyCulturalFix}
          />}</div>

          {/* Phân tích Hài hòa Màu sắc & Độ tương phản (F07) */}
          <div className={mobilePanel === "properties" ? "" : "hidden lg:block"}><ColorAnalysisPanel
            equippedColors={currentColorsForAnalysis}
            onApplyColorVariant={async (sug) => {
              const targetCatalogItem = catalogItems.find(ci => ci.id === sug.item_id);
              const targetSlot = targetCatalogItem?.slot;
              if (targetSlot && lockedSlots.has(targetSlot)) { setActionNotice("Vị trí này đang khóa nên chưa áp dụng gợi ý màu."); return; }
              const currentItem = equippedItems.find(item => item.slot === targetSlot);
              if (!targetCatalogItem || !targetSlot || !currentItem) return;
              try {
                const resolved = await resolveColorPatch(targetCatalogItem, sug.hex_color, sug.variant_id);
                if (!resolved.supported) { setActionNotice(resolved.reason || "Ảnh không hỗ trợ đổi màu an toàn; họa tiết được giữ nguyên."); return; }
                const applied = applyColorPatches([{ slot: targetSlot, itemId: currentItem.itemId,
                  previousColor: currentItem.colorHex, patch: { ...resolved.patch, itemId: sug.item_id } }]);
                setActionNotice(applied ? `Đã áp dụng gợi ý màu ${sug.color_name}.` : "Bản phối vừa được chỉnh ở nơi khác; gợi ý chưa được áp dụng.");
              } catch (error: any) { setActionNotice(error?.message || "Không kiểm tra được ảnh đổi màu."); }
            }}
          /></div>

          {/* Bảng phối màu Ngũ Hành 1 chạm (Tối ưu trải nghiệm F02/F07) */}
          <div className={`${mobilePanel === "tools" ? "" : "hidden lg:block"} bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-2.5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-heritage-gold" />
                <span>Phối màu ngũ hành</span>
              </span>
              <span className="shrink-0 text-xs text-stone-500">1 chạm</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {NGU_HANH_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  disabled={isApplyingColor}
                  onClick={() => void applyNguHanhPalette(pal)}
                  className={`p-2 rounded-xl border text-center transition-all hover:scale-105 disabled:opacity-60 ${pal.badge}`}
                  title={`${pal.name} (${pal.desc}) - chỉ đổi màu khi ảnh giữ được chi tiết`}
                >
                  <div
                    className="w-4 h-4 rounded-full mx-auto mb-1 border border-black/10 shadow-xs"
                    style={{ backgroundColor: pal.colors.outerwear }}
                  ></div>
                  <div className="text-xs font-bold">{pal.name}</div>
                </button>
              ))}
            </div>
          </div>



          <div className={mobilePanel === "properties" ? "" : "hidden lg:block"}>
          {/* Dự báo Thời tiết & Lời khuyên bối cảnh (F06) */}
          <WeatherWidget
            onApplyWeatherSuggestion={handleWeatherSuggestion}
          /></div>
        </div>
      </div>

      {/* MODALS */}
      {isStarterOpen && <StarterOutfitModal
        isOpen={isStarterOpen}
        onClose={() => setIsStarterOpen(false)}
        onSelectStarter={handleLoadStarter}
      />}

      {pendingStarter && <Modal isOpen onClose={() => setPendingStarter(null)} label="Mở mẫu phối này?">
        <div className="w-full max-w-md max-h-full overflow-y-auto space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
          <h2 id="starter-replace-title" className="font-serif text-lg font-bold text-stone-900">Mở mẫu phối này?</h2>
          <p className="text-sm leading-relaxed text-stone-600">Bản phối chưa lưu hiện tại sẽ được giữ trong mục khôi phục trên thiết bị này. Bạn có thể tiếp tục bản hiện tại hoặc mở mẫu <strong>{pendingStarter.title}</strong>.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPendingStarter(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">Tiếp tục bản hiện tại</button>
            <button type="button" onClick={() => applyStarter(pendingStarter)} className="rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white">Mở mẫu phối</button>
          </div>
        </div>
      </Modal>}

      {pendingCatalogReplacement && <Modal isOpen onClose={() => setPendingCatalogReplacement(null)} label="Thay món đang có?">
        <div className="w-full max-w-md max-h-full overflow-y-auto space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
          <h2 id="catalog-replace-title" className="font-serif text-lg font-bold text-stone-900">Thay món đang có?</h2>
          <p className="text-sm leading-relaxed text-stone-600">Vị trí {slotLabel(pendingCatalogReplacement.slot)} đang có trang phục khác. Nếu tiếp tục, bản hiện tại sẽ được giữ trong mục khôi phục trên thiết bị.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPendingCatalogReplacement(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">Giữ món hiện tại</button>
            <button type="button" disabled={isSaving} onClick={confirmCatalogReplacement} className="rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Thay bằng {pendingCatalogReplacement.name}</button>
          </div>
        </div>
      </Modal>}

      {pinnedSnapshotA && isCompareOpen && (
        <CompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          snapshotA={pinnedSnapshotA}
          catalogItems={catalogItems}
          snapshotB={snapshot}
          onSelectOutfit={(chosen) => {
            studio.dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: chosen }) });
          }}
        />
      )}

      {isExportOpen && <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={async (ratio) => {
          if (!canvasRef.current) throw new Error("Canvas chưa sẵn sàng");
          return canvasRef.current.exportToBlob(ratio);
        }}
        outfitTitle={outfitTitle}
        documentKey={JSON.stringify({ snapshot, outfitTitle })}
      />}

      <GeminiTryOnModal
        key={user?.id || "anonymous"}
        isOpen={isTryOnOpen}
        onClose={() => setIsTryOnOpen(false)}
        snapshot={snapshot}
        outfitTitle={outfitTitle}
        catalogItems={catalogItems}
        catalogLoading={isInitialLoading}
        catalogError={catalogItemsError}
        onReloadCatalog={refreshCatalog}
        ownerId={user?.id}
        onReplaceUnavailableItems={() => {
          const firstUnavailable = unavailableSnapshotItems[0];
          if (firstUnavailable) {
            setActiveSlot(firstUnavailable.slot);
            setSelectedGarmentType("all");
            setMobilePanel("catalog");
          }
          setIsTryOnOpen(false);
          setActionNotice("Bản phối vẫn giữ nguyên các món cũ. Chọn món thay thế trong danh mục đã xuất bản rồi thử tạo lại ảnh.");
        }}
        onExportOutfit={async (options) => {
          if (!canvasRef.current) throw new Error("Canvas chưa sẵn sàng");
          return canvasRef.current.exportToBlob(snapshot.aspectRatio || "9:16", options);
        }}
        onSaveOutfit={saveFromTryOn}
        isLoggedIn={isLoggedIn}
      />

      <AuthModal isOpen={showAuthModal} onClose={(authenticated) => {
        setShowAuthModal(false);
        if (!authenticated) setPendingAccountAction(null);
      }} />

      {/* Modal Giới thiệu Quy chuẩn Văn hóa Hữu Nhậm */}
      {showHuuNhamInfo && (
        <Modal isOpen onClose={() => setShowHuuNhamInfo(false)} label="Tìm hiểu Hữu nhậm">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-full overflow-y-auto p-6 shadow-2xl border border-stone-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-heritage-red/10 text-heritage-red flex items-center justify-center font-serif font-bold text-xl">
                  右
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900">
                    Quy chuẩn Văn hóa &quot;Hữu nhậm&quot; (右衽)
                  </h3>
                  <span className="text-xs text-stone-500">Đặc trưng cốt lõi của trang phục truyền thống Việt</span>
                </div>
              </div>
              <button
                aria-label="Đóng thông tin Hữu nhậm"
                onClick={() => setShowHuuNhamInfo(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-stone-600 leading-relaxed">
              <p>
                <strong>Hữu nhậm (cài vạt sang bên phải):</strong> Vạt áo bên trái đè lên vạt bên phải, các khuy cài dọc theo sườn phải. Đây là quy chuẩn trang phục nhất quán của người Việt từ thời Lý, Trần, Lê cho đến triều Nguyễn.
              </p>
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900">
                <strong>Tại sao cấm &quot;Tả nhậm&quot; (cài vạt sang trái)?</strong> Theo sách <em>Lễ Ký</em> và khảo cứu <em>Ngàn năm áo mũ</em> (Trần Quang Đức), người phương Bắc cổ đại quy định người sống mặc Hữu nhậm, chỉ khi qua đời khâm liệm mới cài vạt Tả nhậm. Mặc Tả nhậm lúc thường là điều đại kỵ trong văn hóa truyền thống.
              </div>
              <p className="text-[11px] text-stone-400 italic">
                Nguồn học thuật: Khâm định Đại Nam hội điển sự lệ, Ngàn năm áo mũ, Cố đô Huế.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHuuNhamInfo(false)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Đã hiểu quy chuẩn
              </button>
            </div>
          </div>
        </Modal>
      )}
      {weatherReplacementDialog}
    </div>
  );
}
