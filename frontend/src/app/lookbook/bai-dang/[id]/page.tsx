import type { Metadata } from 'next';
import { API_ORIGIN } from '@/lib/api/client';
import PostDetailView from '@/features/lookbook/PostDetailView';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await fetch(API_ORIGIN + '/api/lookbook-posts/' + encodeURIComponent(id), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const post = await response.json();
      if (post.visibility === 'public') return { title: post.title + ' | VietStylist', description: post.description,
        authors: [{ name: post.author.display_name }],
        openGraph: { title: post.title + ' · ' + post.author.display_name, description: post.description, images: [post.image_url] },
        twitter: { card: 'summary_large_image', title: post.title, images: [post.image_url] } };
    }
  } catch { /* Private/unavailable content has generic metadata. */ }
  return { title: 'Bộ phối | VietStylist', robots: { index: false, follow: false }, openGraph: { title: 'Bộ phối | VietStylist', images: [] } };
}
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return <PostDetailView id={id} />;
}
