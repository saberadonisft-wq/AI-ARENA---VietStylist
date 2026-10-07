import type { OutfitSnapshot } from '@/lib/types/api';
import type { PostInput, Visibility } from '@/lib/types/community';

export type PostSource = { outfitId: string; version: string; title: string; snapshot: OutfitSnapshot };
export type PostDraft = {
  title: string; description: string; visibility: Visibility; version: string;
  media?: string; pendingMedia?: string; source?: PostSource; requestKey: string;
  publication?: { requestKey: string; payload: PostInput };
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const visibility = (value: unknown): value is Visibility => value === 'public' || value === 'private' || value === 'unlisted';
const requestKey = (value: unknown): value is string => text(value) && /^[\x21-\x7E]{1,128}$/.test(value);
const payload = (value: unknown): value is PostInput => record(value) && text(value.title) && text(value.description) &&
  text(value.outfit_version_id) && !!value.outfit_version_id && text(value.cover_media_id) && !!value.cover_media_id && visibility(value.visibility);
const publicationPayload = (value: PostInput): PostInput => ({
  title: value.title, description: value.description, visibility: value.visibility,
  outfit_version_id: value.outfit_version_id, cover_media_id: value.cover_media_id,
});

const onlyKeys = (value: object, allowed: readonly string[]): boolean =>
  Object.keys(value).every(key => allowed.includes(key));

// Clean receipts need no migration write. Keep the nested allowlists strict so
// an embedded legacy snapshot cannot bypass removal by using a receipt field.
export function isMetadataOnlyPostDraft(value: unknown): boolean {
  if (!record(value) || !onlyKeys(value, ['title', 'description', 'visibility', 'version', 'media', 'pendingMedia', 'requestKey', 'publication']) ||
      !text(value.title) || !text(value.description) || !visibility(value.visibility) || !text(value.version) || !requestKey(value.requestKey) ||
      (value.media !== undefined && !text(value.media)) || (value.pendingMedia !== undefined && !text(value.pendingMedia))) return false;
  if (value.publication === undefined) return true;
  const receipt = value.publication;
  return record(receipt) && onlyKeys(receipt, ['requestKey', 'payload']) && requestKey(receipt.requestKey) &&
    payload(receipt.payload) && onlyKeys(receipt.payload, ['title', 'description', 'visibility', 'outfit_version_id', 'cover_media_id']);
}

// Outfit snapshots stay in memory or on the server. Only the post's text,
// source identifiers and immutable publication receipt may survive a reload.
export function serializePostDraft(value: PostDraft): string {
  return JSON.stringify({
    title: value.title, description: value.description, visibility: value.visibility,
    version: value.version, media: value.media, pendingMedia: value.pendingMedia,
    requestKey: value.requestKey,
    publication: value.publication ? {
      requestKey: value.publication.requestKey,
      payload: publicationPayload(value.publication.payload),
    } : undefined,
  });
}

export function parsePostDraft(value: unknown): PostDraft | null {
  if (!record(value) || !text(value.title) || !text(value.version) || !visibility(value.visibility)) return null;
  const publication = record(value.publication) && requestKey(value.publication.requestKey) && payload(value.publication.payload)
    ? { requestKey: value.publication.requestKey, payload: publicationPayload(value.publication.payload) } : undefined;
  const version = publication?.payload.outfit_version_id || value.version;
  return {
    title: publication?.payload.title ?? value.title,
    description: publication?.payload.description ?? (text(value.description) ? value.description : ''),
    visibility: publication?.payload.visibility ?? value.visibility, version, publication,
    media: publication?.payload.cover_media_id ?? (text(value.media) && value.media ? value.media : undefined),
    pendingMedia: text(value.pendingMedia) && value.pendingMedia ? value.pendingMedia : undefined,
    requestKey: publication?.requestKey || (requestKey(value.requestKey) ? value.requestKey : crypto.randomUUID()),
  };
}
