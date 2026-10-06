import { expect, test, type Page } from "@playwright/test";
import { DRAFT_KEY } from "../src/features/studio/state";
import { chooseStudioGarment, clickStudioAction, closeStudioPanels, openStudioPanel, openStudioProperties, type StudioTool } from "./helpers/studio-ui";

const garment = { id: "workbench-coat", name: "Áo kiểm chứng", slot: "outerwear", gender: "unisex", garment_type_id: "ngu_than", is_published: true,
  metadata: { real_image_url: "/workbench.png" },
  variants: [{ id: "red", color_name: "Đỏ", hex_color: "#8B1E24", is_default: true }],
};
const starter = { id: "workbench-starter", title: "Mẫu phối kiểm chứng", description: "Mẫu kiểm tra mở bản mới", garment_type_id: "ngu_than", occasion_id: "tet", items: [{ slot: "outerwear", item_id: garment.id, variant_id: "red" }] };
async function fixture(page: Page) {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    const json = path === "/api/catalog/items" ? [garment]
      : path === "/api/catalog/starter-outfits" ? [starter]
      : path === "/api/catalog/garment-types" ? [{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]
      : path === "/api/catalog/occasions" ? [{ id: "tet", name: "Tết", season: "all" }]
      : path === "/api/color-analysis" ? { dominant_color: "#8B1E24", accent_colors: [], suggested_variants: [], contrast_ratio: 5 }
      : path === "/api/cultural-check" ? { is_culturally_sound: true, warnings: [] }
      : path === "/api/outfits/compare" ? { summary_message: "Hai phương án đã được đối chiếu.", diffs: [], style_changed: false }
      : path === "/api/weather" ? { location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [] } }
      : [];
    return route.fulfill({ json });
  });
  await page.route("**/workbench.png", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64") }));
  await page.route("https://accounts.google.com/**", route => route.abort());
  await page.goto("/studio");
}
const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), DRAFT_KEY);

