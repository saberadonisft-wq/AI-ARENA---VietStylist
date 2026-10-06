import { expect, test, type Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";
import { clickStudioAction } from "./helpers/studio-ui";

async function openDraft(page: Page) {
  await page.addInitScript(({ key, draft }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(draft));
  }, { key: DRAFT_KEY, draft: { ...INITIAL_DOCUMENT, title: "Bản nháp cần giữ" } });
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/cultural-check" ? { is_culturally_sound: true, warnings: [] }
      : path === "/api/color-analysis" ? { dominant_color: "#426348", accent_colors: [], suggested_variants: [] }
      : path === "/api/weather" ? { location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false }
      : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Đóng thông báo bản nháp" })).toBeVisible();
}

test("corner notices can be closed without changing the draft or shifting the editor", async ({ page }) => {
  await openDraft(page);
  const notices = page.getByRole("region", { name: "Thông báo", exact: true });
  const original = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFT_KEY);
  const editor = page.locator('input[value="Bản nháp cần giữ"]');
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await notices.evaluate(el => getComputedStyle(el).position)).toBe("fixed");
    const box = (await notices.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    const close = notices.getByRole("button", { name: "Đóng thông báo bản nháp" });
    expect((await close.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width === 375 || width === 1440) await page.screenshot({ path: test.info().outputPath(`studio-notices-${width}.png`) });
  }
  const beforeClose = (await editor.boundingBox())!.y;
  await notices.getByRole("button", { name: "Đóng thông báo bản nháp" }).click();
  await notices.getByRole("button", { name: "Đóng thông báo chế độ khách" }).click();
  await expect(notices).toHaveCount(0);
  expect((await editor.boundingBox())!.y).toBe(beforeClose);
  const current = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFT_KEY);
  expect(current.title).toBe(original.title);
  expect(current.snapshot).toEqual(original.snapshot);
  await editor.fill("Tiếp tục chỉnh sửa");
  await expect(notices).toHaveCount(0);
});

test("starting fresh from the draft toast keeps the previous draft recoverable", async ({ page }) => {
  await openDraft(page);
  const notices = page.getByRole("region", { name: "Thông báo", exact: true });
  await notices.getByRole("button", { name: "Đóng thông báo chế độ khách" }).click();
  await notices.getByRole("button", { name: "Tạo bản phối trống" }).click();
  await expect(page.getByRole("button", { name: "Đóng thông báo bản nháp" })).toHaveCount(0);
  await expect(notices.getByRole("button", { name: "Khôi phục Bản nháp cần giữ" })).toBeVisible();
  await expect(notices).toContainText("Đã tạo bản phối trống");
  const title = page.getByRole("textbox", { name: "Tên bản phối", exact: true });
  const beforeDismiss = (await title.boundingBox())!.y;
  await notices.getByRole("button", { name: "Đóng thông báo bản khôi phục" }).click();
  await notices.getByRole("button", { name: "Đóng thông báo thành công" }).click();
  await expect(notices).toHaveCount(0);
  expect((await title.boundingBox())!.y).toBe(beforeDismiss);
  await clickStudioAction(page, "Xem bản khôi phục trên thiết bị");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await notices.evaluate(element => getComputedStyle(element).position)).toBe("fixed");
    await expect(notices.getByText("Bản khôi phục trên thiết bị", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`recovery-toast-${width}.png`) });
  }
  await notices.getByRole("button", { name: "Khôi phục Bản nháp cần giữ" }).click();
  await expect(title).toHaveValue("Bản nháp cần giữ");
  await expect(notices).toContainText("Đã khôi phục bản phối");
  await expect(page.locator(".studio-workspace").getByText(/Đã khôi phục bản phối/)).toHaveCount(0);
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFT_KEY);
  const beforeSuccessDismiss = (await title.boundingBox())!.y;
  await notices.getByRole("button", { name: "Đóng thông báo thành công" }).click();
  expect((await title.boundingBox())!.y).toBe(beforeSuccessDismiss);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFT_KEY)).toEqual(restored);
});
