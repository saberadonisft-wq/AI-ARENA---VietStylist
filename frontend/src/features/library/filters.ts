import type { CatalogItem } from "@/lib/types/api";

export const groups = [
  { id: "all", label: "Tất cả" }, { id: "tops", label: "Áo" },
  { id: "bottoms", label: "Quần / Váy" }, { id: "accessories", label: "Phụ kiện" },
] as const;
export const genders = [
  { id: "all", label: "Tất cả" }, { id: "male", label: "Nam" },
  { id: "female", label: "Nữ" }, { id: "unisex", label: "Nam và nữ" },
] as const;
export const slotLabels: Record<string, string> = {
  outerwear: "Áo khoác", undergarment: "Áo mặc trong", top: "Áo", bottom: "Quần / Váy",
  headwear: "Mũ / Khăn", footwear: "Giày / Dép", accessory: "Phụ kiện", accessories: "Phụ kiện",
  accessory_front: "Phụ kiện trước", accessory_back: "Phụ kiện sau",
};
export type LibraryFilters = { q: string; group: string; gender: string; type: string };
export const emptyFilters: LibraryFilters = { q: "", group: "all", gender: "all", type: "all" };
export const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim().replace(/\s+/g, " ");

export function matchesFilters(item: CatalogItem, filters: LibraryFilters) {
  const slot = item.slot.toLowerCase();
  const group = ["outerwear", "undergarment", "top"].includes(slot) ? "tops" : slot === "bottom" ? "bottoms" : "accessories";
  return (filters.group === "all" || filters.group === group)
    && (filters.gender === "all" || item.gender?.toLowerCase() === filters.gender)
    && (filters.type === "all" || item.garment_type_id === filters.type)
    && normalizeSearch(item.name).includes(normalizeSearch(filters.q));
}
