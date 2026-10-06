import AuthorProfile from '@/features/lookbook/AuthorProfile';
export const metadata = { title: 'Tác giả Lookbook | VietStylist' };
export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return <AuthorProfile id={id} />;
}
