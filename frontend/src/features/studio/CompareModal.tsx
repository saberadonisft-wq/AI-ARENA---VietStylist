"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogItem, OutfitSnapshot } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { itemLabel, slotLabel, styleLabel } from "@/lib/catalog/display";
import Modal from "@/components/ui/Modal";
import { X, ArrowRightLeft } from "lucide-react";

type Comparison = { summary_message: string; style_changed: boolean; diffs: Array<{
  slot: string; is_changed: boolean; item_a_name?: string; item_a_id?: string;
  item_b_name?: string; item_b_id?: string;
}> };

export default function CompareModal({ isOpen, onClose, snapshotA, snapshotB, catalogItems, onSelectOutfit }: {
  isOpen: boolean; onClose: () => void; snapshotA: OutfitSnapshot; snapshotB: OutfitSnapshot;
  catalogItems: CatalogItem[]; onSelectOutfit: (snapshot: OutfitSnapshot) => void;
}) {
  const [diffData, setDiffData] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<{ key: string; promise: Promise<Comparison> }>();
  const comparisonItemLabel = (id?: string, name?: string) => name?.trim() && name !== id
    ? name : id ? itemLabel(id, catalogItems) : "—";
  useEffect(() => {
    if (!isOpen) { request.current = undefined; return; }
    let active = true;
    setDiffData(null); setError(null); setLoading(true);
    const key = JSON.stringify([snapshotA, snapshotB, retry]);
    // Reuse the pending request across Strict Mode mount cleanup. Retry and
    // document changes still issue a fresh comparison.
    if (request.current?.key !== key) request.current = { key,
      promise: api.compareOutfits({ snapshot_a: snapshotA, snapshot_b: snapshotB }),
    };
    request.current.promise
      .then(data => { if (active) setDiffData(data); })
      .catch(() => { if (active) setError("Chưa tải được bảng so sánh chi tiết. Hai bản phối vẫn được giữ nguyên."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, snapshotA, snapshotB, retry]);
  return <Modal isOpen={isOpen} onClose={onClose} label="So sánh hai phương án phối đồ">
    <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2"><ArrowRightLeft aria-hidden="true" className="h-5 w-5 shrink-0 text-heritage-indigo" /><h3 className="font-serif text-lg font-bold">So sánh hai phương án phối đồ</h3></div>
        <button type="button" aria-label="Đóng so sánh" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
        {loading && <p role="status" className="text-sm text-stone-600">Đang so sánh…</p>}
        {error && <div className="space-y-2"><p role="alert" className="text-sm text-amber-900">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-semibold">Thử lại so sánh</button></div>}
        {diffData && <p role="status" className="rounded-xl border border-heritage-indigo/20 bg-heritage-indigo/10 p-3 text-xs text-heritage-indigo">{diffData.summary_message}{diffData.style_changed && " · Khác phong cách"}</p>}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {([{ name: "A", detail: "Bản đã ghim", snapshot: snapshotA }, { name: "B", detail: "Bản đang chỉnh", snapshot: snapshotB }] as const).map(option => <section key={option.name} aria-label={`Phương án ${option.name}`} className="min-w-0 space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-serif text-sm font-bold">Phương án {option.name} ({option.detail})</h4><span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs">{styleLabel(option.snapshot.styleMode)}</span></div>
            <dl className="space-y-2 text-xs">
              {option.snapshot.items.map(item => <div key={item.slot} className="flex min-w-0 items-start justify-between gap-3 border-t border-stone-200 pt-2">
                <dt className="shrink-0 text-stone-500">{slotLabel(item.slot)}:</dt>
                <dd className="flex min-w-0 items-start justify-end gap-1.5 text-right font-medium">
                  {item.colorHex && <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: item.colorHex }} />}
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{itemLabel(item.itemId, catalogItems)}</span>
                </dd>
              </div>)}
              {option.snapshot.items.length === 0 && <p className="text-stone-500">Bản phối này chưa có trang phục.</p>}
            </dl>
            <button type="button" onClick={() => { onSelectOutfit(option.snapshot); onClose(); }} className="min-h-11 w-full whitespace-nowrap rounded-lg bg-stone-800 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-900">Chỉnh sửa phương án {option.name}</button>
          </section>)}
        </div>
        {diffData && <section className="space-y-2" aria-label="Bảng đối chiếu chi tiết"><h4 className="font-serif text-sm font-bold">Thay đổi theo vị trí</h4>
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-xs">
            <div className="grid grid-cols-3 gap-2 p-2.5 font-semibold"><span>Vị trí</span><span>Phương án A</span><span>Phương án B</span></div>
            {diffData.diffs.map(diff => <div key={diff.slot} className={`grid grid-cols-3 gap-2 p-2.5 [overflow-wrap:anywhere] ${diff.is_changed ? "bg-amber-50" : ""}`}>
              <span className="min-w-0 font-semibold">{slotLabel(diff.slot)}</span>
              <span className="min-w-0">{comparisonItemLabel(diff.item_a_id, diff.item_a_name)}</span>
              <span className="min-w-0">{comparisonItemLabel(diff.item_b_id, diff.item_b_name)}{diff.is_changed && <span className="mt-1 block font-semibold text-amber-800">Đã đổi</span>}</span>
            </div>)}
          </div>
        </section>}
      </div>
    </div>
  </Modal>;
}
