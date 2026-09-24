import { expect, test } from "@playwright/test";

test("story loading failure is distinct from an empty category and offers retry", async ({ page }) => {
  let articleReads = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/heritage/articles") {
      articleReads += 1;
      return articleReads <= 2
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Máy chủ nội dung không khả dụng." } }) })
        : route.fulfill({ json: [] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/chuyen-co-phuc");
  await expect(page.locator('p[role="alert"]')).toContainText("Máy chủ nội dung không khả dụng");
  await expect(page.getByText("Không tìm thấy câu chuyện phù hợp")).toHaveCount(0);
  await page.getByRole("button", { name: "Thử tải lại câu chuyện" }).click();
  await expect(page.getByText("Không tìm thấy câu chuyện phù hợp")).toBeVisible();
  expect(articleReads).toBeGreaterThanOrEqual(3);
});

test("story deletion explains its scope, honors cancellation, and keeps API errors visible", async ({ page }) => {
  let deleteAttempts = 0;
  const story = {
    id: "story-1",
    title: "Áo ngũ thân trong đời sống",
    slug: "ao-ngu-than",
    short_summary: "Câu chuyện về cấu trúc áo ngũ thân.",
    full_content: "Một bài viết thử nghiệm.",
    status: "published",
    version: 1,
    author_id: "stylist-1",
    author_name: "Stylist Test",
    author_role: "stylist",
    category: "Nghiên cứu Cổ phong",
    era: "Triều Nguyễn",
  };
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-story-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "stylist-1", email: "stylist@example.invalid", displayName: "Stylist Test", roles: ["stylist"] }));
  });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { id: "stylist-1", email: "stylist@example.invalid", display_name: "Stylist Test", roles: ["stylist"] } });
    if (path === "/api/heritage/articles" && request.method() === "GET") return route.fulfill({ json: deleteAttempts > 1 ? [] : [story] });
    if (path === "/api/heritage/articles/story-1" && request.method() === "DELETE") {
      deleteAttempts += 1;
      return deleteAttempts === 1
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Máy chủ không khả dụng." } }) })
        : route.fulfill({ json: { status: "deleted" } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/chuyen-co-phuc");
  await page.getByRole("article").filter({ hasText: story.title }).click();
  await page.getByRole("button", { name: "Xóa câu chuyện" }).click();
  let confirm = page.getByRole("alertdialog", { name: "Xóa câu chuyện này?" });
  await expect(confirm).toContainText("không còn xuất hiện trong danh sách bài viết");
  await confirm.getByRole("button", { name: "Hủy" }).click();
  await expect(confirm).toHaveCount(0);
  expect(deleteAttempts).toBe(0);

  await page.getByRole("button", { name: "Xóa câu chuyện" }).click();
  confirm = page.getByRole("alertdialog", { name: "Xóa câu chuyện này?" });
  await confirm.getByRole("button", { name: "Xóa câu chuyện" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Không xóa được câu chuyện");
  await expect(page.locator('p[role="alert"]')).toContainText("Máy chủ không khả dụng");
  expect(deleteAttempts).toBe(1);

  await page.getByRole("button", { name: "Xóa câu chuyện" }).click();
  await page.getByRole("alertdialog", { name: "Xóa câu chuyện này?" }).getByRole("button", { name: "Xóa câu chuyện" }).click();
  await expect(page.getByRole("status")).toContainText("Đã xóa câu chuyện");
  await expect.poll(() => deleteAttempts).toBe(2);
});
