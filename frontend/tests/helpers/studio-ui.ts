import { expect, type Page } from "@playwright/test";

export type StudioTool = "Chọn trang phục" | "Mẫu phối" | "Màu sắc" | "Bối cảnh" | "Văn hóa" | "Trợ lý AI";
export async function openStudioPanel(page: Page, name: StudioTool) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}
export async function openStudioProperties(page: Page) {
  const trigger = page.getByRole("button", { name: "Món đang chọn", exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
}
export async function closeStudioPanels(page: Page) {
  const properties = page.getByRole("button", { name: "Đóng thuộc tính món", exact: true });
  if (await properties.isVisible()) await properties.click();
  const tool = page.locator(".studio-tool-panel:not([hidden]) .studio-panel-heading button");
  if (await tool.isVisible()) await tool.click();
}
export async function chooseStudioGarment(page: Page, name: string) {
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByRole("button", { name: `Chọn ${name}`, exact: true }).click();
}
export async function clickStudioAction(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (await button.filter({ visible: true }).count() === 0) {
    await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  }
  const visible = button.filter({ visible: true });
  await expect(visible).toHaveCount(1);
  await visible.click();
}
