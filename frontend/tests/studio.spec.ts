import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openStudioDocument, openStudioPanel, openStudioProperties, closeStudioPanels, chooseStudioGarment, clickStudioAction } from "./helpers/studio-ui";
import { DRAFT_KEY, INITIAL_DOCUMENT, mergeUnlockedItems, parseDraft, sameDocument, studioReducer } from "../src/features/studio/state";
import { buildManualTryOnPrompt } from "../src/features/studio/tryOnPrompt";
import { occasionBackgroundPatch, OCCASION_BACKGROUNDS, backgroundUrl } from "../src/features/studio/backgrounds";

test("all occasion background assets exist in both formats and old drafts keep their neutral choice", () => {
  for (const occasion of Object.keys(OCCASION_BACKGROUNDS)) {
    for (const ratio of ["1:1", "9:16"] as const) {
      expect(readFileSync(`public${backgroundUrl(occasion, ratio)}`).length).toBeGreaterThan(10000);
    }
  }
  const old = parseDraft(JSON.stringify({ snapshot: { ...INITIAL_DOCUMENT.snapshot, backgroundTheme: "dopaper" } }))!;
  const selected = { ...old.snapshot, ...occasionBackgroundPatch(old.snapshot, "tet") };
  expect(selected).toMatchObject({ backgroundTheme: "occasion", neutralBackgroundTheme: "dopaper" });
  expect(occasionBackgroundPatch(selected)).toMatchObject({ backgroundTheme: "dopaper", occasionId: undefined });
  expect(backgroundUrl("unknown", "1:1")).toBeUndefined();
});

const TEST_GARMENT = { slot: "outerwear", itemId: "item-test-outerwear", variantId: "variant-test-outerwear", assetVersion: 1, colorHex: "#8B1E24" };
const TEST_DOCUMENT = { ...structuredClone(INITIAL_DOCUMENT), snapshot: { ...structuredClone(INITIAL_DOCUMENT.snapshot), items: [TEST_GARMENT] } };
const STALE_DOCUMENT = { ...structuredClone(INITIAL_DOCUMENT), snapshot: { ...structuredClone(INITIAL_DOCUMENT.snapshot), items: [
  "outerwear", "undergarment", "bottom", "headwear", "accessory_front", "footwear",
].map(slot => ({ slot, itemId: `removed-${slot}`, variantId: `removed-variant-${slot}`, assetVersion: 1, colorHex: "#123456" })) } };

const serverFixtures = new WeakMap<Page, { document: typeof TEST_DOCUMENT; ownerId?: string }>();
const culturalRequests = new WeakMap<Page, any>();

// Load fixtures through the same owned-outfit GET contract as production. Guest
// tests select catalog items through the UI; neither path stores an outfit locally.
async function seedServerOutfit(page: Page, document = TEST_DOCUMENT, ownerId?: string) {
  serverFixtures.set(page, { document: structuredClone(document), ownerId });
}

async function openStudio(page: Page) {
  const fixture = serverFixtures.get(page);
  const loaded = fixture?.ownerId ? page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/outfits/test-fixture" && response.request().method() === "GET") : null;
  await page.goto(fixture?.ownerId ? "/studio?loadOutfit=test-fixture" : "/studio");
  await openStudioDocument(page);
  if (fixture?.ownerId) {
    await loaded;
    await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(fixture.document.title);
    await expect(page.locator('#flatlay-outfit-board [id^="interactive-slot-"]')).toHaveCount(fixture.document.snapshot.items.length);
    await openStudioDocument(page);
    await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeEnabled();
  } else if (fixture) {
    await chooseStudioGarment(page, "Trang phục 0");
    await closeStudioPanels(page);
  }
}

// Observe public SVG/control output and the cultural-check request contract.
// This deliberately does not inspect React state or browser draft storage.
async function readStudioView(page: Page) {
  const rendered = await page.evaluate(() => {
    const buttonText = (selector: string) => document.querySelector(selector)?.textContent?.trim();
    const theme = buttonText('[aria-label="Nền bảng phối"] [aria-pressed="true"]');
    const style = buttonText('.studio-style-switch [aria-pressed="true"]');
    const items = [...document.querySelectorAll<SVGGElement>('#flatlay-outfit-board [id^="item-transform-"]')].map(node => {
      const slot = node.id.replace("item-transform-", "");
      const transforms = node.transform.baseVal;
      const first = transforms.getItem(0).matrix;
      const last = transforms.getItem(transforms.numberOfItems - 1).matrix;
      const transform = { dx: first.e + last.e, dy: first.f + last.f,
        rotation: transforms.getItem(1).angle, scale: transforms.getItem(2).matrix.a };
      return { slot, transform: transform.dx || transform.dy || transform.rotation || transform.scale !== 1 ? transform : undefined };
    });
    return {
      title: document.querySelector<HTMLInputElement>('[aria-label="Tên bản phối"]')!.value,
      snapshot: {
        items,
        lockedSlots: [...document.querySelectorAll('#flatlay-outfit-board [id^="content-"][data-studio-drag="false"]')].map(node => node.id.replace("content-", "")),
        backgroundTheme: theme === "Theo hoàn cảnh" ? "occasion" : theme === "Giấy Dó" ? "dopaper" : "white",
        backgroundFade: Number(document.querySelector<HTMLInputElement>('.studio-background-fade input')?.value || 0),
        aspectRatio: document.querySelector<HTMLElement>('[data-testid="outfit-artboard"]')!.style.aspectRatio.replace(/\s*\/\s*/, ":"),
        styleMode: style === "Remix" ? "remix" : style === "Cách tân" ? "modern_fusion" : "traditional",
        overlapDirection: document.querySelector('[aria-label^="Đổi hướng khép vạt"]')?.getAttribute("aria-pressed") === "true" ? "right_over_left" : "left_over_right",
        occasionName: document.querySelector('.studio-occasion-list [aria-pressed="true"]')?.getAttribute("aria-label"),
      },
    };
  });
  return { ...rendered, snapshot: { ...rendered.snapshot,
    occasionId: rendered.snapshot.occasionName === "Tết" ? "tet" : rendered.snapshot.occasionName === "Kỷ yếu" ? "ky_yeu" : undefined,
  } };
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`desktop Studio fits the viewport and scrolls tools independently at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.route("http://127.0.0.1:4100/api/catalog/occasions", route => route.fulfill({ json: Array.from({ length: 40 }, (_, i) => ({ id: `occasion-${i}`, name: `Hoàn cảnh ${i + 1}`, season: "all" })) }));
    await openStudio(page);
    await chooseStudioGarment(page, "Trang phục 0");
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    const original = (await readStudioView(page)).snapshot.items;
    const board = page.getByTestId("outfit-artboard");
    for (const ratio of ["1:1", "9:16"] as const) {
      await openStudioPanel(page, "Bối cảnh");
      await page.getByRole("button", { name: ratio, exact: true }).click();
      await closeStudioPanels(page);
      const bounds = (await board.boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(ratio === "1:1" ? 1 : 9 / 16, 2);
      expect(bounds.height).toBeGreaterThan(160);
      const toolbar = (await page.getByRole("group", { name: "Thu phóng bảng phối", exact: true }).boundingBox())!;
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(toolbar.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    }
    await openStudioPanel(page, "Bối cảnh");
    const body = page.locator("#studio-panel-context .studio-panel-body");
    const before = (await board.boundingBox())!;
    await body.evaluate(element => { element.scrollTop = 0; });
    const bodyBounds = (await body.boundingBox())!;
    await page.mouse.move(bodyBounds.x + 80, bodyBounds.y + 150);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect((await board.boundingBox())!.y).toBe(before.y);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    if (viewport.width < 1280) await expect(page.getByRole("button", { name: "Mở menu điều hướng", exact: true })).toBeVisible();
    else await expect(page.getByRole("link", { name: "Thư viện Cổ phục", exact: true })).toBeVisible();
    expect((await readStudioView(page)).snapshot.items).toEqual(original);
    await page.screenshot({ path: test.info().outputPath("desktop-workbench.png") });
  });
}

test("Studio workbench remains usable across mobile widths and landscape", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  for (const [width, height] of [[320, 812], [375, 812], [414, 896], [768, 1024], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await closeStudioPanels(page);
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    const box = (await page.getByTestId("outfit-artboard").boundingBox())!;
    expect(box.height).toBeGreaterThan(100);
    expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
    if (width === 844 && height === 390) {
      const logo = (await page.locator(".site-navbar .site-brand img").boundingBox())!;
      const iconCenters = await page.locator(".studio-tool-rail .studio-tool-icon").evaluateAll(icons => icons.map(icon => {
        const bounds = icon.getBoundingClientRect(); return bounds.x + bounds.width / 2;
      }));
      expect(iconCenters).toHaveLength(6);
      for (const center of iconCenters) expect(Math.abs(logo.x + logo.width / 2 - center), "Logo and tool icon centers in landscape").toBeLessThanOrEqual(0.5);
    }
    await page.screenshot({ path: test.info().outputPath(`mobile-${width}.png`) });
  }
});

for (const width of [375, 1536]) {
  test(`empty Studio guides garment selection at viewport ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await openStudio(page);
    const board = page.getByTestId("outfit-artboard");
    await expect(board.getByText("Bảng phối đang trống", { exact: true })).toBeVisible();
    await expect(page.locator("#flatlay-outfit-board > g")).toHaveCount(0);
    await board.getByRole("button", { name: "Chọn trang phục", exact: true }).click();
    const catalog = page.getByRole("region", { name: "Danh sách trang phục", exact: true });
    await expect(catalog).toBeFocused();
    await expect(catalog).toBeInViewport();
    await catalog.getByText("Trang phục 0", { exact: true }).click();
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    await expect(board.getByText("Bảng phối đang trống", { exact: true })).toHaveCount(0);
  });
}

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
  const item = { slot: "outerwear", itemId: "item-test", variantId: "variant-test", assetVersion: 1, colorHex: "#123456", transform: { dx: 30, dy: 10, scale: 1.2, rotation: 20 } };
  document.snapshot.items = [item];
  expect(parseDraft(JSON.stringify(document))).toEqual(document);
  const documentWithoutPlacement = structuredClone(document);
  delete documentWithoutPlacement.snapshot.items[0].transform;
  const serverDocument = structuredClone(documentWithoutPlacement);
  serverDocument.snapshot.items[0].transform = null as any;
  expect(sameDocument(documentWithoutPlacement, serverDocument)).toBe(true);
  expect(parseDraft(JSON.stringify({ ...document, snapshot: { ...document.snapshot, items: [] } }))?.snapshot.items).toEqual([]);
  expect(parseDraft('{"snapshot":{"items":[null]}}')).toBeNull();
  const result = mergeUnlockedItems(document.snapshot.items, [{ ...item, colorHex: "#ffffff" }], ["outerwear"]);
  expect(result[0]).toEqual(item);
});

