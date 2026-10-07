"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Share2, ImageOff, Globe2, Lock, Link2, MoreHorizontal } from 'lucide-react';
import type { PostCard as Post } from '@/lib/types/community';
import { styleLabel } from '@/lib/catalog/display';
export const control = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-heritage-red disabled:cursor-not-allowed disabled:opacity-50';
export const primary = control + ' !border-heritage-red !bg-heritage-red !text-white hover:!bg-heritage-red-dark';
export const field = 'w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:outline-heritage-red';
export const visibilityLabel = { public: 'Công khai', private: 'Riêng tư', unlisted: 'Người có liên kết' };
export function CommunityAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-50 text-base font-semibold text-heritage-red" aria-hidden="true">
    {imageUrl && !failed ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" width={40} height={40} className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : name.trim().slice(0, 1).toUpperCase() || 'V'}
  </span>;
}
export function PostImage({ post, large = false, feed = false, priority = false }: { post: Post; large?: boolean; feed?: boolean; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.image_url]);
  return <div className={'flex items-center justify-center overflow-hidden bg-stone-100 ' + (feed ? 'lookbook-post-image' : large ? 'min-h-64 rounded-2xl' : 'aspect-[3/4] rounded-2xl')}>
    {failed ? <p className="p-6 text-center text-sm text-stone-600"><ImageOff className="mx-auto mb-2" aria-hidden="true" />Ảnh chưa khả dụng. Tải lại bài để cập nhật quyền xem.</p> :
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.image_url} alt={`Bộ phối ${post.title}`} width={900} height={1200} loading={large || priority ? 'eager' : 'lazy'} fetchPriority={large || priority ? 'high' : 'auto'} decoding="async" referrerPolicy="no-referrer" className={large ? 'max-h-[75dvh] w-full object-contain' : 'h-full w-full object-contain'} onError={() => setFailed(true)} />}
  </div>;
}
export default function PostCard({ post, busy, onSave, onShare, mine = false, priority = false }: {
  post: Post; busy: boolean; onSave: (post: Post) => void; onShare: (post: Post) => void; mine?: boolean; priority?: boolean;
}) {
  const VisibilityIcon = post.visibility === 'private' ? Lock : post.visibility === 'unlisted' ? Link2 : Globe2;
  const date = post.published_at || post.created_at;
  const action = 'flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50';
  return <article className="lookbook-panel overflow-hidden" aria-label={'Bài đăng ' + post.title}>
    <header className="flex items-center gap-3 px-4 pt-4">
      <Link href={'/lookbook/tac-gia/' + post.author.id} aria-label={'Trang của ' + post.author.display_name}><CommunityAvatar name={post.author.display_name} imageUrl={post.author.avatar_url} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={'/lookbook/tac-gia/' + post.author.id} className="block truncate text-sm font-semibold text-stone-900 hover:underline">{post.author.display_name}</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500"><time dateTime={date}>{new Date(date).toLocaleDateString('vi-VN')}</time><span aria-hidden="true">·</span><VisibilityIcon size={12} aria-hidden="true" /><span>{visibilityLabel[post.visibility]}</span></div>
      </div>
      <Link href={'/lookbook/bai-dang/' + post.id} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100" aria-label={(mine ? 'Quản lý bài đăng ' : 'Chi tiết bài đăng ') + post.title}><MoreHorizontal size={21} aria-hidden="true" /></Link>
    </header>
    <div className="space-y-2 px-4 py-3">
      <Link href={'/lookbook/bai-dang/' + post.id} className="block text-base font-semibold text-stone-900 [overflow-wrap:anywhere]">{post.title}</Link>
      {post.description && <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 [overflow-wrap:anywhere]">{post.description}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500"><span>{styleLabel(post.style_mode)}</span>{post.moderation_status === 'hidden' && <span className="rounded bg-red-50 px-2 py-1 text-red-800">Đang bị ẩn</span>}</div>
    </div>
    <Link href={'/lookbook/bai-dang/' + post.id} aria-label={'Xem bộ phối ' + post.title}><PostImage post={post} feed priority={priority} /></Link>
    <div className="mx-4 flex gap-2 border-t border-stone-200 py-1.5">
      {post.visibility === 'public' && post.moderation_status === 'visible' && <button type="button" className={action + (post.is_favorite ? ' !text-heritage-red' : '')} aria-pressed={post.is_favorite} disabled={busy} onClick={() => onSave(post)}><Bookmark size={18} aria-hidden="true" fill={post.is_favorite ? 'currentColor' : 'none'} />{post.is_favorite ? 'Đã lưu' : 'Yêu thích'}</button>}
      {(post.visibility === 'public' || mine) && <button type="button" className={action} disabled={busy} onClick={() => onShare(post)}><Share2 size={18} aria-hidden="true" />Chia sẻ</button>}
    </div>
  </article>;
}
