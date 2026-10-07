import { expect, test } from "@playwright/test";
import { INITIAL_DOCUMENT } from "../src/features/studio/state";
import { chooseStudioGarment, clickStudioAction, openStudioDocument } from "./helpers/studio-ui";
import { assertNoStoredOutfits, installStorageProbe, mockDeviceStorageApi, seedLegacyOutfits, seedLogin, SERVER_OUTFIT, TEST_ITEM, USER_A, USER_B } from "./helpers/device-storage";

test("an initial server load blocks save actions until its outfit identity is available", async ({ page }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let getRequests = 0;
  await page.route(`**/api/outfits/${SERVER_OUTFIT.id}`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    getRequests++;
    await held;
    await route.fulfill({ json: SERVER_OUTFIT });
  });
  await page.goto(`/studio?loadOutfit=${SERVER_OUTFIT.id}`);
  await openStudioDocument(page);
  await expect.poll(() => getRequests).toBeGreaterThan(0);
  await expect(page.getByText("Đang tải bộ phối…", { exact: true })).toBeVisible();
  const save = page.getByRole("button", { name: "Lưu bộ phối", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Lưu thành bản mới", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Đăng lên Lookbook", exact: true })).toBeDisabled();
  await save.evaluate((button: HTMLButtonElement) => button.click());
  expect(writes).toHaveLength(0);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();

  release();
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await expect(save).toBeEnabled();
  await title.fill("Đã tải xong rồi mới lưu");
  await save.click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: `/api/outfits/${SERVER_OUTFIT.id}`, body: { revision: SERVER_OUTFIT.revision, title: "Đã tải xong rồi mới lưu" } });
  await assertNoStoredOutfits(page, true);
});

test("edits made while a server outfit loads remain open until the user chooses its saved version", async ({ page }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let getRequests = 0;
  await page.route(`**/api/outfits/${SERVER_OUTFIT.id}`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    getRequests++;
    await held;
    await route.fulfill({ json: SERVER_OUTFIT });
  });
  await page.goto(`/studio?loadOutfit=${SERVER_OUTFIT.id}`);
  await openStudioDocument(page);
  await expect.poll(() => getRequests).toBeGreaterThan(0);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await title.fill("Thay đổi trong khi chờ tải");
  await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeDisabled();
  release();
  const openSaved = page.getByRole("button", { name: "Mở bộ phối từ liên kết", exact: true });
  await expect(openSaved).toBeVisible();
  await expect(title).toHaveValue("Thay đổi trong khi chờ tải");
  expect(writes).toHaveLength(0);
  await openSaved.click();
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await title.fill("Chỉnh sửa phiên bản đã chọn");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: `/api/outfits/${SERVER_OUTFIT.id}`, body: { revision: SERVER_OUTFIT.revision, title: "Chỉnh sửa phiên bản đã chọn" } });
  await assertNoStoredOutfits(page, true);
});

test("server outfit links load the saved document and save changes through PUT without caching it", async ({ page }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  await page.goto(`/studio?loadOutfit=${SERVER_OUTFIT.id}`);
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await title.fill("Bộ phối được cập nhật trên máy chủ");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: `/api/outfits/${SERVER_OUTFIT.id}`, body: { title: "Bộ phối được cập nhật trên máy chủ", revision: SERVER_OUTFIT.revision, snapshot: { items: [TEST_ITEM] } } });
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  await assertNoStoredOutfits(page, true);

  await page.reload();
  await openStudioDocument(page);
  await expect(title).toHaveValue("Bộ phối được cập nhật trên máy chủ");
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect(page.getByTitle("Hoàn tác (Ctrl+Z)")).toBeDisabled();
  await assertNoStoredOutfits(page, true);
});

