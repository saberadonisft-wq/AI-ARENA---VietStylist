"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ImageOff, Layers } from "lucide-react";
import { useNearViewport } from "@/lib/hooks/useNearViewport";
import type { CatalogItem, OutfitResponse } from "@/lib/types/api";

const Canvas2D = dynamic(() => import("./Canvas2D"), {
  loading: () => <p role="status" className="text-sm text-stone-500">Đang tải ảnh bộ phối…</p>,
});

interface OutfitPreviewProps {
  outfit: OutfitResponse;
  catalogItems: CatalogItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  onRetryCatalog: () => void;
}

export default function OutfitPreview(props: OutfitPreviewProps) {
  const { ref, isNearViewport } = useNearViewport<HTMLElement>();
  return <figure ref={ref} aria-label={`Ảnh bộ phối ${props.outfit.title}`} className="border-b border-stone-100">
    {isNearViewport ? <OutfitPreviewContent {...props} /> : (
      <div className="h-72 bg-stone-100/70 sm:h-80" aria-hidden="true" />
    )}
  </figure>;
}

function OutfitPreviewContent({ outfit, catalogItems, catalogLoading, catalogError, onRetryCatalog }: OutfitPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [outfit.preview_image_url]);
  const snapshot = outfit.current_snapshot;
  const items = snapshot?.items || [];
  const available = items.filter(item => catalogItems.some(candidate => candidate.id === item.itemId && (
    candidate.metadata?.catalog_media_id || candidate.metadata?.flatlay_image_url ||
    candidate.metadata?.real_image_url || candidate.default_layer?.svg_content
  )));
  const missingCount = items.length - available.length;
  const label = `Ảnh bộ phối ${outfit.title}`;
  const useSavedImage = Boolean(outfit.preview_image_url && !imageFailed);

  return <>
    <div className="flex h-72 items-center justify-center overflow-hidden bg-stone-100/70 p-4 sm:h-80">
      {useSavedImage ? (
        // Saved URLs can expire; fall back to the current outfit snapshot.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={outfit.preview_image_url} alt={label} decoding="async" className="h-full w-full object-contain" onError={() => setImageFailed(true)} />
      ) : catalogError && items.length > 0 ? (
        <div className="space-y-3 text-center text-sm text-stone-600">
          <ImageOff className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
          <p>Chưa tải được trang phục để xem ảnh.</p>
          <button type="button" onClick={onRetryCatalog} className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold">Thử tải lại ảnh</button>
        </div>
      ) : catalogLoading && items.length > 0 ? (
        <p role="status" className="animate-pulse text-sm text-stone-500">Đang tải ảnh bộ phối…</p>
      ) : snapshot && available.length > 0 ? (
        <Canvas2D readOnly ariaLabel={label} avatar={null}
          equippedItems={items} catalogItems={catalogItems}
          layers={items.flatMap(saved => {
            const layer = catalogItems.find(item => item.id === saved.itemId)?.default_layer;
            return layer ? [layer] : [];
          })}
          aspectRatio={snapshot.aspectRatio} backgroundTheme={snapshot.backgroundTheme}
          neutralBackgroundTheme={snapshot.neutralBackgroundTheme} backgroundFade={snapshot.backgroundFade}
          occasionId={snapshot.occasionId} />
      ) : (
        <div className="space-y-2 text-center text-sm text-stone-500">
          <Layers className="mx-auto h-9 w-9 text-stone-300" aria-hidden="true" />
          <p>{items.length ? "Chưa có ảnh cho trang phục đã lưu." : "Bộ phối chưa có trang phục."}</p>
        </div>
      )}
    </div>
    {!useSavedImage && !catalogLoading && !catalogError && missingCount > 0 && available.length > 0 && (
      <figcaption className="px-5 py-2 text-xs text-stone-500">{missingCount} món chưa có ảnh để hiển thị.</figcaption>
    )}
  </>;
}
