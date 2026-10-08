import type { OutfitSnapshot } from "@/lib/types/api";

export const SESSION_GARMENT_PREFIX = "session-upload:";
export const SESSION_GARMENT_LIMIT = 12;
export const SESSION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const isSessionGarment = (id: string) => id.startsWith(SESSION_GARMENT_PREFIX);
export const hasSessionGarments = (snapshot: OutfitSnapshot) => snapshot.items.some(item => isSessionGarment(item.itemId));
export const SESSION_SAVE_NOTICE = "Bộ phối có ảnh chỉ dùng trong phiên. Bạn có thể xuất PNG; hãy bỏ các ảnh này trước khi lưu vào Tủ đồ, đăng Lookbook hoặc thử đồ AI.";
