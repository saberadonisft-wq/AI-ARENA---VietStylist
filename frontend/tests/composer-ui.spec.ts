import { test, expect } from "@playwright/test";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";

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
  await page.route("http://127.0.0.1:4100/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const send = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (path === "/api/v3/datasets") return send([{ dataset_version: "ds_fixture", ruleset_version: "rules_fixture", label: "Bộ kiểm thử" }]);
    if (path === "/api/v3/entities") return send(url.searchParams.get("entity_type") === "period" ? [{ id: "period_fixture", entity_type: "period", identity: { name_vi: "Thời kỳ kiểm thử" }, status: "published", version: 1, schema_version: "1.0" }] : []);
    if (path === "/api/v3/legacy-mappings") return send({ dataset_version: url.searchParams.get("dataset_version") || "dev", ruleset_version: url.searchParams.get("dataset_version") === "ds_fixture" ? "rules_fixture" : "dev", reproducible: false,
      mappings: [...INITIAL_DOCUMENT.snapshot.items.map((item, i) => ({ legacy_table: "items", legacy_id: item.itemId, canonical_entity_id: `entity_${i}`, canonical_entity_type: "garment", renderable_item_id: `render_${i}`, render_variants: item.variantId ? { [item.variantId]: `variant_${i}` } : {} })), { legacy_table: "occasions", legacy_id: "ky_yeu", canonical_entity_id: "occasion_school", canonical_entity_type: "occasion", renderable_item_id: null, render_variants: {} }] });
    if (path === "/api/v3/outfits/validate") {
      validations++;
      const outfit = route.request().postDataJSON();
      lastSpec = outfit;
      if (failed) return send({ error: { code: "UNAVAILABLE", message: "unavailable" } }, 503);
      if (slow) await new Promise(resolve => setTimeout(resolve, 800));
      return send({ status: "not_evaluated", missing_entities: [], unchecked_entities: ["entity_0"], unevaluated_rule_ids: [], evaluated_rule_count: 0, violations: [], outfit });
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
  await page.goto("/studio");
  const panel = page.getByTestId("studio-composer");
  await expect(panel.getByText("Chưa đủ dữ liệu kiểm tra")).toBeVisible();
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
  await expect(panel.getByText("Chưa đủ dữ liệu kiểm tra")).toBeVisible();
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
  await page.getByRole("button", { name: /Khôi phục/ }).click();
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
  await page.goto("/studio");
  await expect(page.getByTestId("studio-composer").getByText(/chưa có ánh xạ đầy đủ/)).toBeVisible();
  await page.locator("input").first().fill("Bộ phối vẫn sửa được");
  await expect(page.locator("input").first()).toHaveValue("Bộ phối vẫn sửa được");
  expect(validations).toBe(0);
});
