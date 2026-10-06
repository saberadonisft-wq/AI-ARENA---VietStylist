"use client";
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { communityApi } from '@/lib/api/community';
import { useAuth } from '@/lib/auth/context';
import type { CommunityAuthor } from '@/lib/types/community';
import CommunityWorkspace from './CommunityWorkspace';
import { control, field, primary } from './PostCard';
export default function AuthorProfile({ id }: { id: string }) {
  const { user } = useAuth(); const owner = useRef(user?.id); owner.current = user?.id;
  const [author, setAuthor] = useState<CommunityAuthor | null>(null); const [bio, setBio] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; communityApi.profile(id).then(data => { if (live) { setAuthor(data); setBio(data.bio); } }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [id]);
  useEffect(() => { setEditing(false); setNotice(''); }, [user?.id]);
  return <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6"><Link className={control} href="/lookbook">← Lookbook</Link><div className="mt-5 space-y-4 rounded-2xl border border-stone-200 bg-white p-6"><h1 className="font-serif text-3xl font-bold">{author?.display_name || 'Tác giả Việt phục'}</h1>{author && <p className="whitespace-pre-wrap break-words text-stone-600">{author.bio || 'Chia sẻ những bộ phối Việt phục.'}</p>}{user?.id === id && <button className={control} onClick={() => setEditing(e => !e)}>Sửa giới thiệu</button>}{editing && <div className="space-y-3"><label className="block space-y-2"><span>Giới thiệu công khai</span><textarea className={field} value={bio} maxLength={500} onChange={e => setBio(e.target.value)} /></label><button className={primary} disabled={busy} onClick={async () => { const identity = user?.id; setBusy(true); setError(''); try { const updated = await communityApi.updateProfile(bio); if (identity === owner.current) { setAuthor(updated); setEditing(false); setNotice('Đã lưu giới thiệu.'); } } catch (e: any) { if (identity === owner.current) setError(e.message); } finally { if (identity === owner.current) setBusy(false); } }}>Lưu giới thiệu</button></div>}{error && <p role="alert" className="text-red-800">{error}</p>}{notice && <p role="status" className="text-green-800">{notice}</p>}</div>{author && <><h2 className="mt-7 font-serif text-2xl font-bold">Bộ phối công khai</h2><Suspense fallback={<p>Đang tải…</p>}><CommunityWorkspace authorId={id} /></Suspense></>}</div>;
}
