import { expect, test, type Page } from "@playwright/test";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";
import type { OutfitResponse } from "../src/lib/types/api";
import { seedLogin, USER_A } from "./helpers/device-storage";
import { openStudioDocument, chooseStudioGarment, clickStudioAction, closeStudioPanels, openStudioPanel, openStudioProperties, type StudioTool } from "./helpers/studio-ui";

const garment = { id: "workbench-coat", name: "Áo kiểm chứng", slot: "outerwear", gender: "unisex", garment_type_id: "ngu_than", is_published: true,
  metadata: { real_image_url: "/workbench.png" },
  variants: [{ id: "red", color_name: "Đỏ", hex_color: "#8B1E24", is_default: true }],
};
const starter = { id: "workbench-starter", title: "Mẫu phối kiểm chứng", description: "Mẫu kiểm tra mở bản mới", garment_type_id: "ngu_than", occasion_id: "tet", items: [{ slot: "outerwear", item_id: garment.id, variant_id: "red" }] };
const savedOutfit: OutfitResponse = {
  id: "workbench-outfit", owner_id: USER_A.id, title: "Phiên bản máy chủ", revision: 3,
  current_version_id: "workbench-version-3", style_mode: "traditional",
  current_snapshot: { ...structuredClone(INITIAL_DOCUMENT.snapshot), items: [{ slot: garment.slot, itemId: garment.id, variantId: "red", assetVersion: 1, colorHex: "#8B1E24" }] },
  created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z",
};
async function fixture(page: Page, loadSaved = false) {
  const outfitWrites: string[] = [];
  if (loadSaved) await seedLogin(page);
  await page.route("**/api/**", route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/outfits") && ["POST", "PUT", "DELETE"].includes(request.method()) && path !== "/api/outfits/compare") {
      outfitWrites.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: { code: "UNEXPECTED_WRITE", message: "This UI test must not save outfits." } } });
    }
    const json = path === "/api/catalog/items" ? [garment]
      : path === "/api/auth/me" ? USER_A
      : path === `/api/outfits/${savedOutfit.id}` ? savedOutfit
      : path === "/api/outfits" ? [savedOutfit]
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
  await page.goto(loadSaved ? `/studio?loadOutfit=${savedOutfit.id}` : "/studio");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(loadSaved ? savedOutfit.title : INITIAL_DOCUMENT.title);
  if (loadSaved) await expect(page.locator("#content-outerwear image")).toBeVisible();
  return { outfitWrites };
}

// Observe the public drawing and document controls, including while their panel is closed.
async function outfitView(page: Page) {
  return page.locator(".studio-workspace").evaluate(root => {
    const title = root.querySelector<HTMLInputElement>('input[aria-label="Tên bản phối"]');
    const board = root.querySelector<HTMLElement>('[data-testid="outfit-artboard"]');
    if (!title || !board || !board.querySelector("#flatlay-outfit-board")) throw new Error("Studio drawing is not ready");
    const pressed = (selector: string) => [...root.querySelectorAll<HTMLElement>(selector)].map(button => ({
      name: button.getAttribute("aria-label") || button.textContent?.trim(), pressed: button.getAttribute("aria-pressed"),
    }));
    return {
      title: title.value,
      items: [...board.querySelectorAll('[id^="item-transform-"]')].map(item => ({
        slot: item.id.replace("item-transform-", ""), transform: item.getAttribute("transform"),
        draggable: item.querySelector("[data-studio-drag]")?.getAttribute("data-studio-drag"),
        images: [...item.querySelectorAll('[id^="content-"] image')].map(image => image.getAttribute("href")),
        fills: [...item.querySelectorAll('[id^="content-"] [fill]')].map(element => element.getAttribute("fill")),
      })),
      style: pressed('.studio-style-switch button[aria-pressed]'),
      context: pressed('#studio-panel-context button[aria-pressed]'),
      closure: pressed('#studio-panel-culture button[aria-pressed]'),
      ratio: board.style.aspectRatio,
      background: board.querySelector('[data-testid="board-background"]')?.getAttribute("data-background-url"),
    };
  });
}

