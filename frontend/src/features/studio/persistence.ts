import type { OutfitSnapshot } from "@/lib/types/api";
import type { OutfitResponse } from "@/lib/types/api";
import { DRAFT_KEY, parseDraft } from "./state";
import { sameDocument } from "./state";
import type { StudioDocument, StudioDraft } from "./state";

export function ownerDraftKey(ownerId: string): string {
  return `${DRAFT_KEY}:${ownerId}`;
}

export function readStudioDraft(key: string): StudioDraft | null {
  if (typeof window === "undefined") return null;
  return parseDraft(window.localStorage.getItem(key));
}

export function writeStudioDraft(key: string, draft: StudioDraft): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeStudioDraft(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export interface OutfitSavePayload {
  title: string;
  snapshot: OutfitSnapshot;
  occasion_id?: string;
  style_mode?: OutfitSnapshot["styleMode"];
}

export function toOutfitSavePayload(document: StudioDocument): OutfitSavePayload {
  return {
    title: document.title,
    snapshot: document.snapshot,
    occasion_id: document.snapshot.occasionId,
    style_mode: document.snapshot.styleMode,
  };
}

export function newSaveIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type OutfitSaveIdentity = Pick<StudioDraft,
  "ownerId" | "outfitId" | "revision" | "savedDocument" | "createIdempotencyKey" | "createDocument"
>;

export interface SaveOutfitDocumentOptions {
  document: StudioDocument;
  identity: OutfitSaveIdentity;
  asNew?: boolean;
  create: (payload: OutfitSavePayload, idempotencyKey: string) => Promise<OutfitResponse>;
  update: (id: string, payload: OutfitSavePayload & { revision: number }) => Promise<OutfitResponse>;
  onPendingCreate?: (identity: OutfitSaveIdentity) => void;
}

/**
 * One save policy for Studio and Account: revision guarded updates, durable
 * idempotent creates, and recovery of a create whose response was lost.
 */
export async function saveOutfitDocument({
  document,
  identity,
  asNew = false,
  create,
  update,
  onPendingCreate,
}: SaveOutfitDocumentOptions): Promise<{ saved: OutfitResponse; identity: OutfitSaveIdentity; submitted: StudioDocument }> {
  const submitted = structuredClone(document);
  const payload = toOutfitSavePayload(submitted);
  let meta = { ...identity };
  let saved: OutfitResponse | null = null;

  if (meta.createIdempotencyKey && meta.createDocument) {
    onPendingCreate?.(meta);
    const createDocument = meta.createDocument;
    const recovered = await create(toOutfitSavePayload(createDocument), meta.createIdempotencyKey);
    saved = sameDocument(createDocument, submitted)
      ? recovered
      : await update(recovered.id, { ...payload, revision: recovered.revision });
  }

  const creating = asNew || !meta.outfitId;
  if (!saved && !creating) {
    if (!meta.revision) throw new Error("Thiếu phiên bản bộ phối. Tải bản máy chủ hoặc lưu thành bộ mới.");
    saved = await update(meta.outfitId!, { ...payload, revision: meta.revision });
  }

  if (!saved) {
    if (!meta.createIdempotencyKey || !meta.createDocument || !sameDocument(meta.createDocument, submitted)) {
      meta = { ...meta, createIdempotencyKey: newSaveIdempotencyKey(), createDocument: submitted };
      onPendingCreate?.(meta);
    }
    saved = await create(toOutfitSavePayload(meta.createDocument || submitted), meta.createIdempotencyKey!);
  }

  return {
    saved,
    submitted,
    identity: {
      ownerId: meta.ownerId,
      outfitId: saved.id,
      revision: saved.revision,
      savedDocument: {
        title: saved.title,
        snapshot: saved.current_snapshot || submitted.snapshot,
      },
    },
  };
}
