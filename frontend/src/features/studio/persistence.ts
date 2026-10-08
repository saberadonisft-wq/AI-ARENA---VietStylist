import type { OutfitSnapshot } from "@/lib/types/api";
import type { OutfitResponse } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { sameDocument } from "./state";
import type { StudioDocument, StudioDraft } from "./state";
import { hasSessionGarments, SESSION_SAVE_NOTICE } from "./sessionGarments";

export interface OutfitSavePayload {
  title: string;
  snapshot: OutfitSnapshot;
  occasion_id?: string;
  style_mode?: OutfitSnapshot["styleMode"];
}

export function toOutfitSavePayload(document: StudioDocument): OutfitSavePayload {
  if (hasSessionGarments(document.snapshot)) throw new Error(SESSION_SAVE_NOTICE);
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
  "ownerId" | "outfitId" | "revision" | "savedDocument" | "createIdempotencyKey" | "createDocument" | "createAsNew"
>;

export interface SaveOutfitDocumentOptions {
  document: StudioDocument;
  identity: OutfitSaveIdentity;
  asNew?: boolean;
  create: (payload: OutfitSavePayload, idempotencyKey: string) => Promise<OutfitResponse>;
  update: (id: string, payload: OutfitSavePayload & { revision: number }) => Promise<OutfitResponse>;
  onCheckpoint?: (identity: OutfitSaveIdentity) => void;
}

function savedIdentity(ownerId: string | undefined, saved: OutfitResponse, submitted: StudioDocument): OutfitSaveIdentity {
  return {
    ownerId,
    outfitId: saved.id,
    revision: saved.revision,
    savedDocument: { title: saved.title, snapshot: saved.current_snapshot || submitted.snapshot },
    createIdempotencyKey: undefined,
    createDocument: undefined,
    createAsNew: undefined,
  };
}

/**
 * Studio's server-save policy: revision guarded updates, idempotent creates,
 * and retrying an uncertain create while its receipt remains in page memory.
 */
export async function saveOutfitDocument({
  document,
  identity,
  asNew = false,
  create,
  update,
  onCheckpoint,
}: SaveOutfitDocumentOptions): Promise<{ saved: OutfitResponse; identity: OutfitSaveIdentity; submitted: StudioDocument }> {
  const submitted = structuredClone(document);
  const payload = toOutfitSavePayload(submitted);
  let meta = { ...identity };
  let saved: OutfitResponse | null = null;
  const checkpoint = (next: OutfitSaveIdentity) => {
    meta = next;
    onCheckpoint?.(meta);
  };

  if (meta.createIdempotencyKey && meta.createDocument) {
    onCheckpoint?.(meta);
    const createDocument = meta.createDocument;
    // A retry of a pending "save as new" reuses that create; requesting a new
    // copy of a pending ordinary save must leave the first outfit untouched.
    const separateCopy = asNew && !meta.createAsNew;
    let recovered: OutfitResponse | null = null;
    try {
      recovered = await create(toOutfitSavePayload(createDocument), meta.createIdempotencyKey);
    } catch (err) {
      if (!(err instanceof ApiError) || err.statusCode !== 409 ||
          !["REVISION_CONFLICT", "OUTFIT_DELETED"].includes(err.code) ||
          typeof err.details?.outfit_id !== "string" || err.details?.revision !== 1) throw err;
      // The create succeeded, even though its result has since changed. Keep
      // its original revision so the conflict UI can load it without overwriting.
      checkpoint({
        ownerId: meta.ownerId, outfitId: err.details.outfit_id, revision: 1,
        savedDocument: createDocument, createIdempotencyKey: undefined,
        createDocument: undefined, createAsNew: undefined,
      });
      if (!separateCopy) throw err;
    }
    if (recovered) {
      checkpoint(savedIdentity(meta.ownerId, recovered, createDocument));
      if (!separateCopy) saved = sameDocument(createDocument, submitted)
        ? recovered
        : await update(recovered.id, { ...payload, revision: recovered.revision });
    }
  }

  const creating = asNew || !meta.outfitId;
  if (!saved && !creating) {
    if (!meta.revision) throw new Error("Thiếu phiên bản bộ phối. Tải bản máy chủ hoặc lưu thành bộ mới.");
    saved = await update(meta.outfitId!, { ...payload, revision: meta.revision });
  }

  if (!saved) {
    if (!meta.createIdempotencyKey || !meta.createDocument || !sameDocument(meta.createDocument, submitted)) {
      checkpoint({ ...meta, createIdempotencyKey: newSaveIdempotencyKey(), createDocument: submitted, createAsNew: asNew || undefined });
    }
    saved = await create(toOutfitSavePayload(meta.createDocument || submitted), meta.createIdempotencyKey!);
  }

  return {
    saved,
    submitted,
    identity: savedIdentity(meta.ownerId, saved, submitted),
  };
}
