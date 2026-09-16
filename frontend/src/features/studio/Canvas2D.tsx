"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Avatar, AssetLayer, SnapshotItem, CatalogItem } from "@/lib/types/api";
import {
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Move,
  X,
} from "lucide-react";

export interface Canvas2DHandle {
  exportToDataUrl: (aspectRatio: "1:1" | "9:16") => Promise<string>;
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
  backgroundTheme?: "white" | "dopaper";
  selectedSlot?: string | null;
  onSelectItem?: (slot: string) => void;
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
      aspectRatio = "9:16",
      viewMode = "flatlay",
      backgroundTheme = "white",
      selectedSlot: externalSelectedSlot,
      onSelectItem,
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    // Quản lý slot đang được chọn
    const [activeSlot, setActiveSlot] = useState<string | null>(externalSelectedSlot || null);

    useEffect(() => {
      if (externalSelectedSlot !== undefined) {
        setActiveSlot(externalSelectedSlot);
      }
    }, [externalSelectedSlot]);

    // Trạng thái biến đổi của từng slot (dx, dy, scale, rotation)
    const [transforms, setTransforms] = useState<Record<string, ItemTransform>>({});

    // Trạng thái kéo chuột đang diễn ra
    const [dragSession, setDragSession] = useState<{
      type: "move" | "resize" | "rotate";
      slot: string;
      startSvgX: number;
      startSvgY: number;
      initialTransform: ItemTransform;
    } | null>(null);

    // Trạng thái ẩn khung chọn khi xuất ảnh
    const [isExporting, setIsExporting] = useState(false);

    // Lấy thông số hình học chuẩn của món đồ
    const getItemGeometry = (eq: SnapshotItem): ItemGeometry => {
      if (ITEM_GEOMETRIES[eq.itemId]) return ITEM_GEOMETRIES[eq.itemId];
      return DEFAULT_SLOT_GEOMETRY[eq.slot] || DEFAULT_SLOT_GEOMETRY.outerwear;
    };

    // Lấy transform hiện hành của món đồ
    const getTransform = (eq: SnapshotItem): ItemTransform => {
      if (transforms[eq.slot]) return transforms[eq.slot];
      const geom = getItemGeometry(eq);
      return {
        dx: geom.defaultDx,
        dy: geom.defaultDy,
        scale: geom.defaultScale,
        rotation: geom.defaultRotation,
      };
    };

    // Quy đổi tọa độ chuột sang tọa độ viewBox (800 x 1200) của SVG
    const getSvgCoordinates = (e: React.PointerEvent | PointerEvent) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 1200 / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    // Bắt đầu kéo di chuyển
    const handlePointerDownMove = (e: React.PointerEvent, slot: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActiveSlot(slot);
      onSelectItem?.(slot);

      const pt = getSvgCoordinates(e);
      const currentEq = equippedItems.find((it) => it.slot === slot);
      if (!currentEq) return;

      setDragSession({
        type: "move",
        slot,
        startSvgX: pt.x,
        startSvgY: pt.y,
        initialTransform: { ...getTransform(currentEq) },
      });
    };

    // Bắt đầu kéo tay cầm co dãn (Resize)
    const handlePointerDownResize = (e: React.PointerEvent, slot: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      const pt = getSvgCoordinates(e);
      const currentEq = equippedItems.find((it) => it.slot === slot);
      if (!currentEq) return;

      setDragSession({
        type: "resize",
        slot,
        startSvgX: pt.x,
        startSvgY: pt.y,
        initialTransform: { ...getTransform(currentEq) },
      });
    };

    // Bắt đầu kéo tay cầm xoay (Rotate)
    const handlePointerDownRotate = (e: React.PointerEvent, slot: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      const pt = getSvgCoordinates(e);
      const currentEq = equippedItems.find((it) => it.slot === slot);
      if (!currentEq) return;

      setDragSession({
        type: "rotate",
        slot,
        startSvgX: pt.x,
        startSvgY: pt.y,
        initialTransform: { ...getTransform(currentEq) },
      });
    };

