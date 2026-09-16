"use client";

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
} from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import Canvas2D, { Canvas2DHandle } from "@/features/studio/Canvas2D";
import SwatchPicker from "@/features/studio/SwatchPicker";
import CulturalCheckBadge from "@/features/studio/CulturalCheckBadge";
import WeatherWidget from "@/features/studio/WeatherWidget";
import ColorAnalysisPanel from "@/features/studio/ColorAnalysisPanel";
import CompareModal from "@/features/studio/CompareModal";
import ExportModal from "@/features/studio/ExportModal";
import StarterOutfitModal from "@/features/studio/StarterOutfitModal";
import AITryOnModal from "@/features/studio/AITryOnModal";
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

export default function StudioPage() {
  const { user, isLoggedIn } = useAuth();
  const canvasRef = useRef<Canvas2DHandle | null>(null);

  // Dữ liệu danh mục
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatar, setCurrentAvatar] = useState<Avatar | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Bộ lọc
  const [selectedGarmentType, setSelectedGarmentType] = useState<string>("all");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("ky_yeu");
  const [activeSlot, setActiveSlot] = useState<string>("outerwear");

  // State bộ phối hiện hành (Snapshot F01-F03)
  const [outfitTitle, setOutfitTitle] = useState<string>("Bản phối Kỷ yếu Cổ phong");
  const [styleMode, setStyleMode] = useState<"traditional" | "remix">("traditional");
  const [overlapDirection, setOverlapDirection] = useState<"right_over_left" | "left_over_right">("right_over_left");
  const [equippedItems, setEquippedItems] = useState<SnapshotItem[]>([
    { slot: "outerwear", itemId: "item_ngu_than_nam_xanh", variantId: "var_ngu_than_nam_xanh_cham", assetVersion: 1, colorHex: "#1A365D" },
    { slot: "undergarment", itemId: "item_ao_lot_trang", variantId: "var_ao_lot_trang", assetVersion: 1, colorHex: "#FFFFFF" },
    { slot: "bottom", itemId: "item_quan_trang_lua", variantId: "var_quan_trang", assetVersion: 1, colorHex: "#FFFFFF" },
    { slot: "headwear", itemId: "item_khan_van_den", variantId: "var_khan_van_den", assetVersion: 1, colorHex: "#171923" },
    { slot: "accessory_front", itemId: "item_quat_xep_giay_do", variantId: "var_quat_xep", assetVersion: 1, colorHex: "#9C4221" },
    { slot: "footwear", itemId: "item_guoc_moc_quai_nhung", variantId: "var_guoc_moc", assetVersion: 1, colorHex: "#4A5568" },
  ]);

  // Khóa món (Item lock F02)
  const [lockedSlots, setLockedSlots] = useState<Set<string>>(new Set());

  // Lịch sử Undo/Redo (F02)
  const [historyStack, setHistoryStack] = useState<SnapshotItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Lớp vẽ render
  const [layers, setLayers] = useState<AssetLayer[]>([]);

  // Kiểm tra văn hóa thời gian thực (F10)
  const [culturalCheck, setCulturalCheck] = useState<CulturalCheckResponse | null>(null);

  // Ghim Phương án A để so sánh A/B (F08)
  const [pinnedSnapshotA, setPinnedSnapshotA] = useState<OutfitSnapshot | null>(null);

  // Modals
  const [isStarterOpen, setIsStarterOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // AI Prompt nhanh
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Tỷ lệ khung hình hiển thị
  const [displayRatio, setDisplayRatio] = useState<"1:1" | "9:16">("9:16");

  const [canvasBackgroundTheme, setCanvasBackgroundTheme] = useState<"white" | "dopaper">("white");

  // Thông báo khôi phục bản nháp & giải thích văn hóa Hữu nhậm
  const [draftNotice, setDraftNotice] = useState<any | null>(null);
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

  const applyNguHanhPalette = (palette: (typeof NGU_HANH_PALETTES)[0]) => {
    const newItems = equippedItems.map((item) => {
      const colorHex = (palette.colors as Record<string, string>)[item.slot];
      if (colorHex && !lockedSlots.has(item.slot)) {
        return { ...item, colorHex };
      }
      return item;
    });
    pushHistory(newItems);
  };

  // Khởi tạo dữ liệu từ backend
  useEffect(() => {
    setIsInitialLoading(true);
    Promise.all([
      api.getGarmentTypes(),
      api.getOccasions(),
      api.getCatalogItems(),
      api.getAvatars(),
    ])
      .then(([gt, occ, items, avts]) => {
        setGarmentTypes(gt);
        setOccasions(occ);
        setCatalogItems(items);
        setAvatars(avts);
        if (avts.length > 0) setCurrentAvatar(avts[0]);
      })
      .catch((err) => console.error("Lỗi khởi tạo Studio:", err))
      .finally(() => setIsInitialLoading(false));
  }, []);

  // Cập nhật lớp vẽ dựa trên các món đang chọn
  useEffect(() => {
    const loadedLayers: AssetLayer[] = [];
    equippedItems.forEach((it) => {
      const dbItem = catalogItems.find((ci) => ci.id === it.itemId);
      if (dbItem?.default_layer) {
        loadedLayers.push(dbItem.default_layer);
      }
    });
    setLayers(loadedLayers);

    // Chạy kiểm tra quy chuẩn văn hóa thời gian thực (F10)
    api
      .checkCulturalCompliance({
        garment_type_id: selectedGarmentType === "all" ? undefined : selectedGarmentType,
        occasion_id: selectedOccasion,
        style_mode: styleMode,
        overlap_direction: overlapDirection,
        items: equippedItems.map((it) => ({
          slot: it.slot,
          item_id: it.itemId,
          variant_id: it.variantId,
          color_hex: it.colorHex,
        })),
      })
      .then((res) => setCulturalCheck(res))
      .catch((err) => console.error("Lỗi kiểm tra văn hóa:", err));

    // Tự động lưu bản nháp Studio cục bộ (F13 - khách vãng lai)
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "viet_stylist_current_draft",
          JSON.stringify({
            title: outfitTitle,
            occasionId: selectedOccasion,
            styleMode: styleMode,
            overlapDirection: overlapDirection,
            snapshot: {
              schemaVersion: 1,
              avatarId: currentAvatar?.id || "avatar_nam_chuan",
              poseId: "front_01",
              occasionId: selectedOccasion,
              styleMode: styleMode,
              overlapDirection: overlapDirection,
              items: equippedItems,
            },
          })
        );
      }
    } catch {
      // Bỏ qua lỗi quota
    }
  }, [equippedItems, catalogItems, selectedGarmentType, selectedOccasion, styleMode, overlapDirection, outfitTitle, currentAvatar]);

  // Kiểm tra tham số tải bộ phối từ URL (?loadOutfit=id)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const loadId = params.get("loadOutfit");
      if (loadId) {
        api.getOutfit(loadId)
          .then((saved) => {
            if (saved) {
              setOutfitTitle(saved.title);
              if (saved.occasion_id) setSelectedOccasion(saved.occasion_id);
              if (saved.style_mode) setStyleMode(saved.style_mode as any);
              if (saved.current_snapshot?.items) {
                setEquippedItems(saved.current_snapshot.items);
              }
              if (saved.current_snapshot?.overlapDirection) {
                setOverlapDirection(saved.current_snapshot.overlapDirection as any);
              }
            }
          })
          .catch((err) => console.warn("Không tải được outfit từ link:", err));
      }
    }
  }, []);

  // Lưu lịch sử Undo/Redo khi đổi đồ
  const pushHistory = (newItems: SnapshotItem[]) => {
    const nextStack = historyStack.slice(0, historyIndex + 1);
    nextStack.push(newItems);
    setHistoryStack(nextStack);
    setHistoryIndex(nextStack.length - 1);
    setEquippedItems(newItems);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setEquippedItems(historyStack[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setEquippedItems(historyStack[historyIndex + 1]);
    }
  };

  // Lắng nghe phím tắt: Ctrl+Z, Ctrl+Y, Esc, Phím số 1-6 đổi slot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
      } else if (e.key >= "1" && e.key <= "6") {
        const slots = ["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "footwear"];
        const idx = parseInt(e.key) - 1;
        if (slots[idx]) setActiveSlot(slots[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, historyStack]);

  // Kiểm tra xem có bản nháp từ phiên trước không
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("viet_stylist_current_draft");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.snapshot?.items && parsed.snapshot.items.length > 0) {
            setDraftNotice(parsed);
          }
        }
      }
    } catch {
      // Bỏ qua
    }
  }, []);

  const handleRestoreDraft = () => {
    if (!draftNotice) return;
    if (draftNotice.title) setOutfitTitle(draftNotice.title);
    if (draftNotice.occasionId) setSelectedOccasion(draftNotice.occasionId);
    if (draftNotice.styleMode) setStyleMode(draftNotice.styleMode);
    if (draftNotice.overlapDirection) setOverlapDirection(draftNotice.overlapDirection);
    if (draftNotice.snapshot?.items) {
      setEquippedItems(draftNotice.snapshot.items);
      pushHistory(draftNotice.snapshot.items);
    }
    setDraftNotice(null);
  };

  const toggleLockSlot = (slot: string) => {
    const next = new Set(lockedSlots);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    setLockedSlots(next);
  };

  // Chọn món từ catalog
  const handleSelectItem = (item: CatalogItem) => {
    if (lockedSlots.has(item.slot)) return;

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
  };

  // Chọn biến thể màu
  const handleSelectVariant = (variant: ItemVariant) => {
    const activeItemConfig = equippedItems.find((it) => it.slot === activeSlot);
    if (!activeItemConfig) return;

    const newItems = equippedItems.map((it) => {
      if (it.slot === activeSlot) {
        return {
          ...it,
          variantId: variant.id,
          colorHex: variant.hex_color,
        };
      }
      return it;
    });
    pushHistory(newItems);
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
  const handleLoadStarter = (starter: any) => {
    setSelectedOccasion(starter.occasion_id);
    setSelectedGarmentType(starter.garment_type_id);
    setOutfitTitle(starter.title);

    const newItems: SnapshotItem[] = starter.items.map((it: any) => {
      const dbItem = catalogItems.find((ci) => ci.id === it.item_id);
      const chosenVar = dbItem?.variants.find((v) => v.id === it.variant_id) || dbItem?.variants[0];
      return {
        slot: it.slot,
        itemId: it.item_id,
        variantId: it.variant_id,
        assetVersion: 1,
        colorHex: chosenVar?.hex_color,
      };
    });
    pushHistory(newItems);
  };

  // Lưu bộ phối vào database (F08, F13)
  const handleSaveOutfit = async () => {
    setIsSaving(true);
    try {
      const currentSnapshot: OutfitSnapshot = {
        schemaVersion: 1,
        avatarId: currentAvatar?.id || "avatar_nam_chuan",
        poseId: "front_01",
        occasionId: selectedOccasion,
        styleMode: styleMode,
        overlapDirection: overlapDirection,
        items: equippedItems,
      };

      await api.createOutfit({
        title: outfitTitle,
        occasion_id: selectedOccasion,
        style_mode: styleMode,
        snapshot: currentSnapshot,
      });

      setSaveSuccessMessage("Đã lưu bộ phối thành công!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      alert("Lỗi khi lưu bộ phối: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Trợ lý AI Gemini gợi ý phối đồ (F11)
  const handleAskAIStylist = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const lockedList = Array.from(lockedSlots).map((slot) => {
        const it = equippedItems.find((item) => item.slot === slot);
        return { slot, item_id: it?.itemId || "", variant_id: it?.variantId };
      });

      const res = await api.getAIRecommendations({
        prompt: aiPrompt,
        occasion_id: selectedOccasion,
        style_mode: styleMode,
        locked_items: lockedList,
      });

      if (res.outfits && res.outfits.length > 0) {
        const recOutfit = res.outfits[0];
        setOutfitTitle(recOutfit.title);

        const newItems: SnapshotItem[] = recOutfit.items.map((it: any) => ({
          slot: it.slot,
          itemId: it.item_id,
          variantId: it.variant_id,
          assetVersion: 1,
          colorHex: it.hex_color,
        }));
        pushHistory(newItems);
      }
    } catch (err: any) {
      alert("Trợ lý AI bận: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
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

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner thông báo khôi phục bản nháp */}
      {draftNotice && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-amber-200/60 flex items-center justify-center text-amber-800 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Phát hiện bản phối dở dang từ phiên trước: &quot;{draftNotice.title}&quot;
              </h4>
              <p className="text-[11px] text-amber-700">
                Gồm {draftNotice.snapshot?.items?.length || 0} món trang phục đã chọn. Bạn có muốn khôi phục lại không?
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRestoreDraft}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
            >
              Khôi phục bản phối
            </button>
            <button
              onClick={() => setDraftNotice(null)}
              className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-medium rounded-lg transition-colors"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* Top Toolbar: Tên bộ phối, Chế độ, Undo/Redo, Nút Lưu & Xuất */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={outfitTitle}
            onChange={(e) => setOutfitTitle(e.target.value)}
            className="font-serif font-bold text-xl sm:text-2xl text-stone-900 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-heritage-red focus:outline-none px-1 py-0.5 tracking-tight"
          />

          {/* Segmented control: Truyền thống vs Remix */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
            <button
              onClick={() => setStyleMode("traditional")}
              className={`px-3 py-1 rounded-lg transition-all ${
                styleMode === "traditional"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              Cổ phong Chuẩn mực
            </button>
            <button
              onClick={() => setStyleMode("remix")}
              className={`px-3 py-1 rounded-lg transition-all ${
                styleMode === "remix"
                  ? "bg-heritage-red text-white shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              Remix Đương đại
            </button>
          </div>
        </div>

        {/* Nút thao tác nhanh: Undo, Redo, Mở đầu, So sánh, Thử đồ, Lưu, Xuất */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Undo / Redo & Phím tắt */}
          <div className="flex items-center space-x-1.5">
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-md hover:bg-white text-stone-700 disabled:opacity-30 transition-all"
                title="Hoàn tác (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= historyStack.length - 1}
                className="p-1.5 rounded-md hover:bg-white text-stone-700 disabled:opacity-30 transition-all"
                title="Làm lại (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            <span
              className="hidden xl:inline-block text-[10px] text-stone-400 font-mono bg-stone-50 border border-stone-200 px-2 py-1 rounded-md"
              title="Phím tắt: Ctrl+Z (Undo), Ctrl+Y (Redo), 1-6 (Đổi slot trang phục), Esc (Đóng bảng)"
            >
              ⌨️ Ctrl+Z / 1-6
            </span>
          </div>

          <button
            onClick={() => setIsStarterOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-heritage-gold" />
            <span>Mẫu mở đầu (F01)</span>
          </button>

          {/* Ghim / So sánh A/B */}
          <button
            onClick={() => {
              if (!pinnedSnapshotA) {
                setPinnedSnapshotA({
                  schemaVersion: 1,
                  avatarId: currentAvatar?.id || "avatar_nam_chuan",
                  poseId: "front_01",
                  occasionId: selectedOccasion,
                  styleMode: styleMode,
                  overlapDirection: overlapDirection,
                  items: equippedItems,
                });
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
            <span>{pinnedSnapshotA ? "So sánh A/B (F08)" : "Ghim bản A"}</span>
          </button>

          {/* Thử đồ AI */}
          <button
            onClick={() => setIsTryOnOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-heritage-gold bg-amber-50/50 hover:bg-amber-100/60 text-xs font-semibold text-amber-900 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-heritage-gold" />
            <span>Thử đồ AI (F05)</span>
          </button>

          {/* Xuất ảnh 2D */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất ảnh (F03)</span>
          </button>

          {/* Lưu bộ phối */}
          <button
            onClick={handleSaveOutfit}
            disabled={isSaving}
            className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-heritage-red hover:bg-heritage-red-dark text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Đang lưu..." : "Lưu bộ phối"}</span>
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Studio 3-Column Layout: Trái (Danh mục & Sự kiện) | Giữa (Canvas 2D) | Phải (Màu sắc, Cảnh báo văn hóa, Thời tiết) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI (3 cols): Bối cảnh sự kiện & Kho đồ */}
        <div className="lg:col-span-3 xl:col-span-3 space-y-4">
          {/* Lọc Sự Kiện & Bối Cảnh (F01) */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Hoàn cảnh sử dụng
              </span>
              <span className="text-[11px] font-medium text-stone-400">Occasion</span>
            </div>
            {isInitialLoading ? (
              <OccasionGridSkeleton />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {occasions.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedOccasion === occ.id
                        ? "border-heritage-red bg-heritage-red/10 text-heritage-red font-semibold shadow-xs"
                        : "border-stone-200 hover:border-stone-300 text-stone-700 bg-stone-50/50"
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900 truncate">{occ.name}</div>
                    <div className="text-[11px] text-stone-500 font-normal capitalize mt-0.5">{occ.season}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lọc Nhóm Áo & Slot */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
            {/* Tiêu đề mục phân loại */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Phân loại trang phục
              </span>
              <span className="text-xs text-stone-400 font-medium">
                {filteredCatalogItems.length} món
              </span>
            </div>

            {/* Tabs Slot sắp xếp lưới 3 cột x 2 hàng đều đặn, khóa slot tinh gọn */}
            <div className="grid grid-cols-3 gap-1.5">
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
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => setActiveSlot(s.slot)}
                    className={`group relative px-2.5 py-2 rounded-xl text-xs font-semibold text-center transition-all border select-none ${
                      isSelected
                        ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                        : "bg-stone-50 text-stone-700 border-stone-200/80 hover:bg-stone-100 hover:border-stone-300"
                    }`}
                  >
                    <span className="truncate block">{s.label}</span>
                    {/* Nút khóa slot tinh tế ở góc, chỉ hiện rõ khi đã khóa hoặc khi rê chuột */}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLockSlot(s.slot);
                      }}
                      className={`absolute top-1 right-1 p-0.5 rounded cursor-pointer transition-all ${
                        isLocked
                          ? "text-amber-500 opacity-100 bg-amber-50 rounded-full"
                          : "opacity-0 group-hover:opacity-40 hover:!opacity-100 text-current"
                      }`}
                      title={isLocked ? "Đã khóa - Giữ nguyên khi tạo ngẫu nhiên" : "Nhấn để khóa món này"}
                    >
                      {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quy cách Cài vạt Cổ phục (Hữu nhậm vs Tả nhậm) gọn gàng */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs">
              <div className="flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-heritage-red shrink-0" />
                <span className="font-semibold text-stone-700">Cài vạt:</span>
                <button
                  type="button"
                  onClick={() => setShowHuuNhamInfo(true)}
                  className="text-stone-400 hover:text-heritage-red transition-colors inline-flex items-center"
                  title="Tìm hiểu ý nghĩa quy chuẩn Hữu nhậm cổ truyền"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-stone-300 text-[9px] flex items-center justify-center font-bold text-stone-500 hover:border-heritage-red hover:text-heritage-red">?</span>
                </button>
              </div>
              <button
                type="button"
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
                title="Nhấn để đổi hướng vạt áo và kiểm tra cảnh báo quy chuẩn văn hóa"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${overlapDirection === "right_over_left" ? "bg-emerald-600" : "bg-red-600"}`} />
                <span>{overlapDirection === "right_over_left" ? "Hữu nhậm (Phải)" : "Tả nhậm (Trái)"}</span>
              </button>
            </div>

            {/* Danh sách items có sẵn theo slot */}
            {isInitialLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <GarmentItemSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] xl:max-h-[560px] overflow-y-auto pr-1 overscroll-contain">
                {filteredCatalogItems.map((item) => {
                  const isEquipped = equippedItems.some((it) => it.itemId === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`p-2.5 rounded-xl border flex items-center space-x-3 cursor-pointer transition-colors duration-150 ${
                        isEquipped
                          ? "border-heritage-red bg-heritage-red/5 ring-1.5 ring-heritage-red shadow-xs"
                          : "border-stone-200 hover:border-stone-400 bg-white hover:bg-[#FAF8F5]"
                      }`}
                    >
                      {/* Thumbnail ảnh minh họa thật hoặc SVG */}
                      <div className="w-14 h-14 rounded-lg bg-[#FAF8F5] border border-stone-200/80 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {item.metadata?.real_image_url ? (
                          <img
                            src={item.metadata.real_image_url}
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
                        {item.metadata?.real_image_url && (
                          <span className="absolute bottom-0 right-0 bg-heritage-red text-[8px] font-bold text-white px-1 rounded-tl">
                            Ảnh thật
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="font-semibold text-[13px] text-stone-900 truncate tracking-tight" title={item.name}>
                          {item.name}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-stone-500">
                          <span>Thời {item.era || "Nguyễn"}</span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CỘT GIỮA (6 cols): Vùng Artboard Canvas 2D (F03) - Trọng tâm thiết kế */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-3">
          {/* Thanh công cụ Artboard: Chế độ Flat-lay, Nền, Tỉ lệ */}
          <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              {/* Tiêu đề Bảng phối Flat-lay OOTD */}
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-heritage-red/10 text-heritage-red flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-stone-900 tracking-tight">Bảng Phối Đồ Flat-lay (OOTD)</span>
              </div>

              {/* Tỉ lệ khung hình */}
              <div className="flex items-center space-x-1 text-xs">
                <button
                  onClick={() => setDisplayRatio("9:16")}
                  className={`px-2.5 py-1 rounded-lg font-mono font-semibold text-xs transition-all ${
                    displayRatio === "9:16" ? "bg-stone-900 text-white shadow-xs" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title="Tỉ lệ dọc (Story / TikTok / Reels)"
                >
                  9:16
                </button>
                <button
                  onClick={() => setDisplayRatio("1:1")}
                  className={`px-2.5 py-1 rounded-lg font-mono font-semibold text-xs transition-all ${
                    displayRatio === "1:1" ? "bg-stone-900 text-white shadow-xs" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title="Tỉ lệ vuông (Instagram / Feed)"
                >
                  1:1
                </button>
              </div>
            </div>

            {/* Tùy chọn nền & Nút đặt lại vị trí */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs text-stone-500">
              <div className="flex items-center space-x-1.5">
                <span className="font-medium text-stone-600">Nền:</span>
                <button
                  onClick={() => setCanvasBackgroundTheme("white")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    canvasBackgroundTheme === "white"
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  Trắng Studio
                </button>
                <button
                  onClick={() => setCanvasBackgroundTheme("dopaper")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
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
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-heritage-red transition-colors"
                title="Khôi phục toàn bộ trang phục về vị trí sắp xếp OOTD ban đầu"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Căn lại vị trí ban đầu</span>
              </button>
            </div>
          </div>

          <Canvas2D
            ref={canvasRef}
            avatar={currentAvatar}
            layers={layers}
            equippedItems={equippedItems}
            catalogItems={catalogItems}
            aspectRatio={displayRatio}
            viewMode="flatlay"
            backgroundTheme={canvasBackgroundTheme}
            selectedSlot={activeSlot}
            onSelectItem={(slot) => setActiveSlot(slot)}
            className="w-full"
          />

          {/* Trợ lý Gemini gợi ý nhanh */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-stone-900">
              <Sparkles className="w-3.5 h-3.5 text-heritage-red" />
              <span>Trợ lý Gemini Styling (F11)</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ví dụ: Phối áo ngũ thân chụp kỷ yếu thanh lịch..."
                className="flex-1 text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-heritage-red"
              />
              <button
                onClick={handleAskAIStylist}
                disabled={isAiLoading || !aiPrompt.trim()}
                className="px-3.5 py-2 bg-heritage-red text-white rounded-lg text-xs font-semibold hover:bg-heritage-red-dark transition-all disabled:opacity-50"
              >
                {isAiLoading ? "..." : "Gợi ý"}
              </button>
            </div>
            {isAiLoading && (
              <div className="flex items-center space-x-2 text-xs text-heritage-red pt-1">
                <span className="w-2 h-2 rounded-full bg-heritage-red animate-ping shrink-0" />
                <span className="font-medium animate-pulse">Gemini AI đang phân tích bối cảnh & tuyển chọn trang phục...</span>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (3 cols): Swatch Màu (F02), Cảnh báo văn hóa (F10), Hài hòa màu (F07), Thời tiết (F06) */}
        <div className="lg:col-span-3 xl:col-span-3 space-y-4">
          {/* Cảnh báo Quy Chuẩn Văn Hóa (F10) */}
          <CulturalCheckBadge
            checkData={culturalCheck}
            onApplyFix={handleApplyCulturalFix}
          />

          {/* Bảng phối màu Ngũ Hành 1 chạm (Tối ưu trải nghiệm F02/F07) */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-heritage-gold" />
                <span>Phối Màu Ngũ Hành 1 Chạm</span>
              </span>
              <span className="text-xs text-stone-400 font-medium">Tương sinh</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {NGU_HANH_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  onClick={() => applyNguHanhPalette(pal)}
                  className={`p-2 rounded-xl border text-center transition-all hover:scale-105 ${pal.badge}`}
                  title={`${pal.name} (${pal.desc}) - Bấm để áp dụng`}
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

          {/* Bộ chọn Biến thể màu sắc & Chất liệu cho món đang chọn (F02) */}
          {isInitialLoading ? (
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
                onSelectVariant={handleSelectVariant}
              />
            </div>
          ) : null}

          {/* Phân tích Hài hòa Màu sắc & Độ tương phản (F07) */}
          <ColorAnalysisPanel
            equippedColors={currentColorsForAnalysis}
            onApplyColorVariant={(sug) => {
              const targetSlot = catalogItems.find((ci) => ci.id === sug.item_id)?.slot;
              if (targetSlot) {
                const newItems = equippedItems.map((it) => {
                  if (it.slot === targetSlot) {
                    return { ...it, itemId: sug.item_id, variantId: sug.variant_id, colorHex: sug.hex_color };
                  }
                  return it;
                });
                pushHistory(newItems);
              }
            }}
          />

          {/* Dự báo Thời tiết & Lời khuyên bối cảnh (F06) */}
          <WeatherWidget
            onApplyWeatherSuggestion={(accessories) => {
              // Tìm phụ kiện tương ứng trong catalog
              const fan = catalogItems.find((ci) => ci.id === "item_quat_xep_giay_do");
              if (fan) handleSelectItem(fan);
            }}
          />
        </div>
      </div>

      {/* MODALS */}
      <StarterOutfitModal
        isOpen={isStarterOpen}
        onClose={() => setIsStarterOpen(false)}
        onSelectStarter={handleLoadStarter}
      />

      {pinnedSnapshotA && (
        <CompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          snapshotA={pinnedSnapshotA}
          snapshotB={{
            schemaVersion: 1,
            avatarId: currentAvatar?.id || "avatar_nam_chuan",
            poseId: "front_01",
            occasionId: selectedOccasion,
            styleMode: styleMode,
            overlapDirection: overlapDirection,
            items: equippedItems,
          }}
          onSelectOutfit={(chosen) => {
            setEquippedItems(chosen.items);
            setStyleMode(chosen.styleMode as any);
            setOverlapDirection(chosen.overlapDirection as any);
          }}
        />
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={async (ratio) => {
          if (!canvasRef.current) throw new Error("Canvas chưa sẵn sàng");
          return canvasRef.current.exportToDataUrl(ratio);
        }}
        outfitTitle={outfitTitle}
      />

      <AITryOnModal
        isOpen={isTryOnOpen}
        onClose={() => setIsTryOnOpen(false)}
        snapshot={{
          schemaVersion: 1,
          avatarId: currentAvatar?.id || "avatar_nam_chuan",
          poseId: "front_01",
          occasionId: selectedOccasion,
          styleMode: styleMode,
          overlapDirection: overlapDirection,
          items: equippedItems,
        }}
        outfitTitle={outfitTitle}
      />

      {/* Modal Giới thiệu Quy chuẩn Văn hóa Hữu Nhậm */}
      {showHuuNhamInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
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
        </div>
      )}
    </div>
  );
}