async function mockApi(page: Page, imageMetadata: { real_image_url?: string; flatlay_image_url?: string; catalog_media_id?: string } = { real_image_url: "/fixture.png" }) {
  const saves: Array<{ method: string; body: any }> = [];
  let saved: any;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/cultural-check") culturalRequests.set(page, request.postDataJSON());
  });
  const garmentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64");
  await page.route("**/fixture*.png", route => {
    const path = new URL(route.request().url()).pathname;
    return ["/fixture.png", "/fixture-flatlay.png"].includes(path)
      ? route.fulfill({ contentType: "image/png", body: garmentPng })
      : route.fulfill({ status: 404, body: "Image does not exist" });
  });
  await page.route("http://127.0.0.1:4100/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const send = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path.endsWith("/studio-image")) return route.fulfill({ status: 200, contentType: "image/png", body: garmentPng, headers: { "Access-Control-Allow-Origin": "*" } });
    if (path === "/api/v3/generation/status") return send({ enabled: true });
    if (path === "/api/lookbook-posts") return send({ items: [], next_cursor: null });
    if (path === "/api/v3/legacy-mappings") return send({ dataset_version: "dev", ruleset_version: "dev", reproducible: false, mappings: [] });
    if (path === "/api/catalog/garment-types") return send([{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]);
    if (path === "/api/catalog/occasions") return send([{ id: "ky_yeu", name: "Kỷ yếu", season: "all" }, { id: "tet", name: "Tết", season: "spring", description: "Sum họp gia đình và du xuân." }]);
    if (path === "/api/catalog/avatars") return send([{ id: "avatar_nam_chuan", name: "Nam", dimensions: { width: 800, height: 1200 } }]);
    if (path === "/api/catalog/items") return send([TEST_GARMENT].map((item, index) => ({
      id: item.itemId, slot: item.slot, name: `Trang phục ${index}`, gender: "unisex", garment_type_id: "ngu_than", is_published: true,
      metadata: index === 0 ? imageMetadata : {},
      variants: [{ id: item.variantId, item_id: item.itemId, color_name: "Màu gốc", hex_color: item.colorHex, is_default: true }],
      default_layer: { id: `layer-${index}`, item_id: item.itemId, slot: item.slot, z_index: index, layer_type: "svg", svg_content: `<circle cx="50" cy="${50 + index * 30}" r="10" fill="${item.colorHex}"/>` },
    })));
    if (path === "/api/cultural-check") return send({ is_culturally_sound: true, strict_count: 0, warning_count: 0, info_count: 0, warnings: [] });
    if (path === "/api/color-analysis") return send({ dominant_color: "#1A365D", accent_colors: [], palette_type: "neutral_balance", contrast_rating: "good", contrast_ratio: 5, suggested_variants: [], aesthetic_comment: "" });
    if (path === "/api/weather") return send({ location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false });
    if (path === "/api/outfits/test-fixture" && request.method() === "GET") {
      const fixture = serverFixtures.get(page)!;
      return send({ id: "test-fixture", owner_id: fixture.ownerId, title: fixture.document.title, revision: 1,
        current_version_id: "test-fixture-version", current_snapshot: fixture.document.snapshot });
    }
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

test("mobile Studio closes the catalog after selection and reopens garment adjustments", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockApi(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await expect(page.getByRole("tab", { name: "Chọn trang phục", exact: true })).toHaveAttribute("aria-selected", "false");
  await openStudioProperties(page);
  await expect(page.getByRole("region", { name: "Điều chỉnh trang phục", exact: true })).toBeInViewport();
  await closeStudioPanels(page);
  await expect(page.getByTestId("outfit-artboard")).toBeInViewport();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
});

test("occasion selection is saved on the server, reopens through its link, and can be cleared", async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  await openStudioPanel(page, "Bối cảnh");
  const occasion = page.getByRole("button", { name: "Tết", exact: true });
  await occasion.click();
  await openStudioPanel(page, "Bối cảnh");

  await expect(occasion).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Sum họp gia đình và du xuân.")).toBeVisible();
  await openStudioPanel(page, "Bối cảnh");

  await expect(occasion).toContainText("Mùa xuân");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].body).toMatchObject({ occasion_id: "tet", snapshot: { occasionId: "tet" } });
  await page.goto("/studio?loadOutfit=saved-1");
  await openStudioPanel(page, "Bối cảnh");
  await expect(occasion).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Bỏ chọn hoàn cảnh" }).click();
  await openStudioPanel(page, "Bối cảnh");

  await expect(occasion).toHaveAttribute("aria-pressed", "false");
  await closeStudioPanels(page);

  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await openStudioPanel(page, "Bối cảnh");

  await expect(occasion).toHaveAttribute("aria-pressed", "true");
  await closeStudioPanels(page);

  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves[1].body.occasion_id).toBeUndefined();
  expect(saves[1].body.snapshot.occasionId).toBeUndefined();
});

test("in-memory edits undo, saves update one outfit, and reload requires a server link", async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Tên trước khi lưu");
  await page.getByRole("button", { name: "Remix · kết hợp hiện đại" }).click();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.getByRole("button", { name: "Truyền thống", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  await openStudioDocument(page);
  await title.fill("Tên sau khi sửa");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves.map(save => save.method)).toEqual(["POST", "PUT"]);
  expect(saves[1].body.revision).toBe(1);
  await page.reload();
  await expect(title).toHaveValue(INITIAL_DOCUMENT.title);
  await page.goto("/studio?loadOutfit=saved-1");
  await expect(title).toHaveValue("Tên sau khi sửa");
  await openStudioDocument(page);
  await title.fill("Chưa lưu lên máy chủ");
  await page.reload();
  await expect(title).toHaveValue("Tên sau khi sửa");
});

for (const width of [375, 1536]) {
  test(`remove garment control respects locks and supports undo at viewport ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await openStudio(page);
    await chooseStudioGarment(page, "Trang phục 0");
    await openStudioProperties(page);
    const controls = page.getByRole("region", { name: "Điều chỉnh trang phục" });
    await controls.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
    await expect.poll(async () => (await readStudioView(page))?.snapshot.items[0].transform?.rotation).toBe(15);
    const original = (await readStudioView(page)).snapshot.items;
    const remove = controls.getByRole("button", { name: "Xóa trang phục khỏi bảng", exact: true });
    await controls.getByRole("button", { name: "Khóa món đang chọn", exact: true }).click();
    await expect(remove).toBeDisabled();
    await controls.getByRole("button", { name: "Mở khóa món đang chọn", exact: true }).click();
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(page.locator("#content-outerwear")).toHaveCount(0);
    await expect(page.getByText("Bảng phối đang trống", { exact: true })).toBeVisible();
    await expect.poll(async () => (await readStudioView(page))?.snapshot.items).toEqual([]);
    await closeStudioPanels(page);

    await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    await expect.poll(async () => (await readStudioView(page))?.snapshot.items).toEqual(original);
    await openStudioProperties(page);
    await remove.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await readStudioView(page))?.snapshot.items).toEqual([]);
    await page.reload();
    await expect(page.locator("#content-outerwear")).toHaveCount(0);
    await expect(page.getByText("Bảng phối đang trống", { exact: true })).toBeVisible();
  });
}

test("board zoom preserves the outfit and exported pixels while dragging uses zoomed coordinates", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await openStudioPanel(page, "Bối cảnh");

  await page.getByRole("button", { name: "1:1", exact: true }).click();
  const original = (await readStudioView(page)).snapshot.items;
  const board = page.getByTestId("outfit-artboard");
  const viewport = page.getByRole("region", { name: "Vùng xem bảng phối", exact: true });
  const zoomIn = page.getByRole("button", { name: "Phóng to bảng phối", exact: true });
  const exportImage = async () => {
    await clickStudioAction(page, "Xuất ảnh");
    await page.getByRole("button", { name: "Vuông (Instagram / Post)" }).click();
    const image = page.getByAltText("Bản phối xuất");
    await expect(image).toBeVisible();
    // Blob URLs are unique per export; compare the actual PNG bytes instead.
    const bytes = await image.evaluate(async node => {
      const data = await (await fetch((node as HTMLImageElement).src)).arrayBuffer();
      return [...new Uint8Array(data)];
    });
    await page.getByRole("heading", { name: "Xuất ảnh bản phối", exact: true }).locator("../..").getByRole("button").click();
    return bytes;
  };
  const exportedBefore = await exportImage();
  const fit = (await board.boundingBox())!;
  for (let i = 0; i < 4; i++) await zoomIn.click();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("200%");
  const zoomed = (await board.boundingBox())!;
  expect(zoomed.width).toBeCloseTo(fit.width * 2, 0);
  expect(zoomed.height).toBeCloseTo(fit.height * 2, 0);
  expect((await readStudioView(page)).snapshot.items).toEqual(original);
  expect(await exportImage()).toEqual(exportedBefore);
  const image = page.locator("#content-outerwear image");
  await image.scrollIntoViewIfNeeded();
  const box = (await image.boundingBox())!;
  const svgScale = await page.locator('svg:has(> #flatlay-outfit-board)').evaluate((svg: SVGSVGElement) => svg.getScreenCTM()!.a);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readStudioView(page)).snapshot.items[0].transform?.dx).toBeCloseTo(40 / svgScale, 0);
  await closeStudioPanels(page);

  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(async () => (await readStudioView(page)).snapshot.items).toEqual(original);
  const pageScroll = await page.evaluate(() => scrollY);
  await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; element.scrollTop = element.scrollHeight; });
  expect(await viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
  await page.getByRole("button", { name: "Vừa khung", exact: true }).click();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("100%");
  expect((await board.boundingBox())!.width).toBeCloseTo(fit.width, 0);
  expect(await viewport.evaluate(element => [element.scrollLeft, element.scrollTop])).toEqual([0, 0]);
  for (let i = 0; i < 12; i++) await zoomIn.click();
  await expect(zoomIn).toBeDisabled();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("400%");
  await page.getByRole("button", { name: "Vừa khung", exact: true }).click();
  const zoomOut = page.getByRole("button", { name: "Thu nhỏ bảng phối", exact: true });
  await zoomOut.click();
  await zoomOut.click();
  await expect(zoomOut).toBeDisabled();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("50%");
});

for (const width of [375, 1440]) {
  test(`occasion backgrounds preserve locked placement, neutral choice and history at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const saves = await mockApi(page, { flatlay_image_url: "/garments/item_ao_tac_xanh_reu_transparent.png" });
    await loginForGeneration(page);
    await openStudio(page);
    await chooseStudioGarment(page, "Trang phục 0");
    await openStudioProperties(page);
    const controls = page.getByRole("region", { name: "Điều chỉnh trang phục" });
    await controls.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
    await controls.getByRole("button", { name: "Khóa món đang chọn", exact: true }).click();
    const original = (await readStudioView(page)).snapshot;
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: "Giấy Dó", exact: true }).click();
    await openStudioPanel(page, "Bối cảnh");
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: "Tết", exact: true }).click();
    const bg = page.getByTestId("board-background");
    await expect(bg).toHaveAttribute("data-background-status", "ready");
    await expect(bg).toHaveAttribute("data-background-url", /tet-portrait/);
    const fade = page.getByRole("slider", { name: "Độ mờ ảnh nền" });
    await openStudioPanel(page, "Bối cảnh");

    await expect(fade).toHaveValue("0");
    await fade.fill("45");
    await openStudioPanel(page, "Bối cảnh");

    await expect(fade).toHaveAttribute("aria-valuetext", "45%");
    await closeStudioPanels(page);

    await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
    await openStudioPanel(page, "Bối cảnh");

    await expect(fade).toHaveValue("0");
    await fade.fill("45");
    await expect(page.getByRole("button", { name: "Theo hoàn cảnh", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect((await readStudioView(page)).snapshot).toMatchObject({ items: original.items, lockedSlots: original.lockedSlots,
      backgroundTheme: "occasion" });
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: "1:1", exact: true }).click();
    await expect(bg).toHaveAttribute("data-background-url", /tet-square/);
    await expect(bg).toHaveAttribute("data-background-status", "ready");
    await page.getByTestId("outfit-artboard").screenshot({ path: test.info().outputPath("tet-square-real-garment.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Bỏ chọn hoàn cảnh" }).click();
    await expect(page.getByRole("button", { name: "Giấy Dó", exact: true })).toHaveAttribute("aria-pressed", "true");
    await closeStudioPanels(page);

    await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
    await expect(bg).toHaveAttribute("data-background-status", "ready");
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: "Trắng Studio", exact: true }).click();
    await expect(bg).toHaveAttribute("data-background-status", "neutral");
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: "Tết", exact: true }).click();
    await openStudioDocument(page);
    await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0].body.snapshot).toMatchObject({ backgroundTheme: "occasion", neutralBackgroundTheme: "white", backgroundFade: 45, items: original.items });
    await page.goto("/studio?loadOutfit=saved-1");
    await openStudioPanel(page, "Bối cảnh");

    await expect(fade).toHaveValue("45");
    await expect(bg).toHaveAttribute("data-background-status", "ready");
    await expect(bg).toHaveAttribute("data-background-url", /tet-square/);
    expect((await readStudioView(page)).snapshot).toMatchObject({ items: original.items,
      lockedSlots: original.lockedSlots, backgroundTheme: "occasion" });
  });
}

