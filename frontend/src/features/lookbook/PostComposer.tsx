"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Images } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Canvas2D, { type Canvas2DHandle } from '@/features/studio/Canvas2D';
import { useCatalog } from '@/lib/catalog/CatalogProvider';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { communityApi } from '@/lib/api/community';
import type { OutfitResponse, OutfitSnapshot } from '@/lib/types/api';
import type { PostDetail, PostInput, Visibility } from '@/lib/types/community';
import { CommunityAvatar, control, field, primary, PostImage } from './PostCard';
import './lookbook-social.css';
import { parsePostDraft, serializePostDraft, type PostDraft, type PostSource } from './postDraft';

export default function PostComposer({ post, initialOutfitId, onClose, onPublished, onNeedAuth }: {
  post?: PostDetail; initialOutfitId?: string; onClose: () => void; onPublished: (post: PostDetail) => void; onNeedAuth: () => void;
}) {
  const { user } = useAuth();
  const owner = user?.id;
  const activeOwner = useRef(owner); activeOwner.current = owner;
  const mounted = useRef(false);
  const submission = useRef<AbortController | null>(null);
  const catalog = useCatalog();
  const canvas = useRef<Canvas2DHandle>(null);
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [outfitsCursor, setOutfitsCursor] = useState<string | null>(null);
  const [loadingMoreOutfits, setLoadingMoreOutfits] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [createConflict, setCreateConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const draftKey = `viet_lookbook_post:${owner}:${post?.id || 'new'}`;
  const [draft, setDraft] = useState<PostDraft>({ title: post?.title || '', description: post?.description || '', visibility: post?.visibility || 'private', version: post?.outfit_version_id || '', media: post?.cover_media_id, requestKey: '', source: post ? { outfitId: post.outfit_id, version: post.outfit_version_id, title: post.title, snapshot: post.snapshot } : undefined });
  const latestDraft = useRef(draft); latestDraft.current = draft;
  const current = () => mounted.current && activeOwner.current === owner;
  const remember = (next: PostDraft) => {
    latestDraft.current = next; setDraft(next);
    // Checkpoint before requests, rather than relying on a later React effect.
    try { sessionStorage.setItem(draftKey, serializePostDraft(next)); } catch { /* Keep the in-memory draft. */ }
  };
  const forget = () => {
    try { sessionStorage.removeItem(draftKey); }
    catch { try { sessionStorage.setItem(draftKey, 'null'); } catch { /* A successful publication remains successful. */ } }
  };
  useEffect(() => {
    let live = true;
    mounted.current = true;
    const controller = new AbortController();
    void catalog.ensureLoaded();
    try {
      const raw = sessionStorage.getItem(draftKey);
      const saved = raw ? parsePostDraft(JSON.parse(raw)) : null;
      remember(saved || { ...latestDraft.current, requestKey: crypto.randomUUID() });
    } catch { remember({ ...latestDraft.current, requestKey: crypto.randomUUID() }); }
    api.listUserOutfitsPage(null, controller.signal).then(async page => {
      if (!live) return;
      const data = [...page.items];
      setOutfitsCursor(page.next_cursor);
      if (initialOutfitId && !post && !data.some(outfit => outfit.id === initialOutfitId)) {
        data.push(await api.getOutfit(initialOutfitId));
        if (!live) return;
      }
      setOutfits(data);
      let restored = latestDraft.current;
      if (!restored.version && !post) {
        const initial = initialOutfitId ? data.find(o => o.id === initialOutfitId) : data.find(o => o.current_version_id);
        if (initial?.current_version_id) {
          restored = { ...restored, version: initial.current_version_id, title: restored.title || initial.title };
          remember(restored);
        }
      }
      if (!restored.version) return;
      const selected = data.find(o => o.current_version_id === restored.version);
      let source: PostSource | undefined;
      if (post?.outfit_version_id === restored.version) source = { outfitId: post.outfit_id, version: restored.version, title: post.title, snapshot: post.snapshot };
      else if (selected?.current_snapshot) source = { outfitId: selected.id, version: restored.version, title: selected.title, snapshot: selected.current_snapshot };
      else if (restored.source?.version === restored.version && data.some(o => o.id === restored.source?.outfitId)) source = restored.source;
      else {
        // Browser storage contains identifiers only. Read the owned frozen version.
        const version = await api.getOutfitVersion(restored.version, controller.signal);
        source = { outfitId: version.outfit_id, version: version.id, title: data.find(o => o.id === version.outfit_id)?.title || restored.title, snapshot: version.snapshot };
      }
      if (live && latestDraft.current.version === restored.version) remember({ ...latestDraft.current, source });
    }).catch(e => { if (live) { setError(e.message); if (e.statusCode === 401) onNeedAuth(); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; mounted.current = false; controller.abort(); submission.current?.abort(); };
    // Restore once per account and editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  const loadMoreOutfits = async () => {
    if (!outfitsCursor || loadingMoreOutfits) return;
    setLoadingMoreOutfits(true);
    setError('');
    try {
      const page = await api.listUserOutfitsPage(outfitsCursor);
      if (!current()) return;
      setOutfits(previous => [...previous.filter(outfit => !page.items.some(row => row.id === outfit.id)), ...page.items]);
      setOutfitsCursor(page.next_cursor);
    } catch (e: any) {
      if (current()) setError(e.message || 'Không tải được bộ phối tiếp theo.');
    } finally {
      if (current()) setLoadingMoreOutfits(false);
    }
  };
  const selected = outfits.find(o => o.current_version_id === draft.version);
  const frozen = post?.outfit_version_id === draft.version;
  const snapshot: OutfitSnapshot | undefined = draft.source?.version === draft.version ? draft.source.snapshot : frozen ? post.snapshot : selected?.current_snapshot;
  const items = snapshot?.items || [];
  const missingItemCount = catalog.itemsLoaded ? items.filter(item => !catalog.catalogItems.some(candidate => candidate.id === item.itemId)).length : 0;
  const uncertain = !!draft.publication;
  const patch = (value: Partial<PostDraft>) => {
    if (submission.current || latestDraft.current.publication) return;
    setPreview(false); remember({ ...latestDraft.current, ...value, requestKey: crypto.randomUUID() });
  };
  const validate = () => {
    if (!draft.title.trim()) { setError('Nhập tiêu đề bài đăng.'); return false; }
    if (!draft.version || !snapshot) { setError('Chọn một bộ phối đã lưu.'); return false; }
    setError(''); return true;
  };
  const submit = async () => {
    const previous = latestDraft.current.publication;
    if (submission.current || !owner || (!previous && (!validate() || !snapshot))) return;
    const controller = new AbortController(); submission.current = controller;
    setBusy(true); setError(''); setCreateConflict(false);
    let savingPost = false;
    try {
      let media = latestDraft.current.media;
      if (!previous && !media) {
        if (latestDraft.current.pendingMedia) {
          setStage('Đang hoàn tất ảnh…');
          media = await communityApi.completeCover(latestDraft.current.pendingMedia, controller.signal);
        } else {
          if (catalog.itemsError || !catalog.isLoaded || !canvas.current) throw new Error('Chờ trang phục tải đầy đủ trước khi tạo ảnh.');
          if (items.some(item => !catalog.catalogItems.some(candidate => candidate.id === item.itemId))) throw new Error('Một món trong bộ phối không còn khả dụng. Mở Studio để cập nhật trước khi đăng.');
          setStage('Đang tạo ảnh bộ phối…');
          const blob = await canvas.current.exportToBlob(snapshot!.aspectRatio || '9:16');
          if (!current()) return;
          setStage('Đang tải ảnh…');
          media = await communityApi.uploadCover(blob, pendingMedia => {
            if (!current()) return;
            remember({ ...latestDraft.current, pendingMedia });
            setStage('Đang hoàn tất ảnh…');
          }, controller.signal);
        }
        if (!current()) return;
        remember({ ...latestDraft.current, media, pendingMedia: undefined });
      }
      const payload: PostInput = previous?.payload || { title: draft.title.trim(), description: draft.description, visibility: draft.visibility, outfit_version_id: draft.version, cover_media_id: media! };
      const requestKey = previous?.requestKey || latestDraft.current.requestKey;
      if (!post && !previous) remember({ ...latestDraft.current, publication: { requestKey, payload } });
      setStage(previous ? 'Đang kiểm tra lần đăng trước…' : 'Đang lưu bài đăng…');
      savingPost = true;
      const result = post ? await communityApi.update(post.id, { ...payload, revision: post.revision }, controller.signal) : await communityApi.create(payload, requestKey, controller.signal);
      if (!current()) return;
      forget();
      onPublished(result);
    } catch (e: any) {
      if (current()) {
        const postConflict = savingPost && e.statusCode === 409;
        // Rejected or missing uploads cannot be completed again; transient failures can.
        if (!savingPost && (e.statusCode === 413 || e.statusCode === 422 || e.code === 'MEDIA_NOT_FOUND')) remember({ ...latestDraft.current, pendingMedia: undefined });
        if (savingPost && !post && (e.statusCode === 400 || e.statusCode === 422)) remember({ ...latestDraft.current, publication: undefined });
        if (savingPost && e.code === 'INVALID_POST_IMAGE') remember({ ...latestDraft.current, media: undefined, pendingMedia: undefined });
        setCreateConflict(!post && postConflict);
        setError(postConflict ? post ? 'Bài đăng đã thay đổi. Nội dung đang soạn vẫn được giữ. Đóng cửa sổ và tải lại bài trước khi tiếp tục.' : 'Lần đăng trước có thể đã thành công. Kiểm tra Của tôi trước khi tạo bài mới. Nội dung đang soạn vẫn được giữ.' : e.message || 'Chưa đăng được bài. Nội dung đang soạn vẫn được giữ.');
        if (e.statusCode === 401) onNeedAuth();
      }
    } finally { if (submission.current === controller) submission.current = null; if (current()) { setBusy(false); setStage(''); } }
  };
  const publishHint = loading ? 'Đang tải bộ phối đã lưu…' : uncertain ? 'Bạn có thể thử lại cùng lần đăng để kiểm tra kết quả.' : !draft.version ? 'Chọn bộ phối đã lưu để xem ảnh và tiếp tục.' : !draft.title.trim() ? 'Thêm tiêu đề cho bài đăng.' : !preview ? 'Nhấn Xem trước bài đăng, rồi xác nhận đăng.' : 'Nội dung đã sẵn sàng để bạn xác nhận.';
  return <Modal isOpen onClose={onClose} closeDisabled={busy} label={post ? 'Sửa bài đăng bộ phối' : 'Đăng bộ phối'}>
    <div className="lookbook-composer flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <header className="relative flex min-h-16 shrink-0 items-center justify-center border-b border-stone-200 px-16 py-4"><h2 className="text-center text-lg font-semibold">{post ? 'Sửa bài đăng' : 'Đăng bộ phối'}</h2><button type="button" className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50" aria-label="Đóng cửa sổ đăng bài" onClick={onClose} disabled={busy}><X size={20} aria-hidden="true" /></button></header>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3"><CommunityAvatar name={user?.displayName || 'VietStylist'} imageUrl={user?.avatarUrl} /><div className="min-w-0 flex-1"><p className="mb-1 truncate text-sm font-semibold">{user?.displayName}</p><label><span className="sr-only">Ai có thể xem?</span><select className="min-h-11 max-w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm font-medium" value={draft.visibility} disabled={busy || uncertain} onChange={e => patch({ visibility: e.target.value as Visibility })}><option value="private">Riêng tư — chỉ mình tôi</option><option value="unlisted">Người có liên kết</option><option value="public">Công khai</option></select></label></div></div>
          <section className="space-y-3 rounded-lg border border-stone-200 p-3" aria-label="Bộ phối đính kèm">
            <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-medium"><Images size={18} className="text-emerald-600" aria-hidden="true" />Bộ phối đã lưu</span><select className={field} value={draft.version} disabled={busy || loading || uncertain} onChange={e => { const outfit = outfits.find(o => o.current_version_id === e.target.value); patch({ version: e.target.value, media: undefined, pendingMedia: undefined, source: outfit?.current_snapshot ? { outfitId: outfit.id, version: e.target.value, title: outfit.title.trim() || 'Bộ phối chưa đặt tên', snapshot: outfit.current_snapshot } : undefined, title: draft.title || outfit?.title || '' }); }}><option value="">{loading ? 'Đang tải bộ phối…' : 'Chọn bộ phối'}</option>{post && !outfits.some(o => o.current_version_id === post.outfit_version_id) && <option value={post.outfit_version_id}>Phiên bản đang đăng (v{post.version_number})</option>}{!frozen && draft.source && !outfits.some(o => o.current_version_id === draft.version) && <option value={draft.version}>{draft.source.title.trim() || 'Bộ phối chưa đặt tên'} · phiên bản đã chọn</option>}{outfits.filter(o => o.current_version_id).map(o => <option key={o.id} value={o.current_version_id}>{o.title.trim() || 'Bộ phối chưa đặt tên'}</option>)}</select></label>
            {!loading && outfits.length === 0 && !post && !error && <p className="text-sm text-stone-500">Bạn chưa lưu bộ phối. <Link href="/studio" className="font-semibold text-heritage-red underline">Tạo trong Studio</Link></p>}
            {outfitsCursor && <button type="button" className={control} disabled={busy || loading || loadingMoreOutfits || uncertain} onClick={() => void loadMoreOutfits()}>{loadingMoreOutfits ? "Đang tải bộ phối…" : "Tải thêm bộ phối"}</button>}
            {frozen && draft.media === post?.cover_media_id ? <div className="[&>div]:max-h-72 [&>div]:min-h-0 [&_img]:max-h-72"><PostImage post={post!} large /></div> : snapshot ? <figure aria-label="Bộ phối đã chọn" className="overflow-hidden rounded-lg bg-stone-50 p-3"><div className="lookbook-composer-preview" style={{ aspectRatio: snapshot.aspectRatio === '1:1' ? '1 / 1' : '9 / 16' }}><Canvas2D readOnly ariaLabel="Ảnh xem trước bài đăng" key={draft.version} ref={canvas} lockedSlots={items.map(item => item.slot)} avatar={null} equippedItems={items} catalogItems={catalog.catalogItems}
              layers={items.flatMap(item => { const layer = catalog.catalogItems.find(i => i.id === item.itemId)?.default_layer; return layer ? [layer] : []; })}
              aspectRatio={snapshot.aspectRatio} backgroundTheme={snapshot.backgroundTheme} neutralBackgroundTheme={snapshot.neutralBackgroundTheme} backgroundFade={snapshot.backgroundFade} occasionId={snapshot.occasionId} /></div></figure> : <p className="text-xs leading-relaxed text-stone-500">Chọn một bộ phối để xem ảnh đính kèm tại đây.</p>}
            {snapshot && catalog.itemsLoading && <p role="status" className="text-xs text-stone-500">Đang tải ảnh trang phục…</p>}
            {missingItemCount > 0 && <p role="status" className="text-xs leading-relaxed text-amber-800">{missingItemCount} món trong bản lưu không còn trong kho trang phục. Mở bộ phối trong Studio để cập nhật trước khi đăng.</p>}
            {snapshot && <p className="text-xs leading-relaxed text-stone-500">Bài đăng giữ phiên bản bộ phối đã chọn. Bạn có thể cập nhật bài sau khi sửa trong Studio.</p>}
            {catalog.itemsError && <div role="alert" className="space-y-2 text-sm text-red-800">{catalog.itemsError}<button className={control} onClick={() => void catalog.refreshCatalog()}>Tải lại trang phục</button></div>}
          </section>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Tiêu đề</span><input className={field} placeholder="Đặt tên cho bộ phối của bạn" maxLength={160} value={draft.title} disabled={busy || uncertain} onChange={e => patch({ title: e.target.value })} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Mô tả</span><textarea className={field + ' resize-y'} placeholder="Chia sẻ cảm hứng và câu chuyện của bộ phối…" rows={2} maxLength={3000} value={draft.description} disabled={busy || uncertain} onChange={e => patch({ description: e.target.value })} /></label>
          <p className="text-xs leading-relaxed text-stone-500">{draft.visibility === 'private' ? 'Chỉ bạn xem được. Chuyển về riêng tư sẽ thu hồi các link chia sẻ.' : draft.visibility === 'unlisted' ? 'Không xuất hiện ở Khám phá. Ai nhận được link hợp lệ đều có thể xem và chuyển tiếp link.' : 'Mọi người có thể xem và lưu vào Yêu thích. Ảnh đã tải xuống bên ngoài không thể thu hồi.'}</p>
          {preview && <div role="status" className="space-y-1 rounded-lg border border-red-200 bg-red-50/50 p-3"><p className="text-base font-semibold [overflow-wrap:anywhere]">{draft.title}</p><p className="whitespace-pre-wrap break-words text-sm">{draft.description || 'Chưa có mô tả.'}</p><p className="text-xs text-stone-500">Tác giả: {user?.displayName}</p></div>}
          {uncertain && !busy && <p role="status" className="text-sm text-stone-600">Chưa xác nhận kết quả lần đăng trước. Nội dung được giữ nguyên; bấm đăng lại để kiểm tra cùng lần đăng, tránh tạo bài trùng.</p>}
          {uncertain && !busy && !createConflict && <Link className={control} href="/lookbook?tab=mine" onClick={onClose}>Kiểm tra bài của tôi</Link>}
          {createConflict && <div className="flex flex-wrap gap-2"><Link className={control} href="/lookbook?tab=mine" onClick={onClose}>Kiểm tra bài của tôi</Link><button className={control} type="button" onClick={() => { remember({ ...latestDraft.current, requestKey: crypto.randomUUID(), publication: undefined }); setPreview(false); setCreateConflict(false); setError(''); }}>Dùng nội dung này cho bài mới</button></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {error && draft.pendingMedia && <button className={control} type="button" disabled={busy || uncertain} onClick={() => { remember({ ...latestDraft.current, pendingMedia: undefined }); setError(''); }}>Tạo lại ảnh bộ phối</button>}
          {busy && <p role="status" className="text-sm">{stage}</p>}
      </div>
      <footer className="shrink-0 space-y-2 border-t border-stone-200 bg-white p-3 sm:p-4"><p id="lookbook-publish-hint" className="text-xs leading-relaxed text-stone-500">{publishHint}</p><div className="grid gap-2 sm:grid-cols-2"><button className={control} type="button" disabled={busy || loading} onClick={() => { if (validate()) setPreview(true); }}>Xem trước bài đăng</button><button className={primary} aria-describedby="lookbook-publish-hint" type="button" disabled={busy || (!preview && !uncertain) || !draft.requestKey} onClick={() => void submit()}>{busy ? 'Đang lưu…' : post ? 'Lưu thay đổi' : draft.visibility === 'public' ? 'Đăng công khai' : draft.visibility === 'unlisted' ? 'Tạo bài qua liên kết' : 'Lưu riêng tư'}</button></div></footer>
    </div>
  </Modal>;
}
