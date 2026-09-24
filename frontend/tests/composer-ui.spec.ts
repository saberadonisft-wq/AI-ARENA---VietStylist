import { test, expect } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";

const COMPOSER_DOCUMENT = {
  ...structuredClone(INITIAL_DOCUMENT),
  snapshot: {
    ...structuredClone(INITIAL_DOCUMENT.snapshot),
    occasionId: "ky_yeu",
    items: [
      { slot: "outerwear", itemId: "item-test-outerwear", variantId: "variant-test-outerwear", assetVersion: 1 },
      { slot: "bottom", itemId: "item-test-bottom", variantId: "variant-test-bottom", assetVersion: 1 },
    ],
  },
};

test("V3 flag off keeps the legacy Studio and sends no V3 requests", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_STUDIO_V3 === "true");
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/v3/")) requests.push(request.url()); });
  await page.route("http://127.0.0.1:4100/**", route => route.fulfill(new URL(route.request().url()).pathname.startsWith("/api/catalog/") ? { json: [] } : { status: 503, json: { error: { code: "UNAVAILABLE", message: "unavailable" } } }));
  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeVisible();
  await expect(page.getByTestId("studio-composer")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("V3 shows API validation and per-entity sources, clears stale results and reports failures", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_STUDIO_V3 !== "true");
  let failed = false;
  let slow = false;
  let validations = 0;
  let lastSpec: any;
  let validationStatus: "clear" | "warning" | "error" | "not_evaluated" = "not_evaluated";
  await page.route("http://127.0.0.1:4100/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const send = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (path === "/api/v3/datasets") return send([{ dataset_version: "ds_fixture", ruleset_version: "rules_fixture", label: "Bộ kiểm thử" }]);
    if (path === "/api/v3/entities") return send(url.searchParams.get("entity_type") === "period" ? [{ id: "period_fixture", entity_type: "period", identity: { name_vi: "Thời kỳ kiểm thử" }, status: "published", version: 1, schema_version: "1.0" }] : []);
    if (path === "/api/v3/legacy-mappings") return send({ dataset_version: url.searchParams.get("dataset_version") || "dev", ruleset_version: url.searchParams.get("dataset_version") === "ds_fixture" ? "rules_fixture" : "dev", reproducible: false,
      mappings: [...COMPOSER_DOCUMENT.snapshot.items.map((item, i) => ({ legacy_table: "items", legacy_id: item.itemId, canonical_entity_id: `entity_${i}`, canonical_entity_type: "garment", renderable_item_id: `render_${i}`, render_variants: item.variantId ? { [item.variantId]: `variant_${i}` } : {} })), { legacy_table: "occasions", legacy_id: "ky_yeu", canonical_entity_id: "occasion_school", canonical_entity_type: "occasion", renderable_item_id: null, render_variants: {} }] });
    if (path === "/api/v3/outfits/validate") {
      validations++;
      const outfit = route.request().postDataJSON();
      lastSpec = outfit;
      if (failed) return send({ error: { code: "UNAVAILABLE", message: "unavailable" } }, 503);
      if (slow) await new Promise(resolve => setTimeout(resolve, 800));
      const strictViolation = validationStatus === "error" ? [{ rule_id: "strict_fixture", severity: "strict", explanation: "Quy tắc nghiêm trọng cần được xem xét.", suggested_fix: "Sửa bộ phối." }] : [];
      const warningViolation = validationStatus === "warning" ? [{ rule_id: "warning_fixture", severity: "warning", explanation: "Có điểm cần xem xét." }] : [];
      return send({ status: validationStatus, missing_entities: validationStatus === "warning" ? ["entity_missing"] : [], unchecked_entities: validationStatus === "not_evaluated" ? ["entity_0"] : [], unevaluated_rule_ids: [], evaluated_rule_count: validationStatus === "not_evaluated" ? 0 : 1, violations: [...strictViolation, ...warningViolation], outfit });
    }
    if (path.startsWith("/api/v3/")) {
      const entity = path.match(/entity_\d+/)?.[0] || "entity_0";
      const base = { projection_version: "test", attributes: [], relations: [], evidence: [{ assertion_id: `assert_${entity}`, subject_id: entity, predicate: "test", qualifiers: {}, confidence: 1, consensus: "accepted", sources: [{ source_id: "source", title: `Nguồn ${entity}`, locator: "trang 5", trust_tier: "A", version: 1, rights: {} }] }] };
      if (path.endsWith("/education")) return send({ ...base, entity_id: entity, title: `Áo ${entity}`, aliases: [] });
      return send({ ...base, dataset_version: "dev", entity: { id: entity, identity: { name_vi: `Áo ${entity}` } }, renderables: [], style_options: [], rules: [] });
    }
    if (path === "/api/catalog/items") return send([]);
    if (path === "/api/color-analysis") return send({ accent_colors: [], suggested_variants: [] });
    if (path === "/api/weather") return send({ location: { name: "Hà Nội" }, weather: {}, recommendation: { suggested_accessories: [] } });
    return send([]);
  });
  await page.addInitScript(({ key, document }) => {
    if (!sessionStorage.getItem("composer-seeded")) {
      localStorage.setItem(key, JSON.stringify(document));
      sessionStorage.setItem("composer-seeded", "yes");
    }
  }, { key: DRAFT_KEY, document: COMPOSER_DOCUMENT });
  await page.goto("/studio");
  const panel = page.getByTestId("studio-composer");
  await expect(panel.getByText("Chưa thể kết luận với dữ liệu hiện có")).toBeVisible();
  await expect(panel.getByText("Nguồn entity_0; trang 5")).toBeVisible();
  await expect(panel.getByText("Chuẩn mực văn hóa")).toHaveCount(0);
  const previous = validations;
  slow = true;
  await panel.getByRole("combobox").selectOption("entity_1");
  await expect(panel.getByText("Đang kiểm tra…")).toBeVisible();
  await expect(panel.getByText("Nguồn entity_0; trang 5")).toHaveCount(0);
  await expect.poll(() => validations).toBeGreaterThan(previous);
  failed = true;
  await panel.getByRole("combobox").selectOption("entity_0");
  await expect(panel.getByText(/Chưa kiểm tra. Không thể kiểm tra/)).toBeVisible();
  // The earlier successful response must not overwrite the current failure.
  await page.waitForTimeout(900);
  await expect(panel.getByText(/Chưa kiểm tra. Không thể kiểm tra/)).toBeVisible();
  await expect(panel.getByText("Nguồn entity_1; trang 5")).toHaveCount(0);
  failed = false;
  slow = false;
  await panel.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(panel.getByText("Chưa thể kết luận với dữ liệu hiện có")).toBeVisible();
  let statusEntity = "entity_0";
  for (const [status, label] of [
    ["error", "Có vi phạm nghiêm trọng theo quy tắc đã kiểm tra"],
    ["warning", "Có cảnh báo hoặc dữ liệu chưa đủ"],
    ["clear", "Không phát hiện vi phạm trong các quy tắc đã kiểm tra"],
  ] as const) {
    validationStatus = status;
    statusEntity = statusEntity === "entity_0" ? "entity_1" : "entity_0";
    await panel.getByRole("combobox").selectOption(statusEntity);
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
  await panel.getByRole("button", { name: "Chọn bối cảnh và bộ dữ liệu riêng" }).click();
  await panel.getByLabel("Thời kỳ", { exact: true }).selectOption("period_fixture");
  await expect.poll(() => lastSpec?.context?.period_ids).toEqual(["period_fixture"]);
  await panel.getByLabel("Bộ dữ liệu", { exact: true }).selectOption("ds_fixture");
  await expect.poll(() => lastSpec?.dataset_version).toBe("ds_fixture");
  expect(lastSpec.ruleset_version).toBe("rules_fixture");
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(panel.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("dev");
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect(panel.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("ds_fixture");
  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục bản nháp", exact: true }).click();
  await expect(panel.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("ds_fixture");
  await expect(panel.getByLabel("Thời kỳ", { exact: true })).toHaveValues(["period_fixture"]);
});

test("incomplete mappings keep the V1 editor usable without validating a partial outfit", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_STUDIO_V3 !== "true");
  let validations = 0;
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v3/outfits/validate") validations++;
    if (path === "/api/v3/legacy-mappings") return route.fulfill({ json: { dataset_version: "dev", ruleset_version: "dev", reproducible: false, mappings: [] } });
    return route.fulfill(path.startsWith("/api/catalog/") ? { json: [] } : { status: 503, json: { error: { code: "UNAVAILABLE", message: "unavailable" } } });
  });
  await page.addInitScript(({ key, document }) => localStorage.setItem(key, JSON.stringify(document)), { key: DRAFT_KEY, document: COMPOSER_DOCUMENT });
  await page.goto("/studio");
  await expect(page.getByTestId("studio-composer").getByText(/chưa có ánh xạ đầy đủ/)).toBeVisible();
  await page.locator("input").first().fill("Bộ phối vẫn sửa được");
  await expect(page.locator("input").first()).toHaveValue("Bộ phối vẫn sửa được");
  expect(validations).toBe(0);
});
