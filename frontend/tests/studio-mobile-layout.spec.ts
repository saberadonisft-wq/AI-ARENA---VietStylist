import { expect, test, type Page } from "@playwright/test";
import { mockDeviceStorageApi } from "./helpers/device-storage";
import { closeStudioPanels, openStudioDocument, openStudioPanel } from "./helpers/studio-ui";

async function expectViewportFit(page: Page) {
  expect(await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    vertical: document.documentElement.scrollHeight > innerHeight,
  }))).toEqual({ horizontal: false, vertical: false });
  const viewport = (await page.getByRole("region", { name: "Vùng xem bảng phối", exact: true }).boundingBox())!;
  const board = (await page.getByTestId("outfit-artboard").boundingBox())!;
  expect(board.x).toBeGreaterThanOrEqual(viewport.x);
  expect(board.y).toBeGreaterThanOrEqual(viewport.y);
  expect(board.x + board.width).toBeLessThanOrEqual(viewport.x + viewport.width + 1);
  expect(board.y + board.height).toBeLessThanOrEqual(viewport.y + viewport.height + 1);
  expect(await page.locator(".studio-style-switch button").evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
}

for (const size of [
  { width: 320, height: 480 }, { width: 320, height: 640 }, { width: 375, height: 667 },
  { width: 393, height: 740 }, { width: 480, height: 800 }, { width: 740, height: 360 },
  { width: 1366, height: 768 }, { width: 1920, height: 1080 },
]) {
  test(`document controls collapse into the right toolbar at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockDeviceStorageApi(page);
    await page.route("https://accounts.google.com/**", route => route.abort());
    await page.goto("/studio");
    const trigger = page.getByRole("button", { name: "Quản lý bộ phối", exact: true });
    const panel = page.locator(".studio-document-popover");
    await expect(trigger).toBeVisible();
    await expect(panel).toBeHidden();
    await expect(page.locator(".studio-canvas-heading .studio-document-float")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Thu phóng bảng phối", exact: true }).getByRole("button", { name: "Quản lý bộ phối", exact: true })).toBeVisible();
    await expectViewportFit(page);
    const originalBoard = await page.getByTestId("outfit-artboard").boundingBox();
    await page.screenshot({ path: test.info().outputPath("collapsed.png") });
    await openStudioDocument(page);
    await expect(panel).toBeVisible();
    const saveBox = (await panel.getByRole("button", { name: "Lưu bộ phối", exact: true }).boundingBox())!;
    const iconBox = (await panel.getByRole("button", { name: "Lưu bộ phối", exact: true }).locator("svg").boundingBox())!;
    expect(Math.abs(saveBox.x + saveBox.width / 2 - iconBox.x - iconBox.width / 2)).toBeLessThan(1);
    expect(Math.abs(saveBox.y + saveBox.height / 2 - iconBox.y - iconBox.height / 2)).toBeLessThan(1);
    expect(await page.getByTestId("outfit-artboard").boundingBox()).toEqual(originalBoard);
    await expect(page.locator(".studio-save-status")).toContainText("Chế độ khách");
    await page.getByLabel("Tên bản phối", { exact: true }).fill("Bản phối đang mở");
    await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
    await panel.getByRole("button", { name: "Lưu thành bản mới", exact: true }).scrollIntoViewIfNeeded();
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path: test.info().outputPath("document-actions.png") });
    await page.keyboard.press("Escape");
    await expect(page.locator(".studio-document-menu")).not.toHaveAttribute("open");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bản phối đang mở");
    await openStudioDocument(page);
    await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await closeStudioPanels(page);
    await openStudioPanel(page, "Chọn trang phục");
    await expect(panel).toBeHidden();
    await page.getByRole("button", { name: "Chọn Trang phục kiểm thử", exact: true }).click();
    await closeStudioPanels(page);
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    if (size.width < 500) {
      await expect(page.locator('[data-toast-id="guest"]')).toBeHidden();
      await page.addStyleTag({ content: "html { font-size: 20px; }" });
      await expectViewportFit(page);
    }
  });
}
