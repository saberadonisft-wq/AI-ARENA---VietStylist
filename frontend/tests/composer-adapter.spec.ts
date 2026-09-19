import { test, expect } from "@playwright/test";
import { snapshotV1ToSpecV2, specV2ToSnapshotV1, mappingIssues } from "../src/features/composer/adapters/snapshotAdapter";
import type { OutfitSnapshot } from "../src/lib/types/api";
import type { LegacyMappingBundle } from "../src/lib/types/v3";

const mappings: LegacyMappingBundle = { dataset_version: "ds_test", ruleset_version: "rules_test", reproducible: true, mappings: [
  { legacy_table: "items", legacy_id: "shirt", canonical_entity_id: "garment_shirt", canonical_entity_type: "garment", renderable_item_id: "render_shirt", render_variants: { blue: "render_blue" } },
  { legacy_table: "occasions", legacy_id: "festival", canonical_entity_id: "occasion_festival", canonical_entity_type: "occasion", renderable_item_id: null, render_variants: {} },
] };
const snapshot: OutfitSnapshot = {
  schemaVersion: 1, avatarId: "avatar", poseId: "front", occasionId: "festival", styleMode: "remix", overlapDirection: "left_over_right",
  lockedSlots: ["upper_body"], backgroundTheme: "dopaper", aspectRatio: "1:1",
  items: [{ slot: "upper_body", itemId: "shirt", variantId: "blue", assetVersion: 7, colorHex: "#001122", colorOptionId: "custom", transform: { dx: 11, dy: -3, scale: 1.2, rotation: 17 } },
    { slot: "head", itemId: "unmapped", assetVersion: 4, transform: { dx: 0, dy: 0, scale: 1, rotation: 0 } }],
};

test("JSON round-trip preserves all V1 fields, unmapped items and presentation context", () => {
  const before = structuredClone(snapshot);
  const spec = snapshotV1ToSpecV2(snapshot, mappings);
  expect(spec.context?.occasion_ids).toEqual(["occasion_festival"]);
  expect(spec.selections.map(s => s.canonical_entity_id)).toEqual(["garment_shirt"]);
  expect(mappingIssues(spec)).toEqual([{ slot: "head", itemId: "unmapped", reason: "missing_item_mapping" }]);
  expect(specV2ToSnapshotV1(JSON.parse(JSON.stringify(spec)), mappings)).toEqual(snapshot);
  expect(snapshot).toEqual(before);
});

test("V2 edits and deletions apply while unsupported V1 items survive", () => {
  const spec = snapshotV1ToSpecV2(snapshot, mappings);
  spec.selections[0].style!.colorHex = "#ffffff";
  spec.selections[0].transform = { dx: 33, dy: 2, scale: 0.7, rotation: 9 };
  const edited = specV2ToSnapshotV1(spec, mappings);
  expect(edited.items[0]).toMatchObject({ colorHex: "#ffffff", assetVersion: 7, transform: { dx: 33 } });
  expect(edited.items[1]).toEqual(snapshot.items[1]);
  spec.selections = [];
  expect(specV2ToSnapshotV1(spec, mappings).items).toEqual([snapshot.items[1]]);
});

test("missing variant and renderable mappings never invent IDs or erase the original", () => {
  for (const mapping of [{ ...mappings.mappings[0], render_variants: {} }, { ...mappings.mappings[0], renderable_item_id: null }]) {
    const bundle = { ...mappings, mappings: [mapping, mappings.mappings[1]] };
    const spec = snapshotV1ToSpecV2(snapshot, bundle);
    expect(spec.selections).toEqual([]);
    expect(mappingIssues(spec)).toHaveLength(2);
    expect(specV2ToSnapshotV1(spec, bundle)).toEqual(snapshot);
  }
});

