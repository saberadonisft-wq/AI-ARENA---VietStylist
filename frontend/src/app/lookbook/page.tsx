import { Suspense } from 'react';
import CommunityWorkspace from '@/features/lookbook/CommunityWorkspace';
export const metadata = { title: 'Lookbook Việt phục | VietStylist', description: 'Khám phá, chia sẻ và lưu những bộ phối Việt phục bạn yêu thích.' };
export default function LookbookPage() {
  return <Suspense fallback={<p role="status" className="p-8">Đang tải Lookbook…</p>}><CommunityWorkspace /></Suspense>;
}
