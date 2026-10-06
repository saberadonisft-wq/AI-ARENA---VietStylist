"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, FolderHeart } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { communityApi } from '@/lib/api/community';
import type { FavoriteEntry, PostCard as Post } from '@/lib/types/community';
import type { Occasion } from '@/lib/types/api';
import AuthModal from '@/components/AuthModal';
import CollectionWorkspace from './CollectionWorkspace';
import PostCard, { control, field, primary } from './PostCard';
import PostComposer from './PostComposer';
import ShareDialog from './ShareDialog';

type Tab = 'explore' | 'mine' | 'favorites' | 'collections';
const tabs: Array<[Tab, string]> = [['explore','Khám phá'],['mine','Của tôi'],['favorites','Yêu thích'],['collections','Bộ sưu tập']];
export default function CommunityWorkspace({ authorId }: { authorId?: string }) {
  const router = useRouter(); const search = useSearchParams(); const pathname = usePathname();
  const latestSearch = useRef(search); latestSearch.current = search;
  const { user, token, isReady, isLoggedIn, isAdmin } = useAuth();
  const identity = user?.id || 'guest'; const activeIdentity = useRef(identity); activeIdentity.current = identity;
  const initialTab = !authorId && tabs.some(([id]) => id === search.get('tab')) ? search.get('tab') as Tab : 'explore';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState(search.get('q') || ''); const [query, setQuery] = useState(q);
  const [style, setStyle] = useState(search.get('style') || ''); const [occasion, setOccasion] = useState(search.get('occasion') || '');
  const [visibility, setVisibility] = useState(''); const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [posts, setPosts] = useState<Post[]>([]); const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); const [loadedIdentity, setLoadedIdentity] = useState('');
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [authOpen, setAuthOpen] = useState(false); const [composer, setComposer] = useState(false); const [share, setShare] = useState<Post | null>(null);
  const [pending, setPending] = useState<{ kind: 'publish' } | { kind: 'favorite'; post: Post } | null>(null);
  const generation = useRef(0);
  const initialPublish = useRef(false);
  const waitingToken = useRef<string | null>(null);
  const canRead = isReady && (tab === 'explore' || isLoggedIn);
  const historyKey = `viet_lookbook_list:${identity}:${authorId || ''}:${tab}:${query}:${style}:${occasion}:${visibility}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q.trim());
      if ((latestSearch.current.get('q') || '') === q.trim()) return;
      const params = new URLSearchParams(latestSearch.current);
      if (q.trim()) params.set('q', q.trim()); else params.delete('q');
      router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, pathname, router]);
  useEffect(() => { let live = true; api.getOccasions().then(data => { if (live) setOccasions(data); }).catch(() => {}); return () => { live = false; }; }, []);
  const load = useCallback(async (next?: string) => {
    const request = ++generation.current; const owner = identity;
    if (!canRead || tab === 'collections') { setLoading(false); return; }
    if (next) setLoadingMore(true); else { setLoading(true); setPosts([]); setFavorites([]); }
    setError('');
    try {
      let restore: { count?: number; scroll?: number } = {};
      if (!next) { try { restore = JSON.parse(sessionStorage.getItem(historyKey) || '{}'); } catch { /* Start at the first page. */ } }
      const count = Math.min(1000, Math.max(0, Number(restore.count) || 0));
      if (tab === 'favorites') {
        const result = await communityApi.favorites(next);
        while (!next && result.next_cursor && result.items.length < count) {
          if (request !== generation.current || activeIdentity.current !== owner) return;
          const extra = await communityApi.favorites(result.next_cursor); result.items.push(...extra.items); result.next_cursor = extra.next_cursor;
        }
        if (request !== generation.current || activeIdentity.current !== owner) return;
        setFavorites(old => next ? [...old, ...result.items] : result.items); setCursor(result.next_cursor);
      } else {
        const params = { cursor: next, q: query, style, occasion, owner_id: authorId, visibility };
        const result = tab === 'mine' ? await communityApi.mine(params) : await communityApi.feed(params);
        while (!next && result.next_cursor && result.items.length < count) {
          if (request !== generation.current || activeIdentity.current !== owner) return;
          const pageParams = { ...params, cursor: result.next_cursor };
          const extra = tab === 'mine' ? await communityApi.mine(pageParams) : await communityApi.feed(pageParams);
          result.items.push(...extra.items); result.next_cursor = extra.next_cursor;
        }
        if (request !== generation.current || activeIdentity.current !== owner) return;
        setPosts(old => next ? [...old, ...result.items.filter(p => !old.some(existing => existing.id === p.id))] : result.items); setCursor(result.next_cursor);
      }
      setLoadedIdentity(owner);
      if (!next && Number(restore.scroll) > 0) requestAnimationFrame(() => requestAnimationFrame(() => { if (request === generation.current) window.scrollTo({ top: Number(restore.scroll), behavior: 'instant' }); }));
    } catch (e: any) { if (request === generation.current && activeIdentity.current === owner) { setError(e.message || 'Không tải được bộ phối.'); if (e.statusCode === 401) setAuthOpen(true); } }
    finally { if (request === generation.current && activeIdentity.current === owner) { setLoading(false); setLoadingMore(false); } }
  }, [tab, query, style, occasion, visibility, authorId, identity, canRead, historyKey]);
  useEffect(() => {
    if (loading || loadedIdentity !== identity) return;
    const remember = () => { try { sessionStorage.setItem(historyKey, JSON.stringify({ count: tab === 'favorites' ? favorites.length : posts.length, scroll: window.scrollY })); } catch { /* Navigation remains usable without storage. */ } };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { window.removeEventListener('scroll', remember); };
  }, [historyKey, tab, favorites.length, posts.length, loading, loadedIdentity, identity]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => { const focus = () => { if (!composer && !share) void load(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, composer, share]);
  useEffect(() => { setShare(null); setComposer(false); setBusy(null); setNotice(''); }, [identity]);
  const save = useCallback(async (post: Post) => {
    if (!isLoggedIn) { waitingToken.current = token; setPending({ kind: 'favorite', post }); setAuthOpen(true); return; }
    const owner = identity; setBusy(post.id); setError(''); setNotice('');
    try {
      await communityApi.favorite(post.id, !post.is_favorite);
      if (activeIdentity.current !== owner) return;
      setPosts(old => old.map(p => p.id === post.id ? { ...p, is_favorite: !post.is_favorite } : p));
      setFavorites(old => post.is_favorite ? old.filter(p => p.post_id !== post.id) : old);
      setNotice(post.is_favorite ? 'Đã bỏ lưu bộ phối.' : 'Đã lưu bộ phối vào Yêu thích.');
    } catch (e: any) { if (activeIdentity.current === owner) { setError(e.message); if (e.statusCode === 401) { waitingToken.current = token; setPending({ kind: 'favorite', post }); setAuthOpen(true); } } }
    finally { if (activeIdentity.current === owner) setBusy(null); }
  }, [identity, isLoggedIn, token]);
  useEffect(() => {
    if (!isReady || !isLoggedIn || !pending || token === waitingToken.current) return;
    setPending(null); setAuthOpen(false);
    if (pending.kind === 'publish') setComposer(true); else void save(pending.post);
  }, [isReady, isLoggedIn, token, pending, save]);
  const publish = useCallback(() => { if (!isLoggedIn) { waitingToken.current = token; setPending({ kind: 'publish' }); setAuthOpen(true); } else setComposer(true); }, [isLoggedIn, token]);
  useEffect(() => { if (!isReady || initialPublish.current || search.get('dang') !== '1') return; initialPublish.current = true; publish(); }, [isReady, search, publish]);
  useEffect(() => {
    if (authorId) setTab('explore');
    else {
      const next = search.get('tab') as Tab;
      setTab(tabs.some(([id]) => id === next) ? next : 'explore');
    }
    setQ(search.get('q') || ''); setQuery(search.get('q') || '');
    setStyle(search.get('style') || ''); setOccasion(search.get('occasion') || '');
    setVisibility(search.get('visibility') || '');
  }, [search, authorId]);
  const chooseFilter = (key: string, value: string) => {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value); else params.delete(key);
    router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
  };
  const chooseTab = (next: Tab) => {
    setTab(next); setError(''); setNotice('');
    if (!authorId) { const params = new URLSearchParams(search); params.set('tab', next); params.delete('dang'); router.push('/lookbook?' + params.toString(), { scroll: false }); }
  };
  const entries = tab === 'favorites' ? favorites.flatMap(f => f.post ? [f.post] : []) : posts;
  const currentData = loadedIdentity === identity;
  return <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
    {!authorId && <div className="flex flex-wrap items-end justify-between gap-5"><div className="max-w-2xl space-y-2"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-heritage-red"><FolderHeart size={19} aria-hidden="true" />Cộng đồng phối đồ Việt phục</p><h1 className="font-serif text-3xl font-bold text-stone-950 sm:text-4xl">Lookbook Việt Phục</h1><p className="text-stone-600">Chia sẻ phong cách của bạn và lưu những bộ phối truyền cảm hứng.</p></div><button className={primary} onClick={publish}><Plus size={18} aria-hidden="true" />Đăng bộ phối</button></div>}
    {!authorId && <nav aria-label="Các mục Lookbook" className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">{tabs.map(([id, label]) => <button key={id} className={control + (tab === id ? ' !border-red-200 !bg-red-50 !text-heritage-red' : '')} aria-current={tab === id ? 'page' : undefined} onClick={() => chooseTab(id)}>{label}</button>)}{isAdmin && <Link className={control} href="/lookbook/kiem-duyet">Kiểm duyệt</Link>}</nav>}
    {tab === 'collections' && !authorId ? <CollectionWorkspace /> : <>
      {tab === 'explore' && <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }}><label className="relative"><span className="sr-only">Tìm bộ phối</span><Search size={18} className="absolute left-3 top-3.5 text-stone-500" aria-hidden="true" /><input className={field + ' pl-10'} placeholder="Tìm theo tiêu đề bộ phối…" maxLength={160} value={q} onChange={e => setQ(e.target.value)} /></label><label><span className="sr-only">Lọc phong cách</span><select className={field} value={style} onChange={e => chooseFilter('style', e.target.value)}><option value="">Mọi phong cách</option><option value="traditional">Truyền thống</option><option value="remix">Remix</option><option value="modern_fusion">Cách tân</option></select></label><label><span className="sr-only">Lọc dịp sử dụng</span><select className={field} value={occasion} onChange={e => chooseFilter('occasion', e.target.value)}><option value="">Mọi dịp sử dụng</option>{occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></form>}
      {tab === 'mine' && isLoggedIn && <label className="block max-w-xs space-y-2"><span className="text-sm font-semibold">Quyền xem</span><select className={field} value={visibility} onChange={e => chooseFilter('visibility', e.target.value)}><option value="">Tất cả bài của tôi</option><option value="public">Công khai</option><option value="private">Riêng tư</option><option value="unlisted">Người có liên kết</option></select></label>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><span>{error}</span><button className={control} onClick={() => void load()}>Thử lại</button><Link className={control} href="/lookbook?tab=collections" onClick={() => setTab('collections')}>Bộ sưu tập cá nhân</Link></div>}
      {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {!canRead && isReady ? <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-8 text-center"><h2 className="font-serif text-xl font-bold">Đăng nhập để xem {tab === 'favorites' ? 'Yêu thích' : 'bài đăng của bạn'}</h2><button className={primary} onClick={() => setAuthOpen(true)}>Đăng nhập</button></div> : loading || !isReady ? <div role="status" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><span className="sr-only">Đang tải bộ phối…</span>{[1,2,3,4].map(n => <div key={n} className="aspect-[3/4] animate-pulse rounded-2xl bg-stone-200/60" aria-hidden="true" />)}</div> : currentData && <>
        {!entries.length && !favorites.length && !error && <div className="space-y-3 rounded-2xl border border-dashed border-stone-300 p-10 text-center"><h2 className="font-serif text-xl font-bold">{tab === 'favorites' ? 'Chưa có bộ phối yêu thích' : tab === 'mine' ? 'Bạn chưa đăng bộ phối' : 'Chưa có bộ phối phù hợp'}</h2><p className="text-sm text-stone-600">{tab === 'favorites' ? 'Khám phá cộng đồng và lưu bộ phối bạn muốn xem lại.' : tab === 'mine' ? 'Chọn một bộ phối đã lưu để tạo bài đăng đầu tiên.' : 'Thử thay đổi bộ lọc hoặc chia sẻ bộ phối đầu tiên.'}</p><button className={control} onClick={tab === 'favorites' ? () => chooseTab('explore') : publish}>{tab === 'favorites' ? 'Khám phá bộ phối' : 'Đăng bộ phối'}</button></div>}
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{entries.map(post => <PostCard key={post.id} post={post} busy={busy === post.id} onSave={p => void save(p)} onShare={setShare} mine={tab === 'mine'} />)}{tab === 'favorites' && favorites.filter(f => !f.post).map(f => <article key={f.post_id} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6"><p>Bộ phối không còn khả dụng.</p><button className={control} disabled={busy === f.post_id} onClick={async () => { const owner = identity; setBusy(f.post_id); try { await communityApi.favorite(f.post_id, false); if (activeIdentity.current === owner) setFavorites(old => old.filter(item => item.post_id !== f.post_id)); } catch (e: any) { if (activeIdentity.current === owner) setError(e.message); } finally { if (activeIdentity.current === owner) setBusy(null); } }}>Bỏ khỏi Yêu thích</button></article>)}</div>
        {cursor && <div className="text-center"><button className={control} disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? 'Đang tải…' : 'Xem thêm'}</button></div>}
      </>}
    </>}
    {composer && user && <PostComposer key={identity} initialOutfitId={search.get('outfit') || undefined} onClose={() => setComposer(false)} onNeedAuth={() => setAuthOpen(true)} onPublished={post => { setComposer(false); router.push('/lookbook/bai-dang/' + post.id); }} />}
    {share && <ShareDialog key={identity + share.id} post={share} onClose={() => setShare(null)} onNeedAuth={() => setAuthOpen(true)} />}
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
  </div>;
}
