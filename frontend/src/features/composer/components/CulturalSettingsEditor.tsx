"use client";

import { useEffect, useState } from "react";
import { v3Api } from "@/lib/api/v3Client";
import type { OutfitSnapshot } from "@/lib/types/api";
import type { ContextQualifier, Entity } from "@/lib/types/v3";

export type CulturalSettings = NonNullable<OutfitSnapshot["culturalSettings"]>;
export const emptyContext = (): ContextQualifier => ({ period_ids: [], region_ids: [], place_ids: [], community_ids: [], occasion_ids: [], social_context_ids: [] });
const fields: Array<[keyof ContextQualifier, string, string]> = [
  ["period_ids", "period", "Thời kỳ"], ["region_ids", "region", "Vùng"], ["place_ids", "place", "Địa điểm"],
  ["community_ids", "community", "Cộng đồng"], ["occasion_ids", "occasion", "Dịp"], ["social_context_ids", "social_context", "Bối cảnh xã hội"],
];

export function CulturalSettingsEditor({ settings, onChange }: { settings: CulturalSettings; onChange: (value: CulturalSettings) => void }) {
  const [datasets, setDatasets] = useState<Array<{ dataset_version: string; ruleset_version: string; label: string }>>([]);
  const [listFailed, setListFailed] = useState(false);
  const [options, setOptions] = useState<{ version: string; values?: Partial<Record<keyof ContextQualifier, Entity[]>>; failed?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    v3Api.listDatasets().then(data => { if (active) { setDatasets(data); setListFailed(false); } }).catch(() => { if (active) setListFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    const version = settings.dataset_version;
    Promise.all(fields.map(async ([key, entity_type]) => {
      const values: Entity[] = [];
      for (let offset = 0; ; offset += 200) {
        if (!active) return [key, values] as const;
        const page = await v3Api.listEntities({ entity_type, dataset_version: version, limit: 200, offset });
        values.push(...page);
        if (page.length < 200) break;
      }
      return [key, values] as const;
    })).then(entries => { if (active) setOptions({ version, values: Object.fromEntries(entries) }); })
      .catch(() => { if (active) setOptions({ version, failed: true }); });
    return () => { active = false; };
  }, [settings.dataset_version, attempt]);
  const current = options?.version === settings.dataset_version ? options : undefined;
  return <fieldset className="space-y-3 text-sm">
    <legend className="font-semibold">Bối cảnh tra cứu</legend>
    <p>Thiết lập riêng này thay thế dịp của bộ phối khi tra cứu và kiểm tra văn hóa.</p>
    <label className="block">Bộ dữ liệu
      <select aria-label="Bộ dữ liệu" className="w-full border rounded p-2" value={settings.dataset_version} onChange={event => onChange({ ...settings, dataset_version: event.target.value, ruleset_version: datasets.find(d => d.dataset_version === event.target.value)?.ruleset_version || null })}>
        <option value="dev">Dữ liệu hiện hành (có thể thay đổi)</option>
        {settings.dataset_version !== "dev" && !datasets.some(d => d.dataset_version === settings.dataset_version) && <option value={settings.dataset_version}>{settings.dataset_version} — bản đã lưu</option>}
        {datasets.map(d => <option key={d.dataset_version} value={d.dataset_version}>{d.label}</option>)}
      </select>
    </label>
    {listFailed && <p>Chưa tải được danh sách bộ dữ liệu.</p>}
    {!current ? <p role="status">Đang tải bối cảnh…</p> : current.failed ? <p role="status">Không đọc được bối cảnh của bộ dữ liệu đã chọn. Thiết lập đã lưu vẫn được giữ.</p> : <>
      <p>Không chọn bối cảnh: chỉ áp dụng tri thức không giới hạn bối cảnh. Có thể chọn nhiều mục, tối đa 32 mục mỗi nhóm.</p>
      {fields.map(([key, , label]) => <label className="block" key={key}>{label}
        <select aria-label={label} multiple className="w-full border rounded p-2" value={settings.context[key]} onChange={event => {
          const ids = Array.from(event.target.selectedOptions, option => option.value);
          if (ids.length <= 32) onChange({ ...settings, context: { ...settings.context, [key]: ids } });
        }}>
          {settings.context[key].filter(id => !current.values?.[key]?.some(entity => entity.id === id)).map(id => <option key={id} value={id}>{id} — không có trong bộ dữ liệu</option>)}
          {current.values?.[key]?.map(entity => <option key={entity.id} value={entity.id}>{entity.identity.name_vi}</option>)}
        </select>
      </label>)}
    </>}
    {(listFailed || current?.failed) && <button type="button" onClick={() => setAttempt(value => value + 1)}>Tải lại bối cảnh</button>}
  </fieldset>;
}
