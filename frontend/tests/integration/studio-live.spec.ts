import { test, expect } from "@playwright/test";
import { DRAFT_KEY, sameDocument } from "../../src/features/studio/state";

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
    await expect(page.getByTestId("studio-composer")).toBeVisible();
    await expect(page.getByTestId("studio-composer").getByText(/chưa có ánh xạ đầy đủ/)).toBeVisible();
    await page.getByTestId("studio-composer").getByRole("button", { name: "Chọn bối cảnh và bộ dữ liệu riêng" }).click();
    await expect(page.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("dev");
  }
  await page.locator("input").first().fill("Nháp khách trước đăng nhập");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).first().click();
  await page.getByPlaceholder("yourname@gmail.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập vào VietStylist" }).click();
  await expect(page.getByPlaceholder("yourname@gmail.com")).toHaveCount(0);
  await expect(page.locator("input").first()).toHaveValue("Nháp khách trước đăng nhập");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  const readDraft = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), DRAFT_KEY);
  await expect.poll(async () => (await readDraft())?.revision).toBe(1);
  const draft = await readDraft();
  expect(draft.ownerId).toBe(account.user.id);
  const headers = { Authorization: `Bearer ${account.access_token}` };
  const saved = await request.get(`http://127.0.0.1:4100/api/outfits/${draft.outfitId}`, { headers });
  expect(saved.ok()).toBeTruthy();
  const persisted = await saved.json();
  expect(sameDocument({ title: persisted.title, snapshot: persisted.current_snapshot }, draft)).toBe(true);
  if (mappingResponse) expect(persisted.current_snapshot.culturalSettings).toMatchObject({ dataset_version: "dev", context: { period_ids: [], region_ids: [] } });

  const loaded = page.waitForResponse(response => response.url().endsWith(`/api/outfits/${draft.outfitId}`) && response.request().method() === "GET");
  await page.goto(`/studio?loadOutfit=${encodeURIComponent(draft.outfitId)}`);
  await loaded;
  await expect(page.locator("input").first()).toHaveValue("Nháp khách trước đăng nhập");
  if (mappingResponse) await expect(page.getByLabel("Bộ dữ liệu", { exact: true })).toHaveValue("dev");
  const otherTab = await context.newPage();
  await otherTab.goto(`/studio?loadOutfit=${encodeURIComponent(draft.outfitId)}`);
  await expect(otherTab.locator("input").first()).toHaveValue("Nháp khách trước đăng nhập");
  await otherTab.locator("input").first().fill("Tab khác đã lưu");
  const competing = otherTab.waitForResponse(response => response.url().endsWith(`/api/outfits/${draft.outfitId}`) && response.request().method() === "PUT");
  await otherTab.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  expect((await competing).ok()).toBeTruthy();
  await page.locator("input").first().fill("Nội dung của tab cũ");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Lưu bộ phối" })).toContainText("Bản nháp của bạn vẫn được giữ");
  await expect(page.locator("input").first()).toHaveValue("Nội dung của tab cũ");
  const latest = await request.get(`http://127.0.0.1:4100/api/outfits/${draft.outfitId}`, { headers });
  expect((await latest.json()).title).toBe("Tab khác đã lưu");

  await otherTab.goto("/lookbook");
  await otherTab.getByRole("button", { name: "Tạo Lookbook Mới" }).click();
  await otherTab.getByPlaceholder("Ví dụ: Kỷ yếu Cố đô Huế 2026...").fill("Lookbook nghiệm thu");
  await otherTab.getByRole("checkbox", { name: "Tab khác đã lưu" }).check();
  const created = otherTab.waitForResponse(response => response.url().endsWith("/api/lookbooks") && response.request().method() === "POST");
  await otherTab.getByRole("button", { name: "Xác nhận tạo" }).click();
  const createdResponse = await created;
  expect(createdResponse.ok()).toBeTruthy();
  const lookbook = await createdResponse.json();
  expect(lookbook.entries).toHaveLength(1);
  await otherTab.goto(`/lookbook/${lookbook.id}`);
  await expect(otherTab.getByRole("heading", { name: "Lookbook nghiệm thu", exact: true })).toBeVisible();
  const shared = otherTab.waitForResponse(response => response.url().endsWith(`/api/lookbooks/${lookbook.id}/share`));
  await otherTab.getByRole("button", { name: "Tạo link chia sẻ (F09)" }).click();
  const shareResponse = await shared;
  expect(shareResponse.ok()).toBeTruthy();
  const share = await shareResponse.json();

  const anonymous = await browser.newContext();
  try {
    const guest = await anonymous.newPage();
    await guest.goto(`http://127.0.0.1:3100/lookbook/${lookbook.id}`);
    await expect(guest.getByRole("heading", { name: "Không tìm thấy Lookbook" })).toBeVisible();
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
