import { expect, test, type Page } from "@playwright/test";
import { openStudioPanel, openStudioProperties, closeStudioPanels, chooseStudioGarment, clickStudioAction } from "./helpers/studio-ui";

// These workflows include navigation and PNG generation after a cold dev compile.
test.setTimeout(60_000);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64");
const items = [
  { id: "technical-garment-long-id", name: "Áo ngũ thân màu xanh dành cho buổi chụp ảnh di sản", slot: "outerwear", metadata: { catalog_media_id: "fixture-media" } },
  { id: "technical-old-headwear", name: "Mũ cũ", slot: "headwear", metadata: {} },
  { id: "technical-new-headwear", name: "Khăn đóng", slot: "headwear", metadata: {} },
].map(item => ({ ...item, gender: "unisex", garment_type_id: "ngu_than", is_published: true,
  variants: [{ id: `variant-${item.id}`, item_id: item.id, color_name: "Xanh", hex_color: "#1A365D", material: "", is_default: true }],
  default_layer: { id: `layer-${item.id}`, item_id: item.id, slot: item.slot, z_index: 1, layer_type: "svg", svg_content: '<circle cx="50" cy="50" r="10" />' },
}));
const book = { id: "lb-details", title: "Bộ sưu tập kiểm chứng", description: "", visibility: "unlisted", created_at: "2026-10-04T00:00:00Z", entries: [] };
const fail = { error: { code: "SERVICE_UNAVAILABLE", message: "Máy chủ đang bận, hãy thử lại." } };

async function fixtures(page: Page, signedIn = true) {
  if (signedIn) await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-ui-detail-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "ui-details", email: "ui@example.invalid", displayName: "Kiểm chứng", roles: ["user"] }));
  });
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    const send = (json: unknown) => route.fulfill({ json });
    if (path === "/api/auth/me") return send({ id: "ui-details", email: "ui@example.invalid", display_name: "Kiểm chứng", roles: ["user"] });
    if (path === "/api/outfits/page") return send({ items: [], next_cursor: null });
    if (path.endsWith("/studio-image")) return route.fulfill({ contentType: "image/png", body: png, headers: { "Access-Control-Allow-Origin": "*" } });
    if (path === "/api/catalog/items") return send(items);
    if (path.startsWith("/api/catalog/items/")) return send(items.find(item => item.id === path.split("/").pop()));
    if (path === "/api/catalog/garment-types") return send([{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]);
    if (path === "/api/catalog/occasions") return send([{ id: "ky_yeu", name: "Kỷ yếu", season: "all" }]);
    if (path === "/api/catalog/avatars") return send([{ id: "avatar_nam_chuan", name: "Nam", dimensions: { width: 800, height: 1200 } }]);
    if (path === "/api/v3/generation/status") return send({ enabled: true });
    if (path === "/api/v3/legacy-mappings") return send({ dataset_version: "dev", ruleset_version: "dev", mappings: [] });
    if (path === "/api/color-analysis") return send({ dominant_color: "#1A365D", accent_colors: ["#ffffff"], palette_type: "neutral_balance", contrast_rating: "good", contrast_ratio: 5, suggested_variants: [], aesthetic_comment: "" });
    if (path === "/api/cultural-check") return send({ is_culturally_sound: true, strict_count: 0, warning_count: 0, info_count: 0, warnings: [] });
    if (path === "/api/weather") return send({ location: { name: "Hà Nội" }, weather: { temperature_c: 26, humidity_percent: 60, wind_speed_kmh: 8, weather_condition: "Trời trong", is_rainy: false }, recommendation: { suggested_accessories: ["Khăn đóng"], reason: "", layer_advice: "Mặc thoải mái", fabric_advice: "Vải thoáng" }, cached: false });
    if (path === "/api/outfits/compare") return send({ summary_message: "Hai phương án đã được đối chiếu.", style_changed: true, diffs: [
      { slot: "outerwear", item_a_id: items[0].id, item_a_name: items[0].id, item_b_id: items[0].id, is_changed: false },
      { slot: "headwear", item_a_id: "removed-technical-item", item_a_name: "removed-technical-item", is_changed: true },
    ] });
    if (path === "/api/lookbook-posts") return send({ items: [], next_cursor: null });
    if (path === "/api/lookbooks") return send([book]);
    if (path === `/api/lookbooks/${book.id}`) return send(book);
    if (path.endsWith("/share")) return send({ share_token: "long-token-".repeat(20), scope: "view_only" });
    return send([]);
  });
}