test("all eight scenes render and export the matching background in both ratios", async ({ page }) => {
  test.setTimeout(60_000);
  await mockApi(page);
  await loginForGeneration(page);
  await page.route("**/api/catalog/occasions", route => route.fulfill({ json:
    Object.entries(OCCASION_BACKGROUNDS).map(([id, scene]) => ({ id, name: scene.title, season: "all" })),
  }));
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  const bg = page.getByTestId("board-background");
  for (const [id, scene] of Object.entries(OCCASION_BACKGROUNDS)) {
    await openStudioPanel(page, "Bối cảnh");

    await page.getByRole("button", { name: scene.title, exact: true }).click();
    await page.getByRole("slider", { name: "Độ mờ ảnh nền" }).fill(String(Object.keys(OCCASION_BACKGROUNDS).indexOf(id) % 3 * 50));
    for (const ratio of ["1:1", "9:16"] as const) {
      await openStudioPanel(page, "Bối cảnh");

      await page.getByRole("button", { name: ratio, exact: true }).click();
      await expect(bg).toHaveAttribute("data-background-url", backgroundUrl(id, ratio)!);
      await expect(bg).toHaveAttribute("data-background-status", "ready");
      // Finish the crossfade before comparing visible pixels with the PNG.
      await bg.evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished)); });
      await clickStudioAction(page, "Xuất ảnh");
      await page.getByRole("button", { name: ratio === "1:1" ? "Vuông (Instagram / Post)" : "Story / Reels (9:16)" }).click();
      const preview = page.getByAltText("Bản phối xuất");
      await expect(preview).toBeVisible();
      const difference = await preview.evaluate(async node => {
        const exported = node as HTMLImageElement; await exported.decode();
        const visible = [...document.querySelectorAll<HTMLCanvasElement>('[data-testid="board-background"] canvas')].at(-1)!;
        const canvas = document.createElement("canvas"); canvas.width = visible.width; canvas.height = visible.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(exported, 0, 0, canvas.width, canvas.height);
        const originalCtx = visible.getContext("2d")!;
        const fadeOverlay = visible.parentElement!.querySelector<HTMLElement>("div");
        const fade = fadeOverlay ? Number(getComputedStyle(fadeOverlay).opacity) : 0;
        // Sample background down both outer margins, away from garments and the export footer.
        let max = 0;
        for (const x of [0.03, 0.97]) for (const y of [0.1, 0.25, 0.5, 0.7]) {
          const a = ctx.getImageData(x * canvas.width, y * canvas.height, 1, 1).data;
          const b = originalCtx.getImageData(x * canvas.width, y * canvas.height, 1, 1).data;
          for (let c = 0; c < 3; c++) {
            const displayed = b[c] * (1 - fade) + [250, 248, 245][c] * fade;
            max = Math.max(max, Math.abs(a[c] - displayed));
          }
        }
        return max;
      });
      expect(difference).toBeLessThan(20); // Allow resampling at the different export resolution.
      await page.getByRole("heading", { name: "Xuất ảnh bản phối", exact: true }).locator("../..").getByRole("button").click();
    }
  }
});

test("a late occasion background cannot replace the latest choice and errors fall back without blocking export", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/tet-portrait.webp", async route => { await held; await route.continue(); });
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await openStudioPanel(page, "Bối cảnh");

  await page.getByRole("button", { name: "Tết", exact: true }).click();
  const bg = page.getByTestId("board-background");
  await expect(bg).toHaveAttribute("data-background-status", "loading");
  await openStudioPanel(page, "Bối cảnh");

  await page.getByRole("button", { name: "Kỷ yếu", exact: true }).click();
  await expect(bg).toHaveAttribute("data-background-status", "ready");
  release();
  await expect(bg).toHaveAttribute("data-background-url", /ky-yeu-portrait/);
  await page.route("**/tet-square.webp", route => route.abort());
  await openStudioPanel(page, "Bối cảnh");

  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await openStudioPanel(page, "Bối cảnh");

  await page.getByRole("button", { name: "Tết", exact: true }).click();
  await expect(bg).toHaveAttribute("data-background-status", "fallback");
  expect((await readStudioView(page)).snapshot.items).toHaveLength(1);
  await clickStudioAction(page, "Xuất ảnh");
  await page.getByRole("button", { name: "Vuông (Instagram / Post)" }).click();
  await expect(page.getByAltText("Bản phối xuất")).toBeVisible();
  const pixel = await page.getByAltText("Bản phối xuất").evaluate(async node => {
    const image = node as HTMLImageElement; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1400;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(2, 2, 1, 1).data];
  });
  expect(pixel).toEqual([255, 255, 255, 255]);
});

for (const ratio of ["1:1", "9:16"] as const) {
test(`saved, downloaded and AI outfit references retain the same scene at ${ratio}`, async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: ratio, exact: true }).click();
  await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: "Tết", exact: true }).click();
  await expect(page.getByTestId("board-background")).toHaveAttribute("data-background-status", "ready");
  await page.getByRole("slider", { name: "Độ mờ ảnh nền" }).fill("35");
  await clickStudioAction(page, "Xuất ảnh");
  await page.getByRole("button", { name: ratio === "1:1" ? "Vuông (Instagram / Post)" : "Story / Reels (9:16)" }).click();
  const preview = page.getByAltText("Bản phối xuất");
  await expect(preview).toBeVisible();
  const pixel = await preview.evaluate(async node => {
    const image = node as HTMLImageElement; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(2, 2, 1, 1).data];
  });
  expect(pixel.slice(0, 3).some(value => value < 240)).toBe(true);
  await page.getByRole("button", { name: "Đóng xuất ảnh", exact: true }).click();
  await clickStudioAction(page, "Thử đồ AI");
  await page.getByRole("dialog", { name: "Thử đồ bằng Gemini" }).getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].body.snapshot).toMatchObject({ backgroundTheme: "occasion", occasionId: "tet", backgroundFade: 35, aspectRatio: ratio });
  await page.getByRole("button", { name: "Đóng thử đồ AI", exact: true }).click();
  await page.goto("/studio?loadOutfit=saved-1");
  await expect(page.getByTestId("board-background")).toHaveAttribute("data-background-status", "ready");
  await openStudioPanel(page, "Bối cảnh");
  await expect(page.getByRole("slider", { name: "Độ mờ ảnh nền" })).toHaveValue("35");
  await clickStudioAction(page, "Thử đồ AI");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải ảnh bản phối", exact: true }).click();
  const download = await downloading;
  await download.saveAs(test.info().outputPath("download-with-scene.png"));
  const png = readFileSync((await download.path())!);
  const downloadedPixel = await page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(2, 2, 1, 1).data];
  }, `data:image/png;base64,${png.toString("base64")}`);
  expect(downloadedPixel).toEqual(pixel);
  let uploadedBoard: Buffer | undefined;
  await page.route("**/test-upload/scene-reference", route => {
    uploadedBoard = route.request().postDataBuffer()!;
    return route.fulfill({ status: 200, body: "ok" });
  });
  await page.route("http://127.0.0.1:4100/api/media/**", route => route.fulfill({ json:
    new URL(route.request().url()).pathname === "/api/media/uploads"
      ? { media_id: "scene-reference", upload_url: "http://127.0.0.1:3100/test-upload/scene-reference", method: "PUT", storage_type: "r2" }
      : {} }));
  await page.route("http://127.0.0.1:4100/api/v3/generation/jobs", route => route.fulfill({
    status: 202, json: { job_id: "scene-job", status: "failed", error: { code: "UNAVAILABLE", message: "Provider fixture unavailable" } },
  }));
  await page.getByRole("button", { name: "Tạo ảnh thử đồ", exact: true }).click();
  await expect.poll(() => uploadedBoard?.length || 0).toBeGreaterThan(0);
  const aiPixel = await page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(2, 2, 1, 1).data];
  }, `data:image/png;base64,${uploadedBoard!.toString("base64")}`);
  expect(aiPixel).toEqual(pixel);
  expect((await readStudioView(page)).snapshot.backgroundTheme).toBe("occasion");
});
}

