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
  await page.goto("/studio");
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
  await page.goto("/studio");
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
  await page.goto("/studio");
  await page.getByRole("button", { name: "Thử đồ AI (F05)" }).click();
  await page.getByRole("button", { name: "Tạo ảnh Thử đồ AI" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Thử đồ AI chưa sẵn sàng.");
  await page.waitForTimeout(3200);
  await expect(page.getByText("Đã hoàn thành", { exact: true })).toHaveCount(0);
  await expect(page.getByAltText("Kết quả", { exact: true })).toHaveCount(0);
});

test("R08 records Canvas frame intervals and draft writes for one gesture", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) writes += 1;
      return original.call(this, name, value);
    };
    Object.defineProperty(window, "__r08DraftWrites", { get: () => writes });
    Object.defineProperty(window, "__resetR08DraftWrites", { value: () => { writes = 0; } });
  }, DRAFT_KEY);
  await page.goto("/studio");
  const image = page.locator('#content-outerwear image');
  await expect(image).toBeVisible();
  const box = await image.boundingBox();
  if (!box) throw new Error("Missing garment bounds");
  await page.evaluate(() => (window as any).__resetR08DraftWrites());
  const frameSample = page.evaluate(() => new Promise<{ p50_ms: number; p95_ms: number; frames: number }>(resolve => {
    const intervals: number[] = [];
    let previous = 0;
    let frames = 0;
    const tick = (now: number) => {
      if (previous) intervals.push(now - previous);
      previous = now;
      frames += 1;
      if (frames < 90) requestAnimationFrame(tick);
      else {
        const ordered = intervals.sort((a, b) => a - b);
        const at = (fraction: number) => ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))] || 0;
        resolve({ p50_ms: Number(at(0.5).toFixed(3)), p95_ms: Number(at(0.95).toFixed(3)), frames: intervals.length });
      }
    };
    requestAnimationFrame(tick);
  }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 30, { steps: 20 });
  await page.mouse.up();
  const frames = await frameSample;
  const writes = await page.evaluate(() => (window as any).__r08DraftWrites as number);
  const metrics = { workload: "one outerwear drag, 90 requestAnimationFrame samples, Chromium headless", draft_writes: writes, frame: frames };
  console.log(`R08_STUDIO_METRICS ${JSON.stringify(metrics)}`);
  await test.info().attach("r08-studio-metrics.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  expect(writes).toBeLessThanOrEqual(3);
  expect(frames.frames).toBeGreaterThan(30);
});

test("draft history retains cultural settings and rejects malformed context", () => {
  const document = structuredClone(INITIAL_DOCUMENT);
  document.snapshot.culturalSettings = { dataset_version: "ds_test", ruleset_version: "rules_test", context: {
    period_ids: ["period_nguyen"], region_ids: ["region_hue"], place_ids: [], community_ids: [], occasion_ids: [], social_context_ids: [],
  } };
  expect(parseDraft(JSON.stringify(document))).toEqual(document);
  const changed = studioReducer({ past: [], present: document, future: [] }, { type: "commit", update: value => ({ ...value, snapshot: { ...value.snapshot, backgroundTheme: "dopaper" } }) });
  expect(studioReducer(changed, { type: "undo" }).present.snapshot.culturalSettings).toEqual(document.snapshot.culturalSettings);
  expect(parseDraft(JSON.stringify({ ...document, snapshot: { ...document.snapshot, culturalSettings: { dataset_version: "ds_test", context: { period_ids: "wrong" } } } }))).toBeNull();
});

test("empty draft restores all document settings and undo includes presentation", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(({ key, document }) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, JSON.stringify(document));
      sessionStorage.setItem("seeded", "yes");
    }
  }, { key: DRAFT_KEY, document: { title: "Bộ phối rỗng", snapshot: { ...INITIAL_DOCUMENT.snapshot, items: [], lockedSlots: ["headwear"], backgroundTheme: "dopaper", aspectRatio: "1:1" } } });
  await page.goto("/studio");
  await page.getByRole("button", { name: /Khôi phục bản phối/ }).click();
  await expect(page.locator("input").first()).toHaveValue("Bộ phối rỗng");
  expect((await readDraft(page)).snapshot.items).toEqual([]);
  await page.getByRole("button", { name: "Remix Đương đại" }).click();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  expect((await readDraft(page)).snapshot.styleMode).toBe("traditional");
  await page.reload();
  await expect(page.locator("input").first()).toHaveValue("Bộ phối rỗng");
  expect((await readDraft(page)).snapshot).toMatchObject({ items: [], lockedSlots: ["headwear"], backgroundTheme: "dopaper", aspectRatio: "1:1" });
});

test("save in flight preserves newer edits and prevents duplicate submissions", async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let posts = 0;
  await page.route("**/api/outfits", async route => {
    posts++;
    const body = route.request().postDataJSON();
    await held;
    await route.fulfill({ json: { id: "saved-1", revision: 1, title: body.title, current_snapshot: body.snapshot } });
  });
  await page.goto("/studio");
  const title = page.locator("input").first();
  await title.fill("Version submitted");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await title.fill("Newer unsaved edits");
  release();
  await expect.poll(async () => (await readDraft(page))?.outfitId).toBe("saved-1");
  await expect(title).toHaveValue("Newer unsaved edits");
  const draft = await readDraft(page);
  expect(draft.savedDocument.title).toBe("Version submitted");
  expect(draft.title).toBe("Newer unsaved edits");
  expect(posts).toBe(1);
});

