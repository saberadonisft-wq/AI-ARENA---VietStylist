"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Users, Shirt, Layers, FolderHeart, Plus, RefreshCw, Pencil, Trash2, ClipboardCheck, Eye, Check, X } from "lucide-react";
import { api, apiFetch, ApiError } from "@/lib/api/client";
import { adminApi, AdminSection, AdminUser, AdminRow, AdminOverview, ManagedOutfit, ManagedLookbook, StylistSubmission } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/context";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import type { CatalogItem, GarmentType } from "@/lib/types/api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-heritage-red disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-heritage-red";
const tabs = [
  { id: "users", label: "Người dùng", icon: Users, stat: "users" }, { id: "items", label: "Trang phục", icon: Shirt, stat: "items" },
  { id: "outfits", label: "Bộ phối", icon: Layers, stat: "outfits" }, { id: "lookbooks", label: "Lookbook", icon: FolderHeart, stat: "lookbooks" },
  { id: "submissions", label: "Duyệt mẫu stylist", icon: ClipboardCheck, stat: undefined },
] as const;

export default function AdminWorkspace({ onOverview }: { onOverview?: (value: AdminOverview) => void }) {
  const { user, isAdmin } = useAuth();
  const { refreshCatalog } = useCatalog();
  const { confirm, dialog } = useConfirmDialog();
  const [section, setSection] = useState<AdminSection>("users");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loadedSection, setLoadedSection] = useState<AdminSection | null>(null);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [book, setBook] = useState<ManagedLookbook | null>(null);
  const [submissionPreviews, setSubmissionPreviews] = useState<Record<string, string>>({});
  const [submissionNotes, setSubmissionNotes] = useState<Record<string, string>>({});
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [bulkFailures, setBulkFailures] = useState<{ id: string; name: string; message: string }[]>([]);
  const bulkLock = useRef(false);
  const currentActor = useRef(user?.id);
  currentActor.current = user?.id;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) { setRows([]); setOverview(null); return; }
    let cancelled = false;
    setLoading(true); setError(""); setRows([]);
    const timer = setTimeout(() => {
      Promise.all([section === "submissions" ? adminApi.listSubmissions(search, offset) : adminApi.list<AdminRow>(section, search, offset), adminApi.overview()])
        .then(([page, counts]) => { if (!cancelled) { setRows(page.items); setLoadedSection(section); setTotal(page.total); setOverview(counts); onOverview?.(counts); } })
        .catch(e => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [section, search, offset, version, isAdmin, user?.id, onOverview]);

  if (!isAdmin) return null;

  const mutate = async (action: () => Promise<unknown>, message: string) => {
    if (busy || bulkLock.current) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      await action(); setNotice(message); setVersion(v => v + 1);
      if (section === "items" || section === "submissions") await refreshCatalog();
      return true;
    } catch (e: any) { setError(e.message || "Không thực hiện được thao tác. Hãy thử lại."); return false; }
    finally { setBusy(false); }
  };

  const confirmMutation = (options: Parameters<typeof confirm>[0], action: () => Promise<unknown>, message: string) => {
    void confirm(options).then(accepted => { if (accepted) void mutate(action, message); });
  };

  const approveAll = async () => {
    if (busy || loading || bulkLock.current || section !== "submissions") return;
    bulkLock.current = true;
    setBusy(true); setError(""); setNotice(""); setBulkFailures([]);
    const actor = user?.id;
    const token = localStorage.getItem("viet_stylist_auth_token");
    const sessionIsCurrent = () => mounted.current && currentActor.current === actor && localStorage.getItem("viet_stylist_auth_token") === token;
    let reviewed = false;
    let approved = 0;
    try {
      // Collect every page before publishing: approvals remove rows from this list.
      const pending = new Map<string, StylistSubmission>();
      let nextOffset = 0;
      let remaining = true;
      while (remaining) {
        if (!sessionIsCurrent()) return;
        const page = await adminApi.listSubmissions(search, nextOffset, 100);
        for (const item of page.items) if (item.status === "pending") pending.set(item.id, item);
        if (!page.items.length && nextOffset < page.total) throw new Error("Chưa tải đủ các mẫu chờ duyệt. Hãy tải lại rồi thử lại.");
        nextOffset += page.items.length;
        remaining = nextOffset < page.total;
      }
      if (!sessionIsCurrent()) return;
      const submissions = [...pending.values()];
      if (!submissions.length) { setNotice("Không còn mẫu đang chờ duyệt."); setOffset(0); setVersion(v => v + 1); return; }
      const accepted = await confirm({
        title: "Duyệt tất cả mẫu đang chờ?",
        description: `Bạn sắp duyệt và công khai ${submissions.length} mẫu${search.trim() ? ` trong kết quả tìm kiếm “${search.trim()}”` : ""}, bao gồm các trang sau. Các mẫu này sẽ xuất hiện trong thư viện trang phục.`,
        confirmLabel: `Duyệt ${submissions.length} mẫu`,
        tone: "primary",
      });
      if (!accepted || !sessionIsCurrent()) return;
      let completed = 0;
      let skipped = 0;
      const failures: { id: string; name: string; message: string }[] = [];
      setBulkProgress({ completed, total: submissions.length });
      for (const submission of submissions) {
        if (!sessionIsCurrent()) break;
        let stop = false;
        reviewed = true;
        try {
          await adminApi.reviewSubmission(submission.id, "approve");
          approved += 1;
        } catch (e) {
          if (e instanceof ApiError && (e.code === "SUBMISSION_ALREADY_REVIEWED" || e.code === "SUBMISSION_NOT_FOUND")) skipped += 1;
          else {
            failures.push({ id: submission.id, name: submission.name, message: e instanceof Error ? e.message : "Không duyệt được mẫu. Hãy thử lại." });
            stop = e instanceof ApiError && [401, 403, 429].includes(e.statusCode);
          }
        }
        completed += 1;
        if (sessionIsCurrent()) setBulkProgress({ completed, total: submissions.length });
        if (stop) break;
      }
      if (sessionIsCurrent()) {
        const unprocessed = submissions.length - completed;
        setBulkFailures(failures);
        setNotice(`Đã duyệt ${approved}/${submissions.length} mẫu.${skipped ? ` ${skipped} mẫu đã được xử lý ở phiên khác hoặc không còn chờ duyệt.` : ""}${failures.length ? ` ${failures.length} mẫu duyệt thất bại.` : ""}${unprocessed ? ` Đã dừng; ${unprocessed} mẫu chưa được xử lý.` : ""}`);
      }
    } catch (e) {
      if (sessionIsCurrent()) setError(e instanceof Error ? e.message : "Không thực hiện được thao tác. Hãy thử lại.");
    } finally {
      if (reviewed && sessionIsCurrent()) { setOffset(0); setVersion(v => v + 1); }
      try {
        if (approved && sessionIsCurrent()) await refreshCatalog();
      } finally {
        bulkLock.current = false;
        if (mounted.current) { setBulkProgress(null); setBusy(false); }
      }
    }
  };

  const remove = (id: string, name: string) => {
    if (section === "users" || section === "submissions") return;
    void confirm({
      title: "Xóa nội dung này?",
      description: `Bạn sắp xóa “${name}”. Nội dung đang được sử dụng có thể không còn mở được.`,
      confirmLabel: "Xóa nội dung",
      tone: "danger",
    }).then(accepted => {
      if (!accepted) return;
      void mutate(() => adminApi.remove(section, id), "Đã xóa nội dung.").then(ok => { if (ok && rows.length === 1 && offset > 0) setOffset(offset - 20); });
    });
  };

  return <section className="space-y-5" aria-label="Quản lý hệ thống">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-serif text-2xl font-bold text-stone-900">Quản lý hệ thống</h2><p className="mt-1 text-sm text-stone-600">Cấp quyền stylist, quản lý nội dung và bộ phối của người dùng.</p></div>
      <button className={button} onClick={() => setVersion(v => v + 1)} disabled={loading || busy}><RefreshCw size={16} />Tải lại</button>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tabs.filter(t => t.stat).map(t => <div key={t.id} className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-sm text-stone-600">{t.label}</p><p className="mt-1 text-2xl font-semibold text-heritage-red">{overview?.[t.stat as keyof AdminOverview] ?? "—"}</p></div>)}</div>
    <div className="flex flex-wrap gap-2" aria-label="Danh mục quản lý">{tabs.map(t => <button key={t.id} aria-pressed={section === t.id} className={`${button} ${section === t.id ? "!bg-heritage-red !text-white !border-heritage-red" : ""}`} disabled={busy} onClick={() => { setSection(t.id); setOffset(0); setSearch(""); setEditing(null); setBook(null); setNotice(""); setBulkFailures([]); }}><t.icon size={17} />{t.label}</button>)}</div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-0"><span className="mb-1 block text-sm font-medium">{section === "users" ? "Tìm theo tên hoặc email" : "Tìm theo tên"}</span><input className={input} disabled={busy} value={search} onChange={e => { setSearch(e.target.value); setOffset(0); setNotice(""); setBulkFailures([]); }} /></label>
      {section === "submissions" && <button type="button" className={`${button} !border-emerald-700 !bg-emerald-700 !text-white`} disabled={busy || loading || loadedSection !== "submissions" || !rows.length || !total} onClick={() => void approveAll()}><ClipboardCheck size={16} />Duyệt tất cả ({total})</button>}
      {section === "items" && <button className={button} disabled={busy} onClick={() => setEditing("new")}><Plus size={16} />Thêm trang phục</button>}
      {section === "outfits" && <Link className={button} href="/studio"><Plus size={16} />Tạo bộ phối trong Studio</Link>}
      {section === "lookbooks" && <Link className={button} href="/lookbook"><Plus size={16} />Tạo lookbook</Link>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {!!bulkFailures.length && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p className="font-medium">Các mẫu chưa duyệt thành công:</p><ul className="mt-2 list-disc space-y-1 pl-5">{bulkFailures.map(failure => <li key={failure.id}><strong>{failure.name}</strong>: {failure.message}</li>)}</ul></div>}
    {busy && <p role="status" aria-live="polite" className="text-sm text-stone-600">{bulkProgress ? `Đang duyệt ${bulkProgress.completed}/${bulkProgress.total} mẫu…` : "Đang xử lý thao tác…"}</p>}
    {editing && <ItemEditor key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} busy={busy} onCancel={() => setEditing(null)} onSave={async payload => { if (await mutate(() => adminApi.saveItem(payload, editing !== "new"), "Đã lưu trang phục.")) setEditing(null); }} />}
    {book && <form className="rounded-xl border border-stone-300 bg-white p-5 space-y-3" onSubmit={async e => { e.preventDefault(); if (await mutate(() => adminApi.updateLookbook(book.id, { title: book.title, description: book.description, visibility: book.visibility, entries: book.entries.map(x => ({ outfit_version_id: x.outfit_version_id, sort_order: x.sort_order, notes: x.notes })) }), "Đã cập nhật lookbook.")) setBook(null); }}>
      <h3 className="font-semibold">Sửa lookbook · {book.owner_name || book.owner_id}</h3>
      <label className="block text-sm">Tên lookbook<input required className={input} value={book.title} onChange={e => setBook({ ...book, title: e.target.value })} /></label>
      <label className="block text-sm">Mô tả<textarea className={input} value={book.description || ""} onChange={e => setBook({ ...book, description: e.target.value })} /></label>
      <label className="block text-sm">Quyền xem<select className={input} value={book.visibility} onChange={e => setBook({ ...book, visibility: e.target.value as ManagedLookbook["visibility"] })}><option value="private">Riêng tư</option><option value="unlisted">Qua liên kết</option><option value="public">Công khai</option></select></label>
      {book.entries.map(entry => <div className="flex items-center justify-between gap-3" key={entry.id}><span className="text-sm">{entry.outfit_title}</span><button type="button" className={button} onClick={() => setBook({ ...book, entries: book.entries.filter(x => x.id !== entry.id) })}>Bỏ khỏi lookbook</button></div>)}
      <div className="flex gap-2"><button className={button} disabled={busy}>Lưu lookbook</button><button type="button" className={button} disabled={busy} onClick={() => setBook(null)}>Hủy</button></div>
    </form>}
    <div aria-busy={loading} className="space-y-3">
      {loading || (!error && loadedSection !== section) ? <p role="status" className="p-6 text-center text-stone-600">Đang tải dữ liệu…</p> : !error && !rows.length ? <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-600">Chưa có dữ liệu phù hợp.</p> : rows.map(row => {
        if (section === "users") {
          const account = row as AdminUser;
          const protectedAccount = account.id === user?.id || account.roles.some(r => r === "admin" || r === "editor");
          return <article key={account.id} className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><h3 className="font-semibold text-stone-900">{account.display_name}</h3><p className="break-all text-sm text-stone-600">{account.email}</p><p className="mt-1 text-sm text-stone-600">{account.roles.join(", ")} · {account.is_active ? "Đang hoạt động" : "Đã khóa"}</p></div>
            {protectedAccount ? <span className="text-sm text-stone-500">Tài khoản quản trị được bảo vệ</span> : <div className="flex flex-wrap gap-2">
              <button disabled={busy} className={button} onClick={() => { const grant = !account.roles.includes("stylist"); confirmMutation({ title: `${grant ? "Cấp" : "Thu hồi"} quyền stylist?`, description: grant ? `${account.email} sẽ được phép gửi mẫu trang phục để admin duyệt.` : `${account.email} sẽ mất quyền stylist và không thể gửi mẫu mới để xét duyệt.`, confirmLabel: grant ? "Cấp quyền" : "Thu hồi quyền", tone: grant ? "primary" : "danger" }, () => adminApi.updateUser(account.id, { is_stylist: grant }), grant ? "Đã cấp quyền stylist." : "Đã thu hồi quyền stylist."); }}>{account.roles.includes("stylist") ? "Thu hồi stylist" : "Cấp quyền stylist"}</button>
              <button disabled={busy} className={`${button} !text-red-700`} onClick={() => { const locking = account.is_active; confirmMutation({ title: `${locking ? "Khóa" : "Mở khóa"} tài khoản?`, description: locking ? `${account.email} sẽ không thể đăng nhập cho đến khi được mở khóa.` : `${account.email} sẽ có thể đăng nhập trở lại.`, confirmLabel: locking ? "Khóa tài khoản" : "Mở khóa", tone: locking ? "danger" : "primary" }, () => adminApi.updateUser(account.id, { is_active: !locking }), "Đã cập nhật trạng thái tài khoản."); }}>{account.is_active ? "Khóa tài khoản" : "Mở khóa"}</button>
            </div>}
          </article>;
        }
        if (section === "submissions") {
          const submission = row as StylistSubmission;
          const statusLabel = submission.status === "pending" ? "Chờ duyệt" : submission.status === "approved" ? "Đã duyệt" : "Từ chối";
          const statusStyle = submission.status === "pending" ? "bg-amber-50 text-amber-800" : submission.status === "approved" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800";
          return <article key={submission.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-stone-900">{submission.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>{statusLabel}</span></div>
                <p className="mt-1 text-sm text-stone-600">{submission.submitter_name || "Stylist"}{submission.submitter_email ? ` · ${submission.submitter_email}` : ""} · {submission.garment_type_name || submission.garment_type_id} · {submission.era || "Chưa rõ thời kỳ"} · {submission.slot} · {submission.gender}</p>
                <p className="mt-1 text-sm text-stone-600">Màu: {submission.color_name || "Chưa rõ"}{submission.hex_color ? ` (${submission.hex_color})` : ""} · Chất liệu: {submission.material || "Chưa rõ"}</p>
                <p className="mt-2 text-sm text-stone-700">{submission.description}</p>
                {submission.review_note && <p className="mt-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">Ghi chú duyệt: {submission.review_note}</p>}
              </div>
              <button type="button" className={button} disabled={busy || !submission.media_id} onClick={async () => { setError(""); try { const result = await adminApi.submissionPreview(submission.id); setSubmissionPreviews(v => ({ ...v, [submission.id]: result.access_url })); } catch (e: any) { setError(e.message || "Không tải được ảnh mẫu."); } }}><Eye size={16} />{submissionPreviews[submission.id] ? "Tải lại ảnh" : "Xem ảnh"}</button>
            </div>
            {submissionPreviews[submission.id] && <img src={submissionPreviews[submission.id]} alt={`Ảnh mẫu ${submission.name}`} className="max-h-96 w-full rounded-lg border border-stone-200 bg-stone-50 object-contain" />}
            {submission.status === "pending" && <div className="flex flex-col gap-2 border-t border-stone-100 pt-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm">Ghi chú từ chối (bắt buộc, ít nhất 5 ký tự)<input className={input} required minLength={5} maxLength={1000} value={submissionNotes[submission.id] || ""} onChange={e => setSubmissionNotes(v => ({ ...v, [submission.id]: e.target.value }))} /></label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || (submissionNotes[submission.id] || "").trim().length < 5} className={`${button} !text-red-700`} onClick={() => confirmMutation({ title: "Từ chối mẫu trang phục?", description: `Mẫu “${submission.name}” sẽ được trả lại stylist cùng ghi chú để chỉnh sửa.`, confirmLabel: "Từ chối mẫu", tone: "danger" }, () => adminApi.reviewSubmission(submission.id, "reject", submissionNotes[submission.id]), "Đã từ chối mẫu; stylist có thể sửa và gửi lại.")}><X size={16} />Từ chối</button>
                <button type="button" disabled={busy} className={`${button} !border-emerald-700 !bg-emerald-700 !text-white`} onClick={() => confirmMutation({ title: "Duyệt và công khai mẫu?", description: `Mẫu “${submission.name}” sẽ xuất hiện trong thư viện trang phục sau khi được duyệt.`, confirmLabel: "Duyệt & công khai", tone: "primary" }, () => adminApi.reviewSubmission(submission.id, "approve"), "Đã duyệt mẫu và cập nhật thư viện.")}><Check size={16} />Duyệt & công khai</button>
              </div>
            </div>}
          </article>;
        }
        const item = row as CatalogItem; const resource = row as ManagedOutfit & ManagedLookbook;
        const title = section === "items" ? item.name : resource.title;
        return <article key={row.id} className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><h3 className="font-semibold text-stone-900">{title}</h3><p className="mt-1 break-words text-sm text-stone-600">{section === "items" ? `${item.is_published ? "Đã công khai" : "Đang ẩn"} · ${item.variants.length} biến thể` : `${resource.owner_name || resource.owner_id} · ${resource.owner_email || ""}`}</p></div>
          <div className="flex flex-wrap gap-2">
            {section === "items" ? <button disabled={busy} className={button} onClick={() => { setEditing(item); setNotice(""); }}><Pencil size={16} />Sửa trang phục</button> : section === "outfits" ? <Link className={button} href={`/studio?loadOutfit=${encodeURIComponent(row.id)}&manage=1`}><Pencil size={16} />Sửa trong Studio</Link> : <button disabled={busy} className={button} onClick={() => setBook(resource)}><Pencil size={16} />Sửa lookbook</button>}
            <button disabled={busy} className={`${button} !text-red-700`} onClick={() => remove(row.id, title)}><Trash2 size={16} />Xóa</button>
          </div>
        </article>;
      })}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600"><span>{total} kết quả · Trang {Math.floor(offset / 20) + 1}</span><div className="flex gap-2"><button className={button} disabled={!offset || loading || busy} onClick={() => setOffset(offset - 20)}>Trước</button><button className={button} disabled={offset + 20 >= total || loading || busy} onClick={() => setOffset(offset + 20)}>Sau</button></div></div>
    {dialog}
  </section>;
}

