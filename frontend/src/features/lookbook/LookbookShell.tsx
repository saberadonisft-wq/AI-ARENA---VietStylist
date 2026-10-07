"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bookmark, Compass, FolderHeart, Globe2, Images, Newspaper, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { CommunityAvatar } from './PostCard';
import './lookbook-social.css';

export type LookbookTab = 'explore' | 'mine' | 'favorites' | 'collections';
export const lookbookTabs: Array<{ id: LookbookTab; label: string; icon: typeof Compass }> = [
  { id: 'explore', label: 'Khám phá', icon: Compass },
  { id: 'mine', label: 'Của tôi', icon: Newspaper },
  { id: 'favorites', label: 'Yêu thích', icon: Bookmark },
  { id: 'collections', label: 'Bộ sưu tập', icon: FolderHeart },
];

// Existing VietStylist type/accent; social feed with persistent navigation and real actions.
export default function LookbookShell({ activeTab, onSelect, children }: {
  activeTab: LookbookTab | 'moderation'; onSelect?: (tab: LookbookTab) => void; children: ReactNode;
}) {
  const { user, isAdmin } = useAuth();
  return <div className="lookbook-social">
    <div className="lookbook-layout">
      <aside className="lookbook-sidebar">
        <div className="lookbook-brand">
          <h1 aria-label="Lookbook Việt Phục" className="text-2xl font-bold tracking-tight text-stone-900">Lookbook<span className="text-heritage-red">.</span></h1>
          <p className="mt-1 text-xs text-stone-500">Cộng đồng phối đồ Việt phục</p>
        </div>
        {user && <Link className="lookbook-profile" href="/tai-khoan">
          <CommunityAvatar name={user.displayName} imageUrl={user.avatarUrl} />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.displayName}</span><span className="mt-0.5 block text-xs text-stone-500">Trang cá nhân & bộ phối</span></span>
        </Link>}
        <nav aria-label="Các mục Lookbook" className="lookbook-navigation">
          {lookbookTabs.map(({ id, label, icon: Icon }) => {
            const className = 'lookbook-nav-item' + (activeTab === id ? ' is-selected' : '');
            return onSelect ? <button key={id} type="button" className={className} aria-label={label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onSelect(id)}><Icon size={21} aria-hidden="true" /><span>{label}</span></button> :
              <Link key={id} href={'/lookbook?tab=' + id} className={className} aria-label={label}><Icon size={21} aria-hidden="true" /><span>{label}</span></Link>;
          })}
          {isAdmin && <Link className={'lookbook-nav-item' + (activeTab === 'moderation' ? ' is-selected' : '')} aria-label="Kiểm duyệt" aria-current={activeTab === 'moderation' ? 'page' : undefined} href="/lookbook/kiem-duyet"><ShieldCheck size={21} aria-hidden="true" /><span>Kiểm duyệt</span></Link>}
        </nav>
        <div className="lookbook-sidebar-shortcuts">
          <p className="mb-2 px-3 text-xs font-semibold text-stone-500">Lối tắt của bạn</p>
          <Link href="/tai-khoan" className="lookbook-nav-item"><Images size={21} aria-hidden="true" />Bộ phối đã lưu</Link>
          <Link href="/studio" className="lookbook-nav-item"><Sparkles size={21} aria-hidden="true" />Studio phối đồ</Link>
        </div>
      </aside>
      <section className="lookbook-feed" aria-label="Nội dung Lookbook">{children}</section>
      <aside className="lookbook-right-rail" aria-label="Gợi ý sử dụng Lookbook">
        <section className="lookbook-panel p-5">
          <h2 className="text-sm font-semibold text-stone-900">Từ Studio đến Lookbook</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">Tạo bộ phối, lưu lại và chia sẻ phong cách của bạn với cộng đồng.</p>
          <Link href="/studio" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-heritage-red px-3 text-sm font-semibold text-white hover:bg-heritage-red-dark"><Sparkles size={17} aria-hidden="true" />Mở Studio phối đồ</Link>
        </section>
        <section className="space-y-4 px-2 py-5">
          <h2 className="text-sm font-semibold text-stone-600">Không gian của bạn</h2>
          <Link href="/tai-khoan" className="flex min-h-11 items-center gap-3 rounded-lg text-sm hover:bg-white"><span className="lookbook-shortcut-icon"><UserRound size={20} aria-hidden="true" /></span><span>Bộ phối trong tài khoản</span></Link>
          <div className="flex items-start gap-3"><span className="lookbook-shortcut-icon"><Globe2 size={20} aria-hidden="true" /></span><p className="text-xs leading-relaxed text-stone-500">Bộ phối đã lưu chỉ xuất hiện trong bảng tin sau khi bạn đăng bài. Bạn chọn quyền xem cho từng bài đăng.</p></div>
        </section>
      </aside>
    </div>
  </div>;
}

export function LookbookEmptyState({ icon: Icon = FolderHeart, title, description, children }: {
  icon?: typeof FolderHeart; title: string; description: string; children?: ReactNode;
}) {
  return <div className="lookbook-panel flex min-h-60 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500"><Icon size={27} strokeWidth={1.6} aria-hidden="true" /></span>
    <h3 className="text-base font-semibold text-stone-900 sm:text-lg">{title}</h3>
    <p className="max-w-md text-sm leading-relaxed text-stone-600">{description}</p>
    {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
  </div>;
}
