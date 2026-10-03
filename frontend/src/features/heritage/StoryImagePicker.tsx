"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export interface DraftStoryImage {
  id: string;
  file?: File;
  name: string;
  preview: string;
  caption: string;
  uploaded?: { media_id: string; url: string };
}

export default function StoryImagePicker({ images, onChange, disabled }: {
  images: DraftStoryImage[];
  onChange: (images: DraftStoryImage[]) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <section aria-label="Ảnh tư liệu minh họa" className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:p-4">
      <div>
        <h4 className="text-sm font-semibold text-stone-900">Ảnh tư liệu minh họa <span className="font-normal text-stone-500">({images.length}/12)</span></h4>
        <p id="story-image-help" className="mt-1 text-xs leading-relaxed text-stone-600">Chọn nhiều ảnh JPG, PNG hoặc WebP, tối đa 10 MB/ảnh. Ảnh đầu tiên dùng làm bìa nếu bạn không nhập đường dẫn riêng. Ảnh sẽ công khai khi tải lên để xuất bản.</p>
      </div>
      <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-400 bg-white px-3 py-3 text-sm font-medium text-heritage-red focus-within:ring-2 focus-within:ring-heritage-red ${disabled ? "opacity-50" : "hover:bg-red-50"}`}>
        <ImagePlus className="h-5 w-5" aria-hidden="true" />
        <span>Chọn ảnh từ máy</span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Chọn ảnh tư liệu" aria-describedby="story-image-help" disabled={disabled} className="sr-only" onChange={event => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          setError("");
          if (images.length + files.length > 12) { setError("Mỗi câu chuyện tối đa 12 ảnh. Hãy chọn ít ảnh hơn."); return; }
          const invalid = files.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024);
          if (invalid) { setError(`“${invalid.name}” cần là ảnh JPG, PNG hoặc WebP và không quá 10 MB.`); return; }
          onChange([...images, ...files.map(file => ({ id: crypto.randomUUID(), file, name: file.name, preview: URL.createObjectURL(file), caption: "" }))]);
        }} />
      </label>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <div key={image.id} className="min-w-0 space-y-2 rounded-xl border border-stone-200 bg-white p-2">
            <img src={image.preview} alt={`Ảnh minh họa ${index + 1}`} className="h-40 w-full rounded-lg bg-stone-100 object-contain" />
            <p className="truncate text-xs text-stone-500" title={image.name}>{image.name}</p>
            <label className="block text-xs text-stone-700">Chú thích / nguồn ảnh {index + 1}
              <textarea value={image.caption} maxLength={500} rows={2} disabled={disabled} onChange={event => onChange(images.map(item => item.id === image.id ? { ...item, caption: event.target.value } : item))} placeholder="Ví dụ: Áo Nhật Bình, tư liệu bảo tàng..." className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-xs" />
            </label>
            <div className="flex items-center justify-between gap-2">
              <button type="button" disabled={disabled || index === 0} onClick={() => onChange([image, ...images.filter(item => item.id !== image.id)])} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-heritage-red disabled:text-stone-500">{index === 0 ? "Ảnh đầu / bìa mặc định" : "Dùng làm ảnh bìa"}</button>
              <button type="button" aria-label={`Bỏ ảnh ${index + 1}`} disabled={disabled} onClick={() => onChange(images.filter(item => item.id !== image.id))} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
