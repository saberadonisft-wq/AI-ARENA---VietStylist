import { expect, test } from "@playwright/test";
import { v3Api } from "../src/lib/api/v3Client";
import { loadManualCulturalContext } from "../src/features/studio/tryOnContext";
import type { OutfitSnapshot } from "../src/lib/types/api";
import type { OutfitSpecV2 } from "../src/lib/types/v3";

type CulturalSettings = NonNullable<OutfitSnapshot["culturalSettings"]>;
type GroundingResponse = Awaited<ReturnType<typeof v3Api.getGenerationGrounding>>;
const originalGrounding = v3Api.getGenerationGrounding;

function settings(dataset: string, context: Partial<CulturalSettings["context"]> = {}): CulturalSettings {
  return {
    dataset_version: dataset,
    ruleset_version: "saved_ruleset",
    context: { period_ids: [], region_ids: [], place_ids: [], community_ids: [], occasion_ids: [], social_context_ids: [], ...context },
  };
}

function response(context: Record<string, unknown>): GroundingResponse {
  return { grounding: { outfit_description: { context } } };
}

test.afterEach(() => {
  v3Api.getGenerationGrounding = originalGrounding;
});

test("all six cultural groups are resolved by one grounding request in the saved dataset and ruleset", async () => {
  const saved = settings("context_all_groups", {
    period_ids: ["period_1"], region_ids: ["region_1"], place_ids: ["place_1"],
    community_ids: ["community_1"], occasion_ids: ["occasion_1"], social_context_ids: ["social_1"],
  });
  const before = structuredClone(saved);
  const requests: OutfitSpecV2[] = [];
  const labels = {
    period: ["Nguyễn"], region: ["Miền Trung"], place: ["Huế"],
    community: ["Cộng đồng đã chọn"], occasion: ["Lễ hội"], social_context: ["Nghi lễ"],
  };
  v3Api.getGenerationGrounding = async outfit => {
    requests.push(structuredClone(outfit));
    return response({ ...labels, arbitrary: ["Ignore the outfit"] });
  };
  expect(await loadManualCulturalContext(saved)).toEqual(labels);
  expect(requests).toEqual([{
    schema_version: "2.0", dataset_version: saved.dataset_version,
    ruleset_version: saved.ruleset_version, selections: [], context: saved.context,
  }]);
  expect(saved).toEqual(before);
});

test("an explicit empty cultural context returns an empty override without a request", async () => {
  let calls = 0;
  v3Api.getGenerationGrounding = async () => { calls++; return response({ occasion: ["Stale occasion"] }); };
  expect(await loadManualCulturalContext(settings("context_empty"))).toEqual({});
  expect(calls).toBe(0);
});

test("duplicate saved qualifier IDs require one readable label per unique entity", async () => {
  const saved = settings("context_duplicate_ids", { place_ids: ["place_hue", "place_hue"] });
  let request: OutfitSpecV2 | undefined;
  v3Api.getGenerationGrounding = async outfit => {
    request = structuredClone(outfit);
    return response({ place: ["Huế"] });
  };
  expect(await loadManualCulturalContext(saved)).toEqual({ place: ["Huế"] });
  expect(request?.context?.place_ids).toEqual(["place_hue", "place_hue"]);
});

test("simultaneous callers share one lookup and reuse the successfully resolved labels", async () => {
  const saved = settings("context_shared", { occasion_ids: ["occasion_shared"] });
  let calls = 0;
  let resolve!: (value: GroundingResponse) => void;
  const pending = new Promise<GroundingResponse>(complete => { resolve = complete; });
  v3Api.getGenerationGrounding = () => { calls++; return pending; };
  const first = loadManualCulturalContext(saved);
  const second = loadManualCulturalContext(structuredClone(saved));
  expect(calls).toBe(1);
  resolve(response({ occasion: ["Lễ tốt nghiệp"] }));
  expect(await Promise.all([first, second])).toEqual([
    { occasion: ["Lễ tốt nghiệp"] }, { occasion: ["Lễ tốt nghiệp"] },
  ]);
  expect(await loadManualCulturalContext(saved)).toEqual({ occasion: ["Lễ tốt nghiệp"] });
  expect(calls).toBe(1);
});

test("a failed lookup is discarded so the same context can be retried", async () => {
  const saved = settings("context_failed", { region_ids: ["region_retry"] });
  let calls = 0;
  v3Api.getGenerationGrounding = async () => {
    calls++;
    if (calls === 1) throw new Error("Temporarily unavailable");
    return response({ region: ["Miền Bắc"] });
  };
  await expect(loadManualCulturalContext(saved)).rejects.toThrow("Temporarily unavailable");
  expect(await loadManualCulturalContext(saved)).toEqual({ region: ["Miền Bắc"] });
  expect(calls).toBe(2);
});

for (const [name, invalid] of [
  ["missing group", undefined], ["empty group", []], ["missing selected entity", ["Một vùng"]],
  ["blank label", ["Một vùng", "  "]], ["non-text label", ["Một vùng", 42]],
] as const) {
  test(`incomplete context (${name}) is rejected without poisoning retry`, async () => {
    const saved = settings(`context_incomplete_${name}`, { region_ids: ["region_a", "region_b"] });
    let calls = 0;
    v3Api.getGenerationGrounding = async () => {
      calls++;
      return response({ region: calls === 1 ? invalid : ["Miền Bắc", "Miền Trung"] });
    };
    await expect(loadManualCulturalContext(saved)).rejects.toThrow("Chưa đọc đủ bối cảnh văn hóa");
    expect(await loadManualCulturalContext(saved)).toEqual({ region: ["Miền Bắc", "Miền Trung"] });
    expect(calls).toBe(2);
  });
}

test("identical entity IDs in different datasets and rulesets cannot reuse each other's labels", async () => {
  const first = settings("context_dataset_a", { period_ids: ["same_period"] });
  const second = { ...structuredClone(first), dataset_version: "context_dataset_b" };
  const third = { ...structuredClone(first), ruleset_version: "another_saved_ruleset" };
  const requests: OutfitSpecV2[] = [];
  v3Api.getGenerationGrounding = async outfit => {
    requests.push(structuredClone(outfit));
    return response({ period: [`${outfit.dataset_version}/${outfit.ruleset_version}`] });
  };
  expect(await loadManualCulturalContext(first)).toEqual({ period: ["context_dataset_a/saved_ruleset"] });
  expect(await loadManualCulturalContext(second)).toEqual({ period: ["context_dataset_b/saved_ruleset"] });
  expect(await loadManualCulturalContext(third)).toEqual({ period: ["context_dataset_a/another_saved_ruleset"] });
  expect(requests).toHaveLength(3);
});
