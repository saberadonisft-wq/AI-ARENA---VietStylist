import { v3Api } from "@/lib/api/v3Client";
import type { OutfitSnapshot } from "@/lib/types/api";
import type { ManualCulturalContextLabels } from "./tryOnPrompt";

type CulturalSettings = NonNullable<OutfitSnapshot["culturalSettings"]>;
const groups = ["period", "region", "place", "community", "occasion", "social_context"] as const;
const cache = new Map<string, { expires: number; result: Promise<ManualCulturalContextLabels> }>();

/** One public grounding lookup resolves all selected labels in their saved dataset. */
export function loadManualCulturalContext(settings: CulturalSettings): Promise<ManualCulturalContextLabels> {
  const key = JSON.stringify(settings);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  const selected = groups.filter(group => settings.context[`${group}_ids`].length > 0);
  if (!selected.length) return Promise.resolve({});
  const result = v3Api.getGenerationGrounding({
    schema_version: "2.0", dataset_version: settings.dataset_version, ruleset_version: settings.ruleset_version,
    selections: [], context: settings.context,
  }).then(response => {
    const data = response.grounding?.outfit_description?.context;
    const labels: ManualCulturalContextLabels = {};
    for (const group of selected) {
      const values = data?.[group];
      if (!Array.isArray(values) || values.some(value => typeof value !== "string" || !value.trim()) ||
          values.length !== new Set(settings.context[`${group}_ids`]).size) {
        throw new Error("Chưa đọc đủ bối cảnh văn hóa của bộ dữ liệu đã chọn. Vui lòng tải lại trước khi sao chép prompt.");
      }
      labels[group] = values;
    }
    return labels;
  });
  cache.set(key, { expires: Date.now() + 60_000, result });
  while (cache.size > 20) cache.delete(cache.keys().next().value!);
  void result.catch(() => { if (cache.get(key)?.result === result) cache.delete(key); });
  return result;
}