test("rejects mismatched dataset, native V2 without a bridge and slot collisions", () => {
  const spec = snapshotV1ToSpecV2(snapshot, mappings);
  expect(() => specV2ToSnapshotV1(spec, { ...mappings, dataset_version: "other" })).toThrow(/dataset/);
  expect(() => specV2ToSnapshotV1({ ...spec, metadata: {} }, mappings)).toThrow(/V1/);
  spec.selections[0].slot = "head";
  expect(() => specV2ToSnapshotV1(spec, mappings)).toThrow(/xung đột/);
});

test("missing occasion mapping prevents unscoped validation and retains the original context", () => {
  const bundle = { ...mappings, mappings: [mappings.mappings[0]] };
  const spec = snapshotV1ToSpecV2(snapshot, bundle);
  expect(mappingIssues(spec)).toContainEqual({ slot: "context", itemId: "festival", reason: "missing_occasion_mapping" });
  expect(specV2ToSnapshotV1(spec, bundle)).toEqual(snapshot);
});

test("rejects duplicate selection IDs and invalid asset versions instead of silently losing an item", () => {
  const spec = snapshotV1ToSpecV2(snapshot, mappings);
  spec.selections.push({ ...spec.selections[0], slot: "bottom" });
  expect(() => specV2ToSnapshotV1(spec, mappings)).toThrow(/trùng/);
  spec.selections.pop();
  spec.selections[0].style!.assetVersion = undefined;
  expect(() => specV2ToSnapshotV1(spec, mappings)).toThrow(/Phiên bản/);
});

test("preserves explicit nulls returned by older servers", () => {
  const input = { ...snapshot, items: [{ ...snapshot.items[0], variantId: null, transform: null }] } as unknown as OutfitSnapshot;
  expect(specV2ToSnapshotV1(JSON.parse(JSON.stringify(snapshotV1ToSpecV2(input, mappings))), mappings)).toEqual(input);
});

test("V2 context edits are mapped back or explicitly rejected, never silently discarded", () => {
  const bundle = { ...mappings, mappings: [...mappings.mappings, { ...mappings.mappings[1], legacy_id: "school", canonical_entity_id: "occasion_school" }] };
  const spec = snapshotV1ToSpecV2(snapshot, bundle);
  spec.context!.occasion_ids = ["occasion_school"];
  expect(specV2ToSnapshotV1(spec, bundle).occasionId).toBe("school");
  spec.context!.occasion_ids = [];
  expect(specV2ToSnapshotV1(spec, bundle).occasionId).toBeUndefined();
  spec.context!.occasion_ids = ["occasion_school", "occasion_festival"];
  expect(() => specV2ToSnapshotV1(spec, bundle)).toThrow(/một dịp/);
  spec.context!.occasion_ids = ["unmapped"];
  expect(() => specV2ToSnapshotV1(spec, bundle)).toThrow(/mapping dịp/);
  spec.context!.occasion_ids = [];
  spec.selections[0].canonical_variant_id = "unmapped_variant";
  expect(() => specV2ToSnapshotV1(spec, bundle)).toThrow(/mapping V1/);
  delete spec.selections[0].canonical_variant_id;
  spec.context!.period_ids = ["period_nguyen"];
  expect(specV2ToSnapshotV1(spec, bundle).culturalSettings?.context.period_ids).toEqual(["period_nguyen"]);
});

test("extended snapshot context and dataset survive JSON bridge round-trip including an implicit ruleset", () => {
  for (const ruleset_version of ["rules_test", null]) {
    const input: OutfitSnapshot = { ...snapshot, culturalSettings: { dataset_version: mappings.dataset_version, ruleset_version, context: {
      period_ids: ["period_nguyen"], region_ids: ["region_hue"], place_ids: [], community_ids: [], occasion_ids: ["occasion_festival"], social_context_ids: [],
    } } };
    const spec = snapshotV1ToSpecV2(input, mappings);
    expect(spec.context?.period_ids).toEqual(["period_nguyen"]);
    expect(specV2ToSnapshotV1(JSON.parse(JSON.stringify(spec)), mappings)).toEqual(input);
    expect(() => snapshotV1ToSpecV2(input, { ...mappings, dataset_version: "wrong" })).toThrow(/dataset/);
  }
});