test("canvas drag updates the board, undo restores it, and export includes garment image", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  await openStudio(page);
  const image = page.locator('#content-outerwear image');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("href", "/fixture.png");
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Missing garment bounds");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readStudioView(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform?.dx).toBeGreaterThan(0);
  const moved = (await readStudioView(page)).snapshot.items.find((item: any) => item.slot === "outerwear")!.transform;
  await closeStudioPanels(page);

  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(async () => (await readStudioView(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform).toBeUndefined();
  await closeStudioPanels(page);

  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect.poll(async () => (await readStudioView(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform).toEqual(moved);
  await clickStudioAction(page, "Xuất ảnh");
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

for (const realImage of ["/fixture.png", undefined]) {
  test(`canvas uses explicit flatlay image with ${realImage ? "an original image" : "no original image"}`, async ({ page }) => {
    await mockApi(page, { real_image_url: realImage, flatlay_image_url: "/fixture-flatlay.png" });
    await seedServerOutfit(page);
    const imageResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/fixture-flatlay.png");
    await openStudio(page);
    await expect(page.locator('#content-outerwear image')).toHaveAttribute("href", "/fixture-flatlay.png");
    expect((await imageResponse).status()).toBe(200);
  });
}

async function loginForGeneration(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-generation-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "generation-user", email: "generation@example.invalid", displayName: "Generation", roles: ["user"] }));
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { id: "generation-user", email: "generation@example.invalid", display_name: "Generation", roles: ["user"] } }));
}

test("guest work stays in memory but saving, export and AI require sign-in", async ({ page }) => {
  const saves = await mockApi(page);
  await seedServerOutfit(page);
  await openStudio(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Bộ phối khách đang mở");
  await expect.poll(async () => (await readStudioView(page))?.title).toBe("Bộ phối khách đang mở");

  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const authDialog = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await expect(authDialog).toBeVisible();
  await expect.poll(async () => (await readStudioView(page))?.title).toBe("Bộ phối khách đang mở");
  expect(saves).toHaveLength(0);
  await authDialog.getByRole("button", { name: "Đóng cửa sổ đăng nhập" }).click();

  await clickStudioAction(page, "Xuất ảnh");
  await expect(authDialog).toBeVisible();
  await authDialog.getByRole("button", { name: "Đóng cửa sổ đăng nhập" }).click();

  await clickStudioAction(page, "Thử đồ AI");
  await expect(authDialog).toBeVisible();
  expect(saves).toHaveLength(0);
  await expect.poll(async () => (await readStudioView(page))?.title).toBe("Bộ phối khách đang mở");
});

test("signing in saves the current guest work without a device-draft choice", async ({ page }) => {
  const saves = await mockApi(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await closeStudioPanels(page);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bộ phối khách đang mở");
  const account = { id: "guest-handoff", email: "handoff@example.invalid", display_name: "Guest Handoff", roles: ["user"] };
  await page.route("**/api/auth/login", route => route.fulfill({ json: { access_token: "guest-handoff-token", token_type: "bearer", user: account } }));
  await page.route("**/api/auth/me", route => route.fulfill({ json: account }));
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const auth = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await auth.getByLabel("Địa chỉ Email").fill(account.email);
  await auth.getByRole("textbox", { name: "Mật khẩu" }).fill("a-valid-test-password");
  await auth.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(auth).toHaveCount(0);
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].body).toMatchObject({ title: "Bộ phối khách đang mở", snapshot: { items: [TEST_GARMENT] } });
  await expect(page.getByRole("dialog", { name: "Chọn bản phối cần tiếp tục" })).toHaveCount(0);
});

test("published stylist image uses transparent Studio endpoint and can zoom beyond old limit", async ({ page }) => {
  await mockApi(page, { real_image_url: "/fixture.png", catalog_media_id: "public-media" });
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  await openStudio(page);
  const image = page.locator("#content-outerwear image");
  await expect(image).toHaveAttribute("href", /\/api\/catalog\/items\/.*\/studio-image$/);
  await image.click();
  await openStudioProperties(page);
  for (let index = 0; index < 5; index++) await page.getByRole("button", { name: "Phóng to trang phục" }).click();
  await expect.poll(async () => (await readStudioView(page))?.snapshot.items.find((item: any) => item.slot === "outerwear")?.transform?.scale).toBeGreaterThan(2.5);
  await clickStudioAction(page, "Xuất ảnh");
  await page.getByRole("button", { name: "Vuông (Instagram / Post)" }).click();
  await expect(page.getByAltText("Bản phối xuất")).toBeVisible();
});

test("Studio can retry a failed garment image without losing the outfit", async ({ page }) => {
  await mockApi(page, { real_image_url: "/fixture.png", catalog_media_id: "public-media" });
  await seedServerOutfit(page);
  let requests = 0;
  const garmentPng = readFileSync("public/images/heritage/thumb_nguyen_ao_tac.png");
  await page.route("**/api/catalog/items/*/studio-image*", route => {
    requests += 1;
    return new URL(route.request().url()).searchParams.has("retry")
      ? route.fulfill({ status: 200, contentType: "image/png", body: garmentPng, headers: { "Access-Control-Allow-Origin": "*" } })
      : route.fulfill({ status: 503, body: "Unavailable" });
  });
  await openStudio(page);
  await expect(page.getByRole("button", { name: "Thử lại ảnh" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại ảnh" }).click();
  await expect.poll(() => requests).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Thử lại ảnh" })).toHaveCount(0);
  await expect(page.locator("#content-outerwear image")).toHaveAttribute("href", /studio-image\?retry=1$/);
  await expect.poll(async () => (await readStudioView(page))?.snapshot.items.length).toBeGreaterThan(0);
});

test("manual try-on gives an exportable board and a prompt without a person photo", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeEnabled();
  await expect(dialog.getByLabel("Prompt thử đồ thủ công")).toContainText("No person photo is supplied");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Tải ảnh bản phối" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vietstylist-ban-phoi.png");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Sao chép prompt" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Attach the exported outfit board as Image 1");
});

test("disabled Gemini leaves manual export available without uploading", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  let uploads = 0;
  await page.route("http://127.0.0.1:4100/api/v3/generation/status", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ enabled: false }) }));
  await page.route("http://127.0.0.1:4100/api/media/uploads", route => { uploads++; return route.fulfill({ status: 500 }); });
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByText(/Gemini chưa được bật/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Tải ảnh bản phối" })).toBeEnabled();
  expect(uploads).toBe(0);
});

test("manual prompt changes when a person photo is selected", () => {
  const snapshot = INITIAL_DOCUMENT.snapshot;
  const withoutPerson = buildManualTryOnPrompt("Bộ phối", snapshot, [], false);
  const withPerson = buildManualTryOnPrompt("Bộ phối", snapshot, [], true);
  expect(withoutPerson).toContain("Choose one adult wearer");
  expect(withPerson).toContain("Preserve their identity");
  expect(withPerson).not.toContain("Choose one adult wearer");
  for (const prompt of [withoutPerson, withPerson]) {
    expect(prompt).toContain("authoritative visual reference for both the garments and the background");
    expect(prompt).toContain("Do not replace, redesign or simplify the scene");
    expect(prompt).toContain("If the reference has a plain background, keep it plain");
    expect(prompt).toContain("Keep Image 1's aspect ratio and camera framing");
    expect(prompt).not.toContain("Ignore the board's background");
  }
  expect(withPerson).toContain("Use Image 2 only for the wearer, never for the background");
});

test("stale outfit items stay in the draft and block Gemini before upload", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, STALE_DOCUMENT, "generation-user");
  await page.route("http://127.0.0.1:4100/api/catalog/items*", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify([{
      id: "current-outerwear", slot: "outerwear", name: "Áo ngoài hiện có", is_published: true,
      gender: "unisex", metadata: {}, variants: [{ id: "current-variant", hex_color: "#123456", is_default: true }],
    }]),
  }));
  let uploads = 0;
  await page.route("http://127.0.0.1:4100/api/media/uploads", route => {
    uploads += 1;
    return route.fulfill({ status: 500 });
  });
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByText("6 món trong bản phối không còn trong danh mục đã xuất bản.", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Tải ảnh bản phối" })).toBeDisabled();
  expect(uploads).toBe(0);
  await dialog.getByRole("button", { name: "Đóng và chọn món thay thế" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert").getByText(/Một số món trong bản phối không còn được xuất bản/)).toBeVisible();
  await expect.poll(() => culturalRequests.get(page)?.items.map((item: any) => item.item_id)).toEqual(STALE_DOCUMENT.snapshot.items.map((item: any) => item.itemId));
});

test("Gemini result is visible without a person photo", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  await page.route("**/test-upload/result-board", route => route.fulfill({ status: 200, body: "ok" }));
  await page.route("http://127.0.0.1:4100/api/media/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/media/uploads") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        media_id: "result-board", upload_url: "http://127.0.0.1:3100/test-upload/result-board", method: "PUT", storage_type: "r2",
      }) });
    }
    if (path === "/api/media/generated-image/access") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ access_url: "/fixture.png" }) });
    }
    return route.fulfill({ contentType: "application/json", body: "{}" });
  });
  await page.route("http://127.0.0.1:4100/api/v3/generation/jobs", route => route.fulfill({
    status: 202, json: { job_id: "job-1", status: "completed", result: { status: "completed", result_media_id: "generated-image" }, error: null },
  }));

  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
  await expect(dialog.getByRole("status")).toContainText("Ảnh đã tạo và tải thành công. Ảnh kết quả được lưu trong Tài khoản → Ảnh AI.");
  await expect(dialog.getByRole("img", { name: "Kết quả thử đồ Gemini" })).toBeVisible();
});