async function visibleOutfit(page: Page) {
  const title = await page.getByLabel("Tên bản phối", { exact: true }).inputValue();
  const garments = await page.locator('#flatlay-outfit-board [id^="content-"]').evaluateAll(elements => elements.map(element => ({ id: element.id, content: element.innerHTML })));
  const style = await page.getByRole("group", { name: "Phong cách bản phối", exact: true }).locator('[aria-pressed="true"]').getAttribute("aria-label");
  return { title, garments, style };
}
async function chooseGarment(page: Page) {
  await page.goto("/studio");
  await chooseStudioGarment(page, items[0].name);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByRole("button", { name: "Áo ngoài", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openStudioPanel(page, "Bối cảnh");
  await expect(page.getByRole("button", { name: "9:16", exact: true })).toHaveAttribute("aria-pressed", "true");
  await closeStudioPanels(page);
}
async function focusStaysInside(page: Page) {
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog[open]"))).toBe(true);
  }
}

test("export resets after editing and stays scrollable in landscape with keyboard focus contained", async ({ page }) => {
  await fixtures(page);
  await chooseGarment(page);
  const trigger = page.getByLabel("Thao tác bộ phối", { exact: true });
  await clickStudioAction(page, "Xuất ảnh");
  let dialog = page.getByRole("dialog", { name: "Xuất ảnh bản phối", exact: true });
  await expect(dialog.getByRole("button", { name: /Story \/ Reels/ })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: /Vuông/ })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "Nhấn để tạo ảnh xem trước" }).click();
  await expect(dialog.getByAltText("Bản phối xuất")).toBeVisible();
  const before = await dialog.getByAltText("Bản phối xuất").getAttribute("src");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: "Giấy Dó", exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await clickStudioAction(page, "Xuất ảnh");
  dialog = page.getByRole("dialog", { name: "Xuất ảnh bản phối", exact: true });
  await expect(dialog.getByAltText("Bản phối xuất")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Tải ảnh PNG" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Đóng xuất ảnh" })).toBeInViewport();
  await dialog.getByRole("button", { name: "Nhấn để tạo ảnh xem trước" }).click();
  await expect(dialog.getByAltText("Bản phối xuất")).toBeVisible();
  expect((await dialog.getByAltText("Bản phối xuất").getAttribute("src")) !== before).toBe(true);
  const download = dialog.getByRole("button", { name: "Tải ảnh PNG" });
  await expect(download).toBeInViewport();
  await expect(download).toBeEnabled();
  const box = (await download.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  await focusStaysInside(page);
  await test.info().attach("modal-geometry", { contentType: "application/json", body: JSON.stringify(await dialog.evaluate(element => {
    const bounds = (node: Element) => { const r = node.getBoundingClientRect(); const css = getComputedStyle(node); return { x: r.x, y: r.y, width: r.width, height: r.height, boxSizing: css.boxSizing, padding: css.padding }; };
    return { dialog: bounds(element), wrapper: bounds(element.firstElementChild!), panel: bounds(element.firstElementChild!.firstElementChild!) };
  })) });
  await page.screenshot({ path: test.info().outputPath("export-landscape.png") });
});

test("AI model select and other modal controls cannot undo the Studio draft behind them", async ({ page }) => {
  await fixtures(page);
  await chooseGarment(page);
  await page.getByRole("button", { name: "Cách tân hiện đại", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cách tân hiện đại", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Truyền thống", exact: true })).toHaveAttribute("aria-pressed", "false");
  const before = await visibleOutfit(page);
  await clickStudioAction(page, "Thử đồ AI");
  const dialog = page.getByRole("dialog", { name: "Thử đồ bằng Gemini" });
  await dialog.locator("select").focus();
  await page.keyboard.press("Control+z");
  expect(await visibleOutfit(page)).toEqual(before);
  await focusStaysInside(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await visibleOutfit(page)).toEqual(before);
});

