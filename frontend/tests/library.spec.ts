import { expect, test, type Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";

const makeItem = (id: string, name: string, slot: string, gender = "male") => ({
  id, name, slot, gender, garment_type_id: "ngu_than", is_published: true,
  description: id === "coat" ? "Áo ngũ thân với sắc xanh rêu trầm và phom dáng rộng. Phần giới thiệu dài trong dữ liệu kiểm thử giúp kiểm tra cách xuống dòng trên màn hình nhỏ, đồng thời giữ nút phối đồ dễ nhìn." : undefined,
  metadata: { real_image_url: "/garments/item_ao_tac_xanh_reu_transparent.png" },
  variants: [{ id: `${id}-color`, color_name: "Xanh rêu", hex_color: "#426348", is_default: true }],
});
const items = [
  makeItem("coat", "Áo ngũ thân xanh rêu", "outerwear"),
  makeItem("shirt", "Áo giao lĩnh trắng ngà – thiết kế bổ sung với tên dài để kiểm tra bố cục", "undergarment", "female"),
  makeItem("trousers", "Quần đen", "bottom", "unisex"),
  makeItem("hat", "Mũ đen cánh ngang", "headwear"),
  makeItem("shoes", "Giày vải hoa văn", "footwear"),
];
items[1].variants.push({ id: "shirt-second-color", color_name: "Trắng ngà", hex_color: "#eee9df", is_default: false });
const results = (page: Page) => page.getByRole("region", { name: "Danh sách trang phục" });

async function mockCatalog(page: Page, mode: { empty?: boolean; fail?: boolean; wait?: Promise<void> } = {}) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/catalog/items") {
      if (mode.wait) await mode.wait;
      if (mode.fail) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable" } }) });
    }
    const data = path === "/api/catalog/items" ? (mode.empty ? [] : items)
      : path.startsWith("/api/catalog/items/") ? items.find(i => i.id === path.split("/").pop())
      : path === "/api/catalog/garment-types" ? [{ id: "ngu_than", name: "Ngũ thân với tên dòng trang phục dài để kiểm tra bộ lọc", slot_schema: [] }]
      : path === "/api/cultural-check" ? { is_culturally_sound: true, warnings: [] }
      : path === "/api/color-analysis" ? { dominant_color: "#426348", accent_colors: [], suggested_variants: [] }
      : path === "/api/weather" ? { location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false }
      : path.startsWith("/api/heritage/articles/") ? null : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data ?? null) });
  });
}

test("search handles Vietnamese accents, spaces, no matches and URL reload", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/thu-vien");
  await expect(results(page).locator("article")).toHaveCount(5);
  await expect(results(page).getByText("2 màu", { exact: true })).toHaveCount(1);
  await expect(results(page).getByText("1 màu", { exact: true })).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Tìm trang phục" });
  await search.fill("  AO   NGU THAN  ");
  await expect(results(page).locator("article")).toHaveCount(1);
  await page.reload();
  await expect(search).toHaveValue("  AO   NGU THAN  ");
  await expect(results(page).locator("article")).toHaveCount(1);
  await search.fill("mu den");
  await expect(results(page).getByRole("heading", { name: "Mũ đen cánh ngang" })).toBeVisible();
  await search.fill("all");
  await expect(search).toHaveValue("all");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang phục" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(results(page).locator("article")).toHaveCount(5);
  await expect(page).toHaveURL(/\/thu-vien$/);
});

test("filter sheet applies explicitly, supports keyboard escape, restores focus and resets", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/thu-vien");
  const trigger = page.getByRole("button", { name: /^Bộ lọc/ });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Lọc trang phục" });
  await sheet.getByLabel("Dành cho").selectOption("female");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(results(page).locator("article")).toHaveCount(5);
  await trigger.click();
  await expect(sheet.getByLabel("Dành cho")).toHaveValue("all");
  await sheet.getByLabel("Dành cho").selectOption("female");
  await sheet.getByLabel("Dòng trang phục").selectOption("ngu_than");
  await sheet.getByRole("button", { name: "Áp dụng" }).click();
  await expect(results(page).locator("article")).toHaveCount(1);
  await expect(page).toHaveURL(/gender=female/);
  await page.reload();
  await expect(results(page).locator("article")).toHaveCount(1);
  await trigger.click();
  await sheet.getByRole("button", { name: "Đặt lại" }).click();
  await sheet.getByRole("button", { name: "Áp dụng" }).click();
  await page.getByRole("group", { name: "Loại trang phục" }).getByRole("button", { name: "Phụ kiện" }).click();
  await expect(results(page).locator("article")).toHaveCount(2);
  await page.getByRole("group", { name: "Loại trang phục" }).getByRole("button", { name: "Quần / Váy" }).click();
  await expect(results(page).locator("article")).toHaveCount(1);
});

test("loading, request failure, retry and empty catalog have distinct states", async ({ page }) => {
  let release!: () => void;
  const mode = { fail: true, empty: false, wait: new Promise<void>(resolve => { release = resolve; }) };
  await mockCatalog(page, mode);
  await page.goto("/thu-vien");
  await expect(results(page)).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Đang tải trang phục…")).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Chưa tải được thư viện" })).toBeVisible();
  mode.fail = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(results(page).locator("article")).toHaveCount(5);
  mode.empty = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thư viện đang được cập nhật" })).toBeVisible();
});

