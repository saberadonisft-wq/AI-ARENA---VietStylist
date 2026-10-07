import { expect, test } from "@playwright/test";

test("AI media deletion previews the selected image, preserves scope, and allows retry", async ({ page }) => {
  let deleteAttempts = 0;
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-media-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "media-user", email: "media@example.invalid", displayName: "Media User", roles: ["user"] }));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const send = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/me") return send({ id: "media-user", email: "media@example.invalid", display_name: "Media User", roles: ["user"] });
    if (path === "/api/outfits/page") return send({ items: [], next_cursor: null });
    if (path === "/api/media/ai") return send([{ media_id: "person-photo", purposes: ["person"], status: "ready", created_at: "2026-09-24T00:00:00Z" }]);
    if (path === "/api/media/person-photo/access") return send({ access_url: "/preview-test.svg", expires_in: 300 });
    if (path === "/api/media/person-photo" && method === "DELETE") {
      deleteAttempts += 1;
      return deleteAttempts === 1
        ? send({ error: { code: "MEDIA_IN_USE", message: "Ảnh đang được dùng bởi lượt thử đồ đang chạy. Hãy thử xóa lại sau." } }, 409)
        : send({ message: "Đã xóa file thành công", status: "deleted" });
    }
    return send([]);
  });
  await page.route("**/preview-test.svg", route => route.fulfill({ contentType: "image/svg+xml", body: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"80\" height=\"60\"><rect width=\"80\" height=\"60\" fill=\"#8b1e24\"/></svg>" }));

  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Ảnh AI" }).click();
  await expect(page.getByRole("heading", { name: "Ảnh AI trong tài khoản" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Ảnh nhân vật" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Xóa ảnh AI khỏi tài khoản?" });
  await expect(dialog.getByRole("img", { name: "Ảnh sẽ bị xóa khỏi tài khoản" })).toBeVisible();
  await expect(dialog).toContainText("Ảnh nhân vật");
  await expect(dialog).toContainText("Bộ phối đã lưu và Lookbook được giữ nguyên");
  const keepPhoto = dialog.getByRole("button", { name: "Giữ ảnh" });
  const deletePhoto = dialog.getByRole("button", { name: "Xóa ảnh khỏi tài khoản" });
  await expect(keepPhoto).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(deletePhoto).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keepPhoto).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(deleteAttempts).toBe(0);

  await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();
  await dialog.getByRole("button", { name: "Xóa ảnh khỏi tài khoản" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Ảnh đang được dùng bởi lượt thử đồ đang chạy");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Thử xóa lại" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Ảnh đã được xóa")).toBeVisible();
  expect(deleteAttempts).toBe(2);
});

test("device cleanup removes app drafts and session data but leaves server AI media untouched", async ({ page }) => {
  let deleteAttempts = 0;
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-media-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "media-user", email: "media@example.invalid", displayName: "Media User", roles: ["user"] }));
    localStorage.setItem("viet_stylist_current_draft", JSON.stringify({ title: "Nháp thiết bị" }));
    localStorage.setItem("viet_stylist_current_draft:media-user", JSON.stringify({ title: "Nháp tài khoản" }));
    localStorage.setItem("viet_stylist_current_draft:media-user:recovery:1", JSON.stringify({ title: "Bản khôi phục" }));
    localStorage.setItem("unrelated-app-preference", "keep");
    sessionStorage.setItem("vietstylist_generation:media-user", JSON.stringify({ jobId: "pending-job" }));
    sessionStorage.setItem("unrelated-session", "keep");
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const send = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/me") return send({ id: "media-user", email: "media@example.invalid", display_name: "Media User", roles: ["user"] });
    if (path === "/api/outfits/page") return send({ items: [], next_cursor: null });
    if (path === "/api/media/ai") return send([{ media_id: "server-photo", purposes: ["person"], status: "ready", created_at: "2026-09-24T00:00:00Z" }]);
    if (path === "/api/media/server-photo" && method === "DELETE") {
      deleteAttempts += 1;
      return send({ message: "deleted" });
    }
    return send([]);
  });

  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Quyền riêng tư" }).click();
  await page.getByRole("button", { name: "Dọn dữ liệu trên thiết bị" }).click();
  let confirmation = page.getByRole("alertdialog", { name: "Dọn dữ liệu ViệtStylist trên thiết bị này?" });
  await expect(confirmation).toContainText("Bộ phối, Lookbook và ảnh AI trên máy chủ vẫn còn");
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("test-media-token");
  expect(deleteAttempts).toBe(0);

  await page.getByRole("button", { name: "Dọn dữ liệu trên thiết bị" }).click();
  confirmation = page.getByRole("alertdialog", { name: "Dọn dữ liệu ViệtStylist trên thiết bị này?" });
  await confirmation.getByRole("button", { name: "Dọn dữ liệu trên thiết bị" }).click();

  await expect(page.getByText("Ảnh AI trong tài khoản vẫn còn.")).toBeVisible();
  const remaining = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  expect(remaining.local).toEqual({ "unrelated-app-preference": "keep" });
  expect(remaining.session).toEqual({ "unrelated-session": "keep" });
  expect(deleteAttempts).toBe(0);
});