test("a late PNG from a closed export cannot populate the reopened dialog", async ({ page }) => {
  await fixtures(page);
  await chooseGarment(page);
  let release: (() => void) | undefined;
  let pending = false;
  await page.route("**/studio-image", async route => {
    if (route.request().resourceType() !== "fetch" || pending) return route.fallback();
    pending = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fallback();
  });
  try {
    await clickStudioAction(page, "Xuất ảnh");
    const dialog = page.getByRole("dialog", { name: "Xuất ảnh bản phối", exact: true });
    await dialog.getByRole("button", { name: "Nhấn để tạo ảnh xem trước" }).click();
    await expect.poll(() => pending).toBe(true);
    await dialog.getByRole("button", { name: "Đóng xuất ảnh" }).click();
    await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: "Giấy Dó", exact: true }).click();
    await clickStudioAction(page, "Xuất ảnh");
    release!();
    await expect(page.locator("#selection-overlay-outerwear")).toHaveCount(1);
    await expect(dialog.getByAltText("Bản phối xuất")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Tải ảnh PNG" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Nhấn để tạo ảnh xem trước" }).click();
    await expect(dialog.getByAltText("Bản phối xuất")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tải ảnh PNG" })).toBeEnabled();
  } finally { release?.(); }
});

test("weather errors remove stale city data and retry restores the selected city's result", async ({ page }) => {
  await fixtures(page);
  let hueAttempts = 0;
  await page.route("**/api/weather?*", async route => {
    if (!route.request().url().includes("hue")) return route.fallback();
    hueAttempts++;
    if (hueAttempts === 1) return route.fulfill({ status: 503, json: fail });
    return route.fulfill({ json: { location: { name: "Huế" }, weather: { temperature_c: 19, humidity_percent: 75, wind_speed_kmh: 5, weather_condition: "Mưa nhẹ", is_rainy: true }, recommendation: { suggested_accessories: [], reason: "", layer_advice: "Mang áo ấm", fabric_advice: "Vải dày" }, cached: false } });
  });
  await page.goto("/studio");
  await openStudioPanel(page, "Bối cảnh");
  const weather = page.getByRole("region", { name: "Thời tiết và bối cảnh" });
  await expect(weather.getByText("26°C")).toBeVisible();
  await weather.getByLabel("Thành phố xem thời tiết").selectOption("hue");
  await expect(weather.getByRole("alert")).toBeVisible();
  await expect(weather.getByText("26°C")).toHaveCount(0);
  await expect(weather.getByRole("button", { name: "Thêm phụ kiện phù hợp" })).toHaveCount(0);
  await weather.getByRole("button", { name: "Thử lại thời tiết" }).click();
  await expect(weather.getByText("19°C")).toBeVisible();
  await expect(weather.getByLabel("Thành phố xem thời tiết")).toHaveValue("hue");
});

