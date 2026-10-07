import PostDetailView from '@/features/lookbook/PostDetailView';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bộ phối được chia sẻ | VietStylist', robots: { index: false, follow: false }, referrer: 'no-referrer' as const, openGraph: { title: 'Bộ phối được chia sẻ', images: [] } };
export default async function SharedPost({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; return <PostDetailView token={token} />;
}
