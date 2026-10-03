import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=", "base64");
const files = ["nhat-binh.png", "hoa-van.png"].map(name => ({ name, mimeType: "image/png", buffer: png }));

test("mobile story uploads multiple images, reads detail, edits custom category and retains photos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let saved: any = null;
  let uploads = 0;
  let saves = 0;
  let failSecondUpload = true;
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-story-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "stylist-1", displayName: "Stylist Test", roles: ["stylist"] }));
  });
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { id: "stylist-1", display_name: "Stylist Test", roles: ["stylist"] } });
    if (path === "/api/heritage/images/uploads") {
      uploads++;
      return route.fulfill({ json: { media_id: `media-${uploads}`, method: "POST", storage_type: "local", upload_url: `http://127.0.0.1:4100/api/test-upload/${uploads}` } });
    }
    if (path.startsWith("/api/test-upload/")) {
      if (path.endsWith("/2") && failSecondUpload) { failSecondUpload = false; return route.fulfill({ status: 503 }); }
      return route.fulfill({ json: {} });
    }
    if (path.endsWith("/complete")) {
      const id = path.split("/")[3];
      return route.fulfill({ json: { id, public_url: `http://127.0.0.1:4100/api/test-image/${id}`, status: "ready" } });
    }
    if (path.startsWith("/api/test-image/")) return route.fulfill({ contentType: "image/png", body: png });
    if (path.startsWith("/api/heritage/articles")) {
      if (["POST", "PUT"].includes(req.method())) {
        saves++;
        const payload = req.postDataJSON();
        saved = { ...payload, id: "story-1", slug: "nhat-binh", status: "published", version: saves, author_id: "stylist-1", author_name: "Stylist Test", images: payload.images.map((image: any) => ({ ...image, url: `http://127.0.0.1:4100/api/test-image/${image.media_id}` })) };
        saved.cover_image_url ||= saved.images[0]?.url;
        return route.fulfill({ json: { id: "story-1" } });
      }
      if (path.endsWith("/story-1")) return route.fulfill({ json: saved });
      // The real list endpoint intentionally omits content and photos.
      return route.fulfill({ json: saved ? [{ id: saved.id, title: saved.title, short_summary: saved.short_summary, status: "published", version: 1 }] : [] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/chuyen-co-phuc");
  await page.getByRole("button", { name: /Đăng tải câu chuyện mới/ }).click();
  await page.getByPlaceholder("Ví dụ: Bí ẩn Phượng ổ", { exact: false }).fill("Nhật Bình nơi Vatican");
  await page.getByPlaceholder("Một câu văn đắt giá", { exact: false }).fill("Tư liệu minh họa áo Nhật Bình trong lịch sử.");
  await page.getByPlaceholder("Kể câu chuyện", { exact: false }).fill("Đây là toàn bộ nội dung câu chuyện.\nDòng thứ hai vẫn được hiển thị.");
  await page.getByLabel("Thể loại chủ đề").fill("Tư liệu ngoại giao");
  await page.getByLabel("Chọn ảnh tư liệu").setInputFiles(files);
  await page.getByLabel("Chú thích / nguồn ảnh 1").fill("Nguồn: tư liệu Nhật Bình");
  await page.getByLabel("Chú thích / nguồn ảnh 2").fill("Chi tiết hoa văn trên áo");
  await page.getByRole("button", { name: "Dùng làm ảnh bìa", exact: true }).click();
  await page.getByRole("button", { name: "Xuất bản Câu chuyện", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được ảnh" })).toBeVisible();
  expect(saves).toBe(0);
  await expect(page.getByLabel("Chú thích / nguồn ảnh 1")).toHaveValue("Chi tiết hoa văn trên áo");
  await page.getByRole("button", { name: "Xuất bản Câu chuyện", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tư liệu minh họa", exact: true })).toBeVisible();
  expect(uploads).toBe(3); // A successful photo is reused after a sibling failure.
  await expect(page.getByText("Đây là toàn bộ nội dung câu chuyện.", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tư liệu minh họa", exact: true }).getByRole("img")).toHaveCount(2);
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByLabel("Thể loại chủ đề")).toHaveValue("Tư liệu ngoại giao");
  await page.getByLabel("Chọn ảnh tư liệu").setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg />") });
  await expect(page.getByRole("alert").filter({ hasText: "cần là ảnh JPG" })).toBeVisible();
  await page.getByLabel("Bỏ ảnh 1", { exact: true }).click();
  await page.getByLabel("Thể loại chủ đề").fill("Hoa văn Việt");
  await page.getByPlaceholder("Kể câu chuyện", { exact: false }).fill("Nội dung đã chỉnh sửa đầy đủ cùng tư liệu minh họa.");
  await page.getByRole("button", { name: "Lưu chỉnh sửa", exact: true }).click();
  await expect(page.getByText("Nội dung đã chỉnh sửa đầy đủ cùng tư liệu minh họa.", { exact: true })).toBeVisible();
  expect(saved.images).toHaveLength(1);
  expect(saved.category).toBe("Hoa văn Việt");
  await page.reload();
  await page.getByRole("article").click();
  await expect(page.getByText("Nội dung đã chỉnh sửa đầy đủ cùng tư liệu minh họa.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tư liệu minh họa", exact: true }).getByRole("img")).toHaveCount(1);
  await page.screenshot({ path: "test-results/heritage-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