test("Studio removes the toolbox and opens garment adjustments, colors and backgrounds directly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page);
  await expect(page.getByRole("tab", { name: "Công cụ", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel", { name: "Bảng Công cụ", exact: true })).toHaveCount(0);
  await expect(page.locator(".studio-toolbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Về bảng công cụ", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Bảng công cụ Studio", exact: true }).getByRole("tab")).toHaveCount(6);
  await chooseStudioGarment(page, garment.name);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await openStudioProperties(page);
    const adjustments = page.locator(".studio-garment-adjustments");
    await expect(adjustments).toHaveAttribute("open", "");
    await expect(adjustments.getByRole("button", { name: "Xoay phải 15 độ", exact: true })).toBeEnabled();
    await expect(adjustments.getByLabel("Trang phục đang điều chỉnh", { exact: true })).toHaveValue("outerwear");
    await openStudioProperties(page);
    await expect(adjustments).toHaveAttribute("open", "");
    expect(await outfitView(page)).toEqual(before);
    await page.getByRole("tabpanel", { name: "Bảng Trang phục", exact: true }).screenshot({ path: test.info().outputPath(`garment-adjustments-${width}.png`) });
    await openStudioPanel(page, "Màu sắc");
    await expect(page.getByRole("tabpanel", { name: "Bảng Màu sắc", exact: true })).toBeVisible();
    expect(await outfitView(page)).toEqual(before);
    await closeStudioPanels(page);
    await page.getByRole("group", { name: "Thu phóng bảng phối", exact: true }).getByRole("button", { name: /^Nền · / }).click();
    await expect(page.getByRole("tabpanel", { name: "Bảng Bối cảnh", exact: true })).toBeVisible();
    expect(await outfitView(page)).toEqual(before);
  }
});

test("sidebar content fits its own width with long Vietnamese labels across all six tools", async ({ page }) => {
  test.setTimeout(90000);
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /hydration|cannot be a descendant|did not match/i.test(message.text())) runtimeErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixture(page);
  const longName = "Áo tím cổ đứng lấy cảm hứng cung đình triều Nguyễn";
  await page.route("**/api/catalog/items?*", route => route.fulfill({ json: Array.from({ length: 12 }, (_, index) => ({
    ...garment, id: `${garment.id}-${index}`, name: index === 0 ? longName : `Áo Nhật Bình Đỏ ${index}`,
  })) }));
  await page.route("**/api/catalog/occasions", route => route.fulfill({ json: [
    { id: "bieu_dien", name: "Biểu diễn nghệ thuật", season: "all" },
    { id: "cuoi_hoi", name: "Lễ cưới & Đính hôn", season: "all" },
    { id: "tet", name: "Tết & Du xuân", season: "spring" },
  ] }));
  await page.reload();
  await chooseStudioGarment(page, longName);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
  for (const width of [320, 375, 414, 768, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await openStudioPanel(page, "Trợ lý AI");
    const assistant = page.getByRole("region", { name: "Gợi ý phối đồ", exact: true });
    await assistant.getByLabel("Dịp sử dụng", { exact: true }).selectOption("bieu_dien");
    await assistant.getByLabel("Phong cách phối đồ", { exact: true }).selectOption("remix");
    await assistant.getByLabel("Tông màu mong muốn", { exact: true }).selectOption("Thanh nhã · xanh lá, xanh lam");
    const clippedSelections = await assistant.locator("select").evaluateAll(elements => elements.flatMap(element => {
      const select = element as HTMLSelectElement;
      const style = getComputedStyle(select);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = select.selectedOptions[0].text;
      const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24;
      return context.measureText(text).width > available ? [{ text, available }] : [];
    }));
    expect(clippedSelections, `Selected text at ${width}px`).toEqual([]);
    await assistant.screenshot({ path: test.info().outputPath(`assistant-${width}.png`) });
    if (![375, 1280].includes(width)) continue;
    for (const tool of ["Chọn trang phục", "Mẫu phối", "Màu sắc", "Bối cảnh", "Văn hóa", "Trợ lý AI"] as StudioTool[]) {
      await openStudioPanel(page, tool);
      const panel = page.getByRole("tabpanel").filter({ visible: true });
      const body = panel.locator(".studio-panel-body");
      await body.evaluate(element => { element.scrollTop = 0; });
      expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth), `${tool} at ${width}`).toBe(true);
      if (tool === "Chọn trang phục") {
        const title = panel.locator(".studio-garment-name").first();
        expect(await title.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
      }
      if (tool === "Văn hóa") {
        const details = panel.locator(".studio-cultural-details");
        expect(await details.evaluate(element => element.clientHeight)).toBeLessThan(25);
        if (await panel.getByRole("button", { name: /Xem chi tiết/ }).count()) await panel.getByRole("button", { name: /Xem chi tiết/ }).click();
        await expect(panel.getByText(/Đây không phải kết luận thẩm định/)).toBeVisible();
      }
      await panel.screenshot({ path: test.info().outputPath(`panel-${tool}-${width}.png`) });
    }
  }
  expect(await outfitView(page)).toEqual(before);
  expect(runtimeErrors).toEqual([]);
});

test("Studio starts with panels hidden and opens tools and document actions on demand", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await fixture(page);
  await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Món đang chọn", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toBeVisible();
  await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByRole("tabpanel", { name: "Bảng Trang phục", exact: true })).toBeVisible();
  await expect(page.locator(".studio-garment-adjustments > summary")).toBeHidden();
  await expect(page.getByLabel("Mức thu phóng bảng phối", { exact: true })).toHaveText("100%");
  await chooseStudioGarment(page, garment.name);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
  const toolbar = page.getByRole("group", { name: "Thu phóng bảng phối", exact: true });
  const checkToolbar = async (width: number) => {
    await expect(toolbar.getByRole("button")).toHaveCount(6);
    for (const button of await toolbar.getByRole("button").all()) await expect(button).toBeInViewport();
    await expect(toolbar.getByRole("button", { name: /^Nền · / })).toBeVisible();
    const controls = await toolbar.locator("button, output").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { center: box.x + box.width / 2, top: box.y, bottom: box.bottom };
    }));
    expect(controls).toHaveLength(7);
    for (let index = 1; index < controls.length; index++) {
      expect(controls[index].center).toBeCloseTo(controls[0].center, 0);
      expect(controls[index].top).toBeGreaterThanOrEqual(controls[index - 1].bottom);
    }
    const box = (await toolbar.boundingBox())!;
    expect(width - box.x - box.width).toBeGreaterThanOrEqual(0);
    expect(width - box.x - box.width).toBeLessThanOrEqual(24);
    expect(await toolbar.evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopWidth, shadow: style.boxShadow };
    })).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px", shadow: "none" });
  };
  for (const width of [1280, 1366, 1536, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const logo = (await page.locator(".site-navbar .site-brand img").boundingBox())!;
    const iconCenters = await page.locator(".studio-tool-rail .studio-tool-icon").evaluateAll(icons => icons.map(icon => {
      const box = icon.getBoundingClientRect(); return box.x + box.width / 2;
    }));
    expect(iconCenters).toHaveLength(6);
    for (const center of iconCenters) expect(Math.abs(logo.x + logo.width / 2 - center), `Logo and tool icon centers at ${width}px`).toBeLessThanOrEqual(0.5);
    const catalog = (await page.getByRole("tabpanel", { name: "Bảng Trang phục", exact: true }).boundingBox())!;
    const board = (await page.getByTestId("outfit-artboard").boundingBox())!;
    const zoom = (await toolbar.boundingBox())!;
    expect(board.x).toBeGreaterThanOrEqual(catalog.x + catalog.width);
    expect(board.x + board.width).toBeLessThanOrEqual(zoom.x);
    await checkToolbar(width);
    expect(board.width / board.height).toBeCloseTo(9 / 16, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`studio-right-controls-${width}.png`) });
  }
  await closeStudioPanels(page);
  await toolbar.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.locator('#flatlay-outfit-board [id^="item-transform-"]')).toHaveCount(0);
  await toolbar.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect.poll(() => outfitView(page)).toEqual(before);
  await toolbar.getByRole("button", { name: /^Nền · / }).click();
  await expect(page.getByRole("tabpanel", { name: "Bảng Bối cảnh", exact: true })).toBeVisible();
  expect(await outfitView(page)).toEqual(before);
  await openStudioDocument(page);
  await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng lên Lookbook", exact: true })).not.toBeVisible();
  await openStudioDocument(page);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng lên Lookbook", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lưu bản A để so sánh", exact: true }).click();
  await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
  await clickStudioAction(page, "So sánh hai bản");
  await expect(page.getByRole("dialog", { name: "So sánh hai phương án phối đồ" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await outfitView(page)).toEqual(before);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("tabpanel", { name: "Bảng Trang phục", exact: true })).not.toBeVisible();
  await expect(page.getByRole("region", { name: "Món đang chọn", exact: true })).toHaveCount(0);
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await closeStudioPanels(page);
    await checkToolbar(width);
    const board = (await page.getByTestId("outfit-artboard").boundingBox())!;
    expect(board.x + board.width).toBeLessThanOrEqual((await toolbar.boundingBox())!.x);
    await toolbar.getByRole("button", { name: /^Nền · / }).click();
    await expect(page.getByRole("tabpanel", { name: "Bảng Bối cảnh", exact: true })).toBeVisible();
    await closeStudioPanels(page);
    await expect(page.getByRole("button", { name: "Bộ phối", exact: true })).toHaveCount(0);
    await openStudioDocument(page);
    await expect(page.getByLabel("Tên bản phối", { exact: true })).toBeVisible();
    await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
    await page.keyboard.press("Escape");
    await closeStudioPanels(page);
    await expect(page.getByLabel("Tên bản phối", { exact: true })).toBeVisible();
    await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await outfitView(page)).toEqual(before);
    await page.screenshot({ path: test.info().outputPath(`studio-right-controls-narrow-${width}.png`) });
  }
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator('#flatlay-outfit-board [id^="item-transform-"]')).toHaveCount(0);
  await expect(toolbar.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Món đang chọn", exact: true })).toHaveCount(0);
});

