"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Canvas2D, { type Canvas2DHandle } from '@/features/studio/Canvas2D';
import { useCatalog } from '@/lib/catalog/CatalogProvider';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { communityApi } from '@/lib/api/community';
import type { OutfitResponse, OutfitSnapshot } from '@/lib/types/api';
import type { PostDetail, Visibility } from '@/lib/types/community';
import { control, field, primary, PostImage } from './PostCard';

type Draft = { title: string; description: string; visibility: Visibility; version: string; media?: string; requestKey: string; fingerprint?: string };
export default function PostComposer({ post, initialOutfitId, onClose, onPublished, onNeedAuth }: {
  post?: PostDetail; initialOutfitId?: string; onClose: () => void; onPublished: (post: PostDetail) => void; onNeedAuth: () => void;
}) {
  const { user } = useAuth();
  const owner = user?.id;
  const activeOwner = useRef(owner); activeOwner.current = owner;
  const catalog = useCatalog();
  const canvas = useRef<Canvas2DHandle>(null);
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [createConflict, setCreateConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const [restored, setRestored] = useState(false);
  const draftKey = `viet_lookbook_post:${owner}:${post?.id || 'new'}`;
  const [draft, setDraft] = useState<Draft>({ title: post?.title || '', description: post?.description || '', visibility: post?.visibility || 'private', version: post?.outfit_version_id || '', media: post?.cover_media_id, requestKey: '' });
  useEffect(() => {
    let live = true;
    void catalog.ensureLoaded();
    try {
      const raw = sessionStorage.getItem(draftKey);
      const saved = raw ? JSON.parse(raw) as Draft : null;
      if (saved && typeof saved.title === 'string' && typeof saved.version === 'string' && ['public','private','unlisted'].includes(saved.visibility)) setDraft(saved);
      else setDraft(d => ({ ...d, requestKey: crypto.randomUUID() }));
    } catch { setDraft(d => ({ ...d, requestKey: crypto.randomUUID() })); }
    setRestored(true);
    api.listUserOutfits().then(data => {
      if (!live) return;
      setOutfits(data);
      if (initialOutfitId && !post) {
        const selected = data.find(o => o.id === initialOutfitId);
        if (selected?.current_version_id) setDraft(d => ({ ...d, version: selected.current_version_id!, title: d.title || selected.title }));
      }
    }).catch(e => { if (live) { setError(e.message); if (e.statusCode === 401) onNeedAuth(); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Restore once per account and editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => { if (restored) { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* The in-memory form remains available. */ } } }, [draft, draftKey, restored]);
  const selected = outfits.find(o => o.current_version_id === draft.version);
  const frozen = post?.outfit_version_id === draft.version;
  const snapshot: OutfitSnapshot | undefined = frozen ? post.snapshot : selected?.current_snapshot;
  const items = snapshot?.items || [];
  const patch = (value: Partial<Draft>) => { setPreview(false); setDraft(d => ({ ...d, ...value, requestKey: crypto.randomUUID(), fingerprint: undefined })); };
  const validate = () => {
    if (!draft.title.trim()) { setError('Nhập tiêu đề bài đăng.'); return false; }
    if (!draft.version || !snapshot) { setError('Chọn một bộ phối đã lưu.'); return false; }
    setError(''); return true;
  };
  const submit = async () => {
    if (busy || !validate() || !owner || !snapshot) return;
    setBusy(true); setError(''); setCreateConflict(false);
    try {
      let media = draft.media;
      if (!media) {
        if (catalog.itemsError || !catalog.isLoaded || !canvas.current) throw new Error('Chờ trang phục tải đầy đủ trước khi tạo ảnh.');
        if (items.some(item => !catalog.catalogItems.some(candidate => candidate.id === item.itemId))) throw new Error('Một món trong bộ phối không còn khả dụng. Mở Studio để cập nhật trước khi đăng.');
        setStage('Đang tạo ảnh bộ phối…');
        const blob = await canvas.current.exportToBlob(snapshot.aspectRatio || '9:16');
        if (activeOwner.current !== owner) return;
        setStage('Đang tải ảnh…');
        media = await communityApi.uploadCover(blob);
        if (activeOwner.current !== owner) return;
        setDraft(d => ({ ...d, media }));
      }
      const payload = { title: draft.title.trim(), description: draft.description, visibility: draft.visibility, outfit_version_id: draft.version, cover_media_id: media };
      setStage('Đang lưu bài đăng…');
      const result = post ? await communityApi.update(post.id, { ...payload, revision: post.revision }) : await communityApi.create(payload, draft.requestKey);
      if (activeOwner.current !== owner) return;
      sessionStorage.removeItem(draftKey);
      onPublished(result);
    } catch (e: any) {
      if (activeOwner.current === owner) {
        setCreateConflict(!post && e.statusCode === 409);
        setError(e.statusCode === 409 ? post ? 'Bài đăng đã thay đổi. Nội dung đang soạn vẫn được giữ. Đóng cửa sổ và tải lại bài trước khi tiếp tục.' : 'Lần đăng trước có thể đã thành công. Kiểm tra Của tôi trước khi tạo bài mới. Nội dung đang soạn vẫn được giữ.' : e.message || 'Chưa đăng được bài. Nội dung đang soạn vẫn được giữ.');
        if (e.statusCode === 401) onNeedAuth();
      }
    } finally { if (activeOwner.current === owner) { setBusy(false); setStage(''); } }
  };
  return <Modal isOpen onClose={onClose} closeDisabled={busy} label={post ? 'Sửa bài đăng bộ phối' : 'Đăng bộ phối'}>
    <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#FAF8F5] shadow-xl">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4"><h2 className="font-serif text-xl font-bold">{post ? 'Sửa bài đăng' : 'Đăng bộ phối'}</h2><button type="button" className={control} aria-label="Đóng cửa sổ đăng bài" onClick={onClose} disabled={busy}><X size={18} /></button></div>
      <div className="grid gap-6 overflow-y-auto p-5 md:grid-cols-2">
        <div className="space-y-3">
          {frozen && draft.media === post?.cover_media_id ? <PostImage post={post!} large /> : snapshot ? <div role="img" aria-label="Ảnh xem trước bài đăng" className="rounded-xl border border-stone-200 bg-white p-3"><div ref={element => { element?.setAttribute('inert', ''); }}><Canvas2D key={draft.version} ref={canvas} lockedSlots={items.map(item => item.slot)} className="[&_.studio-board-zoom]:hidden [&_.studio-transform-controls]:hidden" avatar={null} equippedItems={items} catalogItems={catalog.catalogItems}
            layers={items.flatMap(item => { const layer = catalog.catalogItems.find(i => i.id === item.itemId)?.default_layer; return layer ? [layer] : []; })}
            aspectRatio={snapshot.aspectRatio} backgroundTheme={snapshot.backgroundTheme} neutralBackgroundTheme={snapshot.neutralBackgroundTheme} backgroundFade={snapshot.backgroundFade} occasionId={snapshot.occasionId} /></div></div> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">Chọn bộ phối để xem trước ảnh.</div>}
          <p className="text-sm text-stone-600">Bài đăng giữ phiên bản bộ phối đã chọn. Khi sửa trong Studio, bạn có thể chủ động cập nhật bài sau.</p>
          {catalog.itemsError && <div role="alert" className="text-sm text-red-800">{catalog.itemsError}<button className={control} onClick={() => void catalog.refreshCatalog()}>Tải lại trang phục</button></div>}
        </div>
        <div className="space-y-4">
          <label className="block space-y-2"><span className="font-semibold">Bộ phối đã lưu</span><select className={field} value={draft.version} disabled={busy || loading} onChange={e => { const outfit = outfits.find(o => o.current_version_id === e.target.value); patch({ version: e.target.value, media: undefined, title: draft.title || outfit?.title || '' }); }}><option value="">{loading ? 'Đang tải bộ phối…' : 'Chọn bộ phối'}</option>{post && !outfits.some(o => o.current_version_id === post.outfit_version_id) && <option value={post.outfit_version_id}>Phiên bản đang đăng (v{post.version_number})</option>}{outfits.filter(o => o.current_version_id).map(o => <option key={o.id} value={o.current_version_id}>{o.title}</option>)}</select></label>
          {!loading && outfits.length === 0 && !post && <p className="text-sm">Bạn chưa lưu bộ phối. <Link href="/studio" className="font-semibold text-heritage-red underline">Tạo trong Studio</Link></p>}
          <label className="block space-y-2"><span className="font-semibold">Tiêu đề</span><input className={field} maxLength={160} value={draft.title} disabled={busy} onChange={e => patch({ title: e.target.value })} /></label>
          <label className="block space-y-2"><span className="font-semibold">Mô tả</span><textarea className={field} rows={4} maxLength={3000} value={draft.description} disabled={busy} onChange={e => patch({ description: e.target.value })} /></label>
          <label className="block space-y-2"><span className="font-semibold">Ai có thể xem?</span><select className={field} value={draft.visibility} disabled={busy} onChange={e => patch({ visibility: e.target.value as Visibility })}><option value="private">Riêng tư — chỉ mình tôi</option><option value="unlisted">Người có liên kết</option><option value="public">Công khai — xuất hiện ở Khám phá</option></select></label>
          <p className="text-sm text-stone-600">{draft.visibility === 'private' ? 'Chỉ bạn xem được. Chuyển về riêng tư sẽ thu hồi các link chia sẻ.' : draft.visibility === 'unlisted' ? 'Không xuất hiện ở Khám phá. Bất kỳ ai nhận được link hợp lệ đều có thể xem và chuyển tiếp link.' : 'Mọi người có thể xem và lưu bài vào Yêu thích. Ảnh đã tải xuống bên ngoài không thể thu hồi.'}</p>
          {preview && <div role="status" className="rounded-xl border border-red-200 bg-white p-4"><p className="font-serif text-lg font-bold">{draft.title}</p><p className="whitespace-pre-wrap break-words text-sm">{draft.description || 'Chưa có mô tả.'}</p><p className="mt-2 text-sm">Tác giả: {user?.displayName}</p></div>}
          {createConflict && <div className="flex flex-wrap gap-2"><Link className={control} href="/lookbook?tab=mine" onClick={onClose}>Kiểm tra bài của tôi</Link><button className={control} type="button" onClick={() => { setDraft(d => ({ ...d, requestKey: crypto.randomUUID() })); setPreview(false); setCreateConflict(false); setError(''); }}>Dùng nội dung này cho bài mới</button></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {busy && <p role="status" className="text-sm">{stage}</p>}
          <div className="flex flex-wrap gap-2"><button className={control} type="button" disabled={busy || loading} onClick={() => { if (validate()) setPreview(true); }}>Xem trước bài đăng</button><button className={primary} type="button" disabled={busy || !preview || !draft.requestKey} onClick={() => void submit()}>{busy ? 'Đang lưu…' : post ? 'Lưu thay đổi' : draft.visibility === 'public' ? 'Đăng công khai' : draft.visibility === 'unlisted' ? 'Tạo bài chia sẻ qua liên kết' : 'Lưu riêng tư'}</button></div>
        </div>
      </div>
    </div>
  </Modal>;
}