for (const withPerson of [false, true]) {
  test(`try-on uploads the outfit board ${withPerson ? "and the person" : "without requiring a person"}`, async ({ page }) => {
    await mockApi(page);
    await loginForGeneration(page);
    await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
    const uploads: Array<{ filename: string; bytes: Buffer }> = [];
    let synthesis: any;
    await page.route("**/test-upload/*", route => {
      uploads.push({ filename: route.request().url(), bytes: route.request().postDataBuffer() || Buffer.alloc(0) });
      return route.fulfill({ status: 200, body: "ok" });
    });
    await page.route("http://127.0.0.1:4100/api/v3/legacy-mappings*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
      dataset_version: "dev", ruleset_version: "dev", reproducible: false,
      mappings: withPerson ? [{ legacy_table: "items", legacy_id: TEST_GARMENT.itemId,
        canonical_entity_id: "garment_ngu_than", renderable_item_id: "renderable-1",
        render_variants: { [TEST_GARMENT.variantId]: "variant-1" } }] : [],
    }) }));
    await page.route("http://127.0.0.1:4100/api/media/**", route => {
      if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/media/uploads") {
        const id = route.request().postDataJSON().filename === "studio-outfit.png" ? "media-1" : "media-2";
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ media_id: id, upload_url: `http://127.0.0.1:3100/test-upload/${id}`, method: "PUT", storage_type: "r2" }) });
      }
      return route.fulfill({ contentType: "application/json", body: "{}" });
    });
    await page.route("http://127.0.0.1:4100/api/v3/generation/jobs", route => {
      synthesis = route.request().postDataJSON();
      const error = withPerson
        ? { code: "GENERATION_BUSY", message: "Gemini đang quá tải." }
        : { code: "GENERATION_RATE_LIMITED", message: "Gemini đã chạm hạn mức. Kiểm tra quota của API key." };
      return route.fulfill({ status: 202, json: { job_id: "failed-job", status: "failed", result: null, error } });
    });
    await openStudio(page);
    await clickStudioAction(page, "Thử đồ AI");
    const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
    if (withPerson) {
      await dialog.locator("div.overflow-y-auto").evaluate(element => { element.scrollTop = element.scrollHeight; });
      const chooserPromise = page.waitForEvent("filechooser");
      await dialog.getByText("Tùy chọn: tải ảnh nhân vật").click();
      await (await chooserPromise).setFiles("public/images/heritage/thumb_nguyen_ao_tac.jpg");
      await expect(dialog.getByText("thumb_nguyen_ao_tac.jpg")).toBeVisible();
      const preview = dialog.getByRole("img", { name: "Ảnh người mẫu đã chọn" });
      await expect(preview).toBeInViewport();
      await expect(preview).toHaveJSProperty("complete", true);
      expect(await preview.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await dialog.getByRole("button", { name: "Bỏ ảnh nhân vật để AI tự chọn người mặc" }).click();
      await expect(preview).toHaveCount(0);
      const sameFileChooser = page.waitForEvent("filechooser");
      await dialog.getByText("Tùy chọn: tải ảnh nhân vật").click();
      await (await sameFileChooser).setFiles("public/images/heritage/thumb_nguyen_ao_tac.jpg");
      await expect(dialog.getByText("thumb_nguyen_ao_tac.jpg")).toBeVisible();
      await expect(dialog.getByRole("img", { name: "Ảnh người mẫu đã chọn" })).toBeInViewport();
    }
    await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
    await expect(dialog.getByRole("alert")).toContainText(withPerson ? "Gemini đang quá tải" : "Kiểm tra quota");
    await expect(dialog.getByRole("alert")).toBeInViewport();
    expect(uploads).toHaveLength(withPerson ? 2 : 1);
    expect(uploads.find(upload => upload.filename.endsWith("/media-1"))?.bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(synthesis.outfit_image_id).toBe("media-1");
    expect(synthesis.user_image_id).toBe(withPerson ? "media-2" : null);
    expect(synthesis.legacy_item_ids).toEqual([TEST_GARMENT.itemId]);
    expect(synthesis.outfit.selections).toHaveLength(withPerson ? 1 : 0);
    if (!withPerson) await expect(dialog.getByText(/chưa có thẩm định V3/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tải ảnh bản phối" })).toBeEnabled();
  });
}

for (const failUpload of [false, true]) {
  test(`parallel try-on uploads preserve image roles and ${failUpload ? "show errors without submitting a partial job" : "long poll the same job until its image is ready"}`, async ({ page }) => {
    await mockApi(page);
    await loginForGeneration(page);
    await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
    const uploaded = new Map<string, Buffer>();
    const completed = new Set<string>();
    let releaseUploads!: () => void;
    let releasePoll!: () => void;
    const uploadGate = new Promise<void>(resolve => { releaseUploads = resolve; });
    const pollGate = new Promise<void>(resolve => { releasePoll = resolve; });
    let submissions = 0, polls = 0;
    await page.route("**/api/media/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/uploads")) {
        const id = route.request().postDataJSON().filename === "studio-outfit.png" ? "board" : "person";
        return route.fulfill({ json: { media_id: id, upload_url: `http://127.0.0.1:3100/parallel-upload/${id}`, method: "PUT", storage_type: "r2" } });
      }
      if (path.endsWith("/complete")) completed.add(path.split("/").at(-2)!);
      return route.fulfill({ json: path.endsWith("/access") ? { access_url: "/fixture.png" } : {} });
    });
    await page.route("**/parallel-upload/*", async route => {
      const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
      uploaded.set(id, route.request().postDataBuffer()!);
      await uploadGate;
      if (failUpload && id === "person") return; // Sibling must be aborted on board failure.
      await route.fulfill({ status: failUpload ? 503 : 200, body: "upload response" });
    });
    await page.route("**/api/v3/generation/jobs**", async route => {
      if (route.request().method() === "POST") {
        submissions++;
        expect(completed).toEqual(new Set(["board", "person"]));
        expect(route.request().postDataJSON()).toMatchObject({ outfit_image_id: "board", user_image_id: "person" });
        return route.fulfill({ status: 202, json: { job_id: "parallel-job", status: "running", result: null, error: null } });
      }
      polls++;
      expect(new URL(route.request().url()).searchParams.get("wait_seconds")).toBe("10");
      await pollGate;
      return route.fulfill({ json: { job_id: "parallel-job", status: "completed", result: { result_media_id: "parallel-result" }, error: null } });
    });
    await openStudio(page);
    await clickStudioAction(page, "Thử đồ AI");
    const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
    const personPath = "public/images/heritage/thumb_nguyen_ao_tac.jpg";
    await dialog.locator("input[type=file]").setInputFiles(personPath);
    await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
    try {
      // Neither upload completes until both have arrived: serial code fails here.
      await expect.poll(() => uploaded.size).toBe(2);
      expect(submissions).toBe(0);
      expect(uploaded.get("person")).toEqual(readFileSync(personPath));
      expect(uploaded.get("board")?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      releaseUploads();
      if (failUpload) {
        await expect(dialog.getByRole("alert")).toContainText("Không thể tải ảnh lên kho media");
        await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeEnabled();
        expect(submissions).toBe(0);
      } else {
        await expect.poll(() => polls).toBe(1);
        expect(submissions).toBe(1);
        releasePoll();
        await expect(dialog.getByAltText("Kết quả thử đồ Gemini")).toBeVisible();
        expect(submissions).toBe(1);
        expect(polls).toBe(1);
      }
    } finally {
      releaseUploads();
      releasePoll();
    }
  });
}

test("authenticated focus keeps the chosen photo and same-file selection works", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  let calls = 0;
  await page.route("**/api/auth/me", async route => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ json: { id: "generation-user", email: "generation@example.invalid", roles: ["user"] } });
  });
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.locator("input[type=file]").setInputFiles("public/images/heritage/thumb_nguyen_ao_tac.jpg");
  const preview = dialog.getByAltText("Ảnh người mẫu đã chọn");
  await expect(preview).toBeVisible();
  const oldSrc = await preview.getAttribute("src");
  const count = calls;
  const refreshed = page.waitForResponse("**/api/auth/me");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  expect(calls).toBeGreaterThan(count);
  await expect(preview).toHaveAttribute("src", oldSrc!);
  await expect(dialog.getByLabel("Prompt thử đồ thủ công")).toContainText("Preserve their identity");
});

async function mockGenerationMedia(page: Page, brokenResult = false) {
  const state = { uploads: 0, access: 0, brokenResult };
  await page.route("**/test-upload/*", route => route.fulfill({ body: "ok" }));
  await page.route("**/api/media/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/media/uploads") {
      const id = `media-${++state.uploads}`;
      return route.fulfill({ json: { media_id: id, upload_url: `http://127.0.0.1:3100/test-upload/${id}`, method: "PUT", storage_type: "r2" } });
    }
    if (path.endsWith("/access")) { state.access++; return route.fulfill({ json: { access_url: state.brokenResult ? "/fixture-missing.png" : "/fixture.png" } }); }
    return route.fulfill({ json: {} });
  });
  return state;
}

test("generation locks immediately, resumes when reopened on the same page and retries only the broken result image", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  const media = await mockGenerationMedia(page, true);
  let mappings = 0, submissions = 0, completed = false;
  let releaseMapping!: () => void;
  const mappingGate = new Promise<void>(resolve => { releaseMapping = resolve; });
  await page.route("**/api/v3/legacy-mappings*", async route => {
    mappings++;
    await mappingGate;
    await route.fulfill({ json: { dataset_version: "dev", mappings: [] } });
  });
  await page.route("**/api/v3/generation/jobs**", route => {
    if (route.request().method() === "POST") submissions++;
    else if (!completed) return route.fulfill({ status: 503, json: { error: { code: "POLL_UNAVAILABLE", message: "Không đọc được trạng thái job." } } });
    return route.fulfill({ status: route.request().method() === "POST" ? 202 : 200, json: {
      job_id: "recoverable-job", status: completed ? "completed" : "running",
      result: completed ? { status: "completed", result_media_id: "result-image" } : null, error: null,
    } });
  });
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  let dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.locator("input[type=file]").setInputFiles("public/images/heritage/thumb_nguyen_ao_tac.jpg");
  const generate = dialog.getByRole("button", { name: "Tạo ảnh thử đồ" });
  await generate.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => mappings).toBe(1);
  await expect(generate).toBeDisabled();
  await expect(dialog.locator("input[type=file]")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Bỏ ảnh nhân vật để AI tự chọn người mặc" })).toBeDisabled();
  releaseMapping();
  await expect.poll(() => submissions).toBe(1);
  await expect(dialog.getByRole("alert")).toContainText("Không đọc được trạng thái job");
  expect(media.uploads).toBe(2);
  await dialog.getByRole("button", { name: "Đóng thử đồ AI" }).click();
  completed = true;
  await clickStudioAction(page, "Thử đồ AI");
  dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByRole("alert")).toContainText("Ảnh đã được tạo nhưng chưa tải được");
  await expect(dialog.getByText("Ảnh đã tạo và tải thành công. Ảnh kết quả được lưu trong Tài khoản → Ảnh AI.")).toHaveCount(0);
  media.brokenResult = false;
  await dialog.getByRole("button", { name: "Tải lại ảnh kết quả" }).click();
  await expect(dialog.getByText("Ảnh đã tạo và tải thành công. Ảnh kết quả được lưu trong Tài khoản → Ảnh AI.")).toBeVisible();
  await expect(dialog.getByAltText("Kết quả thử đồ Gemini")).toHaveJSProperty("naturalWidth", 16);
  expect(submissions).toBe(1);
  expect(media.uploads).toBe(2);
});