test("color-analysis failure is recoverable and dominant/accent dots have their intended size", async ({ page }) => {
  await fixtures(page);
  let attempts = 0;
  await page.route("**/api/color-analysis", route => ++attempts === 1
    ? route.fulfill({ status: 503, json: fail }) : route.fallback());
  await chooseGarment(page);
  await openStudioProperties(page);
  await expect(page.getByTitle("Xanh", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Xanh", { exact: true })).toHaveCSS("background-color", "rgb(26, 54, 93)");
  await openStudioPanel(page, "Màu sắc");
  await expect(page.getByRole("region", { name: "Hài hòa Màu sắc" }).getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại phân tích màu" }).click();
  for (const color of ["#1A365D", "#ffffff"]) {
    const dot = page.getByTitle(color, { exact: true }).last();
    await expect(dot).toBeVisible();
    const bounds = (await dot.boundingBox())!;
    expect(bounds.width).toBe(18);
    expect(bounds.height).toBe(18);
  }
});

test("compare translates long names, retries errors, and permits repinning/unpinning A on a narrow screen", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 812 });
  let attempts = 0;
  await page.route("**/api/outfits/compare", route => ++attempts === 1 ? route.fulfill({ status: 503, json: fail }) : route.fallback());
  await chooseGarment(page);
  await clickStudioAction(page, "Lưu bản A để so sánh");
  await page.getByRole("button", { name: "Cách tân hiện đại", exact: true }).click();
  await clickStudioAction(page, "So sánh hai bản");
  const dialog = page.getByRole("dialog", { name: "So sánh hai phương án phối đồ" });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Thử lại so sánh" }).click();
  await expect(dialog.getByRole("region", { name: "Bảng đối chiếu chi tiết" })).toContainText(items[0].name);
  await expect(dialog).toContainText("Áo ngoài");
  await expect(dialog).toContainText("Cách tân hiện đại");
  await expect(dialog).not.toContainText(items[0].id);
  await expect(dialog).not.toContainText("removed-technical-item");
  await expect(dialog).toContainText("Trang phục không còn trong danh mục");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await focusStaysInside(page);
  await page.screenshot({ path: test.info().outputPath("compare-320.png") });
  await dialog.getByRole("button", { name: "Đóng so sánh" }).click();
  await clickStudioAction(page, "Ghim lại bản A");
  await clickStudioAction(page, "So sánh hai bản");
  await expect(dialog.getByRole("region", { name: "Phương án A" })).toContainText("Cách tân hiện đại");
  await page.keyboard.press("Escape");
  await clickStudioAction(page, "Bỏ ghim bản A");
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Lưu bản A để so sánh", exact: true }).filter({ visible: true })).toBeVisible();
});

test("slot locks are keyboard buttons and weather can add headwear without replacing locked/current pieces silently", async ({ page }) => {
  await fixtures(page);
  await chooseGarment(page);
  await openStudioPanel(page, "Bối cảnh");
  const weather = page.getByRole("region", { name: "Thời tiết và bối cảnh" });
  const add = weather.getByRole("button", { name: "Thêm phụ kiện phù hợp" });
  await openStudioPanel(page, "Chọn trang phục");
  const lock = page.getByRole("button", { name: "Khóa vị trí khăn vấn", exact: true });
  await lock.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Mở khóa vị trí khăn vấn", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openStudioPanel(page, "Bối cảnh");
  await add.click();
  await expect(page.locator("#content-outerwear")).toHaveCount(1);
  await expect(page.locator("#content-headwear")).toHaveCount(0);
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByRole("button", { name: "Mở khóa vị trí khăn vấn", exact: true }).click();
  await page.getByRole("button", { name: "Khăn vấn", exact: true }).click();
  await page.getByText("Mũ cũ", { exact: true }).click();
  await openStudioProperties(page);
  await expect(page.getByLabel("Trang phục đang điều chỉnh").locator('option[value="headwear"]')).toContainText("Mũ cũ");
  const original = await visibleOutfit(page);
  const outerwear = await page.locator("#content-outerwear").innerHTML();
  await openStudioPanel(page, "Bối cảnh");
  await add.click();
  const confirm = page.getByRole("alertdialog", { name: "Thay phụ kiện theo thời tiết?" });
  await confirm.getByRole("button", { name: "Giữ bộ phối" }).click();
  expect(await visibleOutfit(page)).toEqual(original);
  await openStudioPanel(page, "Bối cảnh");
  await add.click();
  await confirm.getByRole("button", { name: "Thay phụ kiện", exact: true }).click();
  await openStudioProperties(page);
  await expect(page.getByLabel("Trang phục đang điều chỉnh").locator('option[value="headwear"]')).toContainText("Khăn đóng");
  expect(await page.locator("#content-outerwear").innerHTML()).toBe(outerwear);
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(() => visibleOutfit(page)).toEqual(original);
});

