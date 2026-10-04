import type { CatalogItem, Occasion } from "@/lib/types/api";

export const SLOT_LABELS: Record<string, string> = {
  outerwear: "Áo ngoài", undergarment: "Áo lót trong", bottom: "Quần / Váy",
  headwear: "Khăn / Mũ", accessory_front: "Phụ kiện phía trước",
  accessory_back: "Phụ kiện phía sau", footwear: "Giày / Guốc",
};
export const STYLE_LABELS: Record<string, string> = {
  traditional: "Truyền thống", remix: "Remix · kết hợp hiện đại", modern_fusion: "Cách tân hiện đại",
};
const OCCASION_LABELS: Record<string, string> = {
  dao_pho: "Dạo phố & Check-in", bieu_dien: "Biểu diễn nghệ thuật", tet: "Lễ Tết cổ truyền",
  tet_nguyen_dan: "Tết Nguyên Đán", cuoi_hoi: "Lễ cưới & Đính hôn", ky_yeu: "Chụp ảnh kỷ yếu",
  le_hoi_truong: "Lễ hội văn hóa trường", tham_quan_di_san: "Tham quan di sản", tot_nghiep: "Lễ tốt nghiệp",
};
export const slotLabel = (slot: string) => SLOT_LABELS[slot.toLowerCase()] || "Trang phục";
export const styleLabel = (style?: string) => STYLE_LABELS[style || ""] || "Chưa có thông tin phong cách";
export const genderLabel = (gender?: string) => ({ male: "Nam", female: "Nữ", unisex: "Nam và nữ" }[gender?.toLowerCase() || ""] || "Chưa có thông tin đối tượng");
export const itemLabel = (id: string, items: CatalogItem[]) => items.find(item => item.id === id)?.name || "Trang phục không còn trong danh mục";
export const occasionLabel = (id?: string, occasions: Occasion[] = []) => !id ? "Chưa chọn hoàn cảnh" : occasions.find(occasion => occasion.id === id)?.name || OCCASION_LABELS[id] || "Hoàn cảnh khác";
export function eraLabel(era?: string) {
  const value = era?.trim();
  return !value || /^(?:x|unknown|n\/a|-|—)$/i.test(value) ? "Chưa có thông tin niên đại" : value;
}