test("catalog outage offers retry without claiming clothes were deleted", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  await page.route("**/api/catalog/items?*", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Catalog outage" } } }));
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByRole("alert")).toContainText("Chưa tải được kho trang phục");
  await expect(dialog.getByText(/không còn ở kho/)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeDisabled();
  await page.unroute("**/api/catalog/items?*");
  await dialog.getByRole("button", { name: "Tải lại kho trang phục" }).click();
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeEnabled();
});

test("missing garment image blocks generation before any upload", async ({ page }) => {
  await mockApi(page, { real_image_url: "/fixture-missing.png" });
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  const media = await mockGenerationMedia(page);
  await openStudio(page);
  await expect(page.getByRole("button", { name: "Thử lại ảnh" })).toBeVisible();
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Một số ảnh trang phục chưa tải được");
  expect(media.uploads).toBe(0);
});

test("upload has a deadline and exposes an actionable error", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, TEST_DOCUMENT, "generation-user");
  const media = await mockGenerationMedia(page);
  let started = false;
  await page.route("**/test-upload/*", () => { started = true; });
  await page.clock.install();
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
  await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(61000);
  await expect(dialog.getByRole("alert")).toContainText("Tải ảnh vượt quá 60 giây");
  await expect(dialog.getByRole("button", { name: "Tạo ảnh thử đồ" })).toBeEnabled();
  expect(media.uploads).toBe(1);
});

test("failed save connection preserves the draft and can be retried", async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  await page.route("**/api/catalog/occasions", route => route.fulfill({ json: [] }));
  await page.route("**/api/outfits", route => route.abort("failed"));
  await openStudio(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Bộ phối cần giữ khi mất mạng");
  const before = await readStudioView(page);
  await openStudioPanel(page, "Bối cảnh");
  await expect(page.getByText("Chưa có lựa chọn hoàn cảnh. Bạn vẫn có thể lưu bộ phối.")).toBeVisible();
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText(/Không kết nối được máy chủ để xác nhận lưu/)).toBeVisible();
  await expect(page.getByText("Failed to fetch", { exact: true })).toHaveCount(0);
  expect((await readStudioView(page)).snapshot).toEqual(before.snapshot);
  await expect(title).toHaveValue("Bộ phối cần giữ khi mất mạng");
  await page.unroute("**/api/outfits");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.")).toBeVisible();
  expect(saves).toHaveLength(1);
  await openStudioDocument(page);
  await title.fill("Tên sau khi thử lại");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves.map(save => save.method)).toEqual(["POST", "PUT"]);
  expect(saves[1].body.revision).toBe(1);
});

test("publishing opens the exact saved outfit when its local receipt cannot be written", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);

  const submitted: any[] = [];
  await page.route("**/api/outfits", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    submitted.push(route.request().postDataJSON());
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key || name.startsWith(`${key}:`)) throw new DOMException("Blocked receipt write", "QuotaExceededError");
        return original.call(this, name, value);
      };
    }, DRAFT_KEY);
    const body = submitted[submitted.length - 1];
    await route.fulfill({ json: { id: "published-source", owner_id: "generation-user", revision: 1, current_version_id: "published-version", title: body.title, current_snapshot: body.snapshot } });
  });
  await page.route(/\/lookbook\?dang=1&outfit=/, route => route.fulfill({ contentType: "text/html", body: "<main>Lookbook composition destination</main>" }));
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await closeStudioPanels(page);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bộ phối vừa lưu để đăng");
  await clickStudioAction(page, "Đăng lên Lookbook");
  await expect(page).toHaveURL(/\/lookbook\?dang=1&outfit=published-source$/);
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ title: "Bộ phối vừa lưu để đăng", snapshot: TEST_DOCUMENT.snapshot });
});

test("R08 records Canvas frame intervals and zero outfit storage writes for one gesture", async ({ page }) => {
  await mockApi(page);
  await seedServerOutfit(page);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (name, value) {
      if (name === key || name.startsWith(`${key}:`)) writes += 1;
      return original.call(this, name, value);
    };
    Object.defineProperty(window, "__r08DraftWrites", { get: () => writes });
    Object.defineProperty(window, "__resetR08DraftWrites", { value: () => { writes = 0; } });
  }, DRAFT_KEY);
  await openStudio(page);
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
  expect(writes).toBe(0);
  expect(frames.frames).toBeGreaterThan(30);
});

test("background fade previews, commits one undo step and never writes outfit storage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: "Tết", exact: true }).click();
  await expect(page.getByTestId("board-background")).toHaveAttribute("data-background-status", "ready");
  const before = await readStudioView(page);
  await page.evaluate(key => {
    let writes = 0;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name.startsWith(key)) writes++;
      return setItem.call(this, name, value);
    };
    Object.defineProperty(window, "__fadeDraftWrites", { get: () => writes });
  }, DRAFT_KEY);
  const slider = page.getByRole("slider", { name: "Độ mờ ảnh nền" });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2, { steps: 40 });
  expect((await readStudioView(page)).snapshot.items).toEqual(before.snapshot.items);
  expect(await page.evaluate(() => (window as any).__fadeDraftWrites)).toBe(0);
  expect(await page.getByTestId("board-background").evaluate(node => node.style.getPropertyValue("--studio-background-fade"))).not.toBe("");
  await page.mouse.up();
  const value = Number(await slider.inputValue());
  expect(value).toBeGreaterThan(50);
  await expect.poll(async () => (await readStudioView(page)).snapshot.backgroundFade).toBe(value);
  expect(await page.evaluate(() => (window as any).__fadeDraftWrites)).toBe(0);
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await openStudioPanel(page, "Bối cảnh");
  await expect(slider).toHaveValue(String(before.snapshot.backgroundFade || 0));
  await closeStudioPanels(page);
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await openStudioPanel(page, "Bối cảnh");
  await expect(slider).toHaveValue(String(value));
  expect((await readStudioView(page)).snapshot.items).toEqual(before.snapshot.items);
});

test("manual copy includes the selected variant and mapping failure retains the same outfit data for Gemini", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  const document = structuredClone(TEST_DOCUMENT);
  document.snapshot.occasionId = "tet";
  document.snapshot.styleMode = "remix";
  document.snapshot.overlapDirection = "left_over_right";
  document.snapshot.items[0].colorHex = "#123456";
  await seedServerOutfit(page, document, "generation-user");
  await page.route("**/api/catalog/items?*", route => route.fulfill({ json: [{
    id: TEST_GARMENT.itemId, slot: TEST_GARMENT.slot, name: "Áo thử nghiệm", gender: "unisex", era: "Nguyễn",
    is_published: true, metadata: { real_image_url: "/fixture.png" },
    variants: [{ id: TEST_GARMENT.variantId, item_id: TEST_GARMENT.itemId, is_default: true,
      hex_color: "#8B1E24", secondary_hex: "#F0E0D0", color_name: "Đỏ gốc", material: "Cotton",
      pattern_description: "Vải trơn", thickness_level: "medium", price_tier: "standard" }],
  }] }));
  await page.route("**/api/v3/legacy-mappings*", route => route.fulfill({ status: 503, json: {
    error: { code: "MAPPING_UNAVAILABLE", message: "Mapping tạm thời không khả dụng", status_code: 503 },
  } }));
  const media = await mockGenerationMedia(page);
  let submitted: any;
  await page.route("**/api/v3/generation/jobs", route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: { job_id: "prompt-job", status: "failed", result: null,
      error: { code: "TEST_STOP", message: "Đã nhận dữ liệu prompt" } } });
  });
  await openStudio(page);
  const before = await readStudioView(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  const prompt = await dialog.getByLabel("Prompt thử đồ thủ công").inputValue();
  expect(prompt).toContain('"primary_color_hex": "#123456"');
  expect(prompt).toContain('"secondary_color_hex": "#F0E0D0"');
  expect(prompt).toContain('"material": "Cotton"');
  expect(prompt).toContain('"pattern": "Vải trơn"');
  expect(prompt).toContain('"occasion": "Tết"');
  expect(prompt).toContain("Remix styling");
  expect(prompt).toContain("Tả nhậm");
  expect(prompt).not.toContain("Đỏ gốc");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Sao chép prompt" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe(prompt);
  await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Đã nhận dữ liệu prompt");
  expect(media.uploads).toBe(1);
  expect(submitted.outfit.selections).toEqual([]);
  expect(submitted.outfit.context).toMatchObject({ occasionId: "tet", styleMode: "remix", overlapDirection: "left_over_right" });
  expect(submitted.outfit.metadata.legacy_bridge.source).toEqual(document.snapshot);
  expect(submitted.outfit.metadata.legacy_bridge.linked).toEqual([]);
  expect(submitted.legacy_item_ids).toEqual([TEST_GARMENT.itemId]);
  expect(await readStudioView(page)).toEqual(before);
});