    // Xử lý di chuyển chuột khi đang kéo
    const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragSession) return;
      e.preventDefault();

      const pt = getSvgCoordinates(e);
      const currentEq = equippedItems.find((it) => it.slot === dragSession.slot);
      if (!currentEq) return;

      const geom = getItemGeometry(currentEq);
      const center = {
        x: geom.cx + dragSession.initialTransform.dx,
        y: geom.cy + dragSession.initialTransform.dy,
      };

      if (dragSession.type === "move") {
        const deltaX = pt.x - dragSession.startSvgX;
        const deltaY = pt.y - dragSession.startSvgY;

        setTransforms((prev) => ({
          ...prev,
          [dragSession.slot]: {
            ...dragSession.initialTransform,
            dx: Math.round(dragSession.initialTransform.dx + deltaX),
            dy: Math.round(dragSession.initialTransform.dy + deltaY),
          },
        }));
      } else if (dragSession.type === "resize") {
        const initialDist = Math.hypot(
          dragSession.startSvgX - center.x,
          dragSession.startSvgY - center.y
        );
        const currentDist = Math.hypot(pt.x - center.x, pt.y - center.y);
        const factor = initialDist > 10 ? currentDist / initialDist : 1.0;
        const newScale = Math.max(0.3, Math.min(2.5, dragSession.initialTransform.scale * factor));

        setTransforms((prev) => ({
          ...prev,
          [dragSession.slot]: {
            ...dragSession.initialTransform,
            scale: parseFloat(newScale.toFixed(2)),
          },
        }));
      } else if (dragSession.type === "rotate") {
        const initialAngle =
          Math.atan2(dragSession.startSvgY - center.y, dragSession.startSvgX - center.x) *
          (180 / Math.PI);
        const currentAngle =
          Math.atan2(pt.y - center.y, pt.x - center.x) * (180 / Math.PI);
        const angleDiff = currentAngle - initialAngle;
        const newRotation = (dragSession.initialTransform.rotation + angleDiff) % 360;

        setTransforms((prev) => ({
          ...prev,
          [dragSession.slot]: {
            ...dragSession.initialTransform,
            rotation: Math.round(newRotation),
          },
        }));
      }
    };

    const handlePointerUp = () => {
      setDragSession(null);
    };

    useEffect(() => {
      const handleGlobalPointerUp = () => {
        if (dragSession) setDragSession(null);
      };
      window.addEventListener("pointerup", handleGlobalPointerUp);
      return () => window.removeEventListener("pointerup", handleGlobalPointerUp);
    }, [dragSession]);

    const resetSlotTransform = (slot: string) => {
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
      setTransforms({});
      setActiveSlot(null);
    };

    useImperativeHandle(ref, () => ({
      resetAllTransforms,
      exportToDataUrl: async (ratio: "1:1" | "9:16") => {
        if (!svgRef.current) throw new Error("SVG artboard chưa sẵn sàng");

        setIsExporting(true);
        await new Promise((r) => setTimeout(r, 50));

        try {
          const svgElement = svgRef.current;
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
          const URL = window.URL || window.webkitURL || window;
          const blobURL = URL.createObjectURL(svgBlob);

          return await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const targetWidth = 1400;
              const targetHeight = ratio === "1:1" ? 1400 : 2488;

              canvas.width = targetWidth;
              canvas.height = targetHeight;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("Không thể khởi tạo Canvas 2D context"));
                return;
              }

              if (backgroundTheme === "white") {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, targetWidth, targetHeight);
              } else {
                ctx.fillStyle = "#FAF8F5";
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                ctx.strokeStyle = "rgba(214, 158, 46, 0.35)";
                ctx.lineWidth = 10;
                ctx.strokeRect(28, 28, targetWidth - 56, targetHeight - 56);
              }

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

              URL.revokeObjectURL(blobURL);
              resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = (e) => {
              URL.revokeObjectURL(blobURL);
              reject(new Error("Lỗi khi kết xuất ảnh canvas: " + e));
            };
            img.src = blobURL;
          });
        } finally {
          setIsExporting(false);
        }
      },
    }));

    const getItemInfo = (itemId: string) => {
      return catalogItems.find((ci) => ci.id === itemId);
    };

    // Render từng món trang phục
    const renderInteractiveItem = (eq: SnapshotItem) => {
      const dbItem = getItemInfo(eq.itemId);
      const layer = layers.find((l) => l.item_id === eq.itemId);

      const geom = getItemGeometry(eq);
      const t = getTransform(eq);

      const realImageUrl = (dbItem?.metadata as any)?.real_image_url;
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
          <g transform={transformString}>
            {/* Lớp chứa nội dung trang phục: Kéo để di chuyển, Nhấp để chọn */}
            <g
              id={`content-${eq.slot}`}
              className="cursor-move select-none"
              onPointerDown={(e) => handlePointerDownMove(e, eq.slot)}
            >
              {/* 1. Ảnh thật bóc tách (Cloudflare R2 / Public) */}
              {realImageUrl ? (
                <image
                  href={
                    realImageUrl.includes(".png") && !realImageUrl.includes("_transparent")
                      ? realImageUrl.replace(".png", "_transparent.png")
                      : realImageUrl
                  }
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
                      ? layer.svg_content
                          .replaceAll("VAR_COLOR_PRIMARY", customHex)
                          .replaceAll("#1A365D", customHex)
                      : layer.svg_content,
                  }}
                />
              ) : null}
            </g>
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
            fill="rgba(155, 44, 44, 0.04)"
            stroke="#9B2C2C"
            strokeWidth={2}
            strokeDasharray="6 4"
            className="pointer-events-none"
          />

          {/* 2. Nhãn tên món đồ */}
          <g transform={`translate(${cx}, ${y - 18})`} className="pointer-events-none">
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
              transform={`translate(${corner.cx}, ${corner.cy})`}
              className={`${corner.cursor} group`}
              onPointerDown={(e) => handlePointerDownResize(e, eq.slot)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Nhấn đúp vào góc để trở về cỡ gốc 100%
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
                stroke="#9B2C2C"
                strokeWidth={2.2}
                filter="url(#flatlayDropShadow)"
                className="transition-transform group-hover:scale-125"
              />
              <title>Kéo góc để phóng to/thu nhỏ (Nhấn đúp để về 100%)</title>
            </g>
          ))}

          {/* 4. Nút xoay duy nhất: Nhấn giữ và kéo chuột để xoay ảnh */}
          <g>
            {/* Đường gióng đứt nét nối từ viền đến nút xoay */}
            <line
              x1={cx}
              y1={stemStartY}
              x2={cx}
              y2={stemEndY}
              stroke="#9B2C2C"
              strokeWidth={1.8}
              strokeDasharray="3 3"
              className="pointer-events-none"
            />

            {/* Cụm nút tròn xoay ảnh */}
            <g
              transform={`translate(${cx}, ${rotateBtnY})`}
              className="cursor-grab active:cursor-grabbing group hover:scale-115 transition-transform"
              onPointerDown={(e) => handlePointerDownRotate(e, eq.slot)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Nhấn đúp để trở về góc 0°
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
                stroke="#9B2C2C"
                strokeWidth={2.2}
                filter="url(#flatlayDropShadow)"
              />
              {/* Icon mũi tên xoay tròn */}
              <path
                d="M-5 -2 A5.5 5.5 0 1 1 5 -2 M5 -5.5 L5 -1 L1.5 -2.5"
                fill="none"
                stroke="#9B2C2C"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <title>Nhấn giữ và kéo để xoay ảnh (Nhấn đúp để về 0°)</title>
            </g>
          </g>
        </g>
      );
    };

    const selectedEq = equippedItems.find((it) => it.slot === activeSlot);
    const selectedItemInfo = selectedEq ? getItemInfo(selectedEq.itemId) : null;
    const selectedTransform = selectedEq ? getTransform(selectedEq) : null;

    return (
      <div
        ref={containerRef}
        className={`relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border border-stone-300 shadow-sm select-none transition-colors duration-300 ${
          backgroundTheme === "white" ? "bg-white" : "bg-[#FAF8F5]"
        } ${className}`}
        style={{
          aspectRatio: aspectRatio === "1:1" ? "1 / 1" : "9 / 16",
          maxHeight: "82vh",
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
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Nền giấy dó nếu bật theme dopaper */}
        {backgroundTheme === "dopaper" && (
          <div className="absolute inset-0 bg-radial from-amber-50/70 to-stone-200/50 pointer-events-none" />
        )}

        {/* SVG Artboard chuẩn 800 x 1200 px */}
        <svg
          ref={svgRef}
          viewBox="0 0 800 1200"
          className="w-full h-full object-contain relative z-10"
          xmlns="http://www.w3.org/2000/svg"
          onPointerDown={() => {
            if (!dragSession) setActiveSlot(null);
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
              {selectedEq && !isExporting && renderSelectionControls(selectedEq)}
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
                    if (layer.slot === "outerwear" && customHex) {
                      processedSvg = processedSvg.replaceAll("#1A365D", customHex);
                    }
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

        {/* Hướng dẫn tương tác */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-1.5 bg-stone-900/75 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-lg font-sans pointer-events-none shadow-xs">
          <Move className="w-3 h-3 text-emerald-400" />
          <span>Kéo để di chuyển • Kéo 4 góc để phóng to/thu nhỏ • Giữ nút tròn để xoay</span>
        </div>

        {/* Huy hiệu chế độ */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center space-x-1.5 bg-stone-900/80 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-lg font-mono shadow-xs pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{viewMode === "flatlay" ? "Bảng Phối Flat-Lay" : "Người Mẫu 2D"}</span>
        </div>
      </div>
    );
  }
);

Canvas2D.displayName = "Canvas2D";

export default Canvas2D;
