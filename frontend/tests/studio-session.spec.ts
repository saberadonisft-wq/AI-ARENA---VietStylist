import { expect, test, type Page } from "@playwright/test";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";
import { chooseStudioGarment, openStudioDocument, openStudioPanel, openStudioProperties } from "./helpers/studio-ui";
import { assertNoStoredOutfits, installStorageProbe, mockDeviceStorageApi, seedLogin, SERVER_OUTFIT, USER_A, USER_B } from "./helpers/device-storage";

test.use({ viewport: { width: 1440, height: 950 } });

async function navigate(page: Page, label: "Thư viện Cổ phục" | "Studio Phối đồ") {
  await page.locator("header nav").getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(label === "Studio Phối đồ" ? /\/studio$/ : /\/thu-vien$/);
}

async function openSession(page: Page, linked = false) {
  await seedLogin(page);
  await installStorageProbe(page);
  const api = await mockDeviceStorageApi(page, linked ? [SERVER_OUTFIT] : []);
  await page.goto(linked ? `/studio?loadOutfit=${SERVER_OUTFIT.id}` : "/studio");
  if (linked) await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(SERVER_OUTFIT.title);
  else await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bộ phối trong phiên");
  return api;
}

test("navigation retains the outfit, placement, background, locks and undo history without a stored draft", async ({ page }) => {
  const { writes } = await openSession(page);
  await openStudioProperties(page);
  await page.getByRole("button", { name: "Xoay phải 15 độ", exact: true }).click();
  await page.getByRole("button", { name: "Khóa món đang chọn", exact: true }).click();
  const transform = await page.locator("#item-transform-outerwear").getAttribute("transform");
  await openStudioPanel(page, "Bối cảnh");
  await page.getByRole("button", { name: "Giấy Dó", exact: true }).click();
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Tên mới trong phiên");

  await navigate(page, "Thư viện Cổ phục");
  await navigate(page, "Studio Phối đồ");
  await expect(title).toHaveValue("Tên mới trong phiên");
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect(page.locator("#item-transform-outerwear")).toHaveAttribute("transform", transform!);
  await openStudioPanel(page, "Chọn trang phục");
  await expect(page.getByRole("button", { name: "Mở khóa vị trí áo ngoài", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openStudioPanel(page, "Bối cảnh");
  await expect(page.getByRole("button", { name: "Giấy Dó", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "1:1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(title).toHaveValue("Bộ phối trong phiên");
  await page.getByTitle("Làm lại (Ctrl+Y)").click();
  await expect(title).toHaveValue("Tên mới trong phiên");
  expect(writes).toHaveLength(0);
  await assertNoStoredOutfits(page, true);
});

test("reload and closing the tab discard the unsaved session even while the account stays signed in", async ({ page, context }) => {
  await openSession(page);
  await page.reload();
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Bộ phối sẽ bỏ khi đóng");
  await assertNoStoredOutfits(page, true);
  await page.close();

  const reopened = await context.newPage();
  await installStorageProbe(reopened);
  await mockDeviceStorageApi(reopened);
  await reopened.goto("/studio");
  await expect(reopened.locator("header").getByRole("button", { name: new RegExp(USER_A.displayName) })).toBeVisible();
  await expect(reopened.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(reopened.locator("#content-outerwear image")).toHaveCount(0);
  await assertNoStoredOutfits(reopened, true);
});

for (const linked of [false, true]) {
test(`logging out away from Studio clears ${linked ? "linked" : "new"} work before the same account signs in again`, async ({ page }) => {
  await openSession(page, linked);
  await navigate(page, "Thư viện Cổ phục");
  await page.locator("header").getByRole("button", { name: new RegExp(USER_A.displayName) }).click();
  await page.getByRole("button", { name: "Đăng xuất tài khoản", exact: true }).click();
  await page.locator("header").getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const auth = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await auth.getByLabel("Địa chỉ Email").fill(USER_A.email);
  await auth.getByRole("textbox", { name: "Mật khẩu" }).fill("a-valid-test-password");
  await auth.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(auth).toBeHidden();
  await navigate(page, "Studio Phối đồ");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await assertNoStoredOutfits(page, true);
});
}

test("switching accounts while away from Studio removes the previous account's session", async ({ page, context }) => {
  const { writes } = await openSession(page);
  await navigate(page, "Thư viện Cổ phục");
  const other = await context.newPage();
  await other.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  await other.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, USER_B);
  await expect(page.locator("header").getByRole("button", { name: new RegExp(USER_B.displayName) })).toBeVisible();
  await navigate(page, "Studio Phối đồ");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ method: "POST", authorization: "Bearer token-b" });
  await assertNoStoredOutfits(page, true);
  await other.close();
});

test("a save completing away from Studio retains its identity so the next save updates the same outfit", async ({ page }) => {
  const { writes } = await openSession(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let creates = 0;
  await page.route("**/api/outfits", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    creates++;
    await held;
    return route.fallback();
  });
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => creates).toBe(1);
  await navigate(page, "Thư viện Cổ phục");
  release();
  await expect.poll(() => writes.length).toBe(1);
  await navigate(page, "Studio Phối đồ");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Bộ phối trong phiên");
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Sửa sau khi quay lại");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(creates).toBe(1);
  expect(writes[1]).toMatchObject({ method: "PUT", path: "/api/outfits/created-1", body: { revision: 1, title: "Sửa sau khi quay lại" } });
  await assertNoStoredOutfits(page, true);
});

test("an uncertain save keeps its retry receipt through navigation", async ({ page }) => {
  const { writes } = await openSession(page);
  const creates: { key?: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/outfits", route => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    creates.push({ key: route.request().headers()["idempotency-key"], body });
    if (creates.length === 1) return route.abort("failed");
    return route.fulfill({ json: { ...SERVER_OUTFIT, id: "recovered-outfit", title: body.title, revision: 1, current_snapshot: body.snapshot } });
  });
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toBeVisible();
  await navigate(page, "Thư viện Cổ phục");
  await navigate(page, "Studio Phối đồ");
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Thay đổi sau khi quay lại");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: "/api/outfits/recovered-outfit", body: { revision: 1, title: "Thay đổi sau khi quay lại" } });
  await assertNoStoredOutfits(page, true);
});

test("opening an account outfit asks before replacing session edits, including a repeated link", async ({ page }) => {
  test.setTimeout(60000);
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  await page.route("**/api/outfits/page?*", route => route.fulfill({ json: { items: [SERVER_OUTFIT], next_cursor: null } }));
  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await openStudioDocument(page);
  await title.fill("Bản đang làm cần giữ");
  const openSavedLink = async () => {
    await page.locator("header").getByRole("button", { name: new RegExp(USER_A.displayName) }).click();
    await page.getByRole("link", { name: "Trang cá nhân & Bộ phối", exact: true }).click();
    await expect(page).toHaveURL(/\/tai-khoan$/);
    await page.getByRole("button", { name: "Mở Studio", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/studio\\?loadOutfit=${SERVER_OUTFIT.id}$`));
    await expect(page.getByRole("button", { name: "Mở bộ phối từ liên kết", exact: true })).toBeVisible();
    await expect(title).toHaveValue("Bản đang làm cần giữ");
  };
  await openSavedLink();
  await page.getByRole("button", { name: "Giữ bản đang mở", exact: true }).click();
  await openSavedLink();
  await page.getByRole("button", { name: "Mở bộ phối từ liên kết", exact: true }).click();
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await page.getByTitle("Hoàn tác (Ctrl+Z)").click();
  await expect(title).toHaveValue("Bản đang làm cần giữ");
  expect(writes).toHaveLength(0);
  await assertNoStoredOutfits(page, true);
});