test("all tool groups preserve the outfit, search and AI choices when switching", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản phối cần giữ");
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
  await expect.poll(async () => (await draft(page))?.snapshot.items[0].transform?.rotation).toBe(15);
  const before = await draft(page);
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByLabel("Tìm trang phục", { exact: true }).fill("kiểm chứng");
  await openStudioPanel(page, "Trợ lý AI");
  await page.getByRole("region", { name: "Gợi ý phối đồ", exact: true }).getByLabel("Dịp sử dụng", { exact: true }).selectOption("tet");
  const tools: StudioTool[] = ["Mẫu phối", "Màu sắc", "Bối cảnh", "Văn hóa", "Trợ lý AI", "Chọn trang phục"];
  for (const tool of tools) {
    await openStudioPanel(page, tool);
    await expect(page.getByRole("tab", { name: tool, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(1);
    expect(await draft(page)).toEqual(before);
  }
  await expect(page.getByLabel("Tìm trang phục", { exact: true })).toHaveValue("kiểm chứng");
  await openStudioPanel(page, "Trợ lý AI");
  await expect(page.getByRole("region", { name: "Gợi ý phối đồ", exact: true }).getByLabel("Dịp sử dụng", { exact: true })).toHaveValue("tet");
  await closeStudioPanels(page);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeEnabled();
});

test("starter confirmation keeps the prior transformed and locked outfit recoverable", async ({ page }) => {
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Nháp trước mẫu phối");
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
  await page.getByRole("button", { name: "Khóa món đang chọn", exact: true }).click();
  const before = await draft(page);
  await openStudioPanel(page, "Mẫu phối");
  await page.getByRole("button", { name: "Mẫu phối có sẵn", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Chọn mẫu phối mở đầu" });
  await chooser.getByRole("button", { name: new RegExp(starter.title) }).click();
  const confirmation = page.getByRole("dialog", { name: "Mở mẫu phối này?", exact: true });
  await expect(confirmation).toBeVisible();
  expect(await draft(page)).toEqual(before);
  await confirmation.getByRole("button", { name: "Mở mẫu phối", exact: true }).click();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(starter.title);
  expect((await draft(page)).snapshot.items).toEqual(before.snapshot.items);
  await closeStudioPanels(page);
  await clickStudioAction(page, "Xem bản khôi phục trên thiết bị");
  await page.getByRole("button", { name: "Khôi phục Nháp trước mẫu phối", exact: true }).click();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(before.title);
  expect((await draft(page)).snapshot.items).toEqual(before.snapshot.items);
});

test("cultural closure, its information dialog and safe-color controls remain available", async ({ page }) => {
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  const before = (await draft(page)).snapshot.items;
  await openStudioPanel(page, "Văn hóa");
  await page.getByRole("button", { name: "Tìm hiểu quy chuẩn Hữu nhậm", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tìm hiểu Hữu nhậm", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Đổi hướng khép vạt sang Tả nhậm", exact: true }).click();
  await expect.poll(async () => (await draft(page)).snapshot.overlapDirection).toBe("left_over_right");
  expect((await draft(page)).snapshot.items).toEqual(before);
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  expect((await draft(page)).snapshot.overlapDirection).toBe("right_over_left");
  await openStudioPanel(page, "Màu sắc");
  for (const name of ["Mộc", "Hỏa", "Thổ", "Kim", "Thủy"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mộc", exact: true }).click();
  await expect(page.getByRole("region", { name: "Thông báo", exact: true })).toContainText("ảnh chưa đủ an toàn");
  expect((await draft(page)).snapshot.items).toEqual(before);
});

test("keyboard tool navigation and Escape return focus without changing the draft", async ({ page }) => {
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await closeStudioPanels(page);
  const before = await draft(page);
  await page.getByRole("tab", { name: "Chọn trang phục", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("tab", { name: "Mẫu phối", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  const assistant = page.getByRole("tab", { name: "Trợ lý AI", exact: true });
  await expect(assistant).toBeFocused();
  await expect(assistant).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(assistant).toBeFocused();
  await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(0);
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Món đang chọn", exact: true })).toBeFocused();
  expect(await draft(page)).toEqual(before);
});

test("light Studio keeps global navigation and returns to the same draft after visiting the library", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  const before = await draft(page);
  const navbar = page.locator(".studio-site-frame > header");
  for (const name of ["Studio Phối đồ", "Thư viện Cổ phục", "Lookbook", "Chuyện Cổ phục"]) await expect(navbar.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(navbar.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(navbar.getByRole("button", { name: "Đăng ký", exact: true })).toBeVisible();
  const [nav, board] = await Promise.all([navbar.boundingBox(), page.getByTestId("outfit-artboard").boundingBox()]);
  expect(board!.y).toBeGreaterThan(nav!.y + nav!.height);
  // Render the resolved surface color into a pixel, including OKLCH browsers.
  expect(await page.locator(".studio-workspace").evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(element).backgroundColor; context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).every(value => value > 220);
  })).toBe(true);
  await navbar.getByRole("link", { name: "Thư viện Cổ phục", exact: true }).click();
  await expect(page).toHaveURL(/\/thu-vien$/);
  await expect(page.locator("footer")).toBeVisible();
  await page.locator("header").getByRole("link", { name: "Studio Phối đồ", exact: true }).click();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  expect(await draft(page)).toEqual(before);
});

test("phone menus keep export, publish, compare and login reachable and resizing closes overlapping panels", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await openStudioPanel(page, "Chọn trang phục");
  await openStudioProperties(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Món đang chọn", exact: true })).toHaveAttribute("aria-expanded", "false");
  await closeStudioPanels(page);
  const before = await draft(page);
  for (const action of ["Xuất ảnh", "Đăng lên Lookbook", "Lưu thành bản mới", "Thử đồ AI"]) {
    await clickStudioAction(page, action);
    const modal = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(await draft(page)).toEqual(before);
  }
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await page.getByRole("button", { name: "Lưu bản A để so sánh", exact: true }).filter({ visible: true }).locator("svg").click();
  await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
  await clickStudioAction(page, "So sánh hai bản");
  const comparison = page.getByRole("dialog", { name: "So sánh hai phương án phối đồ" });
  await expect(comparison).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const menu = page.getByLabel("Điều hướng website", { exact: true });
  await menu.click();
  await page.getByRole("navigation", { name: "Khám phá VietStylist", exact: true }).getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" })).toBeVisible();
  expect(await draft(page)).toEqual(before);
});
