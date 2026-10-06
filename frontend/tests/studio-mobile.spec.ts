import { expect, test, type Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";
import { openStudioProperties, closeStudioPanels } from "./helpers/studio-ui";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const items = [
  { slot: "outerwear", itemId: "mobile-coat", colorHex: "#123456" },
  { slot: "headwear", itemId: "mobile-hat", colorHex: "#123456" },
];
const draft = async (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), DRAFT_KEY);
const placement = async (page: Page) => (await draft(page)).snapshot.items[0].transform;

async function openStudio(page: Page) {
  await page.addInitScript(({ key, document }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(document));
  }, { key: DRAFT_KEY, document: { ...INITIAL_DOCUMENT, snapshot: { ...INITIAL_DOCUMENT.snapshot, items } } });
  await page.route("**/mobile-garment.png", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64") }));
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/catalog/items" ? items.map((item, i) => ({
      id: item.itemId, slot: item.slot, name: i ? "Khăn mobile" : "Áo mobile", garment_type_id: "ngu_than", is_published: true,
      metadata: { real_image_url: "/mobile-garment.png" },
      variants: [{ id: `${item.itemId}-color`, color_name: "Màu gốc", hex_color: item.colorHex, is_default: true }],
    })) : path === "/api/catalog/garment-types" ? [{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]
      : path === "/api/cultural-check" ? { is_culturally_sound: true, warnings: [] }
      : path === "/api/color-analysis" ? { dominant_color: "#123456", accent_colors: [], suggested_variants: [] }
      : path === "/api/weather" ? { location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false }
      : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/studio");
  const resume = page.getByRole("button", { name: "Tiếp tục bản nháp", exact: true });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await page.locator("#content-outerwear").scrollIntoViewIfNeeded();
}

test("a real touch drag moves the garment without scrolling and survives reload and undo", async ({ page }) => {
  await openStudio(page);
  const bounds = (await page.locator("#content-outerwear").boundingBox())!;
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 };
  const scroll = await page.evaluate(() => scrollY);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  for (let i = 1; i <= 6; i++) await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + i * 5, y: point.y - i * 9 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => placement(page)).toMatchObject({ dx: expect.any(Number), dy: expect.any(Number) });
  expect((await placement(page)).dy).toBeLessThan(-30);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  const moved = await placement(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect.poll(() => placement(page)).toBeUndefined();
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect.poll(() => placement(page)).toEqual(moved);
  await page.reload();
  await expect.poll(() => placement(page)).toEqual(moved);
});

test("a tap with small finger jitter selects without modifying the draft", async ({ page }) => {
  await openStudio(page);
  const bounds = (await page.locator("#content-outerwear").boundingBox())!;
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 };
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 2, y: point.y + 2 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await placement(page)).toBeUndefined();
  await expect(page.locator("#selection-overlay-outerwear")).toBeVisible();
});

test("mobile controls select covered garments, rotate, resize, nudge and reset with large touch targets", async ({ page }) => {
  await openStudio(page);
  await openStudioProperties(page);
  const controls = page.getByRole("region", { name: "Điều chỉnh trang phục" });
  await controls.getByLabel("Trang phục đang điều chỉnh").selectOption("headwear");
  await expect(page.locator("#selection-overlay-headwear")).toBeVisible();
  await controls.getByLabel("Trang phục đang điều chỉnh").selectOption("outerwear");
  await controls.getByRole("button", { name: "Phóng to trang phục", exact: true }).tap();
  await controls.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).tap();
  await controls.getByRole("button", { name: "Dịch phải", exact: true }).tap();
  await expect.poll(() => placement(page)).toMatchObject({ scale: 1.25, rotation: 15, dx: 10 });
  const targets = await controls.locator("button, select").evaluateAll(elements => elements.map(element => {
    const { width, height } = element.getBoundingClientRect(); return { width, height };
  }));
  for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
  await controls.getByRole("button", { name: "Đặt lại món đang chọn", exact: true }).tap();
  await expect.poll(() => placement(page)).toBeUndefined();
  await controls.getByRole("button", { name: "Khóa món đang chọn", exact: true }).tap();
  await expect(controls.getByRole("button", { name: "Phóng to trang phục", exact: true })).toBeDisabled();
  await controls.getByRole("button", { name: "Mở khóa món đang chọn", exact: true }).tap();
  await expect(controls.getByRole("button", { name: "Phóng to trang phục", exact: true })).toBeEnabled();
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await controls.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("mobile-controls.png") });
});

test("lifting a second finger cannot end or jump the active drag", async ({ page }) => {
  await openStudio(page);
  const box = (await page.locator("#content-outerwear").boundingBox())!;
  const first = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  const second = { x: first.x + 60, y: first.y + 60, id: 2 };
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 20 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...first, x: first.x + 20 }, second] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 20 }, { ...second, y: second.y + 40 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ ...second, y: second.y + 40 }] });
  expect(await placement(page)).toBeUndefined();
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 40 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await placement(page))?.dx).toBeGreaterThan(50);
  expect((await placement(page)).dy).toBe(0);
});

test("swiping the blank zoomed artboard pans the viewport without changing the outfit", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("button", { name: "Phóng to bảng phối", exact: true }).tap();
  await page.getByRole("button", { name: "Phóng to bảng phối", exact: true }).tap();
  await page.getByRole("button", { name: "Phóng to bảng phối", exact: true }).tap();
  const viewport = page.getByRole("region", { name: "Vùng xem bảng phối", exact: true });
  const before = await viewport.evaluate(element => element.scrollTop);
  const box = (await viewport.boundingBox())!;
  const point = { x: box.x + 20, y: box.y + box.height - 30, id: 1 };
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  for (let i = 1; i <= 6; i++) await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, y: point.y - i * 15 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(before + 20);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await placement(page)).toBeUndefined();
});

test("a cancelled gesture restores the previous placement and the next drag still works", async ({ page }) => {
  await openStudio(page);
  const content = page.locator("#content-outerwear");
  const box = (await content.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 35 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  expect(await placement(page)).toBeUndefined();
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 25 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await placement(page))?.dx).toBeGreaterThan(0);
});

test("choosing a garment returns to the board, zoom preserves the outfit and mobile deletion can be undone", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("tab", { name: "Chọn trang phục", exact: true }).tap();
  await page.getByRole("button", { name: "Chọn Áo mobile", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Món đang chọn", exact: true })).toHaveAttribute("aria-expanded", "true");
  await closeStudioPanels(page);
  const snapshot = (await draft(page)).snapshot;
  await page.getByRole("button", { name: "Phóng to bảng phối", exact: true }).tap();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("125%");
  expect((await draft(page)).snapshot).toEqual(snapshot);
  await page.getByRole("button", { name: "Vừa khung", exact: true }).tap();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("100%");
  await openStudioProperties(page);
  await page.getByRole("region", { name: "Điều chỉnh trang phục" }).getByRole("button", { name: "Xóa trang phục khỏi bảng" }).tap();
  await expect.poll(async () => (await draft(page)).snapshot.items.length).toBe(1);
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").tap();
  await expect.poll(async () => (await draft(page)).snapshot.items).toEqual(snapshot.items);
});
