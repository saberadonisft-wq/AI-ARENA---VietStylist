import type { GarmentType, Occasion, OutfitSnapshot } from "@/lib/types/api";

export type StylingPreferences = {
  occasionId?: string;
  styleMode?: OutfitSnapshot["styleMode"];
  gender: string;
  garmentTypeId: string;
  palette: string;
  priority: string;
};

export const INITIAL_STYLING_PREFERENCES: StylingPreferences = {
  gender: "", garmentTypeId: "", palette: "Tùy bộ phối", priority: "Hài hòa tổng thể",
};

export default function StylingQuestionnaire({ value, occasions, garmentTypes, disabled, loading, onChange, onSubmit }: {
  value: StylingPreferences;
  occasions: Occasion[];
  garmentTypes: GarmentType[];
  disabled: boolean;
  loading: boolean;
  onChange: (value: StylingPreferences) => void;
  onSubmit: () => void;
}) {
  const selectClass = "min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-red disabled:bg-stone-50";
  return (
    <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="space-y-3">
      <p className="text-sm leading-relaxed text-stone-600">Chọn nhu cầu phối đồ để Gemini tìm trang phục phù hợp trong danh mục. Bạn được xem trước khi áp dụng.</p>
      <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">Phiếu nhu cầu phối đồ</legend>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Bạn mặc vào dịp nào? <span className="font-normal">(bắt buộc)</span></span>
          <select aria-label="Dịp sử dụng" required value={value.occasionId || ""} onChange={event => onChange({ ...value, occasionId: event.target.value })} className={selectClass}>
            <option value="">Chọn dịp sử dụng</option>
            {occasions.map(occasion => <option key={occasion.id} value={occasion.id}>{occasion.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Bạn muốn phong cách nào?</span>
          <select aria-label="Phong cách phối đồ" value={value.styleMode || "traditional"} onChange={event => onChange({ ...value, styleMode: event.target.value as OutfitSnapshot["styleMode"] })} className={selectClass}>
            <option value="traditional">Truyền thống</option><option value="remix">Remix · kết hợp hiện đại</option><option value="modern_fusion">Cách tân hiện đại</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Bạn muốn phối trang phục cho ai?</span>
          <select aria-label="Đối tượng phối đồ" value={value.gender} onChange={event => onChange({ ...value, gender: event.target.value })} className={selectClass}>
            <option value="">Không giới hạn</option><option value="male">Nam</option><option value="female">Nữ</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Bạn thích loại trang phục nào?</span>
          <select aria-label="Loại trang phục ưu tiên" value={value.garmentTypeId} onChange={event => onChange({ ...value, garmentTypeId: event.target.value })} className={selectClass}>
            <option value="">Để Gemini đề xuất</option>
            {garmentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Bạn thích tông màu nào?</span>
          <select aria-label="Tông màu mong muốn" value={value.palette} onChange={event => onChange({ ...value, palette: event.target.value })} className={selectClass}>
            {["Tùy bộ phối", "Nhẹ nhàng · trắng ngà, pastel", "Trầm ấm · nâu, đỏ sẫm", "Tươi sáng · đỏ, vàng", "Thanh nhã · xanh lá, xanh lam"].map(label => <option key={label}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-stone-700">
          <span>Điều gì quan trọng nhất với bạn?</span>
          <select aria-label="Ưu tiên khi phối đồ" value={value.priority} onChange={event => onChange({ ...value, priority: event.target.value })} className={selectClass}>
            {["Hài hòa tổng thể", "Thanh lịch, tối giản", "Trang trọng, nổi bật", "Thoải mái, dễ vận động"].map(label => <option key={label}>{label}</option>)}
          </select>
        </label>
      </fieldset>
      <p className="text-xs leading-relaxed text-stone-500">Các món đã khóa sẽ được giữ nguyên. Gợi ý phụ thuộc vào trang phục và màu có trong danh mục.</p>
      <button type="submit" disabled={disabled || !value.occasionId} className="min-h-11 w-full rounded-lg bg-heritage-red px-4 py-2 text-sm font-semibold text-white hover:bg-heritage-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-red focus-visible:ring-offset-2 disabled:opacity-50 sm:w-auto">
        {loading ? "Đang tìm…" : "Gợi ý"}
      </button>
    </form>
  );
}