function ItemEditor({ item, busy, onSave, onCancel }: { item: CatalogItem | null; busy: boolean; onSave: (payload: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [types, setTypes] = useState<GarmentType[]>([]);
  const [form, setForm] = useState({ id: item?.id || "", name: item?.name || "", garment_type_id: item?.garment_type_id || "", slot: item?.slot || "outerwear", gender: item?.gender || "unisex", description: item?.description || "", era: item?.era || "Nguyễn", is_published: item?.is_published ?? false });
  const [imageUrl, setImageUrl] = useState(item?.metadata?.real_image_url || "");
  const [groupName, setGroupName] = useState("");
  const [localError, setLocalError] = useState("");
  const [working, setWorking] = useState(false);
  const [color, setColor] = useState("#1A365D");
  const [colorName, setColorName] = useState("");
  const [variants, setVariants] = useState(item?.variants || []);
  useEffect(() => { let active = true; api.getGarmentTypes().then(v => { if (active) setTypes(v); }).catch(e => { if (active) setLocalError(e.message); }); return () => { active = false; }; }, []);
  const update = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));
  return <form className="space-y-4 rounded-xl border border-stone-300 bg-white p-5" onSubmit={e => { e.preventDefault(); void onSave({ ...form, metadata: { ...item?.metadata, real_image_url: imageUrl || undefined, flatlay_image_url: imageUrl !== (item?.metadata?.real_image_url || "") ? imageUrl || undefined : item?.metadata?.flatlay_image_url } }); }}>
    <h3 className="text-lg font-semibold">{item ? "Chỉnh sửa trang phục" : "Trang phục mới"}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Mã trang phục<input className={input} required pattern="[a-zA-Z0-9_-]+" disabled={!!item} value={form.id} onChange={e => update("id", e.target.value)} /></label>
      <label className="text-sm">Tên trang phục<input className={input} required maxLength={200} value={form.name} onChange={e => update("name", e.target.value)} /></label>
      <label className="text-sm">Nhóm trang phục<select required className={input} value={form.garment_type_id} onChange={e => update("garment_type_id", e.target.value)}><option value="">Chọn nhóm</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="text-sm">Vị trí<select className={input} value={form.slot} onChange={e => update("slot", e.target.value)}>{Object.entries({ outerwear: "Áo ngoài", undergarment: "Áo trong", bottom: "Quần / váy", headwear: "Khăn / mũ", accessory_front: "Phụ kiện trước", accessory_back: "Phụ kiện sau", footwear: "Giày / guốc" }).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-sm">Giới tính<select className={input} value={form.gender} onChange={e => update("gender", e.target.value)}><option value="unisex">Mọi giới</option><option value="male">Nam</option><option value="female">Nữ</option></select></label>
      <label className="text-sm">Thời kỳ<input className={input} value={form.era} onChange={e => update("era", e.target.value)} /></label>
    </div>
    <label className="block text-sm">Mô tả<textarea className={input} value={form.description} onChange={e => update("description", e.target.value)} /></label>
    <label className="block text-sm">Đường dẫn ảnh trang phục<input className={input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://… hoặc /images/…" /></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={e => update("is_published", e.target.checked)} />Công khai trong thư viện</label>
    <details className="rounded-lg bg-stone-50 p-3"><summary className="cursor-pointer text-sm font-medium">Thêm nhóm trang phục</summary><div className="mt-3 flex flex-wrap gap-2"><label className="flex-1 text-sm">Tên nhóm<input className={input} value={groupName} onChange={e => setGroupName(e.target.value)} /></label><button type="button" className={button} disabled={working || busy || !groupName.trim()} onClick={async () => { setWorking(true); setLocalError(""); try { const t = await apiFetch<GarmentType>("/api/admin/garment-types", { method: "POST", body: JSON.stringify({ id: `group_${crypto.randomUUID()}`, name: groupName.trim() }) }); setTypes(v => [...v, t]); update("garment_type_id", t.id); setGroupName(""); } catch (e: any) { setLocalError(e.message); } finally { setWorking(false); } }}>Thêm nhóm</button></div></details>
    {item && <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3"><legend className="px-2 text-sm font-medium">Biến thể màu sắc</legend><ul className="space-y-1 text-sm">{variants.map(v => <li key={v.id}>{v.color_name} · {v.hex_color} · {v.material}</li>)}</ul><div className="flex flex-wrap items-end gap-2"><label className="flex-1 text-sm">Tên màu<input className={input} value={colorName} onChange={e => setColorName(e.target.value)} /></label><label className="text-sm">Màu<input type="color" aria-label="Màu biến thể" className="block h-11 w-16" value={color} onChange={e => setColor(e.target.value)} /></label><button type="button" className={button} disabled={working || busy || !colorName.trim()} onClick={async () => { setWorking(true); setLocalError(""); const variant = { id: `variant_${crypto.randomUUID()}`, item_id: item.id, color_name: colorName.trim(), hex_color: color, material: "Lụa tơ tằm", thickness_level: "medium", is_default: !variants.length, price_tier: "standard" }; try { await apiFetch("/api/admin/variants", { method: "POST", body: JSON.stringify(variant) }); setVariants(v => [...v, variant]); setColorName(""); } catch (e: any) { setLocalError(e.message); } finally { setWorking(false); } }}>Thêm màu</button></div></fieldset>}
    {localError && <p role="alert" className="text-sm text-red-700">{localError}</p>}
    <div className="flex gap-2"><button className={`${button} !bg-heritage-red !text-white`} disabled={busy || working}>{busy ? "Đang lưu…" : "Lưu trang phục"}</button><button type="button" className={button} disabled={busy || working} onClick={onCancel}>Hủy</button></div>
  </form>;
}
