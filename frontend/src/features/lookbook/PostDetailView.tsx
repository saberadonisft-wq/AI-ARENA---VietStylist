"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Share2, Pencil, Trash2 } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import Modal from '@/components/ui/Modal';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth/context';
import { communityApi } from '@/lib/api/community';
import { useCatalog } from '@/lib/catalog/CatalogProvider';
import { itemLabel, slotLabel, styleLabel, occasionLabel } from '@/lib/catalog/display';
import type { PostDetail } from '@/lib/types/community';
import { CommunityAvatar, PostImage, control, primary, field, visibilityLabel } from './PostCard';
import LookbookShell from './LookbookShell';
import PostComposer from './PostComposer';
import ShareDialog from './ShareDialog';

export default function PostDetailView({ id, token }: { id?: string; token?: string }) {
  const { user, token: authToken, isLoggedIn, isReady } = useAuth(); const router = useRouter();
  const { confirm, dialog } = useConfirmDialog(); const catalog = useCatalog();
  const owner = useRef(user?.id); owner.current = user?.id;
  const [post, setPost] = useState<PostDetail | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState(false); const [pendingSave, setPendingSave] = useState(false);
  const waitingToken = useRef<string | null>(null);
  const [editing, setEditing] = useState(false); const [sharing, setSharing] = useState(false); const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('spam'); const [details, setDetails] = useState(''); const version = useRef(0);
  const [dataOwner, setDataOwner] = useState<string | undefined>();
  const load = useCallback(async () => {
    if (!isReady) return;
    const request = ++version.current; const identity = user?.id;
    setLoading(true); setError(''); setPost(null);
    try { const result = token ? await communityApi.shared(token) : await communityApi.post(id!); if (request === version.current && identity === owner.current) { setPost(result); setDataOwner(identity); } }
    catch (e: any) { if (request === version.current) { setError(e.message); if (e.statusCode === 401) setAuth(true); } }
    finally { if (request === version.current) setLoading(false); }
  }, [id, token, user?.id, isReady]);
  const ensureLoaded = catalog.ensureLoaded;
  useEffect(() => { void load(); void ensureLoaded(); return () => { version.current++; }; }, [load, ensureLoaded]);
  useEffect(() => { setEditing(false); setSharing(false); setReporting(false); setBusy(false); setNotice(''); setError(''); }, [user?.id]);
  useEffect(() => { const focus = () => { if (!editing && !sharing && !reporting) void load(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, editing, sharing, reporting]);
  const action = useCallback(async (run: () => Promise<void>) => {
    if (busy) return; const identity = user?.id;
    setBusy(true); setError(''); setNotice('');
    try { await run(); } catch (e: any) { if (identity === owner.current) { setError(e.message); if (e.statusCode === 401) setAuth(true); } }
    finally { if (identity === owner.current) setBusy(false); }
  }, [busy, user?.id]);
  const save = useCallback(() => {
    if (!post) return;
    if (!isLoggedIn) { waitingToken.current = authToken; setPendingSave(true); setAuth(true); return; }
    const identity = user?.id;
    void action(async () => { try { await communityApi.favorite(post.id, !post.is_favorite); } catch (e: any) { if (owner.current === identity && e.statusCode === 401) { waitingToken.current = authToken; setPendingSave(true); } throw e; } if (owner.current !== identity) return; setPost(p => p && ({ ...p, is_favorite: !p.is_favorite })); setNotice(post.is_favorite ? 'Đã bỏ lưu bộ phối.' : 'Đã lưu vào Yêu thích.'); });
  }, [post, isLoggedIn, user?.id, action, authToken]);
  useEffect(() => { if (pendingSave && isReady && isLoggedIn && post && authToken !== waitingToken.current) { setPendingSave(false); setAuth(false); save(); } }, [pendingSave, isReady, isLoggedIn, post, save, authToken]);
  const mine = post?.author.id === user?.id;
  return <LookbookShell activeTab={mine ? 'mine' : 'explore'}>
    <Link className={control} href="/lookbook">← Quay lại Lookbook</Link>
    {loading ? <p role="status">Đang tải bộ phối…</p> : !post || dataOwner !== user?.id ? <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-8"><h1 className="font-serif text-2xl font-bold">Bộ phối chưa khả dụng</h1><p role="alert">{error || 'Bài không tồn tại hoặc bạn chưa có quyền xem.'}</p><button className={control} onClick={() => void load()}>Thử tải lại</button>{!isLoggedIn && !token && <button className={primary} onClick={() => setAuth(true)}>Đăng nhập để xem bài của tôi</button>}</div> : <>
      <article className="lookbook-panel overflow-hidden"><header className="flex items-center gap-3 border-b border-stone-100 p-4"><Link href={'/lookbook/tac-gia/' + post.author.id} aria-label={'Trang của ' + post.author.display_name}><CommunityAvatar name={post.author.display_name} imageUrl={post.author.avatar_url} /></Link><div className="min-w-0"><Link href={'/lookbook/tac-gia/' + post.author.id} className="block truncate text-sm font-semibold hover:underline">{post.author.display_name}</Link><p className="mt-0.5 text-xs text-stone-500">{visibilityLabel[post.visibility]} · {new Date(post.created_at).toLocaleDateString('vi-VN')}</p></div></header><div className="space-y-5 p-4 sm:p-5">
        <h2 className="break-words text-xl font-semibold text-stone-950">{post.title}</h2>
        <p className="whitespace-pre-wrap break-words text-stone-700">{post.description || 'Tác giả chưa thêm mô tả.'}</p>
        <PostImage post={post} large />
        <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-stone-500">Phong cách</dt><dd className="mt-1 font-semibold">{styleLabel(post.style_mode)}</dd></div><div><dt className="text-stone-500">Dịp sử dụng</dt><dd className="mt-1 font-semibold">{occasionLabel(post.occasion_id || undefined, catalog.occasions)}</dd></div></dl>
        {post.moderation_status === 'hidden' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Bài đang bị ẩn khỏi cộng đồng. {post.moderation_reason}</p>}
        <div className="flex flex-wrap gap-2">{post.visibility === 'public' && post.moderation_status === 'visible' && <button className={control} disabled={busy} aria-pressed={post.is_favorite} onClick={save}><Bookmark size={17} aria-hidden="true" />{post.is_favorite ? 'Đã lưu — bỏ yêu thích' : 'Lưu yêu thích'}</button>}{(mine || post.visibility === 'public') && <button className={control} onClick={() => setSharing(true)}><Share2 size={17} aria-hidden="true" />Chia sẻ</button>}{mine && <><button className={control} onClick={() => setEditing(true)}><Pencil size={17} aria-hidden="true" />Sửa bài / quyền xem</button><button className={control} disabled={busy} onClick={() => void confirm({ title: 'Xóa bài đăng này?', description: 'Bài sẽ ngừng hiển thị và các link bị thu hồi. Bộ phối đã lưu trong Studio vẫn còn.', confirmLabel: 'Xóa bài đăng', tone: 'danger' }).then(accepted => { if (accepted) void action(async () => { await communityApi.delete(post.id); router.push('/lookbook?tab=mine'); }); })}><Trash2 size={17} aria-hidden="true" />Xóa bài</button></>}{!mine && post.visibility === 'public' && <button className={control} onClick={() => { if (!isLoggedIn) setAuth(true); else setReporting(true); }}>Báo cáo bài</button>}</div>
        {mine && <Link className={control} href={'/studio?loadOutfit=' + encodeURIComponent(post.outfit_id)}>Mở bộ phối của tôi trong Studio</Link>}
        <p className="text-xs leading-relaxed text-stone-500">Các nhãn phong cách thể hiện hướng phối đồ của tác giả.</p>
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      </div></article>
      <div className="lookbook-panel space-y-3 p-5"><h2 className="text-base font-semibold">Trang phục trong bộ phối</h2><ul className="grid gap-3 sm:grid-cols-2">{post.snapshot.items.map(item => <li key={item.slot} className="rounded-xl bg-stone-50 p-3 text-sm"><span className="text-stone-500">{slotLabel(item.slot)}: </span>{itemLabel(item.itemId, catalog.catalogItems)}</li>)}</ul></div>
      {editing && mine && <PostComposer key={user?.id + post.id} post={post} onClose={() => setEditing(false)} onNeedAuth={() => setAuth(true)} onPublished={updated => { setPost(updated); setEditing(false); setNotice('Đã cập nhật bài đăng.'); }} />}
      {sharing && <ShareDialog key={user?.id + post.id} post={post} onClose={() => setSharing(false)} onNeedAuth={() => setAuth(true)} />}
      {reporting && <Modal isOpen onClose={() => setReporting(false)} closeDisabled={busy} label="Báo cáo bài đăng"><div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"><h2 className="font-serif text-xl font-bold">Báo cáo bài đăng</h2><label className="block space-y-2"><span>Lý do</span><select className={field} value={reason} onChange={e => setReason(e.target.value)}><option value="spam">Spam</option><option value="inappropriate">Nội dung không phù hợp</option><option value="copyright">Quyền sử dụng hình ảnh</option><option value="misleading">Thông tin gây hiểu nhầm</option><option value="other">Khác</option></select></label><label className="block space-y-2"><span>Mô tả thêm</span><textarea className={field} value={details} maxLength={1000} onChange={e => setDetails(e.target.value)} /></label>{error && <p role="alert" className="text-red-800">{error}</p>}<div className="flex gap-2"><button className={primary} disabled={busy} onClick={() => void action(async () => { await communityApi.report(post.id, reason, details); setReporting(false); setNotice('Đã gửi báo cáo để quản trị viên xem xét.'); })}>Gửi báo cáo</button><button className={control} disabled={busy} onClick={() => setReporting(false)}>Hủy</button></div></div></Modal>}
    </>}
    <AuthModal isOpen={auth} onClose={() => setAuth(false)} />{dialog}
  </LookbookShell>;
}
