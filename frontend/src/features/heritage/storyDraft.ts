import { api } from "@/lib/api/client";
import type { DraftStoryImage } from "./StoryImagePicker";

export function validateStoryText(title: string, summary: string, content: string, cover: string) {
  const errors: Record<string, string> = {};
  const length = (text: string) => Array.from(text.trim()).length;
  if (length(title) < 3 || length(title) > 255) errors.title = "Tiêu đề cần từ 3 đến 255 ký tự.";
  if (length(summary) < 10) errors.short_summary = "Tóm tắt cần ít nhất 10 ký tự.";
  if (length(content) < 20) errors.full_content = "Nội dung cần ít nhất 20 ký tự.";
  if (cover.trim()) {
    try {
      if (!["https:", "http:"].includes(new URL(cover.trim()).protocol)) throw new Error();
    } catch { errors.cover_image_url = "Đường dẫn ảnh bìa cần là URL http hoặc https hợp lệ."; }
  }
  return errors;
}

/** Keep order and successful results when a sibling fails. At most two PUTs
 * run together; all in-flight uploads settle before the editor is unlocked. */
export async function uploadStoryDraftImages(
  images: DraftStoryImage[],
  onChange: (images: DraftStoryImage[]) => void,
  onProgress: (message: string) => void,
) {
  const result = [...images];
  const pending = result.map((image, index) => ({ image, index })).filter(({ image }) => !image.uploaded && image.file);
  let next = 0;
  let completed = 0;
  let failed = false;
  let failure: unknown;
  const worker = async () => {
    while (!failed && next < pending.length) {
      const { image, index } = pending[next++];
      try {
        onProgress(`Đang tải ảnh (${completed}/${pending.length} hoàn tất)...`);
        const uploaded = await api.uploadStoryImage(image.file!);
        result[index] = { ...image, uploaded };
        completed++;
        onChange([...result]);
        onProgress(`Đang tải ảnh (${completed}/${pending.length} hoàn tất)...`);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
  if (failed) throw failure;
  return result;
}