test("a lost create response retries the same in-memory receipt before saving newer edits", async ({ page }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page);
  const creates: { key?: string; body: Record<string, unknown> }[] = [];
  let serverCreates = 0;
  await page.route("**/api/outfits", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const request = route.request();
    const body = request.postDataJSON();
    creates.push({ key: request.headers()["idempotency-key"], body });
    if (creates.length === 1) {
      serverCreates++;
      return route.abort("failed");
    }
    expect(creates.at(-1)).toEqual(creates[0]);
    return route.fulfill({ json: { ...SERVER_OUTFIT, id: "recovered-outfit", title: body.title, revision: 1, current_version_id: "recovered-version-1", current_snapshot: body.snapshot } });
  });

  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await title.fill("Phiên bản gửi lần đầu");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toBeVisible();
  expect(creates).toHaveLength(1);
  expect(creates[0].key).toBeTruthy();
  expect(creates[0].body).toMatchObject({ title: "Phiên bản gửi lần đầu", snapshot: { items: [TEST_ITEM] } });
  await assertNoStoredOutfits(page, true);

  await title.fill("Thay đổi sau khi mất phản hồi");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]);
  expect(serverCreates).toBe(1);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: "/api/outfits/recovered-outfit", body: { title: "Thay đổi sau khi mất phản hồi", revision: 1 } });
  await expect(title).toHaveValue("Thay đổi sau khi mất phản hồi");
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await assertNoStoredOutfits(page, true);
});

test("guest edits survive signing in on the same page and are saved only to the account", async ({ page }) => {
  await seedLegacyOutfits(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page);
  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await title.fill("Bộ phối khách đang mở");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const auth = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await expect(auth).toBeVisible();
  expect(writes).toHaveLength(0);
  await auth.getByLabel("Địa chỉ Email").fill(USER_A.email);
  await auth.getByRole("textbox", { name: "Mật khẩu" }).fill("a-valid-test-password");
  await auth.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(auth).toBeHidden();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ method: "POST", authorization: "Bearer token-a", body: { title: "Bộ phối khách đang mở", snapshot: { items: [TEST_ITEM] } } });
  await expect(title).toHaveValue("Bộ phối khách đang mở");
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Chọn bản phối cần tiếp tục" })).toHaveCount(0);
  await assertNoStoredOutfits(page);
});

test("changing accounts clears the previous in-memory outfit and ignores its pending save result", async ({ page, context }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let oldSaveRequests = 0;
  await page.route("**/api/outfits", async route => {
    const request = route.request();
    if (request.method() !== "POST" || request.headers().authorization !== "Bearer token-a") return route.fallback();
    oldSaveRequests++;
    const body = request.postDataJSON();
    await held;
    await route.fulfill({ json: { ...SERVER_OUTFIT, id: "owned-by-a", title: body.title, revision: 1, current_snapshot: body.snapshot } });
  });
  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await title.fill("Riêng tư của tài khoản A");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => oldSaveRequests).toBe(1);

  const otherTab = await context.newPage();
  await otherTab.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  await otherTab.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, USER_B);
  await expect(title).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  const completed = page.waitForResponse(response => response.url().endsWith("/api/outfits") && response.request().headers().authorization === "Bearer token-a");
  release();
  await completed;
  await expect(title).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeEnabled();

  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await openStudioDocument(page);
  await title.fill("Bộ phối riêng của tài khoản B");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "POST", authorization: "Bearer token-b", body: { title: "Bộ phối riêng của tài khoản B" } });
  await assertNoStoredOutfits(page, true);
  await otherTab.close();
});

