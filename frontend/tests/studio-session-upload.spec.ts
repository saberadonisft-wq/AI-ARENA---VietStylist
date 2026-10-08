import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { assertNoStoredOutfits, installStorageProbe, mockDeviceStorageApi, seedLogin, USER_A, USER_B } from "./helpers/device-storage";
import { chooseStudioGarment, clickStudioAction, closeStudioPanels, openStudioDocument, openStudioPanel, openStudioProperties } from "./helpers/studio-ui";
import { toOutfitSavePayload } from "../src/features/studio/persistence";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAoCAYAAACfKfiZAAAATklEQVR4nO3RsQ0AIRADQeMqiKiTEqjzo+8COoCAwAE78UlnaSXgdeV00GubNw/G/21/WGFmgEgQZgaIBGFmgEgQZgaIBGFmgEjwegIAC7LNBDj3wgHoAAAAAElFTkSuQmCC", "base64");
const file = { name: "Áo cá nhân.png", mimeType: "image/png", buffer: png };

async function setup(page: Page, signedIn = true) {
  if (signedIn) await seedLogin(page);
  await installStorageProbe(page);
  await page.addInitScript(() => {
    const probe = window as typeof window & { revokedSessionUrls: string[] };
    probe.revokedSessionUrls = [];
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = url => { probe.revokedSessionUrls.push(url); revoke(url); };
  });
  const api = await mockDeviceStorageApi(page);
  const uploads: { type: string; bytes: number; authorization?: string }[] = [];
  await page.route("**/api/media/session-cutout", route => {
    const request = route.request();
    uploads.push({ type: request.headers()["content-type"], bytes: request.postDataBuffer()!.length, authorization: request.headers().authorization });
    return route.fulfill({ contentType: "image/png", headers: { "Cache-Control": "no-store, private" }, body: png });
  });
  await page.goto("/studio");
  await openStudioPanel(page, "Chọn trang phục");
  return { ...api, uploads };
}

async function uploadAndEquip(page: Page) {
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByLabel("Tải ảnh trang phục", { exact: true }).setInputFiles(file);
  const item = page.getByRole("button", { name: "Chọn ảnh cá nhân Áo cá nhân", exact: true });
  await expect(item).toBeVisible();
  await item.click();
  await closeStudioPanels(page);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect.poll(() => page.locator("#content-outerwear image").getAttribute("href")).toMatch(/^blob:/);
  return (await page.locator("#content-outerwear image").getAttribute("href"))!;
}

