"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus, Search, Bookmark, Images, SlidersHorizontal, Newspaper, Compass } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { communityApi } from '@/lib/api/community';
import type { FavoriteEntry, PostCard as Post } from '@/lib/types/community';
import type { Occasion } from '@/lib/types/api';
import AuthModal from '@/components/AuthModal';
import PostCard, { CommunityAvatar, control, field, primary } from './PostCard';
import LookbookShell, { LookbookEmptyState, lookbookTabs, type LookbookTab as Tab } from './LookbookShell';
import ShareDialog from './ShareDialog';

const CollectionWorkspace = dynamic(() => import('./CollectionWorkspace'), { loading: () => <p role="status">Đang tải bộ sưu tập…</p> });
const PostComposer = dynamic(() => import('./PostComposer'), { loading: () => <p role="status">Đang mở cửa sổ đăng bộ phối…</p> });

export default function CommunityWorkspace({ authorId }: { authorId?: string }) {
  const router = useRouter(); const search = useSearchParams(); const pathname = usePathname();
  const latestSearch = useRef(search); latestSearch.current = search;
  const { user, token, isReady, isLoggedIn } = useAuth();
  const identity = user?.id || 'guest'; const activeIdentity = useRef(identity); activeIdentity.current = identity;
  const initialTab = !authorId && lookbookTabs.some(({ id }) => id === search.get('tab')) ? search.get('tab') as Tab : 'explore';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState(search.get('q') || ''); const [query, setQuery] = useState(q);
  const [style, setStyle] = useState(search.get('style') || ''); const [occasion, setOccasion] = useState(search.get('occasion') || '');
  const [visibility, setVisibility] = useState(search.get('visibility') || ''); const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.get('style') || search.get('occasion')));
  const [posts, setPosts] = useState<Post[]>([]); const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); const [loadedScope, setLoadedScope] = useState('');
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [authOpen, setAuthOpen] = useState(false); const [composer, setComposer] = useState(false); const [share, setShare] = useState<Post | null>(null);
  const [pending, setPending] = useState<{ kind: 'publish' } | { kind: 'favorite'; post: Post } | null>(null);
  const generation = useRef(0);
  const initialPublish = useRef(false);
  const waitingToken = useRef<string | null>(null);
  const canRead = isReady && (tab === 'explore' || isLoggedIn);
  const feedQuery = tab === 'explore' ? query : '';
  const feedStyle = tab === 'explore' ? style : '';
  const feedOccasion = tab === 'explore' ? occasion : '';
  const mineVisibility = tab === 'mine' ? visibility : '';
  const historyKey = `viet_lookbook_list:${identity}:${authorId || ''}:${tab}:${feedQuery}:${feedStyle}:${feedOccasion}:${mineVisibility}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q.trim());
      if ((latestSearch.current.get('q') || '') === q.trim()) return;
      const params = new URLSearchParams(latestSearch.current);
      if (!authorId) params.set('tab', tab);
      if (q.trim()) params.set('q', q.trim()); else params.delete('q');
      router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, tab, authorId, pathname, router]);
  useEffect(() => { let live = true; api.getOccasions().then(data => { if (live) setOccasions(data); }).catch(() => {}); return () => { live = false; }; }, []);
  const load = useCallback(async (next?: string, background = false) => {
    const request = ++generation.current; const owner = identity;
    if (!canRead || tab === 'collections') { setLoading(false); return; }
    if (next) setLoadingMore(true); else if (!background) { setLoading(true); setPosts([]); setFavorites([]); setCursor(null); }
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
        const params = tab === 'mine' ? { cursor: next, visibility: mineVisibility } : { cursor: next, q: feedQuery, style: feedStyle, occasion: feedOccasion, owner_id: authorId };
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
      setLoadedScope(historyKey);
      if (!next && Number(restore.scroll) > 0) requestAnimationFrame(() => requestAnimationFrame(() => { if (request === generation.current) window.scrollTo({ top: Number(restore.scroll), behavior: 'instant' }); }));
    } catch (e: any) { if (request === generation.current && activeIdentity.current === owner) { setError(e.message || 'Không tải được bộ phối.'); if (e.statusCode === 401) { setPosts([]); setFavorites([]); setAuthOpen(true); } } }
    finally { if (request === generation.current && activeIdentity.current === owner) { setLoading(false); setLoadingMore(false); } }
  }, [tab, feedQuery, feedStyle, feedOccasion, mineVisibility, authorId, identity, canRead, historyKey]);
  useEffect(() => {
    if (loading || loadedScope !== historyKey) return;
    const remember = () => { try { sessionStorage.setItem(historyKey, JSON.stringify({ count: tab === 'favorites' ? favorites.length : posts.length, scroll: window.scrollY })); } catch { /* Navigation remains usable without storage. */ } };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { window.removeEventListener('scroll', remember); };
  }, [historyKey, tab, favorites.length, posts.length, loading, loadedScope]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => { const focus = () => { if (!loading && loadedScope === historyKey && !composer && !share) void load(undefined, true); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, loading, loadedScope, historyKey, composer, share]);
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
      setTab(lookbookTabs.some(({ id }) => id === next) ? next : 'explore');
    }
    setQ(search.get('q') || ''); setQuery(search.get('q') || '');
    setStyle(search.get('style') || ''); setOccasion(search.get('occasion') || '');
    setVisibility(search.get('visibility') || '');
  }, [search, authorId]);
  const chooseFilter = (key: string, value: string) => {
    const params = new URLSearchParams(search);
    if (!authorId) params.set('tab', tab);
    const values = { q: q.trim(), style, occasion, visibility, [key]: value };
    Object.entries(values).forEach(([name, filter]) => { if (filter) params.set(name, filter); else params.delete(name); });
    if (key === 'style') setStyle(value);
    if (key === 'occasion') setOccasion(value);
    if (key === 'visibility') setVisibility(value);
    router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
  };
  const chooseTab = (next: Tab) => {
    if (next === tab) return;
    generation.current++; setLoadedScope(''); setCursor(null); setLoading(true); setLoadingMore(false);
    setTab(next); setError(''); setNotice('');
    if (!authorId) {
      const params = new URLSearchParams(search); params.set('tab', next); params.delete('dang');
      Object.entries({ q: q.trim(), style, occasion, visibility }).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
      router.push('/lookbook?' + params.toString(), { scroll: false });
    }
  };
  const clearFilters = () => {
    setQ(''); setQuery(''); setStyle(''); setOccasion('');
    const params = new URLSearchParams(search);
    ['q', 'style', 'occasion'].forEach(key => params.delete(key));
    router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
  };
  const entries = tab === 'favorites' ? favorites.flatMap(f => f.post ? [f.post] : []) : posts;
  const currentData = loadedScope === historyKey;
  const hasFilters = Boolean(query || style || occasion);
  const emptyTitle = authorId ? hasFilters ? 'Không tìm thấy bộ phối phù hợp' : 'Tác giả chưa có bài đăng công khai' : tab === 'favorites' ? 'Chưa có bộ phối yêu thích' : tab === 'mine' ? visibility ? 'Chưa có bài đăng với quyền xem này' : 'Bạn chưa đăng bộ phối' : hasFilters ? 'Không tìm thấy bộ phối phù hợp' : 'Cùng mở đầu bảng tin Việt phục';
  const emptyDescription = authorId ? hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Các bộ phối được tác giả đăng công khai sẽ xuất hiện tại đây.' : tab === 'favorites' ? 'Nhấn Yêu thích trên một bài đăng để lưu bộ phối vào đây.' : tab === 'mine' ? visibility ? 'Chọn tất cả quyền xem để xem những bài đăng còn lại.' : 'Bộ phối đã lưu trong Studio nằm ở tài khoản. Chọn một bộ phối để tạo bài đăng đầu tiên.' : hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem bảng tin.' : 'Chia sẻ một bộ phối đã lưu và câu chuyện phong cách của bạn.';
  const content = <>
    {tab === 'collections' && !authorId ? <CollectionWorkspace embedded /> : <>
      {!authorId && (tab === 'explore' || tab === 'mine') && <section className="lookbook-panel p-4" aria-label="Tạo bài đăng">
        <div className="flex min-w-0 items-center gap-3"><CommunityAvatar name={user?.displayName || 'VietStylist'} imageUrl={user?.avatarUrl} /><button type="button" onClick={publish} aria-label="Viết bài đăng" className="min-h-11 min-w-0 flex-1 truncate rounded-full bg-stone-100 px-4 text-left text-sm text-stone-500 hover:bg-stone-200">{user ? `${user.displayName}, bạn muốn chia sẻ bộ phối nào?` : 'Chia sẻ bộ phối của bạn với cộng đồng…'}</button></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3"><Link href="/tai-khoan" aria-label="Bộ phối đã lưu" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 sm:text-sm"><Images size={19} className="text-emerald-600" aria-hidden="true" /><span className="sm:hidden">Bộ phối</span><span className="hidden sm:inline">Bộ phối đã lưu</span></Link><button type="button" className={primary} onClick={publish}><Plus size={17} aria-hidden="true" />Đăng bộ phối</button></div>
      </section>}
      {!authorId && <div className="px-1"><h2 className="text-lg font-semibold text-stone-900">{tab === 'mine' ? 'Bài đăng của tôi' : tab === 'favorites' ? 'Bộ phối yêu thích' : 'Bảng tin cộng đồng'}</h2>{tab !== 'explore' && <p className="mt-1 text-sm text-stone-500">{tab === 'mine' ? 'Các bộ phối bạn đã đăng và quyền xem của từng bài.' : 'Những bài đăng bạn đã lưu để xem lại.'}</p>}</div>}
      {tab === 'explore' && <form className="lookbook-panel space-y-3 p-4" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }}>
        <div className="flex min-w-0 gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">Tìm bộ phối</span><Search size={18} className="absolute left-3 top-3.5 text-stone-500" aria-hidden="true" /><input className={field + ' rounded-full bg-stone-50 pl-10'} placeholder="Tìm theo tiêu đề bộ phối…" maxLength={160} value={q} onChange={e => setQ(e.target.value)} /></label><button type="button" className={control + (filtersOpen || style || occasion ? ' !border-red-200 !text-heritage-red' : '')} aria-expanded={filtersOpen} aria-controls="lookbook-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={17} aria-hidden="true" /><span className="hidden sm:inline">Bộ lọc</span><span className="sr-only sm:hidden">Bộ lọc</span></button></div>
        {filtersOpen && <div id="lookbook-filters" className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-medium text-stone-600">Lọc phong cách</span><select className={field} value={style} onChange={e => chooseFilter('style', e.target.value)}><option value="">Mọi phong cách</option><option value="traditional">Truyền thống</option><option value="remix">Remix</option><option value="modern_fusion">Cách tân</option></select></label><label className="space-y-1.5"><span className="text-xs font-medium text-stone-600">Lọc dịp sử dụng</span><select className={field} value={occasion} onChange={e => chooseFilter('occasion', e.target.value)}><option value="">Mọi dịp sử dụng</option>{occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>}
        {hasFilters && <button type="button" className="min-h-11 px-1 text-sm font-semibold text-heritage-red hover:underline" onClick={clearFilters}>Xóa bộ lọc</button>}
      </form>}
      {tab === 'mine' && isLoggedIn && <label className="lookbook-panel flex flex-wrap items-center gap-3 p-4"><span className="text-sm font-semibold">Quyền xem</span><select className={field + ' min-w-0 flex-1 sm:max-w-xs'} value={visibility} onChange={e => chooseFilter('visibility', e.target.value)}><option value="">Tất cả bài của tôi</option><option value="public">Công khai</option><option value="private">Riêng tư</option><option value="unlisted">Người có liên kết</option></select></label>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><span>{error}</span><button className={control} onClick={() => void load()}>Thử lại</button><Link className={control} href="/lookbook?tab=collections" onClick={() => setTab('collections')}>Bộ sưu tập cá nhân</Link></div>}
      {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {!canRead && isReady ? <LookbookEmptyState icon={tab === 'favorites' ? Bookmark : Newspaper} title={'Đăng nhập để xem ' + (tab === 'favorites' ? 'Yêu thích' : 'bài đăng của bạn')} description="Đăng nhập để lưu bộ phối yêu thích và quản lý bài đăng trong tài khoản."><button className={primary} onClick={() => setAuthOpen(true)}>Đăng nhập</button></LookbookEmptyState> : loading || !isReady ? <div role="status" className="space-y-4"><span className="sr-only">Đang tải bộ phối…</span>{[1,2].map(n => <div key={n} className="lookbook-panel animate-pulse p-4" aria-hidden="true"><div className="mb-4 flex gap-3"><span className="h-10 w-10 rounded-full bg-stone-200" /><span className="mt-1 h-7 w-36 rounded bg-stone-200" /></div><div className="aspect-[4/3] rounded bg-stone-200/60" /></div>)}</div> : currentData && <>
        {!entries.length && !favorites.length && !error && <LookbookEmptyState icon={tab === 'favorites' ? Bookmark : tab === 'mine' ? Newspaper : Compass} title={emptyTitle} description={emptyDescription}>
          {(!authorId || hasFilters || user?.id === authorId) && <button className={primary} onClick={tab === 'favorites' ? () => chooseTab('explore') : tab === 'mine' && visibility ? () => chooseFilter('visibility', '') : tab === 'explore' && hasFilters ? clearFilters : publish}>{tab === 'favorites' ? 'Khám phá bộ phối' : tab === 'mine' && visibility ? 'Xem tất cả bài đăng' : tab === 'explore' && hasFilters ? 'Xóa bộ lọc' : 'Đăng bộ phối'}</button>}
          {tab === 'mine' && !visibility && <Link className={control} href="/tai-khoan">Bộ phối đã lưu</Link>}
        </LookbookEmptyState>}
        <div className="space-y-4">{entries.map((post, index) => <PostCard key={post.id} post={post} busy={busy === post.id} onSave={p => void save(p)} onShare={setShare} mine={tab === 'mine'} priority={index === 0} />)}{tab === 'favorites' && favorites.filter(f => !f.post).map(f => <article key={f.post_id} className="lookbook-panel space-y-4 p-6"><p>Bộ phối không còn khả dụng.</p><button className={control} disabled={busy === f.post_id} onClick={async () => { const owner = identity; setBusy(f.post_id); try { await communityApi.favorite(f.post_id, false); if (activeIdentity.current === owner) setFavorites(old => old.filter(item => item.post_id !== f.post_id)); } catch (e: any) { if (activeIdentity.current === owner) setError(e.message); } finally { if (activeIdentity.current === owner) setBusy(null); } }}>Bỏ khỏi Yêu thích</button></article>)}</div>
        {cursor && <div className="text-center"><button className={control} disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? 'Đang tải…' : 'Xem thêm'}</button></div>}
      </>}
    </>}
    {composer && user && <PostComposer key={identity} initialOutfitId={search.get('outfit') || undefined} onClose={() => setComposer(false)} onNeedAuth={() => setAuthOpen(true)} onPublished={post => { setComposer(false); router.push('/lookbook/bai-dang/' + post.id); }} />}
    {share && <ShareDialog key={identity + share.id} post={share} onClose={() => setShare(null)} onNeedAuth={() => setAuthOpen(true)} />}
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
  </>;
  return authorId ? <div className="space-y-4">{content}</div> : <LookbookShell activeTab={tab} onSelect={chooseTab}>{content}</LookbookShell>;
}
