import { expect, type Page } from "@playwright/test";

export type StudioTool = "Chọn trang phục" | "Mẫu phối" | "Màu sắc" | "Bối cảnh" | "Văn hóa" | "Trợ lý AI";
export async function openStudioDocument(page: Page) {
  if (await page.evaluate(() => matchMedia("(max-width: 1023px)").matches)) await closeStudioPanels(page);
  const trigger = page.getByRole("button", { name: "Quản lý bộ phối", exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toBeVisible();
}
export async function openStudioPanel(page: Page, name: StudioTool) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}
export async function openStudioProperties(page: Page) {
  await openStudioPanel(page, "Chọn trang phục");
  const adjustments = page.locator(".studio-garment-adjustments");
  if (await adjustments.getAttribute("open") === null) await adjustments.locator("summary").click();
  await expect(page.getByRole("region", { name: "Điều chỉnh trang phục", exact: true })).toBeVisible();
}
export async function closeStudioPanels(page: Page) {
  // Resizing can close a tool between a visibility check and a click.
  // Escape also closes an open document menu before closing the tool.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(".studio-tool-panel:not([hidden])")).toHaveCount(0);
  const document = page.getByRole("button", { name: "Quản lý bộ phối", exact: true });
  if (await document.getAttribute("aria-expanded") === "true") await document.click();
}
export async function chooseStudioGarment(page: Page, name: string) {
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByRole("button", { name: `Chọn ${name}`, exact: true }).click();
}
export async function clickStudioAction(page: Page, name: string) {
  await openStudioDocument(page);
  const button = page.locator(".studio-actions").getByRole("button", { name, exact: true });
  if (await button.filter({ visible: true }).count() === 0) {
    await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  }
  const visible = button.filter({ visible: true });
  await expect(visible).toHaveCount(1);
  await visible.click();
}