test("revision conflict preserves local edits until explicit server selection", async ({ page }) => {
  await mockApi(page);
  await page.goto("/studio");
  const title = page.locator("input").first();
  await title.fill("Saved version");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(async () => (await readDraft(page))?.revision).toBe(1);
  await page.route("**/api/outfits/saved-1", async route => {
    if (route.request().method() === "PUT") return route.fulfill({ status: 409, json: { error: { code: "REVISION_CONFLICT", message: "conflict" } } });
    return route.fulfill({ json: { id: "saved-1", revision: 2, title: "Other tab version", current_snapshot: INITIAL_DOCUMENT.snapshot } });
  });
  await title.fill("My losing edit");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toContainText("Bản nháp của bạn vẫn được giữ");
  expect((await readDraft(page)).revision).toBe(1);
  await expect(title).toHaveValue("My losing edit");
  await page.getByRole("button", { name: "Tải bản máy chủ" }).click();
  await expect(title).toHaveValue("Other tab version");
  expect((await readDraft(page)).revision).toBe(2);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(title).toHaveValue("My losing edit");
});

test("expired session does not expose or erase the account draft", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(({ key, document }) => {
    localStorage.setItem(key, JSON.stringify({ ...document, ownerId: "account-a" }));
    localStorage.setItem("viet_stylist_auth_token", "expired-test-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "account-a", email: "a@example.invalid", displayName: "A", roles: ["user"] }));
  }, { key: DRAFT_KEY, document: { ...INITIAL_DOCUMENT, title: "Account A private draft" } });
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { error: { code: "TOKEN_EXPIRED", message: "expired" } } }));
  await page.goto("/studio");
  await expect(page.locator("input").first()).toHaveValue(INITIAL_DOCUMENT.title);
  const archived = await page.evaluate(key => JSON.parse(localStorage.getItem(`${key}:account-a`) || "null"), DRAFT_KEY);
  expect(archived.title).toBe("Account A private draft");
  expect((await readDraft(page)).ownerId).toBeUndefined();
});

test("opening an outfit link requires choosing before replacing unsaved work", async ({ page }) => {
  await mockApi(page);
  let reads = 0;
  await page.route("**/api/outfits/from-link", route => {
    reads++;
    return route.fulfill({ json: { id: "from-link", revision: 3, title: "Bộ phối từ liên kết", current_snapshot: INITIAL_DOCUMENT.snapshot } });
  });
  await page.goto("/studio");
  await page.locator("input").first().fill("Nháp chưa lưu cần giữ");
  await page.goto("/studio?loadOutfit=from-link");
  await expect(page.locator("input").first()).toHaveValue("Nháp chưa lưu cần giữ");
  await expect(page.getByRole("button", { name: "Mở bộ phối từ liên kết" })).toBeVisible();
  expect(reads).toBe(0);
  await page.getByRole("button", { name: "Mở bộ phối từ liên kết" }).click();
  await expect(page.locator("input").first()).toHaveValue("Bộ phối từ liên kết");
  expect((await readDraft(page)).revision).toBe(3);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.locator("input").first()).toHaveValue("Nháp chưa lưu cần giữ");
});

test("an outfit load finishing after a new edit cannot overwrite it", async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.route("**/api/outfits/slow-link", async route => {
    reads++;
    await held;
    await route.fulfill({ json: { id: "slow-link", revision: 5, title: "Response muộn", current_snapshot: INITIAL_DOCUMENT.snapshot } });
  });
  await page.goto("/studio?loadOutfit=slow-link");
  await expect.poll(() => reads).toBeGreaterThan(0);
  await page.locator("input").first().fill("Thao tác mới trong lúc tải");
  const completed = page.waitForResponse("**/api/outfits/slow-link");
  release(); await completed;
  await expect(page.locator("input").first()).toHaveValue("Thao tác mới trong lúc tải");
  expect((await readDraft(page)).outfitId).toBeUndefined();
});

test("an account switch in another tab hides old work and ignores its pending save", async ({ page, context }) => {
  await mockApi(page);
  const account = (id: string) => ({ id, email: `${id}@example.invalid`, displayName: id, roles: ["user"] });
  await page.goto("/studio");
  await page.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-a");
  }, account("account-a"));
  await page.route("**/api/auth/me", route => {
    const id = route.request().headers().authorization === "Bearer token-b" ? "account-b" : "account-a";
    return route.fulfill({ json: { ...account(id), display_name: id } });
  });
  await page.reload();
  await page.locator("input").first().fill("Riêng tư tài khoản A");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let saves = 0;
  await page.route("**/api/outfits", async route => {
    const body = route.request().postDataJSON(); saves++;
    await held;
    await route.fulfill({ json: { id: "owned-by-a", revision: 1, title: body.title, current_snapshot: body.snapshot } });
  });
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  const otherTab = await context.newPage();
  await otherTab.goto("/favicon.ico");
  await otherTab.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, account("account-b"));
  await expect(page.locator("input").first()).toHaveValue(INITIAL_DOCUMENT.title);
  const completed = page.waitForResponse("**/api/outfits");
  release(); await completed;
  await page.locator("input").first().fill("Bản nháp B");
  const draft = await readDraft(page);
  expect(draft.ownerId).toBe("account-b");
  expect(draft.outfitId).toBeUndefined();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(`${key}:account-a`) || "null").title, DRAFT_KEY)).toBe("Riêng tư tài khoản A");
  await otherTab.close();
});
