"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useLayoutEffect } from "react";
import { Avatar, AssetLayer, SnapshotItem, CatalogItem } from "@/lib/types/api";
import { API_ORIGIN } from "@/lib/api/client";
import BoardBackground from "./BoardBackground";
import DragShadowImage, { pauseDragPreviewPreparation } from "./DragShadowImage";
import { encodePng } from "./encodePng";
import { backgroundUrl, loadBackground, paintBackground, type BackgroundTheme, type NeutralBackground } from "./backgrounds";
import {
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Lock,
  Unlock,
  X,
} from "lucide-react";

export interface Canvas2DHandle {
  exportToBlob: (aspectRatio: "1:1" | "9:16", options?: { neutralBackground?: boolean }) => Promise<Blob>;
  previewBackgroundFade: (value: number | null) => void;
  resetAllTransforms: () => void;
}

export interface ItemTransform {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

export interface Canvas2DProps {
  avatar: Avatar | null;
  layers: AssetLayer[];
  equippedItems: SnapshotItem[];
  catalogItems?: CatalogItem[];
  aspectRatio?: "1:1" | "9:16";
  viewMode?: "flatlay" | "avatar";
  backgroundTheme?: BackgroundTheme;
  neutralBackgroundTheme?: NeutralBackground;
  backgroundFade?: number;
  occasionId?: string;
  selectedSlot?: string | null;
  onSelectItem?: (slot: string) => void;
  onRemoveItem?: (slot: string) => void;
  onBrowseCatalog?: () => void;
  onToggleLock?: (slot: string) => void;
  lockedSlots?: string[];
  onTransformsCommit?: (changes: Record<string, ItemTransform | undefined>) => void;
  onColorLoadFailure?: (itemId: string, colorHex: string) => void;
  className?: string;
}

interface ItemGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  defaultDx: number;
  defaultDy: number;
  defaultScale: number;
  defaultRotation: number;
  zIndex: number;
  label: string;
}

// Bảng tọa độ và vùng bao (Bounding Box) chuẩn xác cho từng hiện vật thực tế trên khung 800 x 1200
const ITEM_GEOMETRIES: Record<string, ItemGeometry> = {
  // 1. Áo tấc Xanh Rêu (Ảnh thật bóc tách từ Gemini)
  item_ao_tac_xanh_reu: {
    x: 160,
    y: 240,
    width: 480,
    height: 530,
    cx: 400,
    cy: 505,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 30,
    label: "Áo tấc Xanh Rêu",
  },
  // 2. Quạt xếp giấy dó truyền thống
  item_quat_xep_giay_do: {
    x: 285,
    y: 450,
    width: 145,
    height: 200,
    cx: 357,
    cy: 550,
    defaultDx: 230, // Đưa quạt sang bên phải tà áo
    defaultDy: -40,
    defaultScale: 1.0,
    defaultRotation: -12,
    zIndex: 42,
    label: "Quạt xếp giấy dó",
  },
  // 3. Túi cói remix
  item_tui_coi_remix: {
    x: 120,
    y: 460,
    width: 160,
    height: 180,
    cx: 200,
    cy: 550,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 40,
    label: "Túi cói",
  },
  // 4. Khăn vấn đen truyền thống
  item_khan_van_den: {
    x: 320,
    y: 180,
    width: 160,
    height: 75,
    cx: 400,
    cy: 218,
    defaultDx: 0,
    defaultDy: -50,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 50,
    label: "Khăn vấn đen",
  },
  // 5. Khăn vấn xanh lục bảo
  item_khan_van_xanh: {
    x: 320,
    y: 180,
    width: 160,
    height: 75,
    cx: 400,
    cy: 218,
    defaultDx: 0,
    defaultDy: -50,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 50,
    label: "Khăn vấn xanh",
  },
  // 6. Quần lụa trắng
  item_quan_trang_lua: {
    x: 305,
    y: 715,
    width: 190,
    height: 355,
    cx: 400,
    cy: 890,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 15,
    label: "Quần lụa trắng",
  },
  // 7. Quần lụa đen
  item_quan_den_ong_rong: {
    x: 305,
    y: 715,
    width: 190,
    height: 355,
    cx: 400,
    cy: 890,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 15,
    label: "Quần lụa đen",
  },
  // 8. Guốc mộc quai nhung
  item_guoc_moc_quai_nhung: {
    x: 315,
    y: 1045,
    width: 175,
    height: 40,
    cx: 400,
    cy: 1065,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 10,
    label: "Guốc mộc",
  },
  // 9. Sneaker trắng remix
  item_sneaker_trang_remix: {
    x: 310,
    y: 1030,
    width: 180,
    height: 55,
    cx: 400,
    cy: 1055,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 10,
    label: "Sneaker trắng",
  },
  // 10. Kiềng bạc chạm hoa mai
  item_kieng_bac: {
    x: 350,
    y: 375,
    width: 100,
    height: 65,
    cx: 400,
    cy: 405,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 45,
    label: "Kiềng bạc",
  },
  // 11. Áo lót trắng cổ đứng
  item_ao_lot_trang: {
    x: 365,
    y: 340,
    width: 70,
    height: 50,
    cx: 400,
    cy: 365,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 20,
    label: "Áo lót trắng",
  },
};

// Bố cục mặc định cho các slot chưa có tọa độ tùy biến
const DEFAULT_SLOT_GEOMETRY: Record<string, ItemGeometry> = {
  headwear: {
    x: 300,
    y: 150,
    width: 200,
    height: 120,
    cx: 400,
    cy: 210,
    defaultDx: 0,
    defaultDy: -30,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 50,
    label: "Khăn / Nón",
  },
  accessory_front: {
    x: 320,
    y: 350,
    width: 160,
    height: 160,
    cx: 400,
    cy: 430,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 45,
    label: "Phụ kiện",
  },
  outerwear: {
    x: 160,
    y: 340,
    width: 480,
    height: 540,
    cx: 400,
    cy: 610,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 30,
    label: "Áo ngoài",
  },
  undergarment: {
    x: 350,
    y: 340,
    width: 100,
    height: 60,
    cx: 400,
    cy: 370,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 20,
    label: "Áo lót",
  },
  bottom: {
    x: 280,
    y: 700,
    width: 240,
    height: 360,
    cx: 400,
    cy: 880,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 15,
    label: "Quần / Váy",
  },
  footwear: {
    x: 310,
    y: 1040,
    width: 180,
    height: 45,
    cx: 400,
    cy: 1060,
    defaultDx: 0,
    defaultDy: 0,
    defaultScale: 1.0,
    defaultRotation: 0,
    zIndex: 10,
    label: "Giày / Guốc",
  },
};

