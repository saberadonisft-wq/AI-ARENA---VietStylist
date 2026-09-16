import type { OutfitSnapshot, SnapshotItem } from "@/lib/types/api";

export const DRAFT_KEY = "viet_stylist_current_draft";
export interface StudioDocument { title: string; snapshot: OutfitSnapshot }
export interface StudioDraft extends StudioDocument {
  outfitId?: string;
  revision?: number;
}
export interface StudioHistory {
  past: StudioDocument[];
  present: StudioDocument;
  future: StudioDocument[];
}

export function sameDocument(left: StudioDocument, right: StudioDocument): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
        .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])
    );
    return value;
  };
  return JSON.stringify(canonical({ title: left.title, snapshot: left.snapshot })) === JSON.stringify(canonical({ title: right.title, snapshot: right.snapshot }));
}
export const INITIAL_DOCUMENT: StudioDocument = {
  title: "Bản phối Kỷ yếu Cổ phong",
  snapshot: {
    schemaVersion: 1, avatarId: "avatar_nam_chuan", poseId: "front_01",
    occasionId: "ky_yeu", styleMode: "traditional", overlapDirection: "right_over_left",
    lockedSlots: [], backgroundTheme: "white", aspectRatio: "9:16",
    items: [
      { slot: "outerwear", itemId: "item_ngu_than_nam_xanh", variantId: "var_ngu_than_nam_xanh_cham", assetVersion: 1, colorHex: "#1A365D" },
      { slot: "undergarment", itemId: "item_ao_lot_trang", variantId: "var_ao_lot_trang", assetVersion: 1, colorHex: "#FFFFFF" },
      { slot: "bottom", itemId: "item_quan_trang_lua", variantId: "var_quan_trang", assetVersion: 1, colorHex: "#FFFFFF" },
      { slot: "headwear", itemId: "item_khan_van_den", variantId: "var_khan_van_den", assetVersion: 1, colorHex: "#171923" },
      { slot: "accessory_front", itemId: "item_quat_xep_giay_do", variantId: "var_quat_xep", assetVersion: 1, colorHex: "#9C4221" },
      { slot: "footwear", itemId: "item_guoc_moc_quai_nhung", variantId: "var_guoc_moc", assetVersion: 1, colorHex: "#4A5568" },
    ],
  },
};

export type StudioAction =
  | { type: "commit"; update: (current: StudioDocument) => StudioDocument }
  | { type: "replace"; document: StudioDocument }
  | { type: "undo" }
  | { type: "redo" };

export function studioReducer(state: StudioHistory, action: StudioAction): StudioHistory {
  if (action.type === "replace") return { past: [], present: action.document, future: [] };
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  const next = action.update(state.present);
  if (sameDocument(next, state.present)) return state;
  return { past: [...state.past.slice(-99), state.present], present: next, future: [] };
}

// Preserve the complete locked item, including custom color and canvas placement.
export function mergeUnlockedItems(current: SnapshotItem[], incoming: SnapshotItem[], lockedSlots: string[]): SnapshotItem[] {
  const locked = new Set(lockedSlots);
  return [...incoming.filter(item => !locked.has(item.slot)), ...current.filter(item => locked.has(item.slot))];
}

export function parseDraft(raw: string | null): StudioDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const snap = data?.snapshot;
    if (!snap || !Array.isArray(snap.items) || !snap.items.every((item: SnapshotItem) =>
      item && typeof item.slot === "string" && typeof item.itemId === "string" &&
      (!item.transform || ([item.transform.dx, item.transform.dy, item.transform.scale, item.transform.rotation].every(Number.isFinite) && item.transform.scale > 0))
    )) return null;
    if (new Set(snap.items.map((item: SnapshotItem) => item.slot)).size !== snap.items.length) return null;
    const snapshot = { ...INITIAL_DOCUMENT.snapshot, ...snap };
    if (!["traditional", "remix", "modern_fusion"].includes(snapshot.styleMode) ||
        !["right_over_left", "left_over_right"].includes(snapshot.overlapDirection) ||
        typeof snapshot.avatarId !== "string" || typeof snapshot.poseId !== "string") return null;
    snapshot.lockedSlots = Array.isArray(snap.lockedSlots) ? snap.lockedSlots.filter((s: unknown) => typeof s === "string") : [];
    snapshot.backgroundTheme = snap.backgroundTheme === "dopaper" ? "dopaper" : "white";
    snapshot.aspectRatio = snap.aspectRatio === "1:1" ? "1:1" : "9:16";
    return { title: typeof data.title === "string" ? data.title : INITIAL_DOCUMENT.title, snapshot,
      outfitId: typeof data.outfitId === "string" ? data.outfitId : undefined,
      revision: Number.isInteger(data.revision) && data.revision > 0 ? data.revision : undefined };
  } catch { return null; }
}
