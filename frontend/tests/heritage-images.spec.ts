import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=", "base64");
const files = ["nhat-binh.png", "hoa-van.png"].map(name => ({ name, mimeType: "image/png", buffer: png }));

test("mobile story uploads multiple images, reads detail, edits custom category and retains photos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let saved: any = null;
  let uploads = 0;
  let saves = 0;
  let failSecondUpload = true;
  let activeUploads = 0;
  let peakUploads = 0;
  let releaseInitialUploads!: () => void;
  const initialUploadsReady = new Promise<void>(resolve => { releaseInitialUploads = resolve; });
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
      activeUploads++;
      peakUploads = Math.max(peakUploads, activeUploads);
      if (activeUploads === 2) releaseInitialUploads();
      if (/\/(1|2)$/.test(path)) await initialUploadsReady;
      activeUploads--;
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
  expect(peakUploads).toBe(2);
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

test("invalid story text is caught before upload and server field errors identify the input", async ({ page }) => {
  let uploadCalls = 0;
  let saveCalls = 0;
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "review-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "author", email: "author@example.invalid", displayName: "Author", roles: ["stylist"] }));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { id: "author", display_name: "Author", roles: ["stylist"] } });
    if (path === "/api/heritage/images/uploads") uploadCalls++;
    if (path === "/api/heritage/articles" && route.request().method() === "POST") {
      saveCalls++;
      return route.fulfill({ status: 422, json: { error: { code: "VALIDATION_ERROR", message: "Dữ liệu yêu cầu không hợp lệ", details: { validation_errors: [{ field: "body -> title", message: "Tiêu đề không hợp lệ." }] } } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/chuyen-co-phuc");
  await page.getByRole("button", { name: /Đăng tải câu chuyện mới/ }).click();
  await page.getByLabel("Tiêu đề câu chuyện", { exact: true }).fill("A");
  await page.getByLabel("Tóm tắt câu chuyện", { exact: true }).fill("abc");
  await page.getByLabel("Nội dung câu chuyện", { exact: true }).fill("abc");
  await page.getByLabel("Chọn ảnh tư liệu").setInputFiles(files);
  await page.getByRole("button", { name: "Xuất bản Câu chuyện", exact: true }).click();
  await expect(page.getByText("Tiêu đề cần từ 3 đến 255 ký tự.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Tóm tắt câu chuyện", { exact: true })).toHaveAttribute("aria-invalid", "true");
  expect(uploadCalls).toBe(0);
  expect(saveCalls).toBe(0);
  await page.getByLabel("Tiêu đề câu chuyện", { exact: true }).fill("Tiêu đề hợp lệ");
  await page.getByLabel("Tóm tắt câu chuyện", { exact: true }).fill("Tóm tắt đủ dài để hợp lệ.");
  await page.getByLabel("Nội dung câu chuyện", { exact: true }).fill("Nội dung đầy đủ dài hơn hai mươi ký tự.");
  await page.getByLabel("Bỏ ảnh 2", { exact: true }).click();
  await page.getByLabel("Bỏ ảnh 1", { exact: true }).click();
  await page.getByRole("button", { name: "Xuất bản Câu chuyện", exact: true }).click();
  await expect(page.locator("#story-title-error")).toHaveText("Tiêu đề: Tiêu đề không hợp lệ.");
  await expect(page.getByLabel("Nội dung câu chuyện", { exact: true })).toHaveValue("Nội dung đầy đủ dài hơn hai mươi ký tự.");
});

test("choosing a gallery cover replaces an external URL and stale edits retain the draft until reviewed", async ({ page }) => {
  const base = { id: "story-1", slug: "story", title: "Bài viết ban đầu", short_summary: "Tóm tắt đủ dài để đọc.", full_content: "Nội dung gốc của câu chuyện Việt phục.", status: "published", version: 1, author_id: "author", cover_image_url: "https://images.invalid/external-cover.png", images: [
    { media_id: "img-1", url: "https://images.invalid/1.png", caption: "Ảnh thứ nhất" },
    { media_id: "img-2", url: "https://images.invalid/2.png", caption: "Ảnh thứ hai" },
  ] };
  const requests: any[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "review-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "author", email: "author@example.invalid", displayName: "Author", roles: ["stylist"] }));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { id: "author", display_name: "Author", roles: ["stylist"] } });
    if (path === "/api/heritage/articles") return route.fulfill({ json: [base] });
    if (path === "/api/heritage/articles/story-1") {
      if (route.request().method() === "PUT") {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) return route.fulfill({ status: 409, json: { error: { code: "ARTICLE_VERSION_CONFLICT", message: "Bài viết đã được cập nhật ở cửa sổ khác." } } });
        return route.fulfill({ json: { id: base.id, version: 3 } });
      }
      return route.fulfill({ json: { ...base, version: requests.length ? 2 : 1, full_content: requests.length ? "Nội dung mới từ cửa sổ khác cần đối chiếu." : base.full_content } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/chuyen-co-phuc");
  await page.getByRole("article").click();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await page.getByRole("button", { name: "Dùng làm ảnh bìa", exact: true }).nth(1).click();
  await expect(page.getByLabel("Đường dẫn ảnh bìa riêng", { exact: true })).toHaveValue(base.images[1].url);
  await page.getByLabel("Nội dung câu chuyện", { exact: true }).fill("Bản đang soạn của tôi cần được giữ nguyên.");
  await page.getByRole("button", { name: "Lưu chỉnh sửa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem phiên bản mới", exact: true })).toBeVisible();
  await expect(page.getByLabel("Nội dung câu chuyện", { exact: true })).toHaveValue("Bản đang soạn của tôi cần được giữ nguyên.");
  await expect(page.getByRole("button", { name: "Lưu chỉnh sửa", exact: true })).toBeDisabled();
  expect(requests[0].expected_version).toBe(1);
  expect(requests[0].cover_image_url).toBe(base.images[1].url);
  await page.getByRole("button", { name: "Xem phiên bản mới", exact: true }).click();
  await expect(page.getByText("Nội dung mới từ cửa sổ khác cần đối chiếu.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đã đối chiếu, dùng bản đang soạn", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Đã đối chiếu, tiếp tục", exact: true }).click();
  await page.getByRole("button", { name: "Lưu chỉnh sửa", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].expected_version).toBe(2);
  expect(requests[1].full_content).toBe("Bản đang soạn của tôi cần được giữ nguyên.");
});
