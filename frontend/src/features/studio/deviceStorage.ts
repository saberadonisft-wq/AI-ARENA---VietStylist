import { DRAFT_KEY } from "./state";
import { isMetadataOnlyPostDraft, parsePostDraft, serializePostDraft } from "@/features/lookbook/postDraft";

/** Delete legacy outfit caches without touching login or unrelated preferences. */
export function clearLegacyOutfitStorage(): void {
  if (typeof window === "undefined") return;
  for (const bucket of ["localStorage", "sessionStorage"] as const) {
    let storage: Storage;
    try { storage = window[bucket]; } catch { continue; }
    let keys: string[];
    try { keys = Object.keys(storage); } catch { continue; }
    for (const key of keys) {
      try {
        if (key === DRAFT_KEY || key.startsWith(`${DRAFT_KEY}:`) || key.startsWith("vietstylist_generation:")) {
          storage.removeItem(key);
        } else if (key.startsWith("viet_lookbook_post:")) {
          // Preserve server references and the publication receipt, but remove
          // any legacy embedded outfit payload using the metadata allowlist.
          let draft;
          try {
            const stored: unknown = JSON.parse(storage.getItem(key) || "null");
            // Do not risk deleting a valid publication receipt merely because
            // an unnecessary rewrite is blocked by browser storage settings.
            if (isMetadataOnlyPostDraft(stored)) continue;
            draft = parsePostDraft(stored);
          } catch { /* Remove malformed legacy data too. */ }
          if (draft) {
            try { storage.setItem(key, serializePostDraft(draft)); }
            catch { storage.removeItem(key); }
          }
          else storage.removeItem(key);
        }
      } catch { /* Storage may be disabled; never restore a retired outfit cache. */ }
    }
  }
}