test("all tool groups preserve the outfit, search and AI choices when switching", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản phối cần giữ");
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
  await expect(page.getByLabel("Góc xoay trang phục", { exact: true })).toHaveText("15°");
  await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", /rotate\(15\)/);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByLabel("Tìm trang phục", { exact: true }).fill("kiểm chứng");
  await openStudioPanel(page, "Trợ lý AI");
  await page.getByRole("region", { name: "Gợi ý phối đồ", exact: true }).getByLabel("Dịp sử dụng", { exact: true }).selectOption("tet");
  const tools: StudioTool[] = ["Mẫu phối", "Màu sắc", "Bối cảnh", "Văn hóa", "Trợ lý AI", "Chọn trang phục"];
  for (const tool of tools) {
    await openStudioPanel(page, tool);
    await expect(page.getByRole("tab", { name: tool, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(1);
    expect(await outfitView(page)).toEqual(before);
  }
  await expect(page.getByLabel("Tìm trang phục", { exact: true })).toHaveValue("kiểm chứng");
  await openStudioPanel(page, "Trợ lý AI");
  await expect(page.getByRole("region", { name: "Gợi ý phối đồ", exact: true }).getByLabel("Dịp sử dụng", { exact: true })).toHaveValue("tet");
  await closeStudioPanels(page);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeEnabled();
});

test("starter confirmation preserves locked items while reload discards unsaved work and restores the server outfit", async ({ page }) => {
  const { outfitWrites } = await fixture(page, true);
  const saved = await outfitView(page);
  expect(saved.items).toHaveLength(1);
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản đang chỉnh trước mẫu phối");
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
  await page.getByRole("button", { name: "Khóa món đang chọn", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mở khóa món đang chọn", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", /rotate\(15\)/);
  const before = await outfitView(page);
  await openStudioPanel(page, "Mẫu phối");
  await page.getByRole("button", { name: "Mẫu phối có sẵn", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Chọn mẫu phối mở đầu" });
  await chooser.getByRole("button", { name: new RegExp(starter.title) }).click();
  const confirmation = page.getByRole("dialog", { name: "Mở mẫu phối này?", exact: true });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Những thay đổi chưa lưu sẽ bị bỏ");
  expect(await outfitView(page)).toEqual(before);
  await confirmation.getByRole("button", { name: "Tiếp tục bản hiện tại", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(await outfitView(page)).toEqual(before);
  await chooser.getByRole("button", { name: new RegExp(starter.title) }).click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Mở mẫu phối", exact: true }).click();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(starter.title);
  expect((await outfitView(page)).items).toEqual(before.items);
  await openStudioProperties(page);
  await expect(page.getByRole("button", { name: "Mở khóa món đang chọn", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Góc xoay trang phục", { exact: true })).toHaveText("15°");
  await closeStudioPanels(page);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem bản khôi phục trên thiết bị", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(savedOutfit.title);
  await expect.poll(() => outfitView(page)).toEqual(saved);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await openStudioProperties(page);
  await expect(page.getByRole("button", { name: "Khóa món đang chọn", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Góc xoay trang phục", { exact: true })).toHaveText("0°");
  expect(outfitWrites).toEqual([]);
});

test("cultural closure, its information dialog and safe-color controls remain available", async ({ page }) => {
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  const before = (await outfitView(page)).items;
  expect(before).toHaveLength(1);
  await openStudioPanel(page, "Văn hóa");
  await page.getByRole("button", { name: "Tìm hiểu quy chuẩn Hữu nhậm", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tìm hiểu Hữu nhậm", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Đổi hướng khép vạt sang Tả nhậm", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đổi hướng khép vạt sang Hữu nhậm", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect((await outfitView(page)).items).toEqual(before);
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await openStudioPanel(page, "Văn hóa");
  await expect(page.getByRole("button", { name: "Đổi hướng khép vạt sang Tả nhậm", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openStudioPanel(page, "Màu sắc");
  for (const name of ["Mộc", "Hỏa", "Thổ", "Kim", "Thủy"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mộc", exact: true }).click();
  await expect(page.getByRole("region", { name: "Thông báo", exact: true })).toContainText("ảnh chưa đủ an toàn");
  expect((await outfitView(page)).items).toEqual(before);
});

test("keyboard tool navigation and Escape return focus without changing the open outfit", async ({ page }) => {
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await closeStudioPanels(page);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
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
  await expect(page.getByRole("tab", { name: "Chọn trang phục", exact: true })).toBeFocused();
  expect(await outfitView(page)).toEqual(before);
});

test("light Studio keeps navigation and session edits, resets on reload and loads the saved outfit", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản chưa lưu trước khi sang Thư viện");
  expect((await outfitView(page)).items).toHaveLength(1);
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
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bản chưa lưu trước khi sang Thư viện");
  await expect(page.locator('#flatlay-outfit-board [id^="item-transform-"]')).toHaveCount(1);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator('#flatlay-outfit-board [id^="item-transform-"]')).toHaveCount(0);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await seedLogin(page);
  await page.goto(`/studio?loadOutfit=${savedOutfit.id}`);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(savedOutfit.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", /rotate\(0\) scale\(1\)/);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
});

test("phone menus keep export, publish, compare and login reachable and resizing closes overlapping panels", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await chooseStudioGarment(page, garment.name);
  await openStudioPanel(page, "Chọn trang phục");
  await openStudioProperties(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("tabpanel", { name: "Bảng Trang phục", exact: true })).toBeHidden();
  await closeStudioPanels(page);
  const before = await outfitView(page);
  expect(before.items).toHaveLength(1);
  for (const action of ["Xuất ảnh", "Đăng lên Lookbook", "Lưu thành bản mới", "Thử đồ AI"]) {
    await clickStudioAction(page, action);
    const modal = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(await outfitView(page)).toEqual(before);
  }
  await openStudioDocument(page);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await page.getByRole("button", { name: "Lưu bản A để so sánh", exact: true }).filter({ visible: true }).locator("svg").click();
  await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
  await clickStudioAction(page, "So sánh hai bản");
  const comparison = page.getByRole("dialog", { name: "So sánh hai phương án phối đồ" });
  await expect(comparison).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Điều hướng website", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Công cụ Studio", exact: true }).getByRole("button", { name: "Đăng nhập", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mở menu điều hướng", exact: true }).click();
  await page.getByRole("navigation", { name: "Điều hướng trên điện thoại", exact: true }).getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" })).toBeVisible();
  expect(await outfitView(page)).toEqual(before);
});