const Canvas2D = forwardRef<Canvas2DHandle, Canvas2DProps>(
  (
    {
      avatar,
      layers,
      equippedItems,
      catalogItems = [],
      onBrowseCatalog,
      aspectRatio = "9:16",
      viewMode = "flatlay",
      backgroundTheme = "white",
      neutralBackgroundTheme = "white",
      backgroundFade = 0,
      occasionId,
      selectedSlot: externalSelectedSlot,
      onSelectItem,
      onRemoveItem,
      onToggleLock,
      lockedSlots = [],
      onTransformsCommit,
      onColorLoadFailure,
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const zoomAnchorRef = useRef({ x: 0.5, y: 0.5 });
    const [boardZoom, setBoardZoom] = useState(1);
    const changeBoardZoom = (next: number) => {
      if (dragSessionRef.current) return;
      const viewport = viewportRef.current;
      const board = containerRef.current;
      if (viewport && board) {
        const viewportRect = viewport.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        zoomAnchorRef.current = {
          x: (viewportRect.left + viewport.clientWidth / 2 - boardRect.left) / boardRect.width,
          y: (viewportRect.top + viewport.clientHeight / 2 - boardRect.top) / boardRect.height,
        };
      }
      setBoardZoom(Math.min(4, Math.max(0.5, next)));
    };
    useLayoutEffect(() => {
      const viewport = viewportRef.current;
      const board = containerRef.current;
      if (!viewport || !board) return;
      if (boardZoom <= 1) {
        viewport.scrollTo(0, 0);
        return;
      }
      const viewportRect = viewport.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      viewport.scrollBy(
        boardRect.left + zoomAnchorRef.current.x * boardRect.width - viewportRect.left - viewport.clientWidth / 2,
        boardRect.top + zoomAnchorRef.current.y * boardRect.height - viewportRect.top - viewport.clientHeight / 2,
      );
    }, [boardZoom, aspectRatio]);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const canvasExports = useRef(0);
    const [imageSizes, setImageSizes] = useState<Record<string, { url: string; width: number; height: number }>>({});
    const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
    const [imageRetry, setImageRetry] = useState(0);
    const colorFailureRef = useRef(onColorLoadFailure);
    colorFailureRef.current = onColorLoadFailure;

    const imageUrlFor = (item: CatalogItem | undefined, colorHex?: string, sourceVersion?: string, algorithmVersion?: string) => {
      if (!item) return undefined;
      const defaultColor = item.variants.find(variant => variant.is_default)?.hex_color || item.variants[0]?.hex_color;
      if (item.metadata?.catalog_media_id && colorHex && defaultColor && colorHex.toLowerCase() !== defaultColor.toLowerCase()) {
        const params = new URLSearchParams({ color: colorHex.toUpperCase() });
        if (sourceVersion) params.set("source_version", sourceVersion);
        if (algorithmVersion) params.set("algorithm_version", algorithmVersion);
        if (imageRetry) params.set("retry", String(imageRetry));
        return `${API_ORIGIN}/api/catalog/items/${encodeURIComponent(item.id)}/studio-image?${params.toString()}`;
      }
      const source = item.metadata?.catalog_media_id
        ? `${API_ORIGIN}/api/catalog/items/${encodeURIComponent(item.id)}/studio-image`
        : (item.metadata?.flatlay_image_url as string | undefined) || (item.metadata?.real_image_url as string | undefined);
      if (!source || !imageRetry) return source;
      const hashStart = source.indexOf("#");
      const path = hashStart < 0 ? source : source.slice(0, hashStart);
      const hash = hashStart < 0 ? "" : source.slice(hashStart);
      return `${path}${path.includes("?") ? "&" : "?"}retry=${imageRetry}${hash}`;
    };

    const imageRequestKey = JSON.stringify(equippedItems.map(equipped => ({
      itemId: equipped.itemId,
      url: imageUrlFor(catalogItems.find(candidate => candidate.id === equipped.itemId), equipped.colorHex, equipped.colorSourceVersion, equipped.colorAlgorithmVersion),
    })));

    useEffect(() => {
      let cancelled = false;
      const requests = JSON.parse(imageRequestKey) as Array<{ itemId: string; url?: string }>;
      for (const { itemId, url } of requests) {
        if (!url) continue;
        const image = new Image();
        image.onload = () => {
          if (cancelled) return;
          setImageSizes(previous => ({ ...previous, [itemId]: {
            url, width: image.naturalWidth, height: image.naturalHeight,
          } }));
          setImageErrors(previous => {
            if (!previous[itemId]) return previous;
            const next = { ...previous };
            delete next[itemId];
            return next;
          });
        };
        image.onerror = () => {
          if (cancelled) return;
          setImageErrors(previous => ({ ...previous, [itemId]: url }));
          if (url.includes("color=")) {
            const requestedColor = new URL(url).searchParams.get("color");
            if (requestedColor) colorFailureRef.current?.(itemId, requestedColor);
            const item = catalogItems.find(candidate => candidate.id === itemId);
            const fallbackUrl = imageUrlFor(item);
            if (fallbackUrl) {
              const fallback = new Image();
              fallback.onload = () => {
                if (!cancelled) setImageSizes(previous => ({ ...previous, [itemId]: { url: fallbackUrl, width: fallback.naturalWidth, height: fallback.naturalHeight } }));
              };
              fallback.src = fallbackUrl;
            }
          }
        };
        image.src = url;
      }
      return () => { cancelled = true; };
    }, [imageRequestKey, catalogItems]);

    // Quản lý slot đang được chọn
    const [activeSlot, setActiveSlot] = useState<string | null>(externalSelectedSlot || null);

    useEffect(() => {
      if (externalSelectedSlot !== undefined) {
        setActiveSlot(externalSelectedSlot);
      }
    }, [externalSelectedSlot]);

    // Trạng thái biến đổi của từng slot (dx, dy, scale, rotation)
    const [transforms, renderTransforms] = useState<Record<string, ItemTransform>>({});
    const transformsRef = useRef(transforms);
    const setTransforms = (update: React.SetStateAction<Record<string, ItemTransform>>) => {
      const next = typeof update === "function" ? update(transformsRef.current) : update;
      transformsRef.current = next;
      renderTransforms(next);
    };
    useEffect(() => { setTransforms({}); }, [equippedItems]);

    // Trạng thái kéo chuột đang diễn ra
    type DragSession = {
      type: "move" | "resize" | "rotate";
      slot: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      threshold: number;
      moved: boolean;
      startSvgX: number;
      startSvgY: number;
      initialTransform: ItemTransform;
      geometry: ItemGeometry;
    };
    const [dragSession, renderDragSession] = useState<DragSession | null>(null);
    const dragSessionRef = useRef<DragSession | null>(null);
    const pointerFrame = useRef(0);
    const pendingPointer = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);
    const setDragSession = (session: DragSession | null) => {
      dragSessionRef.current = session;
      renderDragSession(session);
    };

    useEffect(() => {
      const artboard = svgRef.current;
      if (!artboard) return;
      // SVG descendants do not consistently suppress browser scrolling with CSS
      // alone. React's touch listeners are passive, so use a scoped native listener.
      // Blank space still permits page scrolling and browser pinch zoom.
      const preventGarmentScroll = (event: TouchEvent) => {
        const target = event.target;
        if (event.cancelable && (dragSessionRef.current || (target instanceof Element && target.closest('[data-studio-drag="true"]')))) {
          event.preventDefault();
        }
      };
      artboard.addEventListener("touchstart", preventGarmentScroll, { passive: false });
      return () => artboard.removeEventListener("touchstart", preventGarmentScroll);
    }, []);

    useEffect(() => () => { cancelAnimationFrame(pointerFrame.current); }, []);

    // Lấy thông số hình học chuẩn của món đồ
    const getItemGeometry = (eq: SnapshotItem): ItemGeometry => {
      const base = ITEM_GEOMETRIES[eq.itemId] || DEFAULT_SLOT_GEOMETRY[eq.slot] || DEFAULT_SLOT_GEOMETRY.outerwear;
      const item = catalogItems.find(candidate => candidate.id === eq.itemId);
      const size = imageSizes[eq.itemId];
      if (!size || size.url !== imageUrlFor(item, eq.colorHex, eq.colorSourceVersion, eq.colorAlgorithmVersion)) return base;
      const bounds = eq.slot === "undergarment" ? { width: 360, height: 460, cy: 470 }
        : eq.slot === "footwear" ? { width: 260, height: 160, cy: 1040 }
        : { width: base.width, height: base.height, cy: base.cy };
      const factor = Math.min(bounds.width / size.width, bounds.height / size.height);
      const width = Math.round(size.width * factor);
      const height = Math.round(size.height * factor);
      return { ...base, x: base.cx - width / 2, y: bounds.cy - height / 2,
        width, height, cx: base.cx, cy: bounds.cy };
    };

    // Lấy transform hiện hành của món đồ
    const getTransform = (eq: SnapshotItem): ItemTransform => {
      if (transformsRef.current[eq.slot]) return transformsRef.current[eq.slot];
      if (eq.transform) return eq.transform;
      const geom = getItemGeometry(eq);
      return {
        dx: geom.defaultDx,
        dy: geom.defaultDy,
        scale: geom.defaultScale,
        rotation: geom.defaultRotation,
      };
    };

    // Quy đổi tọa độ chuột sang tọa độ viewBox (800 x 1200) của SVG
    const getSvgCoordinates = (e: { clientX: number; clientY: number }) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const matrix = svgRef.current.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      return { x: point.x, y: point.y };
    };

    // Capture on the stable artboard, not a handle that can disappear on selection.
    // One pointer owns the gesture; a second finger must not move or finish it.
    const startGesture = (e: React.PointerEvent, slot: string, type: DragSession["type"]) => {
      e.stopPropagation();
      if (dragSessionRef.current || !e.isPrimary || e.button !== 0) return;
      setActiveSlot(slot);
      onSelectItem?.(slot);
      if (lockedSlots.includes(slot)) return;
      const pt = getSvgCoordinates(e);
      const currentEq = equippedItems.find((it) => it.slot === slot);
      if (!currentEq || !svgRef.current) return;
      svgRef.current.setPointerCapture(e.pointerId);
      setDragSession({
        type, slot, pointerId: e.pointerId,
        startClientX: e.clientX, startClientY: e.clientY,
        threshold: e.pointerType === "touch" ? 6 : 3, moved: false,
        startSvgX: pt.x,
        startSvgY: pt.y,
        initialTransform: { ...getTransform(currentEq) },
        geometry: getItemGeometry(currentEq),
      });
    };

    const flushPointer = () => {
      const event = pendingPointer.current;
      pendingPointer.current = null;
      const session = dragSessionRef.current;
      if (!event || !session || event.pointerId !== session.pointerId) return;
      const pt = getSvgCoordinates(event), geom = session.geometry;
      const initial = session.initialTransform;
      const center = { x: geom.cx + initial.dx, y: geom.cy + initial.dy };
      const next = { ...initial };
      if (session.type === "move") {
        next.dx = Math.round(initial.dx + pt.x - session.startSvgX);
        next.dy = Math.round(initial.dy + pt.y - session.startSvgY);
      } else if (session.type === "resize") {
        const distance = Math.hypot(session.startSvgX - center.x, session.startSvgY - center.y);
        const factor = distance > 10 ? Math.hypot(pt.x - center.x, pt.y - center.y) / distance : 1;
        next.scale = Number(Math.max(.05, Math.min(20, initial.scale * factor)).toFixed(2));
      } else {
        const delta = (Math.atan2(pt.y - center.y, pt.x - center.x) - Math.atan2(session.startSvgY - center.y, session.startSvgX - center.x)) * 180 / Math.PI;
        next.rotation = Math.round((initial.rotation + delta) % 360);
      }
      transformsRef.current = { ...transformsRef.current, [session.slot]: next };
      const transform = `translate(${geom.cx + next.dx}, ${geom.cy + next.dy}) rotate(${next.rotation}) scale(${next.scale}) translate(${-geom.cx}, ${-geom.cy})`;
      // Update only the moving SVG groups; persist one document on release.
      svgRef.current?.getElementById(`item-transform-${session.slot}`)?.setAttribute("transform", transform);
      svgRef.current?.getElementById(`selection-overlay-${session.slot}`)?.setAttribute("transform", transform);
      const group = svgRef.current?.getElementById(`item-transform-${session.slot}`);
      if (group?.querySelector(".studio-drag-preview")) group.setAttribute("data-gesture-preview", "true");
    };

    const handlePointerMove = (event: React.PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (!session.moved && Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY) < session.threshold) return;
      session.moved = true;
      event.preventDefault();
      pendingPointer.current = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
      if (!pointerFrame.current) pointerFrame.current = requestAnimationFrame(() => { pointerFrame.current = 0; flushPointer(); });
    };

    const finishGesture = (e?: { pointerId: number }, cancelled = false) => {
      const session = dragSessionRef.current;
      if (!session || (e && e.pointerId !== session.pointerId)) return;
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = 0;
      if (!cancelled) flushPointer();
      pendingPointer.current = null;
      svgRef.current?.getElementById(`item-transform-${session.slot}`)?.removeAttribute("data-gesture-preview");
      if (cancelled) {
        const geom = session.geometry, initial = session.initialTransform;
        const original = `translate(${geom.cx + initial.dx}, ${geom.cy + initial.dy}) rotate(${initial.rotation}) scale(${initial.scale}) translate(${-geom.cx}, ${-geom.cy})`;
        svgRef.current?.getElementById(`item-transform-${session.slot}`)?.setAttribute("transform", original);
        svgRef.current?.getElementById(`selection-overlay-${session.slot}`)?.setAttribute("transform", original);
      }
      setDragSession(null);
      const changes = transformsRef.current;
      if (!cancelled && session.moved && Object.keys(changes).length) {
        onTransformsCommit?.(changes);
      }
      if (cancelled || onTransformsCommit) setTransforms({});
      else renderTransforms(changes);
      if (svgRef.current?.hasPointerCapture(session.pointerId)) svgRef.current.releasePointerCapture(session.pointerId);
    };

    useEffect(() => {
      const handleGlobalPointerUp = (event: PointerEvent) => finishGesture(event);
      const handleBlur = () => finishGesture(undefined, true);
      window.addEventListener("pointerup", handleGlobalPointerUp);
      window.addEventListener("blur", handleBlur);
      return () => {
        window.removeEventListener("pointerup", handleGlobalPointerUp);
        window.removeEventListener("blur", handleBlur);
      };
    }, [dragSession, onTransformsCommit]);

    const resetSlotTransform = (slot: string) => {
      if (lockedSlots.includes(slot)) return;
      if (onTransformsCommit) {
        onTransformsCommit({ [slot]: undefined });
        setTransforms({});
        return;
      }
      const currentEq = equippedItems.find((it) => it.slot === slot);
      if (!currentEq) return;
      const geom = getItemGeometry(currentEq);
      setTransforms((prev) => ({
        ...prev,
        [slot]: {
          dx: geom.defaultDx,
          dy: geom.defaultDy,
          scale: geom.defaultScale,
          rotation: geom.defaultRotation,
        },
      }));
    };

    const resetAllTransforms = () => {
      onTransformsCommit?.(Object.fromEntries(equippedItems.filter(item => !lockedSlots.includes(item.slot)).map(item => [item.slot, undefined])));
      setTransforms({});
      setActiveSlot(null);
    };

    useImperativeHandle(ref, () => ({
      resetAllTransforms,
      previewBackgroundFade: value => {
        const background = containerRef.current?.querySelector<HTMLElement>('[data-testid="board-background"]');
        if (value === null) background?.style.removeProperty("--studio-background-fade");
        else background?.style.setProperty("--studio-background-fade", String(Math.min(100, Math.max(0, value)) / 100));
      },
      exportToBlob: async (ratio: "1:1" | "9:16", options?: { neutralBackground?: boolean }) => {
        if (!svgRef.current) throw new Error("SVG artboard chưa sẵn sàng");
        if (dragSessionRef.current) throw new Error("Thả trang phục trước khi xuất ảnh.");
        const missing = equippedItems.some(item => {
          const url = imageUrlFor(getItemInfo(item.itemId), item.colorHex, item.colorSourceVersion, item.colorAlgorithmVersion);
          return url ? imageErrors[item.itemId] === url : !layers.some(layer => layer.item_id === item.itemId && layer.svg_content);
        });
        if (missing) throw new Error("Một số ảnh trang phục chưa tải được. Đóng hộp thoại và chọn Thử lại ảnh trước khi xuất bản phối hoặc tạo ảnh AI.");
        const pending = equippedItems.some(item => {
          const url = imageUrlFor(getItemInfo(item.itemId), item.colorHex, item.colorSourceVersion, item.colorAlgorithmVersion);
          return url && imageSizes[item.itemId]?.url !== url;
        });
        if (pending) throw new Error("Ảnh trang phục đang tải. Vui lòng đợi ảnh hiển thị đầy đủ rồi thử lại.");

        const resumePreparation = pauseDragPreviewPreparation();
        const artboard = containerRef.current;
        canvasExports.current++;
        artboard?.setAttribute("data-export-preview", "true");
        try {
          const sceneUrl = !options?.neutralBackground && backgroundTheme === "occasion" ? backgroundUrl(occasionId, ratio) : undefined;
          const sceneImage = sceneUrl ? await loadBackground(sceneUrl) : null;
          const neutral = options?.neutralBackground || backgroundTheme === "white" ? "white" : backgroundTheme === "dopaper" ? "dopaper" : neutralBackgroundTheme;
          const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
          svgElement.querySelectorAll('[id^="selection-overlay-"]').forEach(node => node.remove());
          svgElement.querySelectorAll(".studio-drag-preview").forEach(node => node.remove());
          // Keep the detached export at full quality. The inert board behind the
          // dialog uses cached shadows while PNG encoding runs, so backdrop blur
          // and the loading spinner do not repeatedly repaint six SVG filters.
          // SVG used as an image cannot fetch external image references. Embed every
          // asset into a detached snapshot; fail clearly if CORS prevents retrieval.
          await Promise.all(Array.from(svgElement.querySelectorAll("image")).map(async node => {
            const href = node.getAttribute("href") || node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
            if (!href || href.startsWith("data:")) return;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            try {
              const response = await fetch(href, { signal: controller.signal, credentials: "same-origin" });
              if (!response.ok) throw new Error("Không tải được ảnh trang phục để xuất PNG.");
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Không đọc được ảnh trang phục."));
                reader.readAsDataURL(blob);
              });
              node.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
              node.setAttribute("href", dataUrl);
            } catch {
              throw new Error("Không tải được ảnh trang phục để xuất PNG. Kiểm tra kết nối và quyền truy cập ảnh.");
            } finally { clearTimeout(timer); }
          }));
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
          const URL = window.URL || window.webkitURL || window;
          const blobURL = URL.createObjectURL(svgBlob);

          return await new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                const targetWidth = 1400;
                const targetHeight = ratio === "1:1" ? 1400 : 2488;

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  throw new Error("Không thể khởi tạo Canvas 2D context");
                }

                paintBackground(ctx, targetWidth, targetHeight, neutral, sceneImage, backgroundFade);

                const scale = Math.min((targetWidth - 120) / 800, (targetHeight - 240) / 1200);
                const drawW = 800 * scale;
                const drawH = 1200 * scale;
                const dx = (targetWidth - drawW) / 2;
                const dy = (targetHeight - drawH) / 2 + (ratio === "1:1" ? 15 : 35);

                ctx.drawImage(img, dx, dy, drawW, drawH);

                ctx.fillStyle = "#1A202C";
                ctx.font = "bold 34px serif";
                ctx.textAlign = "center";
                const titleText =
                  viewMode === "flatlay"
                    ? "VIỆT PHỤC REMIX • OOTD FLAT-LAY"
                    : "VIỆT PHỤC REMIX • CỔ PHỤC STUDIO";
                ctx.fillText(titleText, targetWidth / 2, targetHeight - (ratio === "1:1" ? 48 : 96));

                ctx.fillStyle = "#718096";
                ctx.font = "20px sans-serif";
                ctx.fillText(
                  "Nền tảng Tôn vinh & Sáng tạo trên nền Di sản Văn hóa Việt Nam",
                  targetWidth / 2,
                  targetHeight - (ratio === "1:1" ? 18 : 55)
                );

                void encodePng(canvas).then(resolve, reject);
              } catch (err) {
                reject(err);
              } finally { URL.revokeObjectURL(blobURL); }
            };
            img.onerror = (e) => {
              URL.revokeObjectURL(blobURL);
              reject(new Error("Lỗi khi kết xuất ảnh canvas: " + e));
            };
            img.src = blobURL;
          });
        } finally {
          if (--canvasExports.current === 0) artboard?.removeAttribute("data-export-preview");
          resumePreparation();
        }
      },
    }));

    const getItemInfo = (itemId: string) => {
      return catalogItems.find((ci) => ci.id === itemId);
    };

    const removeItem = (slot: string) => {
      if (lockedSlots.includes(slot) || dragSessionRef.current) return;
      onRemoveItem?.(slot);
    };

    // Render từng món trang phục
    const renderInteractiveItem = (eq: SnapshotItem) => {
      const dbItem = getItemInfo(eq.itemId);
      const layer = layers.find((l) => l.item_id === eq.itemId);

      const geom = getItemGeometry(eq);
      const t = getTransform(eq);

      const candidateImageUrl = imageUrlFor(dbItem, eq.colorHex, eq.colorSourceVersion, eq.colorAlgorithmVersion);
      const colorLoadFailed = imageErrors[eq.itemId] === candidateImageUrl && Boolean(candidateImageUrl?.includes("color="));
      const garmentImageUrl = imageErrors[eq.itemId] === candidateImageUrl
        ? colorLoadFailed ? imageUrlFor(dbItem) : undefined
        : candidateImageUrl;
      const customHex = eq.colorHex;

      // Tâm quay và co dãn chính xác của món này
      const cx = geom.cx;
      const cy = geom.cy;
      const w = geom.width;
      const h = geom.height;
      const x = geom.x;
      const y = geom.y;

      // Biến đổi SVG: Dời tâm + offset -> Xoay -> Co dãn -> Trả về tâm gốc
      const transformString = `translate(${cx + t.dx}, ${cy + t.dy}) rotate(${t.rotation}) scale(${t.scale}) translate(${-cx}, ${-cy})`;

      return (
        <g key={eq.itemId} id={`interactive-slot-${eq.slot}`}>
          <g id={`item-transform-${eq.slot}`} transform={transformString}>
            {/* Lớp chứa nội dung trang phục: Kéo để di chuyển, Nhấp để chọn */}
            <g
              id={`content-${eq.slot}`}
              data-studio-drag={!lockedSlots.includes(eq.slot)}
              className={`${lockedSlots.includes(eq.slot) ? "cursor-pointer" : "cursor-move"} select-none [&_*]:[touch-action:inherit]`}
              style={{ touchAction: lockedSlots.includes(eq.slot) ? "auto" : "none" }}
              onPointerDown={(e) => startGesture(e, eq.slot, "move")}
            >
              {/* 1. Ảnh thật bóc tách (Cloudflare R2 / Public) */}
              {garmentImageUrl ? (
                <image
                  className="studio-shadow-original"
                  href={garmentImageUrl}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  preserveAspectRatio="xMidYMid meet"
                  filter="url(#flatlayDropShadow)"
                />
              ) : layer?.svg_content ? (
                /* 2. Lớp vẽ SVG */
                <g
                  filter="url(#flatlayDropShadow)"
                  style={{
                    ['--layer-color' as any]: customHex || undefined,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: customHex
                      ? layer.svg_content.replaceAll("VAR_COLOR_PRIMARY", customHex)
                      : layer.svg_content,
                  }}
                />
              ) : null}
            </g>
            {garmentImageUrl && <DragShadowImage url={garmentImageUrl} x={x} y={y} width={w} height={h} />}
          </g>
        </g>
      );
    };

    // Render khung viền chọn, 4 góc kéo phóng to/thu nhỏ và 1 nút xoay duy nhất (Lớp trên cùng)
    const renderSelectionControls = (eq: SnapshotItem) => {
      const dbItem = getItemInfo(eq.itemId);
      const geom = getItemGeometry(eq);
      const t = getTransform(eq);

      const cx = geom.cx;
      const cy = geom.cy;
      const w = geom.width;
      const h = geom.height;
      const x = geom.x;
      const y = geom.y;

      const transformString = `translate(${cx + t.dx}, ${cy + t.dy}) rotate(${t.rotation}) scale(${t.scale}) translate(${-cx}, ${-cy})`;

      // Vị trí nút xoay: đặt bên dưới viền món đồ (cx, y + h + 32).
      // Nếu sát mép dưới canvas (y + h + 45 > 1180) thì chuyển lên trên đỉnh (cx, y - 32).
      const rotateAtBottom = y + h + 45 <= 1180;
      const rotateBtnY = rotateAtBottom ? y + h + 32 : y - 32;
      const stemStartY = rotateAtBottom ? y + h + 6 : y - 6;
      const stemEndY = rotateAtBottom ? rotateBtnY - 15 : rotateBtnY + 15;

      return (
        <g id={`selection-overlay-${eq.slot}`} transform={transformString} className="select-none pointer-events-auto">
          {/* 1. Khung Bounding Box viền đỏ đứt nét */}
          <rect
            x={x - 6}
            y={y - 6}
            width={w + 12}
            height={h + 12}
            rx={6}
            strokeWidth={2}
            strokeDasharray="6 4"
            className="pointer-events-none fill-heritage-red/[0.04] stroke-heritage-red"
          />

          {/* 2. Nhãn tên món đồ */}
          <g transform={`translate(${cx}, ${y - 18})`} className="hidden lg:block pointer-events-none">
            <rect
              x={-75}
              y={-12}
              width={150}
              height={20}
              rx={10}
              fill="#1A202C"
              opacity={0.92}
            />
            <text
              x={0}
              y={0}
              fill="#FFFFFF"
              fontSize={9.5}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {dbItem?.name ? dbItem.name.slice(0, 18) : geom.label}
            </text>
          </g>

          {/* 3. 4 Tay cầm ở 4 góc ảnh: Di chuột đến góc rồi kéo để phóng to / thu nhỏ */}
          {[
            { id: "tl", cx: x - 6, cy: y - 6, cursor: "cursor-nwse-resize" },
            { id: "tr", cx: x + w + 6, cy: y - 6, cursor: "cursor-nesw-resize" },
            { id: "bl", cx: x - 6, cy: y + h + 6, cursor: "cursor-nesw-resize" },
            { id: "br", cx: x + w + 6, cy: y + h + 6, cursor: "cursor-nwse-resize" },
          ].map((corner) => (
            <g
              key={corner.id}
              data-studio-drag={!lockedSlots.includes(eq.slot)}
              transform={`translate(${corner.cx}, ${corner.cy})`}
              className={`${corner.cursor} group hidden lg:block`}
              style={{ touchAction: "none" }}
              onPointerDown={(e) => startGesture(e, eq.slot, "resize")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Nhấn đúp vào góc để trở về cỡ gốc 100%
                if (lockedSlots.includes(eq.slot)) return;
                if (onTransformsCommit) {
                  onTransformsCommit({ [eq.slot]: { ...getTransform(eq), scale: 1 } });
                  return;
                }
                setTransforms((prev) => ({
                  ...prev,
                  [eq.slot]: {
                    ...getTransform(eq),
                    scale: 1,
                  },
                }));
              }}
            >
              {/* Vùng bấm lớn (Hit area) */}
              <circle cx={0} cy={0} r={16} fill="transparent" />
              {/* Chấm tròn tay cầm sắc nét */}
              <circle
                cx={0}
                cy={0}
                r={6.5}
                fill="#FFFFFF"
                strokeWidth={2.2}
                filter="url(#flatlayDropShadow)"
                className="stroke-heritage-red transition-transform group-hover:scale-125"
              />
              <title>Kéo góc để phóng to/thu nhỏ (Nhấn đúp để về 100%)</title>
            </g>
          ))}

          {/* 4. Nút xoay duy nhất: Nhấn giữ và kéo chuột để xoay ảnh */}
          <g className="hidden lg:block">
            {/* Đường gióng đứt nét nối từ viền đến nút xoay */}
            <line
              x1={cx}
              y1={stemStartY}
              x2={cx}
              y2={stemEndY}
              strokeWidth={1.8}
              strokeDasharray="3 3"
              className="pointer-events-none stroke-heritage-red"
            />

            {/* Cụm nút tròn xoay ảnh */}
            <g
              transform={`translate(${cx}, ${rotateBtnY})`}
              data-studio-drag={!lockedSlots.includes(eq.slot)}
              className="hidden lg:block cursor-grab active:cursor-grabbing group"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => startGesture(e, eq.slot, "rotate")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Nhấn đúp để trở về góc 0°
                if (lockedSlots.includes(eq.slot)) return;
                if (onTransformsCommit) {
                  onTransformsCommit({ [eq.slot]: { ...getTransform(eq), rotation: 0 } });
                  return;
                }
                setTransforms((prev) => ({
                  ...prev,
                  [eq.slot]: {
                    ...getTransform(eq),
                    rotation: 0,
                  },
                }));
              }}
            >
              {/* Vùng bấm rộng */}
              <circle cx={0} cy={0} r={22} fill="transparent" />
              {/* Vòng tròn nút xoay */}
              <circle
                cx={0}
                cy={0}
                r={15}
                fill="#FFFFFF"
                className="stroke-heritage-red"
                strokeWidth={2.2}
                filter="url(#flatlayDropShadow)"
              />
              {/* Icon mũi tên xoay tròn */}
              <path
                d="M-5 -2 A5.5 5.5 0 1 1 5 -2 M5 -5.5 L5 -1 L1.5 -2.5"
                fill="none"
                className="stroke-heritage-red"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <title>Nhấn giữ và kéo để xoay ảnh (Nhấn đúp để về 0°)</title>
            </g>
            {onRemoveItem && (
              <g
                transform={`translate(${cx + 48}, ${rotateBtnY})`}
                role="button"
                aria-label="Xóa trang phục khỏi bảng"
                aria-disabled={lockedSlots.includes(eq.slot)}
                tabIndex={lockedSlots.includes(eq.slot) ? -1 : 0}
                className={lockedSlots.includes(eq.slot) ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); removeItem(eq.slot); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    removeItem(eq.slot);
                  }
                }}
              >
                <circle r={22} fill="transparent" />
                <circle r={15} fill="#FFFFFF" className="stroke-heritage-red" strokeWidth={2.2} filter="url(#flatlayDropShadow)" />
                <path d="M-5 -5 L5 5 M5 -5 L-5 5" className="stroke-heritage-red" strokeWidth={2} strokeLinecap="round" />
                <title>{lockedSlots.includes(eq.slot) ? "Mở khóa trang phục để xóa" : "Xóa trang phục khỏi bảng"}</title>
              </g>
            )}
          </g>
        </g>
      );
    };

    const selectedEq = equippedItems.find((it) => it.slot === activeSlot);
    const selectedTransform = selectedEq ? getTransform(selectedEq) : null;
    const selectedLocked = !!selectedEq && lockedSlots.includes(selectedEq.slot);
    const adjustSelected = (patch: Partial<ItemTransform>) => {
      if (!selectedEq || !selectedTransform || selectedLocked || dragSessionRef.current) return;
      const next = { ...selectedTransform, ...patch };
      if (onTransformsCommit) onTransformsCommit({ [selectedEq.slot]: next });
      else setTransforms(previous => ({ ...previous, [selectedEq.slot]: next }));
    };
    const controlButton = "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-2 text-sm font-medium text-stone-800 hover:bg-stone-100 active:bg-stone-200 disabled:opacity-40 touch-manipulation";

    return (
      <div className={`studio-canvas min-w-0 space-y-2 ${className}`}>
      <div className="studio-artboard-stage" style={{
        "--studio-artboard-ratio": aspectRatio === "1:1" ? 1 : 9 / 16,
        "--studio-board-zoom": boardZoom,
      } as React.CSSProperties}>
      <div role="group" aria-label="Thu phóng bảng phối" className="studio-board-zoom">
        <button type="button" aria-label="Thu nhỏ bảng phối" disabled={boardZoom <= 0.5 || !!dragSession}
          onClick={() => changeBoardZoom(boardZoom - 0.25)}><ZoomOut size={16} /></button>
        <output aria-label="Mức thu phóng bảng phối" aria-live="polite">{Math.round(boardZoom * 100)}%</output>
        <button type="button" aria-label="Phóng to bảng phối" disabled={boardZoom >= 4 || !!dragSession}
          onClick={() => changeBoardZoom(boardZoom + 0.25)}><ZoomIn size={16} /></button>
        <button type="button" disabled={!!dragSession} onClick={() => changeBoardZoom(1)} className="studio-board-fit">Vừa khung</button>
      </div>
      <div ref={viewportRef} className="studio-artboard-viewport" data-zoomed={boardZoom > 1}
        role="region" aria-label="Vùng xem bảng phối" tabIndex={0}>
      <div className="studio-artboard-surface">
      <div
        ref={containerRef}
        data-testid="outfit-artboard"
        className={`studio-artboard relative mx-auto flex max-h-[60svh] flex-col items-center justify-center rounded-lg overflow-hidden border border-stone-300 shadow-sm select-none transition-colors duration-300 ${
          backgroundTheme === "white" ? "bg-white" : "bg-[#FAF8F5]"
        }`}
        style={{
          aspectRatio: aspectRatio === "1:1" ? "1 / 1" : "9 / 16",
          cursor:
            dragSession?.type === "rotate"
              ? "grabbing"
              : dragSession?.type === "resize"
              ? "nwse-resize"
              : dragSession?.type === "move"
              ? "move"
              : "default",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onLostPointerCapture={(event) => finishGesture(event, true)}
      >
        <BoardBackground url={backgroundTheme === "occasion" ? backgroundUrl(occasionId, aspectRatio) : undefined}
          neutral={backgroundTheme === "dopaper" ? "dopaper" : backgroundTheme === "white" ? "white" : neutralBackgroundTheme}
          ratio={aspectRatio} backgroundFade={backgroundFade} />

        {/* SVG Artboard chuẩn 800 x 1200 px */}
        <svg
          ref={svgRef}
          viewBox="0 0 800 1200"
          className="w-full h-full object-contain relative z-10"
          style={{ touchAction: boardZoom > 1 ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom" }}
          xmlns="http://www.w3.org/2000/svg"
          onPointerDown={(event) => {
            if (!dragSessionRef.current && event.target === event.currentTarget) setActiveSlot(null);
          }}
        >
          <defs>
            <filter id="flatlayDropShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#1A202C" floodOpacity="0.10" />
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1A202C" floodOpacity="0.06" />
            </filter>
          </defs>

          {/* CHẾ ĐỘ 1: BẢNG PHỐI ĐỒ FLAT-LAY (OOTD COLLAGE) */}
          {viewMode === "flatlay" ? (
            <g id="flatlay-outfit-board">
              {/* Render tất cả các lớp đồ theo thứ tự z-index */}
              {equippedItems
                .slice()
                .sort((a, b) => {
                  const zA = getItemGeometry(a).zIndex;
                  const zB = getItemGeometry(b).zIndex;
                  return zA - zB;
                })
                .map((eq) => renderInteractiveItem(eq))}

              {/* Lớp khung điều khiển của món đang chọn (luôn nằm trên cùng, không bị món khác che khuất) */}
              {selectedEq && renderSelectionControls(selectedEq)}
            </g>
          ) : (
            /* CHẾ ĐỘ 2: NGƯỜI MẪU 2D (AVATAR STUDIO) */
            <g id="avatar-model-studio">
              {avatar?.svg_body && (
                <g id="avatar-base-body" dangerouslySetInnerHTML={{ __html: avatar.svg_body }} />
              )}

              {layers
                .slice()
                .sort((a, b) => a.z_index - b.z_index)
                .map((layer) => {
                  if (!layer.svg_content) return null;
                  const itemConfig = equippedItems.find((it) => it.slot === layer.slot);
                  const customHex = itemConfig?.colorHex;

                  let processedSvg = layer.svg_content;
                  if (customHex) {
                    processedSvg = processedSvg.replaceAll("VAR_COLOR_PRIMARY", customHex);
                  }

                  return (
                    <g
                      key={layer.id}
                      id={`layer-${layer.slot}-${layer.item_id}`}
                      style={{
                        transform: `translate(${layer.anchor_x}px, ${layer.anchor_y}px) scale(${layer.scale_x}, ${layer.scale_y})`,
                        ['--layer-color' as any]: customHex || undefined,
                      }}
                      dangerouslySetInnerHTML={{ __html: processedSvg }}
                    />
                  );
                })}
            </g>
          )}
        </svg>

        {viewMode === "flatlay" && equippedItems.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-serif text-lg font-semibold text-stone-900">Bảng phối đang trống</p>
            <p className="max-w-xs text-sm leading-relaxed text-stone-600">Chọn một món trong danh sách trang phục để thêm vào bảng phối.</p>
            {onBrowseCatalog && (
              <button type="button" onClick={onBrowseCatalog} className="min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700">
                Chọn trang phục
              </button>
            )}
          </div>
        )}

        {equippedItems.some(item => {
          const url = imageUrlFor(getItemInfo(item.itemId), item.colorHex, item.colorSourceVersion, item.colorAlgorithmVersion);
          return Boolean(url && imageErrors[item.itemId] === url);
        }) && (
          <div role="alert" className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 shadow">
            <span>{equippedItems.some(item => imageErrors[item.itemId]?.includes("color=")) ? "Không tải được ảnh đổi màu; canvas đang giữ ảnh gốc. Hãy kiểm tra kết nối, thử lại hoặc khôi phục màu gốc trước khi xuất." : "Không tải được ảnh trang phục. Kiểm tra backend hoặc kết nối rồi thử lại."}</span>
            <button type="button" onClick={() => setImageRetry(value => value + 1)} className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 font-semibold hover:bg-red-100">Thử lại ảnh</button>
          </div>
        )}

        {/* Hướng dẫn tương tác */}
      </div>
      </div>
      </div>
      </div>
      {viewMode === "flatlay" && equippedItems.length > 0 && (
        <section aria-label="Điều chỉnh trang phục" className="studio-transform-controls space-y-2 rounded-xl border border-stone-200 bg-white p-3">
          <div className="studio-selection-row flex items-center gap-2">
            <select aria-label="Trang phục đang điều chỉnh" value={selectedEq?.slot || ""}
              onChange={event => { setActiveSlot(event.target.value); onSelectItem?.(event.target.value); }}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 text-base">
              <option value="" disabled>Chọn món để điều chỉnh</option>
              {equippedItems.map(item => <option key={item.slot} value={item.slot}>{getItemInfo(item.itemId)?.name || getItemGeometry(item).label}{lockedSlots.includes(item.slot) ? " · Đã khóa" : ""}</option>)}
            </select>
            {onToggleLock && <button type="button" disabled={!selectedEq} className={controlButton}
              aria-label={selectedLocked ? "Mở khóa món đang chọn" : "Khóa món đang chọn"} aria-pressed={selectedLocked}
              onClick={() => selectedEq && onToggleLock(selectedEq.slot)}>{selectedLocked ? <Lock size={18} /> : <Unlock size={18} />}</button>}
            {onRemoveItem && <button type="button" disabled={!selectedEq || selectedLocked || !!dragSession}
              className={`${controlButton} lg:hidden`} aria-label="Xóa trang phục khỏi bảng"
              onClick={() => selectedEq && removeItem(selectedEq.slot)}><X size={18} /></button>}
          </div>
          <p data-locked={selectedLocked} className="studio-gesture-hint text-xs leading-relaxed text-stone-600">{selectedLocked ? "Món này đã khóa. Mở khóa để di chuyển, đổi cỡ hoặc xoay." : <><span className="lg:hidden">Kéo một ngón trên món đồ để di chuyển. Vuốt vùng trống để cuộn trang.</span><span className="hidden lg:inline">Kéo để di chuyển · Kéo góc để đổi cỡ · Giữ nút tròn để xoay</span></>}</p>
          <fieldset disabled={!selectedEq || selectedLocked || !!dragSession} className="studio-transform-fields space-y-2">
            <legend className="sr-only">Vị trí, kích thước và góc xoay</legend>
            <div className="studio-transform-values grid grid-cols-2 gap-3">
              <div className="studio-transform-cluster grid grid-cols-[44px_1fr_44px] items-center gap-1">
                <button type="button" className={controlButton} aria-label="Thu nhỏ trang phục" onClick={() => adjustSelected({ scale: Math.max(0.05, Math.round((selectedTransform!.scale / 1.25) * 100) / 100) })}><ZoomOut size={18} /></button>
                <span aria-label="Mức phóng trang phục" className="text-center text-xs tabular-nums">{selectedTransform ? `${Math.round(selectedTransform.scale * 100)}%` : "—"}</span>
                <button type="button" className={controlButton} aria-label="Phóng to trang phục" onClick={() => adjustSelected({ scale: Math.min(20, Math.round((selectedTransform!.scale * 1.25) * 100) / 100) })}><ZoomIn size={18} /></button>
              </div>
              <div className="studio-transform-cluster grid grid-cols-[44px_1fr_44px] items-center gap-1">
                <button type="button" className={controlButton} aria-label="Xoay trái 15 độ" onClick={() => adjustSelected({ rotation: (selectedTransform!.rotation - 15) % 360 })}><RotateCcw size={18} /></button>
                <span aria-label="Góc xoay trang phục" className="text-center text-xs tabular-nums">{selectedTransform ? `${selectedTransform.rotation}°` : "—"}</span>
                <button type="button" className={controlButton} aria-label="Xoay phải 15 độ" onClick={() => adjustSelected({ rotation: (selectedTransform!.rotation + 15) % 360 })}><RotateCw size={18} /></button>
              </div>
            </div>
            <div className="studio-position-actions flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Dịch chuyển từng bước" className="flex gap-2">
                <button type="button" className={controlButton} aria-label="Dịch trái" onClick={() => adjustSelected({ dx: selectedTransform!.dx - 10 })}><ArrowLeft size={18} /></button>
                <button type="button" className={controlButton} aria-label="Dịch lên" onClick={() => adjustSelected({ dy: selectedTransform!.dy - 10 })}><ArrowUp size={18} /></button>
                <button type="button" className={controlButton} aria-label="Dịch xuống" onClick={() => adjustSelected({ dy: selectedTransform!.dy + 10 })}><ArrowDown size={18} /></button>
                <button type="button" className={controlButton} aria-label="Dịch phải" onClick={() => adjustSelected({ dx: selectedTransform!.dx + 10 })}><ArrowRight size={18} /></button>
              </div>
              <button type="button" className={`${controlButton} ml-auto`} aria-label="Đặt lại món đang chọn" onClick={() => selectedEq && resetSlotTransform(selectedEq.slot)}><RefreshCw size={16} /><span>Đặt lại</span></button>
            </div>
          </fieldset>
        </section>
      )}
      </div>
    );
  }
);

Canvas2D.displayName = "Canvas2D";

export default Canvas2D;
