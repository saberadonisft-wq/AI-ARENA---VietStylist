"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { GarmentType } from "@/lib/types/api";
import { emptyFilters, genders, groups, type LibraryFilters } from "./filters";

export default function FilterSheet({ filters, garmentTypes, onApply }: {
  filters: LibraryFilters; garmentTypes: GarmentType[]; onApply: (filters: LibraryFilters) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = Number(filters.gender !== "all") + Number(filters.type !== "all");
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  const fieldClass = "min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900";
  return <>
    <button ref={trigger} onClick={() => { setDraft(filters); setOpen(true); }} aria-haspopup="dialog"
      className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 hover:border-heritage-red">
      <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Bộ lọc{count > 0 && <span className="text-heritage-red">({count})</span>}
    </button>
    <dialog ref={dialog} aria-labelledby="library-filter-title" onCancel={close} onClose={() => setOpen(false)}
      onClick={e => { if (e.target === dialog.current) close(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 text-stone-900 backdrop:bg-stone-900/40 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl">
      <form className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6" onSubmit={e => { e.preventDefault(); onApply(draft); close(); }}>
        <div className="flex items-center justify-between gap-3"><h2 id="library-filter-title" className="font-serif text-xl font-bold">Lọc trang phục</h2>
          <button type="button" onClick={close} aria-label="Đóng bộ lọc" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"><X aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <label className="block space-y-2"><span className="text-sm font-semibold">Loại trang phục</span><select className={fieldClass} value={draft.group} onChange={e => setDraft({ ...draft, group: e.target.value })}>{groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label className="block space-y-2"><span className="text-sm font-semibold">Dành cho</span><select className={fieldClass} value={draft.gender} onChange={e => setDraft({ ...draft, gender: e.target.value })}>{genders.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        {garmentTypes.length > 0 && <label className="block space-y-2"><span className="text-sm font-semibold">Dòng trang phục</span><select className={fieldClass} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}><option value="all">Tất cả dòng trang phục</option>{garmentTypes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
        <div className="flex gap-3 border-t border-stone-200 pt-5">
          <button type="button" onClick={() => setDraft({ ...emptyFilters, q: filters.q })} className="min-h-12 flex-1 whitespace-nowrap rounded-xl border border-stone-300 px-3 text-sm font-semibold hover:bg-stone-50">Đặt lại</button>
          <button type="submit" className="min-h-12 flex-1 whitespace-nowrap rounded-xl bg-heritage-red px-3 text-sm font-semibold text-white hover:bg-heritage-red-dark">Áp dụng</button>
        </div>
      </form>
    </dialog>
  </>;
}
