"use client";

import { Upload, LoaderCircle } from "lucide-react";
import type { CatalogItem } from "@/lib/types/api";
import { slotLabel } from "@/lib/catalog/display";
import { SESSION_GARMENT_LIMIT } from "./sessionGarments";
import type { useSessionGarments } from "./useSessionGarments";

export default function SessionGarmentUpload({ library, slot, onSlotChange, onSelect, lockedSlots, equippedIds, signedIn, onLogin }: {
  library: ReturnType<typeof useSessionGarments>; slot: string; onSlotChange: (slot: string) => void;
  onSelect: (item: CatalogItem) => void; lockedSlots: Set<string>; equippedIds: string[];
  signedIn: boolean; onLogin: () => void;
}) {
  return <section className="studio-session-upload" aria-label="Ảnh trang phục của bạn">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Ảnh của bạn</h3><span className="text-xs text-stone-500">{library.items.length}/{SESSION_GARMENT_LIMIT}</span></div>
    <p className="text-xs leading-relaxed text-stone-600">Tự động tách nền để phối và xuất PNG. Chỉ giữ trong phiên này; tải lại trang, đóng tab hoặc đăng xuất sẽ xóa ảnh.</p>
    {signedIn ? <>
      <label className="grid gap-1 text-xs font-medium">Vị trí ảnh tải lên
        <select aria-label="Vị trí ảnh tải lên" value={slot} onChange={event => onSlotChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-2">
          {["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "footwear"].map(value => <option key={value} value={value}>{slotLabel(value)}</option>)}
        </select>
      </label>
      <label className="studio-session-upload-button" data-disabled={library.uploading || library.items.length >= SESSION_GARMENT_LIMIT}>
        {library.uploading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
        <span>{library.uploading ? "Đang tách nền…" : "Tải ảnh trang phục"}</span>
        <input type="file" aria-label="Tải ảnh trang phục" accept="image/png,image/jpeg,image/webp" disabled={library.uploading || library.items.length >= SESSION_GARMENT_LIMIT}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void library.upload(file, slot); }} />
      </label>
      <p className="text-[11px] text-stone-500">PNG, JPG, WebP · tối đa 10 MB/ảnh</p>
      {library.uploading && <div role="status" className="flex items-center justify-between gap-2 text-xs"><span>Đang xử lý ảnh của bạn…</span><button type="button" onClick={library.cancel} className="min-h-11 px-3 underline">Hủy</button></div>}
    </> : <button type="button" onClick={onLogin} className="studio-session-login"><Upload size={18} aria-hidden="true" />Đăng nhập để tải ảnh</button>}
    {library.error && <p role="alert" className="text-xs leading-relaxed text-red-800">{library.error}</p>}
    {library.items.length > 0 && <div className="studio-session-garments">
      {library.items.map(item => <button key={item.id} type="button" aria-label={`Chọn ảnh cá nhân ${item.name}`} aria-pressed={equippedIds.includes(item.id)} disabled={lockedSlots.has(item.slot)} onClick={() => onSelect(item)}>
        {/* Blob URLs belong to this tab; image optimization must not fetch them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.metadata.real_image_url} alt={item.name} width={64} height={64} />
        <span className="min-w-0"><strong className="block break-words text-xs">{item.name}</strong><span className="text-[11px] text-stone-500">{slotLabel(item.slot)} · trong phiên{lockedSlots.has(item.slot) ? " · đã khóa" : ""}</span></span>
      </button>)}
    </div>}
  </section>;
}