for (const viewport of [{ width: 375, height: 667 }, { width: 1366, height: 768 }]) {
  test(`session upload composes and exports real PNG at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { writes, uploads } = await setup(page);
    await uploadAndEquip(page);
    expect(uploads).toEqual([{ type: "image/png", bytes: png.length, authorization: "Bearer token-a" }]);
    await openStudioProperties(page);
    await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
    await closeStudioPanels(page);
    await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", /rotate\(15\)/);
    await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
    await expect(page.locator("#content-outerwear image")).toBeVisible();
    await page.getByTitle("Làm lại (Ctrl+Y)").click();
    await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", /rotate\(15\)/);
    await openStudioDocument(page);
    await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
    await expect(page.locator('[data-toast-id="action"]')).toContainText("chỉ dùng trong phiên");
    expect(writes).toHaveLength(0);
    await clickStudioAction(page, "Xuất ảnh");
    const dialog = page.getByRole("dialog", { name: "Xuất ảnh bản phối", exact: true });
    const square = viewport.width > 1000;
    if (square) await dialog.getByRole("button", { name: /1:1/ }).click();
    else await dialog.getByRole("button", { name: "Nhấn để tạo ảnh xem trước" }).click();
    await expect(dialog.getByRole("button", { name: "Tải ảnh PNG" })).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Tải ảnh PNG" }).click();
    const downloaded = await downloadPromise;
    await downloaded.saveAs(test.info().outputPath("personal-outfit.png"));
    const bytes = await readFile((await downloaded.path())!);
    const pixels = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let personalPixels = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - 120) <= 3 && Math.abs(data[i + 1] - 24) <= 3 && Math.abs(data[i + 2] - 30) <= 3 && data[i + 3] === 255) personalPixels++;
      return { width: image.width, height: image.height, personalPixels };
    }, bytes.toString("base64"));
    expect(pixels).toMatchObject({ width: 1400, height: square ? 1400 : 2488 });
    expect(pixels.personalPixels).toBeGreaterThan(1000);
    await dialog.getByRole("button", { name: "Đóng xuất ảnh" }).click();
    await assertNoStoredOutfits(page, true);
    expect(writes).toHaveLength(0);
    await openStudioPanel(page, "Chọn trang phục");
    await page.locator('[data-toast-id="action"]').getByRole("button", { name: "Đóng thông báo" }).click();
    await page.locator(".studio-garment-adjustments summary").click();
    await page.getByRole("region", { name: "Ảnh trang phục của bạn" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("session-upload.png") });
  });
}

test("temporary images survive app navigation and undo but disappear after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await setup(page);
  const url = await uploadAndEquip(page);
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await closeStudioPanels(page);
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(page.locator("#content-outerwear image")).toHaveAttribute("href", url);
  await page.locator("header nav").getByRole("link", { name: "Thư viện Cổ phục", exact: true }).click();
  await page.locator("header nav").getByRole("link", { name: "Studio Phối đồ", exact: true }).click();
  await expect(page.locator("#content-outerwear image")).toHaveAttribute("href", url);
  await assertNoStoredOutfits(page, true);
  await page.reload();
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByRole("button", { name: /^Chọn ảnh cá nhân/ })).toHaveCount(0);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
});

test("logging out away from Studio revokes uploaded blobs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await setup(page);
  const url = await uploadAndEquip(page);
  await page.locator("header nav").getByRole("link", { name: "Thư viện Cổ phục", exact: true }).click();
  await page.locator("header").getByRole("button", { name: new RegExp(USER_A.displayName) }).click();
  await page.getByRole("button", { name: "Đăng xuất tài khoản", exact: true }).click();
  await expect.poll(() => page.evaluate(url => (window as typeof window & { revokedSessionUrls: string[] }).revokedSessionUrls.includes(url), url)).toBe(true);
  expect(await page.evaluate(url => fetch(url).then(() => true, () => false), url)).toBe(false);
  await page.locator("header nav").getByRole("link", { name: "Studio Phối đồ", exact: true }).click();
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByRole("button", { name: "Đăng nhập để tải ảnh", exact: true })).toBeVisible();
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
});

test("account switch drops a late cutout result and clears the previous library", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await setup(page);
  const url = await uploadAndEquip(page);
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/media/session-cutout", async route => { started(); await pending; await route.fulfill({ contentType: "image/png", body: png }).catch(() => {}); });
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByLabel("Tải ảnh trang phục", { exact: true }).setInputFiles({ ...file, name: "Ảnh đang xử lý.png" });
  await requested;
  const other = await context.newPage();
  await other.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  await other.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, USER_B);
  await expect(page.locator("header").getByRole("button", { name: new RegExp(USER_B.displayName) })).toBeVisible();
  release();
  await expect.poll(() => page.evaluate(url => (window as typeof window & { revokedSessionUrls: string[] }).revokedSessionUrls.includes(url), url)).toBe(true);
  await expect(page.getByRole("button", { name: /^Chọn ảnh cá nhân/ })).toHaveCount(0);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await expect(page.getByLabel("Tải ảnh trang phục", { exact: true })).toBeEnabled();
  await assertNoStoredOutfits(page, true);
  await other.close();
});

test("validation and failed cutouts preserve the board and permit retry", async ({ page }) => {
  const { uploads } = await setup(page);
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioPanel(page, "Chọn trang phục");
  const input = page.getByLabel("Tải ảnh trang phục", { exact: true });
  await input.setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  const alert = page.getByRole("region", { name: "Ảnh trang phục của bạn" }).getByRole("alert");
  await expect(alert).toContainText("PNG, JPG hoặc WebP");
  expect(uploads).toHaveLength(0);
  await input.setInputFiles({ ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(alert).toContainText("10 MB");
  expect(uploads).toHaveLength(0);
  await page.route("**/api/media/session-cutout", route => route.fulfill({ status: 503, json: { error: { code: "CUTOUT_BUSY", message: "Đang xử lý ảnh, vui lòng thử lại." } } }));
  await input.setInputFiles(file);
  await expect(alert).toContainText("Đang xử lý ảnh");
  await expect(page.locator("#content-outerwear image")).toHaveAttribute("href", "/device-storage-fixture.png");
  await page.unroute("**/api/media/session-cutout");
  await page.route("**/api/media/session-cutout", route => route.fulfill({ contentType: "image/png", body: png }));
  await input.setInputFiles(file);
  await expect(page.getByRole("button", { name: "Chọn ảnh cá nhân Áo cá nhân", exact: true })).toBeVisible();
});

test("multiple garment layers respect locks and cancelling ignores late results", async ({ page }) => {
  await setup(page);
  await uploadAndEquip(page);
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByLabel("Vị trí ảnh tải lên", { exact: true }).selectOption("bottom");
  await page.getByLabel("Tải ảnh trang phục", { exact: true }).setInputFiles({ ...file, name: "Quần cá nhân.png" });
  await page.getByRole("button", { name: "Chọn ảnh cá nhân Quần cá nhân", exact: true }).click();
  await expect(page.locator("#content-bottom image")).toBeVisible();
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await openStudioPanel(page, "Chọn trang phục");
  await page.getByRole("button", { name: "Khóa vị trí áo ngoài", exact: true }).click();
  await expect(page.getByRole("button", { name: "Chọn ảnh cá nhân Áo cá nhân", exact: true })).toBeDisabled();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/media/session-cutout", async route => { await pending; await route.fulfill({ contentType: "image/png", body: png }).catch(() => {}); });
  await page.getByLabel("Tải ảnh trang phục", { exact: true }).setInputFiles({ ...file, name: "Ảnh đã hủy.png" });
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  release();
  await expect(page.getByLabel("Tải ảnh trang phục", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Chọn ảnh cá nhân/ })).toHaveCount(2);
  await expect(page.locator("#content-bottom image")).toBeVisible();
  await assertNoStoredOutfits(page, true);
});

test("guest upload requests sign-in and temporary snapshots cannot be serialized for saving", async ({ page }) => {
  await setup(page, false);
  await page.getByRole("button", { name: "Đăng nhập để tải ảnh", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" })).toBeVisible();
  expect(() => toOutfitSavePayload({ ...INITIAL_DOCUMENT, snapshot: { ...INITIAL_DOCUMENT.snapshot, items: [{ itemId: "session-upload:private", slot: "outerwear", assetVersion: 1 }] } })).toThrow("chỉ dùng trong phiên");
});

test("comparing personal images stays local and never sends session IDs to the API", async ({ page }) => {
  await setup(page);
  const privateRequests: string[] = [];
  const compareRequests: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/")) return;
    if (request.postData()?.includes("session-upload:")) privateRequests.push(request.url());
    if (request.url().includes("/outfits/compare")) compareRequests.push(request.url());
  });
  await uploadAndEquip(page);
  await clickStudioAction(page, "Lưu bản A để so sánh");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await clickStudioAction(page, "So sánh hai bản");
  const compare = page.getByRole("dialog", { name: "So sánh hai phương án phối đồ", exact: true });
  await expect(compare).toContainText("So sánh các ảnh đang mở trong phiên");
  await expect(compare.getByRole("region", { name: "Phương án A", exact: true })).toContainText("Áo cá nhân");
  await compare.getByRole("button", { name: "Chỉnh sửa phương án A", exact: true }).click();
  await expect(page.locator("#content-outerwear image")).toHaveAttribute("href", /^blob:/);
  expect(privateRequests).toEqual([]);
  expect(compareRequests).toEqual([]);
});
