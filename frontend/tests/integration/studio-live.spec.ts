import { openStudioDocument, openStudioPanel, clickStudioAction } from "../helpers/studio-ui";
import { test, expect } from "@playwright/test";
import { DRAFT_KEY } from "../../src/features/studio/state";

test("real login, two-tab conflict, lookbook creation and revocable anonymous sharing", async ({ page, request, context, browser }) => {
  test.setTimeout(120000);
  const email = `browser-${Date.now()}@example.invalid`;
  const password = "Browser-only-random-765432!";
  const registered = await request.post("http://127.0.0.1:4100/api/auth/register", { data: { email, password, display_name: "Browser Tester" } });
  expect(registered.ok()).toBeTruthy();
  const account = await registered.json();
  const mappingResponse = process.env.NEXT_PUBLIC_STUDIO_V3 === "true"
    ? page.waitForResponse(response => response.url().includes("/api/v3/legacy-mappings")) : null;
  await page.goto("/studio");
  if (mappingResponse) {
    const response = await mappingResponse;
    expect(response.ok()).toBeTruthy();
    expect(Array.isArray((await response.json()).mappings)).toBe(true);
    await openStudioPanel(page, "Văn hóa");
    await expect(page.getByTestId("studio-composer")).toBeVisible();
    await expect(page.getByTestId("studio-composer").getByText("Chọn trang phục để tra cứu và kiểm tra văn hóa.")).toBeVisible();
    await page.getByTestId("studio-composer").getByRole("button", { name: "Chọn bối cảnh và bộ dữ liệu riêng" }).click();
    await expect(page.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("dev");
  }
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Nháp khách trước đăng nhập");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).first().click();
  await page.getByPlaceholder("yourname@gmail.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(page.getByPlaceholder("yourname@gmail.com")).toHaveCount(0);
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Nháp khách trước đăng nhập");
  await openStudioDocument(page);
  const createdOutfit = page.waitForResponse(response => response.url().endsWith("/api/outfits") && response.request().method() === "POST");
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const creation = await createdOutfit;
  expect(creation.ok()).toBeTruthy();
  const draft = await creation.json();
  expect(draft.revision).toBe(1);
  expect(draft.owner_id).toBe(account.user.id);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  const headers = { Authorization: `Bearer ${account.access_token}` };
  const saved = await request.get(`http://127.0.0.1:4100/api/outfits/${draft.id}`, { headers });
  expect(saved.ok()).toBeTruthy();
  const persisted = await saved.json();
  expect(persisted.title).toBe("Nháp khách trước đăng nhập");
  expect(persisted.current_snapshot).toEqual(draft.current_snapshot);
  if (mappingResponse) expect(persisted.current_snapshot.culturalSettings).toMatchObject({ dataset_version: "dev", context: { period_ids: [], region_ids: [] } });

  const loaded = page.waitForResponse(response => response.url().endsWith(`/api/outfits/${draft.id}`) && response.request().method() === "GET");
  await page.goto(`/studio?loadOutfit=${encodeURIComponent(draft.id)}`);
  await loaded;
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Nháp khách trước đăng nhập");
  if (mappingResponse) { await openStudioPanel(page, "Văn hóa"); await expect(page.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("dev"); }
  const otherTab = await context.newPage();
  await otherTab.goto(`/studio?loadOutfit=${encodeURIComponent(draft.id)}`);
  await expect(otherTab.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Nháp khách trước đăng nhập");
  await openStudioDocument(page);
  await page.getByLabel("Tên bản phối", { exact: true }).fill("Nội dung của tab cũ");
  await expect(otherTab.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Nháp khách trước đăng nhập");
  await openStudioDocument(otherTab);
  await otherTab.getByLabel("Tên bản phối", { exact: true }).fill("Tab khác đã lưu");
  const competing = otherTab.waitForResponse(response => response.url().endsWith(`/api/outfits/${draft.id}`) && response.request().method() === "PUT");
  await openStudioDocument(otherTab);
  await otherTab.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  expect((await competing).ok()).toBeTruthy();
  await openStudioDocument(page);
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toContainText("Thay đổi của bạn vẫn đang mở trên trang");
  await expect(page.getByLabel("Tên bản phối", { exact: true })).toHaveValue("Nội dung của tab cũ");
  const latest = await request.get(`http://127.0.0.1:4100/api/outfits/${draft.id}`, { headers });
  expect((await latest.json()).title).toBe("Tab khác đã lưu");

  await otherTab.goto("/lookbook?tab=collections");
  await otherTab.getByRole("button", { name: "Tạo Lookbook Mới" }).click();
  await otherTab.getByPlaceholder("Ví dụ: Kỷ yếu Cố đô Huế 2026...").fill("Lookbook nghiệm thu");
  await otherTab.getByRole("checkbox", { name: "Tab khác đã lưu" }).check();
  await otherTab.getByLabel("Quyền riêng tư").selectOption("unlisted");
  const created = otherTab.waitForResponse(response => response.url().endsWith("/api/lookbooks") && response.request().method() === "POST");
  await otherTab.getByRole("button", { name: "Xác nhận tạo" }).click();
  const createdResponse = await created;
  expect(createdResponse.ok()).toBeTruthy();
  const lookbook = await createdResponse.json();
  expect(lookbook.entries).toHaveLength(1);
  await otherTab.goto(`/lookbook/${lookbook.id}`);
  await expect(otherTab.getByRole("heading", { name: "Lookbook nghiệm thu", exact: true })).toBeVisible();
  const shared = otherTab.waitForResponse(response => response.url().endsWith(`/api/lookbooks/${lookbook.id}/share`));
  await otherTab.getByRole("button", { name: "Tạo liên kết chia sẻ Lookbook" }).click();
  const shareResponse = await shared;
  expect(shareResponse.ok()).toBeTruthy();
  const share = await shareResponse.json();

  const anonymous = await browser.newContext();
  try {
    const guest = await anonymous.newPage();
    await guest.goto(`http://127.0.0.1:3100/lookbook/${lookbook.id}`);
    await expect(guest.getByRole("heading", { name: "Đăng nhập để xem Lookbook của bạn" })).toBeVisible();
    await guest.goto(share.share_url);
    await expect(guest.getByRole("heading", { name: "Lookbook nghiệm thu", exact: true })).toBeVisible();
    await expect(guest.getByRole("heading", { name: "Tab khác đã lưu", exact: true })).toBeVisible();
    const revoked = await request.delete(`http://127.0.0.1:4100/api/lookbooks/${lookbook.id}/shares`, { headers });
    expect(revoked.ok()).toBeTruthy();
    await guest.reload();
    await expect(guest.getByRole("heading", { name: "Liên kết không khả dụng" })).toBeVisible();
    await expect(guest.getByRole("heading", { name: "Lookbook nghiệm thu", exact: true })).toHaveCount(0);
  } finally { await anonymous.close(); }
  await otherTab.close();
});

for (const state of ["unchanged", "edited", "deleted"] as const) {
  test(`a lost create response with an ${state} outfit stays recoverable in the open session and saves a separate copy`, async ({ page, request }) => {
    const registered = await request.post("http://127.0.0.1:4100/api/auth/register", {
      data: { email: `recovery-${state}-${Date.now()}@example.invalid`, password: "Browser-recovery-765432!", display_name: "Recovery Tester" },
    });
    expect(registered.ok()).toBeTruthy();
    const account = await registered.json();
    const headers = { Authorization: `Bearer ${account.access_token}` };
    await page.addInitScript(account => {
      localStorage.setItem("viet_stylist_auth_token", account.access_token);
      localStorage.setItem("viet_stylist_user", JSON.stringify({ ...account.user, displayName: account.user.display_name }));
    }, account);
    let first: any;
    let loseResponse = true;
    await page.route("**/api/outfits", async route => {
      if (route.request().method() === "POST" && loseResponse) {
        loseResponse = false;
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        first = await response.json();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.goto("/studio");
    await openStudioDocument(page);
    const title = page.getByLabel("Tên bản phối", { exact: true });
    await openStudioDocument(page);
    await title.fill("Bộ phối trước lỗi mạng");
    await openStudioDocument(page);
    await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
    await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toContainText("Giữ trang mở");
    expect(first?.id).toBeTruthy();
    const path = `http://127.0.0.1:4100/api/outfits/${first.id}`;
    if (state === "edited") {
      const changed = await request.put(path, { headers, data: { title: "Phiên khác đã lưu", snapshot: first.current_snapshot, revision: 1 } });
      expect(changed.ok()).toBeTruthy();
    } else if (state === "deleted") {
      expect((await request.delete(path, { headers })).ok()).toBeTruthy();
    }
    await openStudioDocument(page);
    await title.fill("Chỉnh sửa cần giữ sau lỗi mạng");
    if (state !== "unchanged") {
      const failed = page.waitForResponse(response => response.url().endsWith("/api/outfits") && response.request().method() === "POST");
      await openStudioDocument(page);
      await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
      const response = await failed;
      expect(response.status()).toBe(409);
      expect((await response.json()).error.code).toBe(state === "deleted" ? "OUTFIT_DELETED" : "REVISION_CONFLICT");
      await expect(title).toHaveValue("Chỉnh sửa cần giữ sau lỗi mạng");
    }
    const copied = page.waitForResponse(response => response.url().endsWith("/api/outfits") && response.request().method() === "POST" && response.request().postDataJSON().title === "Chỉnh sửa cần giữ sau lỗi mạng");
    await clickStudioAction(page, "Lưu thành bản mới");
    const copyResponse = await copied;
    expect(copyResponse.ok()).toBeTruthy();
    const copy = await copyResponse.json();
    expect(copy.id).not.toBe(first.id);
    expect(copy.revision).toBe(1);
    await expect(title).toHaveValue("Chỉnh sửa cần giữ sau lỗi mạng");
    expect(await page.evaluate(key => Object.keys(localStorage).filter(stored => stored.startsWith(key)), DRAFT_KEY)).toEqual([]);
    const outfits = await (await request.get("http://127.0.0.1:4100/api/outfits", { headers })).json();
    expect(outfits).toHaveLength(state === "deleted" ? 1 : 2);
    expect(outfits.find((outfit: any) => outfit.id === copy.id).title).toBe("Chỉnh sửa cần giữ sau lỗi mạng");
    const firstAfter = await request.get(path, { headers });
    if (state === "deleted") expect(firstAfter.status()).toBe(404);
    else expect((await firstAfter.json()).title).toBe(state === "edited" ? "Phiên khác đã lưu" : "Bộ phối trước lỗi mạng");
  });
}
