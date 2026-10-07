"use client";
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { communityApi } from '@/lib/api/community';
import { useAuth } from '@/lib/auth/context';
import type { CommunityAuthor } from '@/lib/types/community';
import CommunityWorkspace from './CommunityWorkspace';
import { CommunityAvatar, control, field, primary } from './PostCard';
import LookbookShell from './LookbookShell';
export default function AuthorProfile({ id }: { id: string }) {
  const { user } = useAuth(); const owner = useRef(user?.id); owner.current = user?.id;
  const [author, setAuthor] = useState<CommunityAuthor | null>(null); const [bio, setBio] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; communityApi.profile(id).then(data => { if (live) { setAuthor(data); setBio(data.bio); } }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [id]);
  useEffect(() => { setEditing(false); setNotice(''); }, [user?.id]);
  return <LookbookShell activeTab="explore">
    <Link className={control} href="/lookbook">← Lookbook</Link>
    <section className="lookbook-panel space-y-4 p-5">
      <div className="flex min-w-0 items-center gap-4"><span className="lookbook-author-avatar"><CommunityAvatar name={author?.display_name || 'VietStylist'} imageUrl={author?.avatar_url} /></span><div className="min-w-0"><h2 className="text-xl font-semibold [overflow-wrap:anywhere]">{author?.display_name || 'Tác giả Việt phục'}</h2><p className="mt-1 text-sm text-stone-500">Thành viên cộng đồng Việt phục</p></div></div>
      {author && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-600">{author.bio || 'Chia sẻ những bộ phối Việt phục.'}</p>}
      {user?.id === id && <button className={control} onClick={() => setEditing(e => !e)}>Sửa giới thiệu</button>}
      {editing && <div className="space-y-3"><label className="block space-y-2"><span className="text-sm font-semibold">Giới thiệu công khai</span><textarea className={field} value={bio} maxLength={500} onChange={e => setBio(e.target.value)} /></label><button className={primary} disabled={busy} onClick={async () => { const identity = user?.id; setBusy(true); setError(''); try { const updated = await communityApi.updateProfile(bio); if (identity === owner.current) { setAuthor(updated); setEditing(false); setNotice('Đã lưu giới thiệu.'); } } catch (e: any) { if (identity === owner.current) setError(e.message); } finally { if (identity === owner.current) setBusy(false); } }}>Lưu giới thiệu</button></div>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    </section>
    {author && <><h2 className="px-1 text-lg font-semibold">Bộ phối công khai</h2><Suspense fallback={<p role="status">Đang tải…</p>}><CommunityWorkspace authorId={id} /></Suspense></>}
  </LookbookShell>;
}
