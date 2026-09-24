"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, apiFetch, ApiError } from "@/lib/api/client";
import type { GarmentType } from "@/lib/types/api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock3,
  Feather,
  ImagePlus,
  Layers,
  LoaderCircle,
  Palette,
  Plus,
  Shirt,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface StylistSubmission {
  id: string;
  name: string;
  garment_type_id: string;
  garment_type_name?: string;
  slot: string;
  gender: string;
  description?: string;
  era?: string;
  status: "pending" | "approved" | "rejected";
  color_name?: string;
  hex_color?: string;
  material?: string;
  submitted_at?: string;
  review_note?: string;
}

const slotOptions = [
  ["outerwear", "Áo ngoài"],
  ["undergarment", "Áo trong"],
  ["bottom", "Quần / váy"],
  ["headwear", "Khăn / mũ"],
  ["accessory_front", "Phụ kiện trước"],
  ["accessory_back", "Phụ kiện sau"],
  ["footwear", "Giày / guốc"],
] as const;

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-heritage-red disabled:cursor-not-allowed disabled:opacity-50";
const input = "mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-heritage-red";

export default function StylistWorkspace({ outfitCount }: { outfitCount: number }) {
  const { confirm, dialog } = useConfirmDialog();
  const [section, setSection] = useState<"overview" | "submissions">("overview");
  const [submissions, setSubmissions] = useState<StylistSubmission[]>([]);
  const [submissionTotal, setSubmissionTotal] = useState(0);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupNotice, setGroupNotice] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [form, setForm] = useState({
    name: "",
    garment_type_id: "",
    slot: "outerwear",
    gender: "unisex",
    description: "",
    era: "Nguyễn",
    color_name: "",
    hex_color: "#7A1E2B",
    material: "Lụa tơ tằm",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [types, page] = await Promise.all([
        api.getGarmentTypes(),
        apiFetch<{ items: StylistSubmission[]; total: number }>("/api/stylist/catalog-submissions?limit=100"),
      ]);
      setGarmentTypes(types || []);
      setSubmissions(page.items || []);
      setSubmissionTotal(page.total || 0);
      setForm(current => ({
        ...current,
        garment_type_id: types?.some(type => type.id === current.garment_type_id)
          ? current.garment_type_id
          : types?.[0]?.id || "",
      }));
    } catch (e: any) {
      setError(e?.message || "Không tải được dữ liệu workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!image) { setImagePreview(""); return; }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const createGarmentType = async () => {
    const name = groupName.trim();
    if (name.length < 2) {
      setError("Tên nhóm cần có ít nhất 2 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    setGroupNotice("");
    try {
      const created = await apiFetch<GarmentType>("/api/stylist/garment-types", {
        method: "POST",
        body: JSON.stringify({ id: `stylist_group_${crypto.randomUUID()}`, name }),
      });
      setGarmentTypes(current => current.some(type => type.id === created.id) ? current : [...current, created]);
      setForm(current => ({ ...current, garment_type_id: created.id }));
      setGroupName("");
      setGroupNotice(`Đã tạo nhóm “${created.name}” và chọn cho trang phục này.`);
    } catch (e: any) {
      setError(e?.message || "Không tạo được nhóm trang phục.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!garmentTypes.some(type => type.id === form.garment_type_id)) {
      setError("Hãy chọn hoặc tạo nhóm trang phục trước khi gửi mẫu.");
      return;
    }
    if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      setError("Chọn ảnh JPEG, PNG hoặc WebP.");
      return;
    }
    if (image.size > 10 * 1024 * 1024) {
      setError("Ảnh vượt quá giới hạn 10 MB.");
      return;
    }

    setBusy(true);
    let uploadedMediaId: string | undefined;
    try {
      const formData = new FormData();
      formData.append("file", image);
      const uploaded = await apiFetch<{ id: string }>("/api/stylist/garment-image", {
        method: "POST",
        body: formData,
        timeoutMs: 360000,
      });
      uploadedMediaId = uploaded.id;
      await apiFetch("/api/stylist/catalog-submissions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          description: form.description.trim(),
          color_name: form.color_name.trim(),
          material: form.material.trim(),
          media_id: uploadedMediaId,
        }),
      });
      setNotice("Đã gửi mẫu. Ảnh chỉ xuất hiện trong thư viện sau khi admin duyệt.");
      setForm(current => ({ ...current, name: "", description: "", color_name: "" }));
      setImage(null);
      setSection("submissions");
      await load();
    } catch (e: any) {
      if (uploadedMediaId && e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) {
        try { await apiFetch(`/api/media/${encodeURIComponent(uploadedMediaId)}`, { method: "DELETE" }); } catch { /* best-effort cleanup after a definitive client error */ }
      }
      setError(e?.message || "Không gửi được mẫu trang phục.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSubmission = async (item: StylistSubmission) => {
    if (!await confirm({
      title: "Xóa mẫu đã gửi?",
      description: `Mẫu “${item.name}” sẽ bị xóa khỏi danh sách của bạn. Bạn có thể gửi lại sau khi chỉnh sửa.`,
      confirmLabel: "Xóa mẫu",
      tone: "danger",
    })) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/stylist/catalog-submissions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setNotice(`Đã xóa mẫu “${item.name}”.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Không xóa được mẫu.");
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = submissions.filter(item => item.status === "pending").length;
  const approvedCount = submissions.filter(item => item.status === "approved").length;
  const rejectedCount = submissions.filter(item => item.status === "rejected").length;

  return <section className="space-y-6" aria-label="Workspace Stylist">
    <header className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-800"><Palette size={15} /> Không gian sáng tạo Stylist</p>
        <h2 className="mt-2 font-serif text-2xl font-bold text-stone-900 sm:text-3xl">Quản lý hoạt động Stylist</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">Quản lý mẫu trang phục gửi vào thư viện và mở nhanh các công cụ sáng tạo cá nhân.</p>
      </div>
      <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-heritage-red-dark disabled:opacity-50" onClick={() => { setError(""); setNotice(""); setShowForm(true); }}>
        <Plus size={17} /> Đăng trang phục
      </button>
    </header>

    <nav className="flex flex-wrap gap-2" aria-label="Khu vực workspace">
      <button type="button" aria-pressed={section === "overview"} className={`${button} ${section === "overview" ? "!border-heritage-red !bg-heritage-red !text-white" : ""}`} onClick={() => setSection("overview")}><Layers size={16} /> Tổng quan</button>
      <button type="button" aria-pressed={section === "submissions"} className={`${button} ${section === "submissions" ? "!border-heritage-red !bg-heritage-red !text-white" : ""}`} onClick={() => setSection("submissions")}><ClipboardCheck size={16} /> Mẫu trang phục ({submissionTotal})</button>
      <button type="button" className={button} disabled={loading || busy} onClick={() => void load()}><LoaderCircle size={16} className={loading ? "animate-spin" : ""} /> Làm mới</button>
    </nav>

    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    {section === "overview" ? <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Bộ phối cá nhân" value={outfitCount} icon={<Layers size={19} />} />
        <Stat label="Mẫu đang chờ duyệt" value={pendingCount} icon={<Clock3 size={19} />} />
        <Stat label="Mẫu trong thư viện" value={approvedCount} icon={<Check size={19} />} />
        <Stat label="Cần chỉnh sửa" value={rejectedCount} icon={<ClipboardCheck size={19} />} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ActionCard icon={<Shirt size={20} />} title="Kho trang phục" description="Gửi mẫu mới, theo dõi xét duyệt và đọc góp ý của quản trị viên." action="Mở mẫu đã gửi" onClick={() => setSection("submissions")} />
        <ActionCard icon={<Layers size={20} />} title="Studio phối đồ" description="Thiết kế, lưu và chỉnh sửa bộ phối cổ phục của riêng bạn." href="/studio" action="Mở Studio" />
        <ActionCard icon={<Palette size={20} />} title="Tác phẩm đã lưu" description="Xem, mở lại hoặc xóa các bộ phối cá nhân đã lưu trong tài khoản." href="/tai-khoan" action="Mở tủ tác phẩm" />
        <ActionCard icon={<BookOpen size={20} />} title="Lookbook" description="Sắp xếp và chia sẻ các bộ phối thành bộ sưu tập cá nhân." href="/lookbook" action="Quản lý lookbook" />
        <ActionCard icon={<Feather size={20} />} title="Chuyện Cổ phục" description="Viết bài và chia sẻ kiến thức, nguồn tham khảo về Việt phục." href="/chuyen-co-phuc" action="Mở chuyên mục" />
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
        <h3 className="font-serif text-lg font-bold text-stone-900">Quy trình đưa mẫu vào thư viện</h3>
        <ol className="mt-3 grid gap-3 text-sm text-stone-700 sm:grid-cols-3">
          <li className="rounded-lg bg-stone-50 p-3"><span className="font-semibold text-heritage-red">01 · Gửi mẫu</span><p className="mt-1">Tải ảnh vào vùng riêng tư và điền đặc điểm trang phục.</p></li>
          <li className="rounded-lg bg-stone-50 p-3"><span className="font-semibold text-heritage-red">02 · Admin thẩm định</span><p className="mt-1">Mẫu được kiểm tra trước khi đưa ra công khai.</p></li>
          <li className="rounded-lg bg-stone-50 p-3"><span className="font-semibold text-heritage-red">03 · Theo dõi kết quả</span><p className="mt-1">Xem trạng thái hoặc góp ý trong mục Mẫu trang phục.</p></li>
        </ol>
      </div>
    </> : <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="font-serif text-xl font-bold text-stone-900">Mẫu trang phục của tôi</h3><p className="mt-1 text-sm text-stone-600">Mẫu chờ duyệt chưa được hiển thị công khai.</p></div>
        <button type="button" className={button} onClick={() => { setError(""); setNotice(""); setShowForm(true); }}><ImagePlus size={16} /> Gửi mẫu mới</button>
      </div>
      {loading ? <p role="status" className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">Đang tải mẫu đã gửi…</p> : submissions.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center"><Shirt className="mx-auto h-8 w-8 text-stone-400" /><h4 className="mt-3 font-semibold text-stone-900">Chưa có mẫu trang phục</h4><p className="mt-1 text-sm text-stone-600">Gửi mẫu đầu tiên để admin thẩm định trước khi xuất hiện trong thư viện.</p><button type="button" className={`${button} mt-4 !border-heritage-red !text-heritage-red`} onClick={() => setShowForm(true)}><Plus size={16} /> Đăng trang phục</button></div> : submissions.map(item => <SubmissionCard key={item.id} item={item} busy={busy} onDelete={() => void deleteSubmission(item)} />)}
    </div>}

    {showForm && <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-stone-950/70 p-3 backdrop-blur-sm sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setShowForm(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="stylist-submission-title" className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-4 backdrop-blur sm:p-5">
          <div><h3 id="stylist-submission-title" className="font-serif text-xl font-bold text-stone-900">Đăng trang phục vào kho</h3><p className="mt-1 text-sm text-stone-600">Khi gửi mẫu, hệ thống tách nền và lưu ảnh PNG riêng tư trước khi admin duyệt.</p></div>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={() => setShowForm(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-50"><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {!garmentTypes.length && <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Kho chưa có nhóm trang phục. Tạo nhóm mới để tiếp tục gửi mẫu.</p>
              <p className="mt-1 text-xs text-amber-800">Nhóm mới sẽ dùng chung trong danh mục; mẫu trang phục vẫn cần admin duyệt.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="min-w-0 flex-1 text-sm font-medium text-stone-800">Tên nhóm mới<input maxLength={200} className={input} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ví dụ: Áo giao lĩnh" /></label>
                <button type="button" disabled={busy || loading || groupName.trim().length < 2} onClick={() => void createGarmentType()} className={`${button} self-end !border-heritage-red !bg-heritage-red !text-white`}><Plus size={16} />Tạo nhóm</button>
              </div>
            </div>}
            <label className="text-sm font-medium">Tên trang phục *<input required minLength={2} maxLength={200} className={input} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Áo ngũ thân tay chẽn" /></label>
            <div>
              <label className="text-sm font-medium">Nhóm trang phục *<select required disabled={!garmentTypes.length} className={input} value={form.garment_type_id} onChange={e => setForm(v => ({ ...v, garment_type_id: e.target.value }))}><option value="">Chọn nhóm</option>{garmentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
              {!!garmentTypes.length && <details className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-stone-700">+ Tạo nhóm trang phục mới</summary>
                <p className="mt-2 text-xs text-stone-600">Nhóm mới sẽ dùng chung trong danh mục; mẫu trang phục vẫn cần admin duyệt.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1 text-sm font-medium text-stone-800">Tên nhóm mới<input maxLength={200} className={input} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ví dụ: Áo giao lĩnh" /></label>
                  <button type="button" disabled={busy || groupName.trim().length < 2} onClick={() => void createGarmentType()} className={`${button} self-end`}><Plus size={16} />Tạo nhóm</button>
                </div>
              </details>}
              {groupNotice && <p role="status" className="mt-2 text-xs text-emerald-700">{groupNotice}</p>}
            </div>
            <label className="text-sm font-medium">Triều đại / thời kỳ *<input required maxLength={100} className={input} value={form.era} onChange={e => setForm(v => ({ ...v, era: e.target.value }))} /></label>
            <label className="text-sm font-medium">Vị trí trang phục *<select className={input} value={form.slot} onChange={e => setForm(v => ({ ...v, slot: e.target.value }))}>{slotOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className="text-sm font-medium">Đối tượng<select className={input} value={form.gender} onChange={e => setForm(v => ({ ...v, gender: e.target.value }))}><option value="unisex">Mọi giới</option><option value="female">Nữ</option><option value="male">Nam</option></select></label>
            <label className="text-sm font-medium">Chất liệu *<input required maxLength={120} className={input} value={form.material} onChange={e => setForm(v => ({ ...v, material: e.target.value }))} /></label>
            <label className="text-sm font-medium">Tên màu *<input required minLength={2} maxLength={80} className={input} value={form.color_name} onChange={e => setForm(v => ({ ...v, color_name: e.target.value }))} placeholder="Đỏ son, vàng nghệ…" /></label>
            <label className="text-sm font-medium">Màu đại diện *<span className="mt-1 flex min-h-11 items-center gap-3 rounded-lg border border-stone-300 px-3 py-2"><input type="color" aria-label="Chọn màu đại diện" value={form.hex_color} onChange={e => setForm(v => ({ ...v, hex_color: e.target.value }))} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" /><span className="font-mono text-sm font-normal">{form.hex_color.toUpperCase()}</span></span></label>
          </div>
          <label className="block text-sm font-medium">Mô tả đặc điểm trang phục *<textarea required minLength={10} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal focus:outline-heritage-red" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Mô tả phom dáng, cấu trúc, hoa văn và thông tin nguồn gốc có căn cứ…" /></label>
          <label className="block text-sm font-medium">Ảnh trang phục *<span className="mt-1 block rounded-xl border border-dashed border-stone-300 p-4"><span className="flex flex-wrap items-center gap-3"><Upload className="h-5 w-5 shrink-0 text-heritage-red" /><span className="min-w-0 flex-1 text-sm font-normal text-stone-600">JPEG, PNG hoặc WebP · tối đa 10 MB. Ảnh chỉ công khai sau khi admin duyệt.</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} className="block max-w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:font-medium" /></span>{imagePreview && <img src={imagePreview} alt="Xem trước ảnh trang phục" className="mt-4 max-h-72 w-full rounded-lg bg-stone-50 object-contain" />}</span></label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4"><button type="button" disabled={busy} className={button} onClick={() => setShowForm(false)}>Hủy</button><button type="submit" disabled={busy || !garmentTypes.some(type => type.id === form.garment_type_id)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white hover:bg-heritage-red-dark disabled:opacity-50"><ImagePlus size={16} />{busy ? "Đang xử lý…" : "Gửi để xét duyệt"}</button></div>
        </form>
      </section>
    </div>}
    {dialog}
  </section>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <article className="rounded-xl border border-stone-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-stone-600">{icon}<span>{label}</span></div><p className="mt-2 font-serif text-3xl font-bold text-heritage-red">{value}</p></article>;
}

function ActionCard({ icon, title, description, action, href, onClick }: { icon: React.ReactNode; title: string; description: string; action: string; href?: string; onClick?: () => void }) {
  const content = <><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">{icon}</div><h3 className="mt-3 font-serif text-lg font-bold text-stone-900">{title}</h3><p className="mt-1 flex-1 text-sm leading-relaxed text-stone-600">{description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-heritage-red">{action}<ArrowRight size={16} /></span></>;
  return href ? <Link href={href} className="flex min-h-52 flex-col rounded-xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">{content}</Link> : <button type="button" onClick={onClick} className="flex min-h-52 flex-col rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">{content}</button>;
}

function SubmissionCard({ item, busy, onDelete }: { item: StylistSubmission; busy: boolean; onDelete: () => void }) {
  const status = item.status === "pending" ? "Đang chờ admin duyệt" : item.status === "approved" ? "Đã công khai trong thư viện" : "Cần chỉnh sửa";
  const badge = item.status === "pending" ? "bg-amber-50 text-amber-800" : item.status === "approved" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800";
  return <article className="rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-stone-900">{item.name}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>{status}</span></div>
        <p className="mt-1 text-sm text-stone-600">{item.garment_type_name || item.garment_type_id} · {item.era || "Chưa rõ thời kỳ"} · {item.color_name || "Chưa rõ màu"}{item.hex_color ? ` (${item.hex_color})` : ""} · {item.material || "Chưa rõ chất liệu"}</p>
        {item.description && <p className="mt-2 text-sm leading-relaxed text-stone-700">{item.description}</p>}
        {item.review_note && <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">Góp ý của admin: {item.review_note}</p>}
        {item.status === "rejected" && <p className="mt-2 text-xs text-stone-500">Xóa mẫu này rồi gửi lại sau khi điều chỉnh nội dung hoặc ảnh.</p>}
      </div>
      {item.status !== "approved" && <button type="button" className={`${button} !text-red-700`} disabled={busy} onClick={onDelete}><Trash2 size={16} />Xóa mẫu</button>}
    </div>
  </article>;
}