test("broken images fall back without misleading historical labels", async ({ page }) => {
  await mockCatalog(page);
  await page.route("**/garments/*.png", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/thu-vien");
  await expect(results(page).getByText("Ảnh tạm thời chưa tải được").first()).toBeVisible();
  await expect(results(page).getByText("Ảnh hiện vật")).toHaveCount(0);
  await expect(results(page).getByText("Thời Nguyễn")).toHaveCount(0);
  await expect(results(page).getByText("Áo khoác · Nam", { exact: true })).toBeVisible();
});

test("detail return link and browser back retain search and scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockCatalog(page);
  await page.goto("/thu-vien?group=accessories");
  const target = results(page).getByRole("link", { name: "Xem chi tiết Giày vải hoa văn" });
  await target.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await target.click();
  await expect(page.getByRole("heading", { name: "Giày vải hoa văn", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Quay lại Thư viện Cổ phục" }).click();
  await expect(page).toHaveURL(/\/thu-vien\?group=accessories$/);
  await expect(results(page).locator("article")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await target.click();
  await expect(page).toHaveURL(/\/trang-phuc\/shoes\?/);
  await page.goBack();
  await expect(results(page).locator("article")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
});

test("library handoff starts a fresh outfit instead of restoring an old device draft", async ({ page }) => {
  await mockCatalog(page);
  const existing = [{ slot: "outerwear", itemId: "old-coat", colorHex: "#426348" }, { slot: "headwear", itemId: "hat", colorHex: "#426348" }];
  await page.addInitScript(({ key, document }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(document));
  }, { key: DRAFT_KEY, document: { ...INITIAL_DOCUMENT, snapshot: { ...INITIAL_DOCUMENT.snapshot, items: existing } } });
  await page.goto("/thu-vien");
  await results(page).getByRole("link", { name: "Phối đồ với Áo ngũ thân xanh rêu" }).click();
  await expect(page).toHaveURL(/\/studio\?itemId=coat$/);
  await expect(page.getByRole("button", { name: "Tiếp tục bản nháp", exact: true })).toHaveCount(0);
  await expect(page.locator("#content-outerwear")).toHaveCount(0);
  await expect(page.locator("#content-headwear")).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await page.getByRole("button", { name: "Thêm vào bản phối", exact: true }).click();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect(page.locator("#content-headwear")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Thay món đang có?" })).toHaveCount(0);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.locator("#content-outerwear")).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
});

test("cards and filter sheet fit supported widths with readable text and touch targets", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/thu-vien");
  await expect(results(page).locator("article")).toHaveCount(5);
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
    const dimensions = await page.locator("section button:visible, article a:visible").evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    for (const d of dimensions) { expect(d.width).toBeGreaterThanOrEqual(44); expect(d.height).toBeGreaterThanOrEqual(44); }
    expect(await page.getByRole("searchbox").evaluate(el => getComputedStyle(el).fontSize)).toBe("16px");
    const columns = await results(page).locator("article").first().evaluate(el => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(width < 640 ? 1 : width < 1024 ? 2 : 3);
    const clipped = await results(page).locator("article a, article h2, article img").evaluateAll(elements => elements.some(el => {
      const box = el.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth;
    }));
    expect(clipped, `clipped card content at ${width}`).toBe(false);
    if (width === 375 || width === 1440) await page.screenshot({ path: test.info().outputPath(`library-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: /^Bộ lọc/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Dòng trang phục").selectOption("ngu_than");
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const targets = await sheet.locator("button, select").evaluateAll(elements => elements.map(el => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })));
    for (const target of targets) { expect(target.w).toBeGreaterThanOrEqual(44); expect(target.h).toBeGreaterThanOrEqual(44); }
    if (width === 375) await page.screenshot({ path: test.info().outputPath("library-filter-mobile.png") });
    await page.keyboard.press("Tab");
    expect(await sheet.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
  }
});

test.describe("touch library", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test("mobile taps apply filters and the sheet stays operable in landscape", async ({ page }) => {
    await mockCatalog(page);
    await page.goto("/thu-vien");
    await page.getByRole("button", { name: /^Bộ lọc/ }).tap();
    const sheet = page.getByRole("dialog", { name: "Lọc trang phục" });
    await sheet.getByLabel("Dành cho").selectOption("female");
    await sheet.getByRole("button", { name: "Áp dụng" }).tap();
    await expect(results(page).locator("article")).toHaveCount(1);
    await page.setViewportSize({ width: 812, height: 375 });
    await page.getByRole("button", { name: /^Bộ lọc/ }).tap();
    await sheet.getByLabel("Dành cho").selectOption("all");
    await sheet.getByRole("button", { name: "Áp dụng" }).scrollIntoViewIfNeeded();
    await sheet.getByRole("button", { name: "Áp dụng" }).tap();
    await expect(sheet).not.toBeVisible();
    await expect(results(page).locator("article")).toHaveCount(5);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});
