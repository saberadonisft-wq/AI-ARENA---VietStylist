import { API_ORIGIN } from "@/lib/api/client";
import type { CatalogItem } from "@/lib/types/api";

export function catalogImageUrl(item: CatalogItem): string | undefined {
  return item.metadata?.real_image_url || (item.metadata?.catalog_media_id
    ? `${API_ORIGIN}/api/catalog/items/${encodeURIComponent(item.id)}/studio-image` : undefined);
}

export function catalogThumbnailUrl(item: CatalogItem, size = 224): string | undefined {
  if (!item.metadata?.catalog_media_id) return catalogImageUrl(item);
  return `${API_ORIGIN}/api/catalog/items/${encodeURIComponent(item.id)}/thumbnail?size=${size}`;
}