test("same-account token replacement retains an uncertain save-as-new receipt on a linked outfit", async ({ page, context }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  let linkedLoads = 0;
  await page.route(`**/api/outfits/${SERVER_OUTFIT.id}`, route => {
    if (route.request().method() === "GET") linkedLoads++;
    return route.fallback();
  });
  const creates: { key?: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/outfits", route => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const body = request.postDataJSON();
    creates.push({ key: request.headers()["idempotency-key"], body });
    if (creates.length === 1) return route.abort("failed");
    return route.fulfill({ json: { ...SERVER_OUTFIT, id: "created-copy", title: body.title, revision: 1, current_version_id: "created-copy-version", current_snapshot: body.snapshot } });
  });
  await page.goto(`/studio?loadOutfit=${SERVER_OUTFIT.id}`);
  await openStudioDocument(page);
  const title = page.getByLabel("Tên bản phối", { exact: true });
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await clickStudioAction(page, "Lưu thành bản mới");
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toBeVisible();
  expect(creates).toHaveLength(1);
  expect(creates[0].key).toBeTruthy();
  expect(linkedLoads).toBe(1);

  const otherTab = await context.newPage();
  await otherTab.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  const validated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/me" && response.request().headers().authorization === "Bearer token-a-refreshed");
  await otherTab.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-a-refreshed");
  }, USER_A);
  await validated;
  await openStudioDocument(page);
  await expect(title).toHaveValue(SERVER_OUTFIT.title);
  await clickStudioAction(page, "Lưu thành bản mới");
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]);
  expect(linkedLoads).toBe(1);
  expect(writes).toHaveLength(0);
  await assertNoStoredOutfits(page, true);
  await otherTab.close();
});

test("a guest pending save waits for the linked outfit to load after signing in", async ({ page }) => {
  await installStorageProbe(page);
  const { writes } = await mockDeviceStorageApi(page, [SERVER_OUTFIT]);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let authenticatedLoads = 0;
  await page.route(`**/api/outfits/${SERVER_OUTFIT.id}`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    if (!route.request().headers().authorization) return route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Đăng nhập để mở bộ phối." } } });
    authenticatedLoads++;
    await held;
    return route.fulfill({ json: SERVER_OUTFIT });
  });
  await page.goto(`/studio?loadOutfit=${SERVER_OUTFIT.id}`);
  await openStudioDocument(page);
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toBeVisible();
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const auth = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await auth.getByLabel("Địa chỉ Email").fill(USER_A.email);
  await auth.getByRole("textbox", { name: "Mật khẩu" }).fill("a-valid-test-password");
  await auth.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(auth).toBeHidden();
  await expect.poll(() => authenticatedLoads).toBeGreaterThan(0);
  await expect(page.getByText("Đang tải bộ phối…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu bộ phối", exact: true })).toBeDisabled();
  expect(writes).toHaveLength(0);
  release();
  await expect(page.getByText("Đã lưu bộ phối vào Tủ đồ.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: "PUT", path: `/api/outfits/${SERVER_OUTFIT.id}`, authorization: "Bearer token-a", body: { revision: SERVER_OUTFIT.revision, title: SERVER_OUTFIT.title } });
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(SERVER_OUTFIT.title);
  await expect(page.locator("#content-outerwear image")).toBeVisible();
  await assertNoStoredOutfits(page, true);
});

test("changing accounts closes comparison and discards the previous account's pinned outfit", async ({ page, context }) => {
  await seedLogin(page);
  await installStorageProbe(page);
  await mockDeviceStorageApi(page);
  await page.goto("/studio");
  await chooseStudioGarment(page, "Trang phục kiểm thử");
  await clickStudioAction(page, "Lưu bản A để so sánh");
  await clickStudioAction(page, "So sánh hai bản");
  const compare = page.getByRole("dialog", { name: "So sánh hai phương án phối đồ" });
  await expect(compare).toBeVisible();
  await expect(compare.getByRole("region", { name: "Phương án A" }).getByText("Trang phục kiểm thử", { exact: true })).toBeVisible();

  const otherTab = await context.newPage();
  await otherTab.goto("/images/heritage/thumb_nguyen_ao_tac.png");
  await otherTab.evaluate(user => {
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem("viet_stylist_auth_token", "token-b");
  }, USER_B);
  await openStudioDocument(page);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue(INITIAL_DOCUMENT.title);
  await expect(compare).toHaveCount(0);
  await expect(page.locator("#content-outerwear image")).toHaveCount(0);
  await page.getByLabel("Thao tác bộ phối", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Lưu bản A để so sánh", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "So sánh hai bản", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bỏ ghim bản A", exact: true })).toHaveCount(0);
  await assertNoStoredOutfits(page, true);
  await otherTab.close();
});
