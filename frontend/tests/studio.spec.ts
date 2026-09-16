import { test, expect, Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT, mergeUnlockedItems, parseDraft, sameDocument, studioReducer } from "../src/features/studio/state";

test("history restores the first edit and discards redo after a new edit", () => {
  const initial = { past: [], present: structuredClone(INITIAL_DOCUMENT), future: [] };
  const changed = studioReducer(initial, { type: "commit", update: document => ({ ...document, title: "Changed" }) });
  const undone = studioReducer(changed, { type: "undo" });
  expect(undone.present).toEqual(initial.present);
  expect(studioReducer(undone, { type: "redo" }).present.title).toBe("Changed");
  const branched = studioReducer(undone, { type: "commit", update: document => ({ ...document, title: "New branch" }) });
  expect(branched.future).toHaveLength(0);
});

test("draft validation accepts empty outfits and preserves locked placement", () => {
  const document = structuredClone(INITIAL_DOCUMENT);
  document.snapshot.items[0].transform = { dx: 30, dy: 10, scale: 1.2, rotation: 20 };
  expect(parseDraft(JSON.stringify(document))).toEqual(document);
  const serverDocument = structuredClone(document);
  serverDocument.snapshot.items[1].transform = null as any;
  expect(sameDocument(document, serverDocument)).toBe(true);
  expect(parseDraft(JSON.stringify({ ...document, snapshot: { ...document.snapshot, items: [] } }))?.snapshot.items).toEqual([]);
  expect(parseDraft('{"snapshot":{"items":[null]}}')).toBeNull();
  const result = mergeUnlockedItems(document.snapshot.items, [{ ...document.snapshot.items[0], colorHex: "#ffffff" }], ["outerwear"]);
  expect(result[0]).toEqual(document.snapshot.items[0]);
});

async function mockApi(page: Page) {
  const saves: Array<{ method: string; body: any }> = [];
  let saved: any;
  await page.route("**/fixture.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#b01020"/></svg>' }));
  await page.route("http://127.0.0.1:4100/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const send = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/catalog/garment-types") return send([{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]);
    if (path === "/api/catalog/occasions") return send([{ id: "ky_yeu", name: "Kỷ yếu" }, { id: "tet", name: "Tết" }]);
    if (path === "/api/catalog/avatars") return send([{ id: "avatar_nam_chuan", name: "Nam", dimensions: { width: 800, height: 1200 } }]);
    if (path === "/api/catalog/items") return send(INITIAL_DOCUMENT.snapshot.items.map((item, index) => ({
      id: item.itemId, slot: item.slot, name: `Trang phục ${index}`, gender: "unisex", garment_type_id: "ngu_than", is_published: true,
      metadata: index === 0 ? { real_image_url: "/fixture.svg" } : {},
      variants: [{ id: item.variantId, item_id: item.itemId, color_name: "Màu gốc", hex_color: item.colorHex, is_default: true }],
      default_layer: { id: `layer-${index}`, item_id: item.itemId, slot: item.slot, z_index: index, layer_type: "svg", svg_content: `<circle cx="50" cy="${50 + index * 30}" r="10" fill="${item.colorHex}"/>` },
    })));
    if (path === "/api/cultural-check") return send({ is_culturally_sound: true, strict_count: 0, warning_count: 0, info_count: 0, warnings: [] });
    if (path === "/api/color-analysis") return send({ dominant_color: "#1A365D", accent_colors: [], palette_type: "neutral_balance", contrast_rating: "good", contrast_ratio: 5, suggested_variants: [], aesthetic_comment: "" });
    if (path === "/api/weather") return send({ location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false });
    if (path.startsWith("/api/outfits") && request.method() !== "GET") {
      const body = request.postDataJSON();
      saves.push({ method: request.method(), body });
      saved = { id: "saved-1", title: body.title, occasion_id: body.occasion_id, style_mode: body.style_mode,
        revision: saves.length, current_version_id: `version-${saves.length}`, current_snapshot: body.snapshot };
      return send(saved);
    }
    if (path === "/api/outfits/saved-1" && saved) return send(saved);
    if (path === "/api/ai/try-on") return send({ error: { code: "TRY_ON_UNAVAILABLE", message: "Thử đồ AI chưa sẵn sàng." } }, 503);
    return send([]);
  });
  return saves;
}

async function readDraft(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), DRAFT_KEY);
}

test("refresh preserves draft, first change can undo, and saving updates one outfit", async ({ page }) => {
  const saves = await mockApi(page);
  await page.goto("/");
  const title = page.locator('input').first();
  await title.fill("Nháp cần giữ");
  await expect.poll(async () => (await readDraft(page))?.title).toBe("Nháp cần giữ");
  await page.reload();
  await expect.poll(async () => (await readDraft(page))?.title).toBe("Nháp cần giữ");
  await page.getByRole("button", { name: /Khôi phục/ }).click();
  await expect(title).toHaveValue("Nháp cần giữ");
  await page.getByRole("button", { name: "Remix Đương đại" }).click();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(async () => (await readDraft(page))?.snapshot.styleMode).toBe("traditional");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  await title.fill("Tên sau khi sửa");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves.map(save => save.method)).toEqual(["POST", "PUT"]);
  expect(saves[1].body.revision).toBe(1);
  await page.reload();
  await expect(title).toHaveValue("Tên sau khi sửa");
  await title.fill("Chưa lưu lên máy chủ");
  await expect.poll(async () => (await readDraft(page))?.title).toBe("Chưa lưu lên máy chủ");
  await page.reload();
  await page.getByRole("button", { name: /Khôi phục/ }).click();
  await expect(title).toHaveValue("Chưa lưu lên máy chủ");
});

test("canvas drag persists, undo restores it, and export includes garment image", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const image = page.locator('#content-outerwear image');
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Missing garment bounds");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readDraft(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform?.dx).toBeGreaterThan(0);
  const moved = (await readDraft(page)).snapshot.items.find((item: any) => item.slot === "outerwear").transform;
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(async () => (await readDraft(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform).toBeUndefined();
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect.poll(async () => (await readDraft(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform).toEqual(moved);
  await page.getByRole("button", { name: "Xuất ảnh (F03)" }).click();
  await page.getByRole("button", { name: "Vuông (Instagram / Post)" }).click();
  const exported = page.getByAltText("Bản phối xuất");
  await expect(exported).toBeVisible();
  const info = await exported.evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 140 && pixels[i + 1] < 60 && pixels[i + 2] < 80) colored++;
    return { width: canvas.width, height: canvas.height, colored };
  });
  expect(info.width).toBe(1400); expect(info.height).toBe(1400); expect(info.colored).toBeGreaterThan(1000);
});

test("unavailable try-on displays an error without fake success", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Thử đồ AI (F05)" }).click();
  await page.getByRole("button", { name: "Tạo ảnh Thử đồ AI" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Thử đồ AI chưa sẵn sàng.");
  await page.waitForTimeout(3200);
  await expect(page.getByText("Đã hoàn thành", { exact: true })).toHaveCount(0);
  await expect(page.getByAltText("Kết quả", { exact: true })).toHaveCount(0);
});
