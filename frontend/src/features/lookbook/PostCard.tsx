"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Share2, ImageOff } from 'lucide-react';
import type { PostCard as Post } from '@/lib/types/community';
import { styleLabel } from '@/lib/catalog/display';
export const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-heritage-red disabled:cursor-not-allowed disabled:opacity-50';
export const primary = control + ' !border-heritage-red !bg-heritage-red !text-white hover:!bg-heritage-red-dark';
export const field = 'w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:outline-heritage-red';
export const visibilityLabel = { public: 'Công khai', private: 'Riêng tư', unlisted: 'Người có liên kết' };
export function PostImage({ post, large = false }: { post: Post; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.image_url]);
  return <div className={'flex items-center justify-center overflow-hidden rounded-2xl bg-stone-100 ' + (large ? 'min-h-64' : 'aspect-[3/4]')}>
    {failed ? <p className="p-6 text-center text-sm text-stone-600"><ImageOff className="mx-auto mb-2" aria-hidden="true" />Ảnh chưa khả dụng. Tải lại bài để cập nhật quyền xem.</p> :
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.image_url} alt={`Bộ phối ${post.title}`} loading={large ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" className={large ? 'max-h-[75dvh] w-full object-contain' : 'h-full w-full object-contain'} onError={() => setFailed(true)} />}
  </div>;
}
export default function PostCard({ post, busy, onSave, onShare, mine = false }: {
  post: Post; busy: boolean; onSave: (post: Post) => void; onShare: (post: Post) => void; mine?: boolean;
}) {
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
    <Link href={'/lookbook/bai-dang/' + post.id} aria-label={'Xem bộ phối ' + post.title}><PostImage post={post} /></Link>
    <div className="space-y-3 p-4">
      <Link href={'/lookbook/bai-dang/' + post.id} className="block font-serif text-lg font-bold text-stone-900 [overflow-wrap:anywhere]">{post.title}</Link>
      <Link href={'/lookbook/tac-gia/' + post.author.id} className="flex min-h-11 items-center gap-2 text-sm text-stone-600">
        {post.author.avatar_url ?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 font-semibold text-heritage-red">{post.author.display_name.slice(0, 1)}</span>}
        <span className="min-w-0 truncate">{post.author.display_name}</span>
      </Link>
      <div className="flex flex-wrap gap-2 text-xs text-stone-600"><span className="rounded-full bg-stone-100 px-2.5 py-1">{styleLabel(post.style_mode)}</span>{mine && <span className="rounded-full bg-stone-100 px-2.5 py-1">{visibilityLabel[post.visibility]}</span>}{post.moderation_status === 'hidden' && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800">Đang bị ẩn</span>}</div>
      <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
        {post.visibility === 'public' && post.moderation_status === 'visible' && <button type="button" className={control + (post.is_favorite ? ' !border-red-200 !bg-red-50 !text-heritage-red' : '')} aria-pressed={post.is_favorite} disabled={busy} onClick={() => onSave(post)}><Bookmark className="h-4 w-4" aria-hidden="true" fill={post.is_favorite ? 'currentColor' : 'none'} />{post.is_favorite ? 'Đã lưu' : 'Yêu thích'}</button>}
        {(post.visibility === 'public' || mine) && <button type="button" className={control} disabled={busy} onClick={() => onShare(post)}><Share2 className="h-4 w-4" aria-hidden="true" />Chia sẻ</button>}
      </div>
    </div>
  </article>;
}
