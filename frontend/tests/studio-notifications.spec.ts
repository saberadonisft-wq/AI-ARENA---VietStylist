import { expect, test } from "@playwright/test";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";
import { chooseStudioGarment, openStudioDocument } from "./helpers/studio-ui";
import { assertNoStoredOutfits, installStorageProbe, mockDeviceStorageApi, seedLegacyOutfits, seedLogin, USER_A } from "./helpers/device-storage";

test("old device and recovery outfits are removed without clearing login or preferences", async ({ page }) => {
  await seedLogin(page);
  await seedLegacyOutfits(page);
  await mockDeviceStorageApi(page);
  await page.goto("/studio");
  await openStudioDocument(page);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await assertNoStoredOutfits(page);
  expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("token-a");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("viet_stylist_user") || "null")?.id)).toBe(USER_A.id);
  expect(await page.evaluate(() => localStorage.getItem("unrelated_preference"))).toBe("keep-this");
  expect(await page.evaluate(() => sessionStorage.getItem("unrelated_session_preference"))).toBe("keep-this-too");

  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openStudioDocument(page);
    await expect(page.getByText("Bản khôi phục trên thiết bị", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Khôi phục|Xem bản khôi phục trên thiết bị/ })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Chọn bản phối cần tiếp tục" })).toHaveCount(0);
  }
});

test("edits and undo remain available in the open page and unsaved work disappears on reload", async ({ page }) => {
  await installStorageProbe(page);
  await mockDeviceStorageApi(page);
  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Bộ phối chỉ ở phiên đang mở");
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(title).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect(title).toHaveValue("Bộ phối chỉ ở phiên đang mở");
  await assertNoStoredOutfits(page, true);

  await page.reload();
  await openStudioDocument(page);
  await expect(title).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.getByTestId("outfit-artboard").getByText("Bảng phối đang trống", { exact: true })).toBeVisible();
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await assertNoStoredOutfits(page, true);
});