test("mapping failure never bypasses explicit cultural settings or uploads a partial outfit", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  const document = structuredClone(TEST_DOCUMENT);
  document.snapshot.culturalSettings = { dataset_version: "dev", ruleset_version: null, context: {
    period_ids: ["period_test"], region_ids: [], place_ids: [], community_ids: [], occasion_ids: [], social_context_ids: [],
  } };
  await seedServerOutfit(page, document, "generation-user");
  await page.route("**/api/v3/legacy-mappings*", route => route.fulfill({ status: 503, json: {
    error: { code: "MAPPING_UNAVAILABLE", message: "Mapping tạm thời không khả dụng", status_code: 503 },
  } }));
  const media = await mockGenerationMedia(page);
  let submissions = 0;
  await page.route("**/api/v3/generation/jobs", route => { submissions++; return route.fulfill({ status: 500 }); });
  await openStudio(page);
  const before = await readStudioView(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.getByRole("button", { name: "Tạo ảnh thử đồ" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Mapping tạm thời không khả dụng" })).toBeVisible();
  expect(media.uploads).toBe(0);
  expect(submissions).toBe(0);
  expect(await readStudioView(page)).toEqual(before);
});

test("manual prompt resolves the saved cultural context once and retries incomplete labels before copying", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  const document = structuredClone(TEST_DOCUMENT);
  document.snapshot.occasionId = "tet";
  document.snapshot.culturalSettings = { dataset_version: "ds_prompt", ruleset_version: "rules_prompt", context: {
    period_ids: ["period_nguyen"], region_ids: ["region_hue"], place_ids: [], community_ids: [],
    occasion_ids: ["occasion_ceremony"], social_context_ids: [],
  } };
  await seedServerOutfit(page, document, "generation-user");
  let requests = 0;
  let received: any;
  await page.route("**/api/v3/generation/grounding", route => {
    requests++;
    received = route.request().postDataJSON();
    return route.fulfill({ json: { grounding: { outfit_description: { context: requests === 1
      ? { period: ["Thời Nguyễn"] }
      : { period: ["Thời Nguyễn"], region: ["Huế"], occasion: ["Nghi lễ"] },
    } } } });
  });
  await openStudio(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await expect(dialog.getByText(/Chưa đọc đủ bối cảnh văn hóa/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sao chép prompt" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Tải lại bối cảnh prompt" }).click();
  await expect(dialog.getByRole("button", { name: "Sao chép prompt" })).toBeEnabled();
  const prompt = await dialog.getByLabel("Prompt thử đồ thủ công").inputValue();
  expect(prompt).toContain("Thời Nguyễn");
  expect(prompt).toContain("Huế");
  expect(prompt).toContain("Nghi lễ");
  expect(prompt).not.toContain('"occasion": "Tết"');
  expect(prompt).not.toContain("period_nguyen");
  expect(received).toMatchObject({ schema_version: "2.0", dataset_version: "ds_prompt", ruleset_version: "rules_prompt",
    selections: [], context: document.snapshot.culturalSettings.context });
  await dialog.getByRole("button", { name: "Đóng thử đồ AI" }).click();
  await clickStudioAction(page, "Thử đồ AI");
  await expect(dialog.getByRole("button", { name: "Sao chép prompt" })).toBeEnabled();
  expect(requests).toBe(2);
});

test("worker PNG pixels match the native fallback without changing the draft", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    let workers = 0;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers++; }
    };
    Object.defineProperty(window, "__pngWorkers", { get: () => workers });
  });
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  const before = await readStudioView(page);
  const exportPixels = async () => {
    await clickStudioAction(page, "Xuất ảnh");
    await page.getByRole("button", { name: "Story / Reels (9:16)" }).click();
    const preview = page.getByAltText("Bản phối xuất");
    await expect(preview).toBeVisible();
    const result = await preview.evaluate(async node => {
      const image = node as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      const hash = await crypto.subtle.digest("SHA-256", context.getImageData(0, 0, canvas.width, canvas.height).data);
      return { width: canvas.width, height: canvas.height, pixels: [...new Uint8Array(hash)] };
    });
    await page.getByRole("button", { name: "Đóng xuất ảnh", exact: true }).click();
    return result;
  };
  const worker = await exportPixels();
  expect(worker).toMatchObject({ width: 1400, height: 2488 });
  expect(await page.evaluate(() => (window as any).__pngWorkers)).toBeGreaterThan(0);
  await page.evaluate(() => { Object.defineProperty(window, "Worker", { value: undefined, configurable: true }); });
  expect(await exportPixels()).toEqual(worker);
  expect((await readStudioView(page)).snapshot).toEqual(before.snapshot);
  await expect(page.locator("#item-transform-outerwear")).not.toHaveAttribute("data-gesture-preview");
});

test("home loads the shared catalog only after navigating to a consumer and coalesces concurrent consumers", async ({ page }) => {
  await mockApi(page);
  const requests: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (["/api/catalog/items", "/api/catalog/garment-types", "/api/catalog/occasions", "/api/catalog/avatars"].includes(path)) {
      requests.push(path);
      expect(request.headers()["content-type"]).toBeUndefined();
    }
  });
  await page.goto("/");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(page.locator("footer")).toBeVisible();
  expect(requests).toEqual([]);
  await page.locator('a[href="/studio"]').first().click();
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByText("Trang phục 0", { exact: true })).toBeVisible();
  expect(requests.sort()).toEqual(["/api/catalog/avatars", "/api/catalog/garment-types", "/api/catalog/items", "/api/catalog/occasions"]);
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

test("an empty server outfit loads presentation settings and supports undo", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await seedServerOutfit(page, { title: "Bộ phối rỗng", snapshot: { ...INITIAL_DOCUMENT.snapshot, items: [], lockedSlots: ["headwear"], backgroundTheme: "dopaper", neutralBackgroundTheme: "dopaper", aspectRatio: "1:1" } }, "generation-user");
  await openStudio(page);
  await openStudioPanel(page, "Văn hóa");
  await expect(page.getByText("Dùng cho kiểm tra văn hóa và gợi ý AI. Ảnh trên bảng phối không đổi hướng; ứng dụng không lật ảnh để giả lập cài vạt.")).toBeVisible();
  await closeStudioPanels(page);
  await page.getByRole("button", { name: "Remix · kết hợp hiện đại" }).click();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.getByRole("button", { name: "Truyền thống", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bộ phối rỗng");
  expect((await readStudioView(page)).snapshot).toMatchObject({ items: [], backgroundTheme: "dopaper", aspectRatio: "1:1" });
});

test("save in flight preserves newer edits and prevents duplicate submissions", async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let posts = 0;
  await page.route("**/api/outfits", async route => {
    posts++;
    const body = route.request().postDataJSON();
    await held;
    await route.fulfill({ json: { id: "saved-1", revision: 1, title: body.title, current_snapshot: body.snapshot } });
  });
  await openStudio(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Version submitted");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => posts).toBe(1);
  await expect(page.getByRole("button", { name: "Đang lưu bộ phối", exact: true })).toBeDisabled();
  await openStudioDocument(page);
  await title.fill("Newer unsaved edits");
  release();
  await expect(page.getByText("Đã lưu phiên bản vừa gửi vào Tủ đồ; thay đổi mới trên trang chưa được lưu.")).toBeVisible();
  await expect(title).toHaveValue("Newer unsaved edits");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({ method: "PUT", body: { title: "Newer unsaved edits", revision: 1 } });
  expect(posts).toBe(1);
});

test("revision conflict preserves edits until explicit server selection and updates its revision", async ({ page }) => {
  const saves = await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Saved version");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  const attempted: any[] = [];
  await page.route("**/api/outfits/saved-1", async route => {
    if (route.request().method() === "PUT") {
      attempted.push(route.request().postDataJSON());
      if (attempted.length === 1) return route.fulfill({ status: 409, json: { error: { code: "REVISION_CONFLICT", message: "conflict" } } });
      return route.fulfill({ json: { id: "saved-1", revision: 3, title: attempted.at(-1).title, current_snapshot: attempted.at(-1).snapshot } });
    }
    return route.fulfill({ json: { id: "saved-1", revision: 2, title: "Other tab version", current_snapshot: INITIAL_DOCUMENT.snapshot } });
  });
  await openStudioDocument(page);
  await title.fill("My losing edit");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toContainText("Thay đổi của bạn vẫn đang mở trên trang");
  expect(attempted[0].revision).toBe(1);
  await expect(title).toHaveValue("My losing edit");
  await page.getByRole("button", { name: "Tải bản máy chủ" }).click();
  await expect(title).toHaveValue("Other tab version");
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(title).toHaveValue("My losing edit");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => attempted.length).toBe(2);
  expect(attempted[1]).toMatchObject({ revision: 2, title: "My losing edit" });
});

test("an expired session cannot load a private server outfit", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "expired-test-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "account-a", email: "a@example.invalid", displayName: "A", roles: ["user"] }));
  });
  let reads = 0;
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { error: { code: "TOKEN_EXPIRED", message: "expired" } } }));
  await page.route("**/api/outfits/private-outfit", route => { reads++; return route.fulfill({ status: 401, json: { error: { code: "UNAUTHENTICATED", message: "Đăng nhập để mở bộ phối đã lưu." } } }); });
  await page.goto("/studio?loadOutfit=private-outfit");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.getByText(/Đăng nhập để mở bộ phối đã lưu/)).toBeVisible();
  expect(reads).toBeGreaterThan(0);
});

test("opening an outfit link after a page navigation loads only the server version", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  let reads = 0;
  await page.route("**/api/outfits/from-link", route => {
    reads++;
    return route.fulfill({ json: { id: "from-link", revision: 3, title: "Bộ phối từ liên kết", current_snapshot: INITIAL_DOCUMENT.snapshot } });
  });
  await openStudio(page);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Chỉnh sửa chưa lưu");
  await page.goto("/studio?loadOutfit=from-link");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bộ phối từ liên kết");
  expect(reads).toBe(1);
  await expect(page.getByRole("button", { name: "Mở bộ phối từ liên kết" })).toHaveCount(0);
});

test("leaving Studio retains session work without device storage and reload clears it", async ({ page }) => {
  test.setTimeout(60000);
  await mockApi(page);
  await loginForGeneration(page);
  await openStudio(page);
  await chooseStudioGarment(page, "Trang phục 0");
  await closeStudioPanels(page);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bộ phối chưa lưu");
  await page.locator('header a[href="/lookbook"]').click();
  await expect(page).toHaveURL(/\/lookbook$/, { timeout: 30000 });
  await page.locator('header a[href="/studio"]').click();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bộ phối chưa lưu");
  await expect(page.locator('#flatlay-outfit-board [id^="item-transform-"]')).toHaveCount(1);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.getByText("Bảng phối đang trống", { exact: true })).toBeVisible();
  await openStudioDocument(page);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem bản khôi phục trên thiết bị" })).toHaveCount(0);
});

test("an outfit load finishing after a new edit cannot overwrite it", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
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
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Thao tác mới trong lúc tải");
  const completed = page.waitForResponse("**/api/outfits/slow-link");
  release(); await completed;
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Thao tác mới trong lúc tải");
  await expect(page.getByRole("button", { name: "Mở bộ phối từ liên kết" })).toBeVisible();
});

test("an account switch in another tab hides old work and ignores its pending save", async ({ page, context }) => {
  await mockApi(page);
  const account = (id: string) => ({ id, email: `${id}@example.invalid`, displayName: id, roles: ["user"] });
  await openStudio(page);
  await page.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-a");
  }, account("account-a"));
  await page.route("**/api/auth/me", route => {
    const id = route.request().headers().authorization === "Bearer token-b" ? "account-b" : "account-a";
    return route.fulfill({ json: { ...account(id), display_name: id } });
  });
  await page.reload();
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Riêng tư tài khoản A");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let saves = 0;
  const requests: Array<{ body: any; authorization?: string }> = [];
  await page.route("**/api/outfits", async route => {
    const body = route.request().postDataJSON(); saves++;
    requests.push({ body, authorization: route.request().headers().authorization });
    await held;
    await route.fulfill({ json: { id: saves === 1 ? "owned-by-a" : "owned-by-b", revision: 1, title: body.title, current_snapshot: body.snapshot } });
  });
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  const otherTab = await context.newPage();
  await otherTab.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  await otherTab.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, account("account-b"));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("viet_stylist_user") || "null")?.id)).toBe("account-b");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  const completed = page.waitForResponse("**/api/outfits");
  release(); await completed;
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản nháp B");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => saves).toBe(2);
  expect(requests[1]).toMatchObject({ authorization: "Bearer token-b", body: { title: "Bản nháp B" } });
  expect(requests[1].body.revision).toBeUndefined();
  expect(await page.evaluate(key => Object.keys(localStorage).filter(name => name === key || name.startsWith(`${key}:`)), DRAFT_KEY)).toEqual([]);
  await otherTab.close();
});


