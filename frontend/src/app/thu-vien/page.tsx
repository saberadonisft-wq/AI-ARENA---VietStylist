import { Suspense } from "react";
import LibraryCatalog from "@/features/library/LibraryCatalog";

export default function ThuVienPage() {
  return <Suspense fallback={<p className="p-8" role="status">Đang mở thư viện…</p>}><LibraryCatalog /></Suspense>;
}
