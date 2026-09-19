import type { OutfitSnapshot, SnapshotItem } from "@/lib/types/api";
import type { OutfitSpecV2, OutfitSelection, LegacyMappingBundle, ContextQualifier } from "@/lib/types/v3";

const contextKeys: Array<keyof ContextQualifier> = ["period_ids", "region_ids", "place_ids", "community_ids", "occasion_ids", "social_context_ids"];

export interface MappingIssue { slot: string; itemId: string; reason: "missing_item_mapping" | "missing_renderable" | "missing_variant_mapping" | "missing_occasion_mapping"; }
interface Bridge {
  version: 1;
  source: OutfitSnapshot;
  linked: Array<{ index: number; selectionId: string }>;
  issues: MappingIssue[];
}

/** Preserve unsupported items in bridge metadata; never invent canonical IDs. */
export function snapshotV1ToSpecV2(snapshot: OutfitSnapshot, mappings: LegacyMappingBundle): OutfitSpecV2 {
  const source = structuredClone(snapshot);
  if (source.culturalSettings && source.culturalSettings.dataset_version !== mappings.dataset_version) throw new Error("Mapping không cùng phiên bản dataset đã lưu.");
  const linked: Bridge["linked"] = [];
  const issues: MappingIssue[] = [];
  const selections: OutfitSelection[] = [];
  source.items.forEach((item, index) => {
    const mapping = mappings.mappings.find(m => m.legacy_table === "items" && m.legacy_id === item.itemId);
    const reason = !mapping ? "missing_item_mapping" : !mapping.renderable_item_id ? "missing_renderable" : item.variantId && !mapping.render_variants[item.variantId] ? "missing_variant_mapping" : null;
    if (reason || !mapping) { issues.push({ slot: item.slot, itemId: item.itemId, reason: reason || "missing_item_mapping" }); return; }
    const selectionId = `selection_${index}`;
    linked.push({ index, selectionId });
    selections.push({
      selection_id: selectionId, slot: item.slot, canonical_entity_id: mapping.canonical_entity_id,
      renderable_item_id: mapping.renderable_item_id,
      render_variant_id: item.variantId ? mapping.render_variants[item.variantId] : null,
      style: { colorHex: item.colorHex, colorOptionId: item.colorOptionId, assetVersion: item.assetVersion },
      transform: item.transform ? structuredClone(item.transform) : null,
    });
  });
  const { items, culturalSettings, ...presentation } = source;
  const occasion = mappings.mappings.find(m => m.legacy_table === "occasions" && m.legacy_id === source.occasionId);
  if (!culturalSettings && source.occasionId && !occasion) issues.push({ slot: "context", itemId: source.occasionId, reason: "missing_occasion_mapping" });
  return {
    schema_version: "2.0", dataset_version: mappings.dataset_version, ruleset_version: culturalSettings?.ruleset_version ?? mappings.ruleset_version,
    selections, context: { ...presentation, ...(culturalSettings ? culturalSettings.context : occasion ? { occasion_ids: [occasion.canonical_entity_id] } : {}) },
    metadata: { legacy_bridge: { version: 1, source, linked, issues } satisfies Bridge },
  };
}

export function mappingIssues(spec: OutfitSpecV2): MappingIssue[] {
  return spec.metadata?.legacy_bridge?.issues || [];
}

