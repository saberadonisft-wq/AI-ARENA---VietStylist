"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ImageOff } from "lucide-react";
import type { CatalogItem } from "@/lib/types/api";
import { genders, slotLabels } from "./filters";

function GarmentImage({ item, priority }: { item: CatalogItem; priority: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = item.metadata?.real_image_url;
  if (url && !failed) return <img src={url} alt={item.name} loading={priority ? "eager" : "lazy"} decoding="async"
    onError={() => setFailed(true)} className="h-full w-full object-contain" />;
  if (item.default_layer?.svg_content) return <svg aria-label={item.name} role="img" viewBox="0 0 800 1200"
    className="h-full w-full" dangerouslySetInnerHTML={{ __html: item.default_layer.svg_content }} />;
  return <span className="flex flex-col items-center gap-3 text-sm text-stone-500"><ImageOff aria-hidden="true" className="h-8 w-8" />{failed ? "Ảnh tạm thời chưa tải được" : "Chưa có ảnh trang phục"}</span>;
}

export default function LibraryCard({ item, priority, returnTo, rememberPosition }: {
  item: CatalogItem; priority: boolean; returnTo: string; rememberPosition: () => void;
}) {
  const gender = genders.find(g => g.id === item.gender?.toLowerCase() && g.id !== "all")?.label;
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
    <Link href={`/trang-phuc/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(returnTo)}`} onClick={rememberPosition}
      className="group block rounded-t-2xl focus-visible:outline-offset-[-4px]" aria-label={`Xem chi tiết ${item.name}`}>
      <div className="flex aspect-[4/3] items-center justify-center bg-heritage-parchment p-2">
        <GarmentImage key={item.metadata?.real_image_url || item.id} item={item} priority={priority} />
      </div>
      <div className="space-y-2 px-5 pt-5">
        <h2 className="break-words font-serif text-lg font-bold leading-relaxed text-stone-900 group-hover:text-heritage-red">{item.name}</h2>
        <p className="text-sm text-stone-600">{slotLabels[item.slot.toLowerCase()] || "Trang phục"}{gender && ` · ${gender}`}</p>
        {item.description?.trim() && (
          <p className="line-clamp-2 break-words text-sm leading-relaxed text-stone-600">
            {item.description.trim()}
          </p>
        )}
      </div>
    </Link>
    <div className="mt-auto space-y-4 p-5 pt-4">
      {item.variants.length > 1 && <div className="flex items-center gap-2 text-sm text-stone-600">
        <div className="flex gap-1.5" aria-hidden="true">{item.variants.slice(0, 4).map(v => <span key={v.id} className="h-4 w-4 rounded-full border border-stone-300" style={{ backgroundColor: v.hex_color }} />)}</div>
        <span>{item.variants.length} màu</span>
      </div>}
      <Link href={`/studio?itemId=${encodeURIComponent(item.id)}`} onClick={rememberPosition} aria-label={`Phối đồ với ${item.name}`}
        className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-heritage-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-heritage-red-dark active:bg-heritage-red-dark">
        Phối đồ <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  </article>;
}