test("Lookbook labels, whitespace validation and server errors stay accessible inside its modal", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 844, height: 390 });
  let attempts = 0;
  await page.route("**/api/lookbooks", route => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, json: fail }) : route.fulfill({ json: book });
  });
  await page.goto("/lookbook?tab=collections");
  const trigger = page.getByRole("button", { name: "Tạo Lookbook mới" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Tạo bộ sưu tập Lookbook mới" });
  await dialog.getByLabel("Tên Lookbook *").fill("   ");
  await dialog.getByLabel("Mô tả chủ đề").fill("Kiểm chứng form");
  await dialog.getByLabel("Quyền riêng tư").selectOption("private");
  await dialog.getByRole("button", { name: "Xác nhận tạo" }).click();
  await expect(dialog.getByRole("alert")).toContainText("khoảng trắng");
  await expect(dialog.getByLabel("Tên Lookbook *")).toBeFocused();
  expect(attempts).toBe(0);
  await dialog.getByLabel("Tên Lookbook *").fill("Lookbook mới");
  await dialog.getByRole("button", { name: "Xác nhận tạo" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Không tạo được Lookbook");
  await expect(dialog.getByRole("alert")).toBeInViewport();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await focusStaysInside(page);
  await page.screenshot({ path: test.info().outputPath("lookbook-error-landscape.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("Tên Lookbook *")).toHaveValue("Lookbook mới");
  await dialog.getByRole("button", { name: "Xác nhận tạo" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Đã tạo Lookbook trong tài khoản của bạn.")).toBeVisible();
  expect(attempts).toBe(2);
});

for (const path of ["/lookbook", `/lookbook/${book.id}`]) {
  test(`long share links keep the copy button inside the mobile viewport on ${path}`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(path === "/lookbook" ? "/lookbook?tab=collections" : path);
    await page.getByRole("button", { name: `Tạo liên kết chia sẻ ${path === "/lookbook" ? book.title : "Lookbook"}`, exact: true }).click();
    const copy = page.getByRole("button", { name: "Sao chép" });
    await expect(copy).toBeVisible();
    const bounds = (await copy.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("share-320.png") });
  });
}

test("library uses catalog-media images and detail omits fabricated era, authenticity and empty material", async ({ page }) => {
  await fixtures(page, false);
  await page.goto("/thu-vien");
  const image = page.getByRole("img", { name: items[0].name, exact: true });
  await expect(image).toHaveJSProperty("naturalWidth", 16);
  await page.getByRole("link", { name: `Xem chi tiết ${items[0].name}`, exact: true }).click();
  await page.waitForURL(`**/trang-phuc/${items[0].id}?*`);
  await expect(page.getByRole("heading", { name: items[0].name, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Chưa có thông tin niên đại", { exact: true })).toBeVisible();
  await expect(page.getByText("Ảnh trang phục", { exact: true })).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/Ảnh thật|Ảnh hiện vật thực tế|Thời Nguyễn|\(\s*\)|outerwear|unisex/);
});

test("account and Lookbook show catalog names, occasion labels and modern-fusion style consistently", async ({ page }) => {
  await fixtures(page);
  const snapshot = { styleMode: "modern_fusion", items: [{ slot: "outerwear", itemId: items[0].id, assetVersion: 1, colorHex: "#1A365D" }] };
  await page.route("**/api/outfits/page?*", route => route.fulfill({ json: { items: [{ id: "outfit-details", title: "Bản phối cách tân", occasion_id: "ky_yeu", style_mode: "modern_fusion", revision: 1, updated_at: "2026-10-04T00:00:00Z", current_version_id: "version-details", current_snapshot: snapshot }], next_cursor: null } }));
  await page.route(`**/api/lookbooks/${book.id}`, route => route.fulfill({ json: { ...book, entries: [{ id: "entry-details", outfit_id: "outfit-details", outfit_title: "Bản phối cách tân", version_number: 1, snapshot }] } }));
  await page.goto("/tai-khoan");
  await expect(page.getByText("Cách tân hiện đại", { exact: true })).toBeVisible();
  await expect(page.getByText("Kỷ yếu", { exact: true })).toBeVisible();
  await page.getByTestId("saved-outfit-card").locator("summary").click();
  await expect(page.getByText(items[0].name, { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(items[0].id);
  await expect(page.locator("main")).not.toContainText("modern_fusion");
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(`/lookbook/${book.id}`);
  await expect(page.getByText("Áo ngoài:", { exact: true })).toBeVisible();
  await expect(page.getByText(items[0].name, { exact: true })).toBeVisible();
  await expect(page.getByText("Cách tân hiện đại", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed Google loading exposes a live error and the Google button actually retries SDK loading", async ({ page }) => {
  await fixtures(page, false);
  let attempts = 0;
  await page.route("https://accounts.google.com/gsi/client*", route => {
    attempts++;
    return attempts === 1 ? route.abort("failed") : route.fulfill({ contentType: "application/javascript", body: 'window.google = { accounts: { id: { initialize() {}, renderButton(container) { const button = document.createElement("button"); button.textContent = "Google đã tải"; container.appendChild(button); } } } };' });
  });
  await page.goto("/lookbook");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await expect(dialog.getByRole("alert")).toContainText("Chưa tải được đăng nhập Google");
  const initialAttempts = attempts;
  await dialog.getByRole("button", { name: /Google/ }).click();
  await expect.poll(() => attempts).toBeGreaterThan(initialAttempts);
  await expect(dialog.getByRole("button", { name: "Google đã tải" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

for (const initialWidth of [1280, 375]) {
  test(`Google button keeps its frame during delayed loading, reopening and resizing from ${initialWidth}px`, async ({ page }) => {
    await fixtures(page, false);
    await page.setViewportSize({ width: initialWidth, height: 812 });
    let releaseSdk!: () => void;
    const sdkReady = new Promise<void>(resolve => { releaseSdk = resolve; });
    await page.route("https://accounts.google.com/gsi/client*", async route => {
      await sdkReady;
      await route.fulfill({ contentType: "application/javascript", body: `
        window.google = { accounts: { id: {
          initialize() {},
          renderButton(container, options) {
            const button = document.createElement("div");
            button.setAttribute("role", "button");
            button.tabIndex = 0;
            button.textContent = options.locale === "en" ? "Continue with Google" : "Nhãn Google theo ngôn ngữ trình duyệt";
            Object.assign(button.style, {
              width: options.width + "px", height: "40px", boxSizing: "border-box",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #747775", borderRadius: "4px", fontSize: "14px"
            });
            container.appendChild(button);
          }
        } } };
      ` });
    });
    await page.goto("/lookbook");
    const openDialog = async () => {
      if (page.viewportSize()!.width < 1024) {
        await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
      }
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
    };
    await openDialog();
    const dialog = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
    const frame = dialog.getByTestId("google-sign-in");
    const fallback = dialog.locator("button", { hasText: "Continue with Google" });
    await expect(fallback).toBeVisible();
    const before = await frame.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.width).toBeLessThanOrEqual(380);
    expect((await fallback.boundingBox())!.width).toBe(before!.width);
    const emailY = (await dialog.getByLabel("Địa chỉ Email").boundingBox())!.y;

    releaseSdk();
    const googleButton = dialog.getByRole("button", { name: "Continue with Google", exact: true });
    await expect(googleButton).toBeVisible();
    await expect(fallback).toHaveCount(0);
    expect(await frame.boundingBox()).toEqual(before);
    expect((await googleButton.boundingBox())!.width).toBe(Math.floor(before!.width));
    expect((await dialog.getByLabel("Địa chỉ Email").boundingBox())!.y).toBe(emailY);

    await dialog.getByRole("button", { name: "Đóng cửa sổ đăng nhập" }).click();
    await openDialog();
    await expect(googleButton).toBeVisible();
    expect((await frame.boundingBox())!.width).toBe(before!.width);
    expect((await googleButton.boundingBox())!.width).toBe(Math.floor(before!.width));

    for (const width of [320, 667, 1280]) {
      await page.setViewportSize({ width, height: width === 667 ? 375 : 812 });
      await expect.poll(async () => {
        const buttonBounds = await googleButton.boundingBox();
        const frameBounds = await frame.boundingBox();
        return buttonBounds && frameBounds ? buttonBounds.width - Math.floor(frameBounds.width) : null;
      }).toBe(0);
      await expect(googleButton).toBeVisible();
      const bounds = (await googleButton.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.width).toBeLessThanOrEqual(380);
    }
    await dialog.screenshot({ path: test.info().outputPath(`google-button-${initialWidth}.png`) });
  });
}