/** Restore preserved V1 fields while applying supported V2 edits. */
export function specV2ToSnapshotV1(spec: OutfitSpecV2, mappings: LegacyMappingBundle): OutfitSnapshot {
  const bridge = spec.metadata?.legacy_bridge as Bridge | undefined;
  if (!bridge || bridge.version !== 1 || !Array.isArray(bridge.source?.items) || !Array.isArray(bridge.linked)) {
    throw new Error("Bộ phối V2 không có dữ liệu chuyển đổi V1; cần chọn cách nhập rõ ràng.");
  }
  if (spec.dataset_version !== mappings.dataset_version) throw new Error("Mapping không cùng phiên bản dataset.");
  if (spec.ruleset_version !== mappings.ruleset_version) throw new Error("Mapping không cùng phiên bản ruleset.");
  if (new Set(spec.selections.map(s => s.selection_id)).size !== spec.selections.length) throw new Error("ID lựa chọn V2 bị trùng.");
  const result = structuredClone(bridge.source);
  const remaining = new Map(spec.selections.map(selection => [selection.selection_id, selection]));
  const toItem = (selection: OutfitSelection, original?: SnapshotItem): SnapshotItem => {
    const candidates = mappings.mappings.filter(m => m.legacy_table === "items" && m.canonical_entity_id === (selection.canonical_variant_id || selection.canonical_entity_id) && m.renderable_item_id === selection.renderable_item_id);
    const mapping = candidates.find(m => m.legacy_id === original?.itemId) || (candidates.length === 1 ? candidates[0] : undefined);
    if (!mapping) throw new Error("Không tìm thấy mapping V1 duy nhất cho lựa chọn.");
    const variants = Object.entries(mapping.render_variants).filter(([, id]) => id === selection.render_variant_id);
    if (selection.render_variant_id && variants.length !== 1) throw new Error("Không tìm thấy mapping màu V1 duy nhất.");
    const item: SnapshotItem = original && original.itemId === mapping.legacy_id ? structuredClone(original) : { itemId: mapping.legacy_id, slot: selection.slot, assetVersion: 1 };
    item.slot = selection.slot;
    if (selection.render_variant_id) item.variantId = variants[0][0]; else if (item.variantId !== null) delete item.variantId;
    for (const key of ["colorHex", "colorOptionId", "assetVersion"] as const) {
      if (selection.style && Object.prototype.hasOwnProperty.call(selection.style, key)) {
        if (key === "assetVersion" && (!Number.isInteger(selection.style[key]) || selection.style[key] < 1)) throw new Error("Phiên bản tài nguyên không hợp lệ.");
        if (selection.style[key] === undefined) delete (item as any)[key];
        else (item as any)[key] = selection.style[key];
      }
    }
    if (selection.transform) item.transform = structuredClone(selection.transform) as SnapshotItem["transform"];
    else if (item.transform !== null) delete item.transform;
    return item;
  };
  result.items = result.items.flatMap((item, index) => {
    const link = bridge.linked.find(entry => entry.index === index);
    if (!link) return [item];
    const selected = remaining.get(link.selectionId);
    remaining.delete(link.selectionId);
    return selected ? [toItem(selected, item)] : [];
  });
  for (const selection of remaining.values()) result.items.push(toItem(selection));
  if (new Set(result.items.map(item => item.slot)).size !== result.items.length) throw new Error("Lựa chọn V2 xung đột với món V1 chưa được ánh xạ.");
  for (const key of ["avatarId", "poseId", "occasionId", "styleMode", "overlapDirection", "lockedSlots", "backgroundTheme", "aspectRatio"] as const) {
    if (spec.context && Object.prototype.hasOwnProperty.call(spec.context, key)) (result as any)[key] = structuredClone(spec.context[key]);
  }
  const hasExtendedContext = !!bridge.source.culturalSettings || contextKeys.some(key => key !== "occasion_ids" && spec.context?.[key]?.length);
  if (hasExtendedContext) {
    result.culturalSettings = { dataset_version: spec.dataset_version, ruleset_version: bridge.source.culturalSettings?.ruleset_version === null && spec.ruleset_version === mappings.ruleset_version ? null : spec.ruleset_version ?? null,
      context: Object.fromEntries(contextKeys.map(key => [key, structuredClone(spec.context?.[key] || [])])) as unknown as ContextQualifier };
  }
  if (!hasExtendedContext && spec.context && Object.prototype.hasOwnProperty.call(spec.context, "occasion_ids")) {
    const ids = spec.context.occasion_ids;
    if (!Array.isArray(ids) || ids.length > 1) throw new Error("V1 chỉ hỗ trợ một dịp; không thể nhập bối cảnh này mà không mất dữ liệu.");
    if (!ids.length) delete result.occasionId;
    else {
      const candidates = mappings.mappings.filter(m => m.legacy_table === "occasions" && m.canonical_entity_id === ids[0]);
      const occasion = candidates.find(m => m.legacy_id === result.occasionId) || (candidates.length === 1 ? candidates[0] : undefined);
      if (!occasion) throw new Error("Không tìm thấy mapping dịp V1 duy nhất.");
      result.occasionId = occasion.legacy_id;
    }
  }
  return result;
}
