import { expect, test } from "@playwright/test";

const detail = { id: "ao-tac", name: "Áo tấc", slot: "outerwear", gender: "unisex", is_published: true, metadata: {} };

test("catalog detail distinguishes a missing item from a failed request", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/catalog/items/ao-tac", route => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "ITEM_NOT_FOUND", message: "Không tìm thấy trang phục." } }),
  }));
  await page.goto("/trang-phuc/ao-tac");
  await expect(page.getByRole("heading", { name: "Không tìm thấy thông tin trang phục" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Không tải được thông tin trang phục" })).toHaveCount(0);
});

test("catalog detail reports network failure and retries without crashing on incomplete variants", async ({ page }) => {
  let attempts = 0;
  let allowRetry = false;
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/catalog/items/ao-tac", route => {
    attempts += 1;
    if (!allowRetry) return route.abort("failed");
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(detail) });
  });

  await page.goto("/trang-phuc/ao-tac");
  await expect(page.getByRole("heading", { name: "Không tải được thông tin trang phục" })).toBeVisible();
  await expect(page.locator("p[role=alert]")).toContainText("Không thể kết nối đến máy chủ");
  const requestsBeforeRetry = attempts;
  allowRetry = true;
  await page.getByRole("button", { name: "Thử tải lại" }).click();
  await expect(page.getByRole("heading", { name: "Áo tấc" })).toBeVisible();
  await expect(page.getByText(/Biến thể màu sắc/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Đưa vào Studio Phối đồ ngay" })).toHaveAttribute("href", "/studio?itemId=ao-tac");
  expect(attempts).toBeGreaterThan(requestsBeforeRetry);
});

test("malformed catalog payload is shown as an API error rather than an empty page", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/catalog/items/ao-tac", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.goto("/trang-phuc/ao-tac");
  await expect(page.getByRole("heading", { name: "Không tải được thông tin trang phục" })).toBeVisible();
  await expect(page.locator("p[role=alert]")).toContainText("trả dữ liệu trang phục không hợp lệ");
});
