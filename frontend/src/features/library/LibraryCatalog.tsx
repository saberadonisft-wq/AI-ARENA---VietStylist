"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, RotateCcw } from "lucide-react";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import LibraryCard from "./LibraryCard";
import FilterSheet from "./LibraryFilters";
import { emptyFilters, genders, groups, matchesFilters, type LibraryFilters } from "./filters";

const positionKey = "vietstylist.library.position";
const gridClass = "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3";

// Existing library route: a consistent catalog grid supports scanning and comparison.
export default function LibraryCatalog() {
  const { catalogItems: items, garmentTypes, itemsLoading: isLoading, itemsError, error, refreshCatalog } = useCatalog();
  const params = useSearchParams();
  const filters: LibraryFilters = {
    q: params.get("q") || "",
    group: groups.some(g => g.id === params.get("group")) ? params.get("group")! : "all",
    gender: genders.some(g => g.id === params.get("gender")) ? params.get("gender")! : "all",
    type: params.get("type") || "all",
  };
  const filtered = items.filter(item => matchesFilters(item, filters));
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== emptyFilters[key as keyof LibraryFilters]);
  const restored = useRef(false);
  useEffect(() => {
    if (isLoading || restored.current) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(positionKey) || "null");
      if (saved?.url === location.pathname + location.search && Number.isFinite(saved.y)) {
        const frame = requestAnimationFrame(() => { window.scrollTo(0, saved.y); restored.current = true; });
        return () => cancelAnimationFrame(frame);
      }
    } catch { /* Browsing still works when storage is unavailable. */ }
  }, [isLoading]);

  function update(next: LibraryFilters) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || (key !== "q" && value === "all")) query.delete(key); else query.set(key, value);
    }
    window.history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
  }
  function rememberPosition() {
    try { sessionStorage.setItem(positionKey, JSON.stringify({ url: location.pathname + location.search, y: scrollY })); } catch { /* Optional position recovery. */ }
  }
  const activeLabels = [
    filters.group !== "all" && groups.find(g => g.id === filters.group)?.label,
    filters.gender !== "all" && genders.find(g => g.id === filters.gender)?.label,
    filters.type !== "all" && (garmentTypes.find(g => g.id === filters.type)?.name || "Dòng trang phục đã chọn"),
  ].filter(Boolean);

  return <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:space-y-9 sm:px-6 sm:py-12 lg:px-8">
    <header className="max-w-2xl space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-heritage-red">Trang phục & di sản Việt</p>
      <h1 className="min-w-0 break-words font-serif text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Thư viện cổ phục</h1>
      <p className="text-base leading-relaxed text-stone-600">Khám phá trang phục và chọn món để tạo bản phối của bạn.</p>
    </header>

    <section aria-label="Tìm kiếm và lọc trang phục" className="space-y-4">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
        <label htmlFor="library-search" className="sr-only">Tìm trang phục</label>
        <input id="library-search" type="search" value={filters.q} onChange={e => update({ ...filters, q: e.target.value })}
          placeholder="Tìm áo, quần, mũ hoặc phụ kiện…" className="min-h-12 w-full rounded-xl border border-stone-300 bg-white py-3 pl-12 pr-12 text-base text-stone-900 placeholder:text-stone-500 [&::-webkit-search-cancel-button]:appearance-none" />
        {filters.q && <button aria-label="Xóa tìm kiếm" onClick={() => update({ ...filters, q: "" })} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"><X aria-hidden="true" className="h-4 w-4" /></button>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Loại trang phục">
          {groups.map(group => <button key={group.id} aria-pressed={filters.group === group.id} onClick={() => update({ ...filters, group: group.id })}
            className={`min-h-11 min-w-11 whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition-colors sm:px-4 ${filters.group === group.id ? "border-heritage-red/20 bg-heritage-red/10 text-heritage-red" : "border-transparent text-stone-600 hover:bg-stone-100"}`}>{group.label}</button>)}
        </div>
        <FilterSheet filters={filters} garmentTypes={garmentTypes} onApply={update} />
      </div>
    </section>

    <section aria-label="Danh sách trang phục" aria-busy={isLoading} className="space-y-5 border-t border-stone-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <p role="status" className="break-words text-sm font-medium text-stone-700">{isLoading ? "Đang tải trang phục…" : itemsError ? "Chưa tải được danh sách" : `${filtered.length} trang phục${filters.q.trim() ? ` cho “${filters.q.trim()}”` : ""}`}</p>
          {activeLabels.length > 0 && <p className="break-words text-sm text-stone-500">{activeLabels.join(" · ")}</p>}
        </div>
        {hasFilters && <button onClick={() => update(emptyFilters)} className="min-h-11 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-heritage-red hover:bg-heritage-red/5">Xóa bộ lọc</button>}
      </div>

      {!isLoading && error && !itemsError && <p role="alert" className="text-sm text-stone-600">Một số tùy chọn chưa tải được. <button onClick={() => void refreshCatalog()} className="min-h-11 px-2 font-semibold text-heritage-red underline">Thử lại</button></p>}
      {isLoading ? <div className={gridClass} aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(key => <div key={key} className="overflow-hidden rounded-2xl border border-stone-200 bg-white motion-safe:animate-pulse"><div className="aspect-[4/3] bg-stone-200/60" /><div className="space-y-4 p-5"><div className="h-6 w-3/4 rounded bg-stone-100" /><div className="h-4 w-1/2 rounded bg-stone-100" /><div className="h-11 rounded-xl bg-stone-100" /></div></div>)}</div>
        : itemsError ? <div role="alert" className="space-y-3 rounded-2xl border border-stone-200 bg-white px-5 py-12 text-center"><h2 className="font-serif text-xl font-bold">Chưa tải được thư viện</h2><p className="text-base text-stone-600">Kết nối có thể bị gián đoạn. Bạn hãy thử tải lại.</p><button onClick={() => void refreshCatalog()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-heritage-red px-5 text-sm font-semibold text-white hover:bg-heritage-red-dark"><RotateCcw aria-hidden="true" className="h-4 w-4" />Thử lại</button></div>
        : filtered.length === 0 ? <div className="space-y-3 py-12 text-center"><Search aria-hidden="true" className="mx-auto h-8 w-8 text-stone-400" /><h2 className="font-serif text-xl font-bold">{items.length === 0 ? "Thư viện đang được cập nhật" : "Không tìm thấy trang phục"}</h2><p className="text-base text-stone-600">{items.length === 0 ? "Các trang phục sẽ xuất hiện tại đây khi được bổ sung." : "Thử tên khác hoặc xóa bộ lọc để xem thêm trang phục."}</p></div>
        : <div className={gridClass}>{filtered.map((item, i) => <LibraryCard key={item.id} item={item} priority={i < 3} returnTo={`/thu-vien${params.size ? `?${params}` : ""}`} rememberPosition={rememberPosition} />)}</div>}
    </section>
  </div>;
}
