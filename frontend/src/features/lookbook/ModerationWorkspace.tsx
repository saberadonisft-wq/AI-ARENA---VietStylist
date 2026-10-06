"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { communityApi } from '@/lib/api/community';
import { apiFetch } from '@/lib/api/client';
import type { PostDetail, PostReport } from '@/lib/types/community';
import AuthModal from '@/components/AuthModal';
import { PostImage, control, field, primary } from './PostCard';
export default function ModerationWorkspace() {
  const { user, isAdmin, isReady } = useAuth(); const owner = useRef(user?.id); owner.current = user?.id;
  const [tab, setTab] = useState<'reports' | 'hidden'>('reports');
  const [reports, setReports] = useState<PostReport[]>([]); const [posts, setPosts] = useState<PostDetail[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [auth, setAuth] = useState(false);
  const generation = useRef(0); const [loadedOwner, setLoadedOwner] = useState('');
  const load = useCallback(async (next?: string) => {
    const request = ++generation.current; if (!isAdmin || !user) return;
    const identity = user.id; setLoading(true); setError('');
    try {
      if (tab === 'reports') { const result = await communityApi.reports(next); if (request !== generation.current || owner.current !== identity) return; setReports(old => next ? [...old, ...result.items] : result.items); setCursor(result.next_cursor); }
      else { const result = await apiFetch<{ items: PostDetail[]; next_cursor: string | null }>('/api/lookbook-posts/moderation/posts' + (next ? '?cursor=' + encodeURIComponent(next) : '')); if (request !== generation.current || owner.current !== identity) return; setPosts(old => next ? [...old, ...result.items] : result.items); setCursor(result.next_cursor); }
      setLoadedOwner(identity);
    } catch (e: any) { if (request === generation.current) setError(e.message); }
    finally { if (request === generation.current) setLoading(false); }
  }, [isAdmin, user, tab]);
  useEffect(() => { setPosts([]); setReports([]); void load(); return () => { generation.current++; }; }, [load]);
  const moderate = async (post: PostDetail, hidden: boolean) => {
    const reason = reasons[post.id]?.trim(); if (!reason) { setError('Nhập lý do xử lý để tác giả biết.'); return; }
    const identity = user?.id; setBusy(true); setError('');
    try { await communityApi.moderate(post.id, post.revision, hidden, reason); if (owner.current !== identity) return; setNotice(hidden ? 'Đã ẩn bài và thu hồi link.' : 'Đã cập nhật bài và giải quyết báo cáo.'); await load(); }
    catch (e: any) { if (owner.current === identity) setError(e.message); }
    finally { if (owner.current === identity) setBusy(false); }
  };
  const rows = tab === 'hidden' ? posts.map(post => ({ key: post.id, post, text: post.moderation_reason })) : reports.map(report => ({ key: report.id, post: report.post, text: report.reason + (report.details ? ': ' + report.details : '') }));
  return <div className="mx-auto max-w-5xl space-y-5 px-4 py-8"><Link className={control} href="/lookbook">← Lookbook</Link><h1 className="font-serif text-3xl font-bold">Kiểm duyệt Lookbook</h1>{!isReady ? <p role="status">Đang xác thực…</p> : !isAdmin ? <p>Trang này dành cho quản trị viên. {!user && <button className={primary} onClick={() => setAuth(true)}>Đăng nhập</button>}</p> : <><div className="flex flex-wrap gap-2"><button className={control} aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>Báo cáo chờ xử lý</button><button className={control} aria-pressed={tab === 'hidden'} onClick={() => setTab('hidden')}>Bài đang bị ẩn</button></div>{notice && <p role="status" className="text-green-800">{notice}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}{loading && <p role="status">Đang tải…</p>}{loadedOwner === user?.id && rows.map(row => <article key={row.key} className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-[180px_1fr]">{row.post ? <><PostImage post={row.post} /><div className="space-y-3"><h2 className="font-serif text-xl font-bold">{row.post.title}</h2><p>Tác giả: {row.post.author.display_name}</p><p className="whitespace-pre-wrap break-words">{row.post.description}</p><p className="rounded-xl bg-stone-50 p-3 text-sm">{row.text}</p><label className="block space-y-2"><span>Lý do xử lý</span><textarea className={field} maxLength={1000} value={reasons[row.post.id] || ''} onChange={e => setReasons(old => ({ ...old, [row.post!.id]: e.target.value }))} /></label><div className="flex flex-wrap gap-2">{tab === 'reports' && <button className={primary} disabled={busy} onClick={() => void moderate(row.post!, true)}>Ẩn bài và thu hồi link</button>}<button className={control} disabled={busy} onClick={() => void moderate(row.post!, false)}>{tab === 'hidden' ? 'Khôi phục hiển thị' : 'Giữ bài và đóng báo cáo'}</button></div></div></> : <div className="space-y-3"><p>Bài đã bị xóa. {row.text}</p><button className={control} disabled={busy} onClick={async () => { setBusy(true); try { await communityApi.resolveReport(row.key); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Đóng báo cáo</button></div>}</article>)}{!loading && !rows.length && <p>Không có nội dung cần xử lý.</p>}{cursor && <button className={control} disabled={loading} onClick={() => void load(cursor)}>Xem thêm</button>}</>}<AuthModal isOpen={auth} onClose={() => setAuth(false)} /></div>;
}
