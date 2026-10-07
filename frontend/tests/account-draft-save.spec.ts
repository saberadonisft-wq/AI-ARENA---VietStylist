import { expect, test } from "@playwright/test";
import { openStudioDocument } from "./helpers/studio-ui";
import { assertNoStoredOutfits, mockDeviceStorageApi, seedLegacyOutfits, seedLogin, SERVER_OUTFIT } from "./helpers/device-storage";

test("account shows saved server outfits and has no device draft management", async ({ page }) => {
  test.setTimeout(60000);
  await seedLogin(page);
  await seedLegacyOutfits(page);
  await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  await page.route("**/api/outfits/page?*", route => route.fulfill({ json: { items: [SERVER_OUTFIT], next_cursor: null } }));
  await page.goto("/tai-khoan");
  await expect(page.getByRole("heading", { name: SERVER_OUTFIT.title, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nháp trên thiết bị|Lưu vào Tủ đồ|Đã lưu vào Tủ đồ/ })).toHaveCount(0);
  await expect(page.getByText(/Bản khôi phục trên thiết bị|Nháp khách trên thiết bị/)).toHaveCount(0);
  await assertNoStoredOutfits(page);
  expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("token-a");
  expect(await page.evaluate(() => localStorage.getItem("unrelated_preference"))).toBe("keep-this");

  await page.getByRole("button", { name: "Mở Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\?loadOutfit=server-outfit/, { timeout: 30000 });
  await openStudioDocument(page);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(SERVER_OUTFIT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await assertNoStoredOutfits(page);
});
