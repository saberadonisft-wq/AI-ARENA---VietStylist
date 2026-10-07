"use client";
import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { communityApi } from '@/lib/api/community';
import { useAuth } from '@/lib/auth/context';
import type { PostCard, PostShare } from '@/lib/types/community';
import { control, field, primary } from './PostCard';

export default function ShareDialog({ post, onClose, onNeedAuth }: { post: PostCard; onClose: () => void; onNeedAuth: () => void }) {
  const { user } = useAuth();
  const mine = user?.id === post.author.id;
  const owner = useRef(user?.id); owner.current = user?.id;
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [links, setLinks] = useState<PostShare[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    setLinks([]); setError(''); setUrl(post.visibility === 'public' ? window.location.origin + '/lookbook/bai-dang/' + post.id : '');
    if (mine) communityApi.shares(post.id).then(data => { if (live) setLinks(data); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [post.id, post.visibility, mine, user?.id]);
  const mutate = async (action: () => Promise<void>) => {
    const identity = user?.id;
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e: any) { if (identity === owner.current) { setError(e.message); if (e.statusCode === 401) onNeedAuth(); } }
    finally { if (identity === owner.current) setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setNotice('Đã sao chép liên kết.'); } catch { setNotice('Chọn và sao chép liên kết trong ô bên trên.'); } };
  return <Modal isOpen onClose={onClose} closeDisabled={busy} label="Chia sẻ bộ phối"><div className="max-h-full w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
    <h2 className="font-serif text-2xl font-bold">Chia sẻ bộ phối</h2>
    {post.visibility === 'private' ? <p>Đổi quyền xem thành Công khai hoặc Người có liên kết trong phần sửa bài trước khi chia sẻ.</p> : <>
      <p className="text-sm text-stone-600">{post.visibility === 'unlisted' ? 'Bất kỳ ai nhận được link hợp lệ đều có thể xem. Bạn có thể thu hồi từng link.' : 'Link công khai dùng được khi bài còn công khai.'}</p>
      {url && <><label className="block space-y-2"><span className="text-sm font-semibold">Liên kết chia sẻ</span><input readOnly value={url} className={field} onFocus={e => e.target.select()} /></label><div className="flex flex-wrap gap-2"><button className={primary} onClick={() => void copy()}>Sao chép liên kết</button>{typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button className={control} onClick={() => void navigator.share({ title: post.title, url }).catch(() => {})}>Chia sẻ trên thiết bị</button>}</div></>}
      {mine && <><label className="block space-y-2"><span className="text-sm font-semibold">Thời hạn link riêng</span><select className={field} value={days} disabled={busy} onChange={e => setDays(Number(e.target.value) as 1 | 7 | 30)}><option value={1}>1 ngày</option><option value={7}>7 ngày</option><option value={30}>30 ngày</option></select></label><button className={control} disabled={busy || post.moderation_status !== 'visible'} onClick={() => void mutate(async () => { const created = await communityApi.createShare(post.id, days); if (owner.current !== user?.id) return; setUrl(window.location.origin + '/lookbook/chia-se/' + created.share_token); setLinks(await communityApi.shares(post.id)); setNotice('Đã tạo liên kết. Sao chép ngay để gửi cho người nhận.'); })}>{busy ? 'Đang xử lý…' : 'Tạo liên kết có thời hạn'}</button>
        <ul className="space-y-2">{links.map(link => <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 p-3 text-sm"><span>Link {link.token_prefix}…<br />{link.revoked_at ? 'Đã thu hồi' : Date.parse(link.expires_at) <= Date.now() ? 'Đã hết hạn' : 'Hết hạn ' + new Date(link.expires_at).toLocaleDateString('vi-VN')}</span>{!link.revoked_at && <button className={control} disabled={busy} onClick={() => void mutate(async () => { await communityApi.revokeShare(post.id, link.id); if (owner.current !== user?.id) return; setLinks(await communityApi.shares(post.id)); setUrl(''); setNotice('Đã thu hồi liên kết.'); })}>Thu hồi</button>}</li>)}</ul>
        {links.some(l => !l.revoked_at) && <button className={control} disabled={busy} onClick={() => void mutate(async () => { await communityApi.revokeShare(post.id); if (owner.current !== user?.id) return; setLinks(await communityApi.shares(post.id)); setUrl(''); setNotice('Đã thu hồi tất cả liên kết có thời hạn.'); })}>Thu hồi tất cả link riêng</button>}</>}
    </>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    <button className={control} disabled={busy} onClick={onClose}>Đóng</button>
  </div></Modal>;
}
