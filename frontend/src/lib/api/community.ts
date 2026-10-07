import { apiFetch, ApiError } from './client';
import type { PostInput, PostDetail, PostPage, FavoritePage, PostShare, CreatedShare, CommunityAuthor, ReportPage } from '../types/community';
const root = '/api/lookbook-posts';
const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
  return search.size ? '?' + search.toString() : '';
};
const completeCover = async (mediaId: string, signal?: AbortSignal) => {
  // Image validation and storage can outlast the default API timeout.
  const media = await apiFetch<{ id: string; status: string }>('/api/media/' + encodeURIComponent(mediaId) + '/complete', {
    method: 'POST', body: '{}', timeoutMs: 30000, signal,
  });
  if (media.id !== mediaId || media.status !== 'ready') throw new ApiError('Ảnh bộ phối chưa sẵn sàng. Hãy thử lại để hoàn tất ảnh.', 'MEDIA_NOT_READY', 409);
  return mediaId;
};
export const communityApi = {
  feed: (params: Record<string, string | undefined>, signal?: AbortSignal) => apiFetch<PostPage>(root + query(params), { signal }),
  mine: (params: Record<string, string | undefined>, signal?: AbortSignal) => apiFetch<PostPage>(root + '/mine' + query(params), { signal }),
  favorites: (cursor?: string, signal?: AbortSignal) => apiFetch<FavoritePage>(root + '/favorites' + query({ cursor }), { signal }),
  post: (id: string, signal?: AbortSignal) => apiFetch<PostDetail>(root + '/' + encodeURIComponent(id), { signal }),
  shared: (token: string, signal?: AbortSignal) => apiFetch<PostDetail>(root + '/shares/' + encodeURIComponent(token), { signal }),
  create: (payload: PostInput, key: string, signal?: AbortSignal) => apiFetch<PostDetail>(root, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload), signal }),
  update: (id: string, payload: PostInput & { revision: number }, signal?: AbortSignal) => apiFetch<PostDetail>(root + '/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload), signal }),
  delete: (id: string) => apiFetch(root + '/' + encodeURIComponent(id), { method: 'DELETE' }),
  favorite: (id: string, save: boolean) => apiFetch<{ saved: boolean }>(root + '/' + encodeURIComponent(id) + '/favorite', { method: save ? 'PUT' : 'DELETE' }),
  shares: (id: string) => apiFetch<PostShare[]>(root + '/' + encodeURIComponent(id) + '/shares'),
  createShare: (id: string, days: 1 | 7 | 30) => apiFetch<CreatedShare>(root + '/' + encodeURIComponent(id) + '/shares', { method: 'POST', body: JSON.stringify({ expires_in_days: days }) }),
  revokeShare: (id: string, shareId?: string) => apiFetch(root + '/' + encodeURIComponent(id) + '/shares' + (shareId ? '/' + encodeURIComponent(shareId) : ''), { method: 'DELETE' }),
  profile: (id: string) => apiFetch<CommunityAuthor>(root + '/profiles/' + encodeURIComponent(id)),
  updateProfile: (bio: string) => apiFetch<CommunityAuthor>(root + '/profile', { method: 'PUT', body: JSON.stringify({ bio }) }),
  report: (id: string, reason: string, details: string) => apiFetch(root + '/' + encodeURIComponent(id) + '/reports', { method: 'POST', body: JSON.stringify({ reason, details }) }),
  reports: (cursor?: string) => apiFetch<ReportPage>(root + '/moderation/reports' + query({ cursor })),
  moderate: (id: string, revision: number, hidden: boolean, reason: string) => apiFetch(root + '/moderation/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ revision, hidden, reason }) }),
  resolveReport: (id: string) => apiFetch(root + '/moderation/reports/' + encodeURIComponent(id), { method: 'DELETE' }),
  completeCover,
  uploadCover: async (blob: Blob, onUploaded?: (mediaId: string) => void, signal?: AbortSignal) => {
    const session = await apiFetch<{ media_id: string; upload_url: string; method: string; storage_type: string }>(
      '/api/media/uploads', { method: 'POST', body: JSON.stringify({ filename: 'lookbook.png', mime_type: 'image/png', media_type: 'image', size_bytes: blob.size, visibility: 'private' }), signal });
    const file = new File([blob], 'lookbook.png', { type: 'image/png' });
    const form = new FormData(); form.append('file', file);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 60000);
    let response: Response;
    try {
      response = await fetch(session.upload_url, {
        method: session.method, body: session.storage_type === 'local' ? form : file,
        headers: session.storage_type === 'local' ? undefined : { 'Content-Type': 'image/png' }, signal: controller.signal,
      });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    if (!response.ok) throw new ApiError('Chưa tải được ảnh bộ phối. Hãy thử lại.', 'COVER_UPLOAD_FAILED', response.status);
    // Retain the uploaded image even if the completion response is lost.
    onUploaded?.(session.media_id);
    return completeCover(session.media_id, signal);
  },
};