test("styling questionnaire sends chosen needs and previews Gemini results before applying", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  let calls = 0;
  await page.route("**/api/recommendations/ai", async route => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ occasion_id: "ky_yeu", style_mode: "remix", gender: "male", locked_items: [] });
    for (const choice of ["Kỷ yếu", "Remix, kết hợp hiện đại", "Đối tượng: Nam", "Ngũ thân", "Trầm ấm · nâu, đỏ sẫm", "Thoải mái, dễ vận động"]) expect(body.prompt).toContain(choice);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ source: "gemini", model: "test", outfits: [{
      title: "Gợi ý đã kiểm thử", explanation: "Chọn từ danh mục", items: [{ slot: TEST_GARMENT.slot, item_id: TEST_GARMENT.itemId, variant_id: TEST_GARMENT.variantId, hex_color: TEST_GARMENT.colorHex, item_name: "Trang phục 0" }],
    }] }) });
  });
  await openStudio(page);
  await openStudioPanel(page, "Trợ lý AI");
  const panel = page.getByRole("region", { name: "Gợi ý phối đồ", exact: true });
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Gợi ý", exact: true })).toBeDisabled();
  await panel.getByLabel("Dịp sử dụng", { exact: true }).selectOption("ky_yeu");
  await panel.getByLabel("Phong cách phối đồ", { exact: true }).selectOption("remix");
  await panel.getByLabel("Đối tượng phối đồ", { exact: true }).selectOption("male");
  await panel.getByLabel("Loại trang phục ưu tiên", { exact: true }).selectOption("ngu_than");
  await panel.getByLabel("Tông màu mong muốn", { exact: true }).selectOption({ label: "Trầm ấm" });
  await expect(panel.getByText("nâu, đỏ sẫm", { exact: true })).toBeVisible();
  await panel.getByLabel("Ưu tiên khi phối đồ", { exact: true }).selectOption({ label: "Thoải mái, dễ vận động" });
  await panel.getByRole("button", { name: "Gợi ý", exact: true }).click();
  await expect(panel.getByText("Nguồn: Gemini")).toBeVisible();
  expect((await readStudioView(page))?.snapshot.items || []).toHaveLength(0);
  expect((await readStudioView(page)).snapshot.backgroundTheme).toBe("white");
  await panel.getByRole("button", { name: "Áp dụng gợi ý" }).click();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect.poll(() => culturalRequests.get(page)?.items[0]?.item_id).toBe(TEST_GARMENT.itemId);
  expect((await readStudioView(page)).snapshot).toMatchObject({ occasionId: "ky_yeu", styleMode: "remix", backgroundTheme: "occasion" });
  expect(calls).toBe(1);
});

test("styling questionnaire waits for a slow Gemini fallback and keeps the draft unchanged", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await loginForGeneration(page);
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/recommendations/ai", async route => {
    requested = true;
    await pending;
    await route.fulfill({ json: { source: "gemini", model: "gemini-3.5-flash", outfits: [{
      title: "Gợi ý từ model dự phòng", explanation: "Chọn từ danh mục", items: [{ slot: TEST_GARMENT.slot, item_id: TEST_GARMENT.itemId, item_name: "Trang phục 0" }],
    }] } });
  });
  await openStudio(page);
  await openStudioPanel(page, "Trợ lý AI");
  const panel = page.getByRole("region", { name: "Gợi ý phối đồ", exact: true });
  await panel.getByLabel("Dịp sử dụng", { exact: true }).selectOption("ky_yeu");
  await expect(page.locator("header").getByRole("button", { name: /Generation/ })).toBeVisible();
  const before = await readStudioView(page);
  try {
    await panel.getByRole("button", { name: "Gợi ý", exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await page.clock.fastForward(90000);
    await expect(panel.getByRole("status")).toContainText("Đang lấy gợi ý từ Gemini");
    await expect(panel.getByRole("alert")).toHaveCount(0);
    release();
    await expect(panel.getByText("Nguồn: Gemini")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Áp dụng gợi ý" })).toBeVisible();
    expect(await readStudioView(page)).toEqual(before);
  } finally {
    release();
  }
});

test("styling questionnaire preserves choices on retry and clears an outdated preview", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  let calls = 0;
  const requests: unknown[] = [];
  await page.route("**/api/recommendations/ai", route => {
    calls++;
    requests.push(route.request().postDataJSON());
    return calls === 1
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Máy chủ đang bận" } }) })
      : route.fulfill({ contentType: "application/json", body: JSON.stringify({ source: "cultural_rule_engine", model: "fallback", notice: "Gemini đã chạm hạn mức. Đây là gợi ý dự phòng.", outfits: [{ title: "Tham khảo", explanation: "Chọn theo vị trí", items: [{ slot: TEST_GARMENT.slot, item_id: TEST_GARMENT.itemId, item_name: "Trang phục 0" }] }] }) });
  });
  await openStudio(page);
  await openStudioPanel(page, "Trợ lý AI");
  const panel = page.getByRole("region", { name: "Gợi ý phối đồ", exact: true });
  await panel.getByLabel("Dịp sử dụng", { exact: true }).selectOption("tet");
  await panel.getByRole("button", { name: "Gợi ý", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Máy chủ đang bận");
  await panel.getByRole("button", { name: "Gợi ý", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("status")).toContainText("Gemini đã chạm hạn mức");
  await expect(panel.getByText("Nguồn: bộ quy tắc")).toBeVisible();
  expect(requests[0]).toEqual(requests[1]);
  await panel.getByLabel("Tông màu mong muốn", { exact: true }).selectOption({ label: "Tươi sáng" });
  await expect(panel.getByText("đỏ, vàng", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Áp dụng gợi ý" })).toHaveCount(0);
  await expect(panel.getByRole("status")).toHaveCount(0);
});

test("styling questionnaire fits phone widths and keeps selections separate from the draft", async ({ page }) => {
  await mockApi(page);
  await loginForGeneration(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await openStudio(page);
  await openStudioPanel(page, "Trợ lý AI");
  const panel = page.getByRole("region", { name: "Gợi ý phối đồ", exact: true });
  // Verify the account using the phone navigation before changing questionnaire controls.
  await page.getByRole("button", { name: "Mở menu điều hướng", exact: true }).click();
  const mobileNav = page.getByRole("navigation", { name: "Điều hướng trên điện thoại", exact: true });
  await expect(mobileNav.getByText("Generation", { exact: true })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "Thoát", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đóng menu điều hướng", exact: true }).click();
  await expect(mobileNav).toHaveCount(0);
  const before = await readStudioView(page);
  await panel.getByLabel("Dịp sử dụng", { exact: true }).selectOption("ky_yeu");
  await panel.getByLabel("Phong cách phối đồ", { exact: true }).selectOption("remix");
  expect(await readStudioView(page)).toEqual(before);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openStudioPanel(page, "Trợ lý AI");
    const invalid = await panel.locator("select, button").evaluateAll(elements => elements.filter(element => {
      const box = element.getBoundingClientRect();
      return box.width < 44 || box.height < 44 || box.left < 0 || box.right > innerWidth;
    }).map(element => element.getAttribute("aria-label") || element.textContent));
    expect(invalid, `Controls at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  await openStudioPanel(page, "Trợ lý AI");
  await panel.getByRole("button", { name: "Gợi ý", exact: true }).scrollIntoViewIfNeeded();
  await expect(panel.getByRole("button", { name: "Gợi ý", exact: true })).toBeInViewport();
  await panel.screenshot({ path: test.info().outputPath("styling-questionnaire-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel.screenshot({ path: test.info().outputPath("styling-questionnaire-desktop.png") });
});

for (const handoff of [
  { button: "Xuất ảnh", dialog: "Xuất ảnh bản phối", close: "Đóng xuất ảnh", escape: false },
  { button: "Thử đồ AI", dialog: "Thử đồ bằng Gemini", close: "Đóng thử đồ AI", escape: true },
] as const) {
  test(`login handoff preserves page scrolling after ${handoff.button}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await seedServerOutfit(page);
    const account = { id: "scroll-handoff-user", email: "scroll-handoff@example.invalid", display_name: "Kiểm tra cuộn", roles: ["user"] };
    await page.route("http://127.0.0.1:4100/api/auth/login", route => route.fulfill({
      json: { access_token: "scroll-handoff-token", token_type: "bearer", user: account },
    }));
    await page.route("http://127.0.0.1:4100/api/auth/me", route => route.fulfill({ json: account }));
    await page.route("https://accounts.google.com/**", route => route.abort());
    await page.route("http://127.0.0.1:4100/api/heritage/articles", route => route.fulfill({
      json: Array.from({ length: 18 }, (_, index) => ({
        id: `scroll-story-${index}`, slug: `scroll-story-${index}`, title: `Câu chuyện kiểm thử ${index + 1}`,
        short_summary: "Tư liệu giả lập để kiểm tra cuộn trang sau khi đóng cửa sổ.",
        status: "published", version: 1, author_role: "stylist", category: "Nghiên cứu Cổ phong", era: "Triều Nguyễn",
      })),
    }));
    await openStudio(page);
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    const originalItems = (await readStudioView(page)).snapshot.items;
    await clickStudioAction(page, handoff.button);
    const auth = page.locator('dialog[aria-label="Đăng nhập hoặc tạo tài khoản"]');
    await expect(auth).toBeVisible();
    await auth.locator('input[type="email"]').fill(account.email);
    await auth.locator('input[type="password"]').fill("test-password");
    await auth.locator('form button[type="submit"]').click();
    const nextDialog = page.locator(`dialog[aria-label="${handoff.dialog}"]`);
    await expect(nextDialog).toBeVisible();
    // Auth closes after its success message; the next dialog must retain the lock.
    await expect(auth).toHaveCount(0);
    await expect(nextDialog).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    if (handoff.escape) await page.keyboard.press("Escape");
    else await nextDialog.getByRole("button", { name: handoff.close, exact: true }).click();
    await expect(nextDialog).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await openStudioPanel(page, "Bối cảnh");
    const tools = page.locator("#studio-panel-context .studio-panel-body");
    await tools.evaluate(element => { element.scrollTop = 0; });
    const toolsBox = (await tools.boundingBox())!;
    await page.mouse.move(toolsBox.x + 100, toolsBox.y + 100);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => tools.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect((await readStudioView(page)).snapshot.items).toEqual(originalItems);
    // Client navigation retains the same body, so it also catches a leaked lock.
    await page.locator("header").getByRole("link", { name: "Chuyện Cổ phục", exact: true }).click();
    await expect(page).toHaveURL(/\/chuyen-co-phuc$/, { timeout: 30000 });
    await expect(page.getByRole("article")).toHaveCount(18);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.mouse.move(20, 350);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}
