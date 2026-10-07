"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { communityApi } from '@/lib/api/community';
import { apiFetch } from '@/lib/api/client';
import type { PostDetail, PostReport } from '@/lib/types/community';
import AuthModal from '@/components/AuthModal';
import { PostImage, control, field, primary } from './PostCard';
import LookbookShell, { LookbookEmptyState } from './LookbookShell';

export default function ModerationWorkspace() {
  const { user, isAdmin, isReady } = useAuth();
  const identity = user?.id;
  const owner = useRef(identity); owner.current = identity;
  const [tab, setTab] = useState<'reports' | 'hidden'>('reports');
  const [reports, setReports] = useState<PostReport[]>([]);
  const [posts, setPosts] = useState<PostDetail[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [auth, setAuth] = useState(false);
  const generation = useRef(0);
  const [loadedScope, setLoadedScope] = useState('');
  const scope = `${identity}:${tab}`;

  const load = useCallback(async (next?: string) => {
    const request = ++generation.current;
    if (!isAdmin || !identity) { setLoading(false); return; }
    if (next) setLoadingMore(true);
    else { setLoading(true); setPosts([]); setReports([]); setCursor(null); }
    setError('');
    try {
      if (tab === 'reports') {
        const result = await communityApi.reports(next);
        if (request !== generation.current || owner.current !== identity) return;
        setReports(old => next ? [...old, ...result.items.filter(item => !old.some(existing => existing.id === item.id))] : result.items);
        setCursor(result.next_cursor);
      } else {
        const result = await apiFetch<{ items: PostDetail[]; next_cursor: string | null }>('/api/lookbook-posts/moderation/posts' + (next ? '?cursor=' + encodeURIComponent(next) : ''));
        if (request !== generation.current || owner.current !== identity) return;
        setPosts(old => next ? [...old, ...result.items.filter(item => !old.some(existing => existing.id === item.id))] : result.items);
        setCursor(result.next_cursor);
      }
      setLoadedScope(scope);
    } catch (e: any) {
      if (request === generation.current && owner.current === identity) setError(e.message || 'Không tải được nội dung kiểm duyệt.');
    } finally {
      if (request === generation.current && owner.current === identity) { setLoading(false); setLoadingMore(false); }
    }
  }, [isAdmin, identity, tab, scope]);

  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => { setReasons({}); setNotice(''); setBusy(false); }, [identity]);

  const chooseTab = (next: typeof tab) => {
    if (next === tab) return;
    generation.current++; setTab(next); setLoadedScope(''); setCursor(null);
    setLoading(true); setLoadingMore(false); setError(''); setNotice('');
  };
  const moderate = async (post: PostDetail, hidden: boolean) => {
    const reason = reasons[post.id]?.trim();
    if (!reason) {
      setError('Nhập lý do xử lý để tác giả biết.');
      document.getElementById('moderation-reason-' + post.id)?.focus();
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await communityApi.moderate(post.id, post.revision, hidden, reason);
      if (owner.current !== identity) return;
      setNotice(hidden ? 'Đã ẩn bài và thu hồi link.' : 'Đã cập nhật bài và giải quyết báo cáo.');
      await load();
    } catch (e: any) { if (owner.current === identity) setError(e.message); }
    finally { if (owner.current === identity) setBusy(false); }
  };
  const resolveReport = async (id: string) => {
    setBusy(true); setError('');
    try {
      await communityApi.resolveReport(id);
      if (owner.current !== identity) return;
      setNotice('Đã đóng báo cáo.'); await load();
    } catch (e: any) { if (owner.current === identity) setError(e.message); }
    finally { if (owner.current === identity) setBusy(false); }
  };

  const rows = tab === 'hidden' ? posts.map(post => ({ key: post.id, post, text: post.moderation_reason })) : reports.map(report => ({ key: report.id, post: report.post, text: report.reason + (report.details ? ': ' + report.details : '') }));
  const currentData = loadedScope === scope;

  return <LookbookShell activeTab="moderation">
    <div className="lookbook-panel space-y-4 p-5">
      <div><h2 className="text-lg font-semibold text-stone-900">Kiểm duyệt Lookbook</h2><p className="mt-1 text-sm text-stone-500">Xử lý báo cáo và quản lý các bài đăng đã bị ẩn.</p></div>
      {isAdmin && <div className="flex flex-wrap gap-2" aria-label="Nội dung kiểm duyệt">
        <button type="button" className={control + (tab === 'reports' ? ' !border-red-200 !bg-red-50 !text-heritage-red' : '')} disabled={busy} aria-pressed={tab === 'reports'} onClick={() => chooseTab('reports')}>Báo cáo chờ xử lý</button>
        <button type="button" className={control + (tab === 'hidden' ? ' !border-red-200 !bg-red-50 !text-heritage-red' : '')} disabled={busy} aria-pressed={tab === 'hidden'} onClick={() => chooseTab('hidden')}>Bài đang bị ẩn</button>
      </div>}
    </div>
    {!isReady ? <p role="status" className="lookbook-panel p-5 text-sm text-stone-500">Đang xác thực…</p> : !isAdmin ? <LookbookEmptyState icon={ShieldCheck} title="Trang này dành cho quản trị viên" description="Tài khoản cần quyền quản trị để xem và xử lý nội dung kiểm duyệt.">{!user && <button className={primary} onClick={() => setAuth(true)}>Đăng nhập</button>}</LookbookEmptyState> : <>
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><span>{error}</span><button className={control} disabled={loading || busy} onClick={() => void load()}>Thử lại</button></div>}
      {loading && <p role="status" className="lookbook-panel p-5 text-sm text-stone-500">Đang tải nội dung kiểm duyệt…</p>}
      {currentData && rows.map(row => <article key={row.key} className="lookbook-panel space-y-4 overflow-hidden p-4 sm:p-5">
        {row.post ? <>
          <div className="flex min-w-0 gap-4"><div className="w-20 shrink-0 sm:w-28"><PostImage post={row.post} /></div><div className="min-w-0 space-y-1"><h3 className="text-base font-semibold text-stone-900 [overflow-wrap:anywhere]">{row.post.title}</h3><p className="text-sm text-stone-500">Tác giả: {row.post.author.display_name}</p><p className="line-clamp-3 whitespace-pre-wrap text-sm text-stone-600 [overflow-wrap:anywhere]">{row.post.description}</p></div></div>
          <p className="rounded-lg bg-stone-100 p-3 text-sm [overflow-wrap:anywhere]">{row.text}</p>
          <label className="block space-y-2"><span className="text-sm font-semibold">Lý do xử lý</span><textarea id={'moderation-reason-' + row.post.id} className={field + ' min-h-24'} rows={3} maxLength={1000} value={reasons[row.post.id] || ''} onChange={e => setReasons(old => ({ ...old, [row.post!.id]: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-2">{tab === 'reports' && <button className={primary} disabled={busy} onClick={() => void moderate(row.post!, true)}>Ẩn bài và thu hồi link</button>}<button className={control} disabled={busy} onClick={() => void moderate(row.post!, false)}>{tab === 'hidden' ? 'Khôi phục hiển thị' : 'Giữ bài và đóng báo cáo'}</button></div>
        </> : <><p className="text-sm [overflow-wrap:anywhere]">Bài đã bị xóa. {row.text}</p><button className={control} disabled={busy} onClick={() => void resolveReport(row.key)}>Đóng báo cáo</button></>}
      </article>)}
      {!loading && currentData && !rows.length && !error && <LookbookEmptyState icon={tab === 'reports' ? Flag : ShieldCheck} title={tab === 'reports' ? 'Không có báo cáo chờ xử lý' : 'Không có bài đăng bị ẩn'} description="Không có nội dung cần xử lý." />}
      {currentData && cursor && <div className="text-center"><button className={control} disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? 'Đang tải…' : 'Xem thêm'}</button></div>}
    </>}
    <AuthModal isOpen={auth} onClose={() => setAuth(false)} />
  </LookbookShell>;
}
