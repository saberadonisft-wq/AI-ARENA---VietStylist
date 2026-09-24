import { expect, test } from "@playwright/test";
import { shareUrlForOrigin } from "../src/lib/shareUrl";

test("share link follows the site origin instead of the API's localhost setting", () => {
  expect(shareUrlForOrigin("a-b_C", "https://vietstylist.example")).toBe(
    "https://vietstylist.example/chia-se/a-b_C",
  );
  expect(shareUrlForOrigin("a-b_C", "http://127.0.0.1:3100")).toBe(
    "http://127.0.0.1:3100/chia-se/a-b_C",
  );
});

test("lookbook page displays a usable current-site link when API returns localhost", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-lookbook-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "lookbook-user", email: "lookbook@example.invalid", displayName: "Lookbook", roles: ["user"] }));
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { id: "lookbook-user", email: "lookbook@example.invalid", display_name: "Lookbook", roles: ["user"] } }));
  await page.route("**/api/lookbooks/lb-share**", route => {
    const data = route.request().method() === "POST"
      ? { share_token: "safe-token", share_url: "http://localhost:3000/chia-se/safe-token", scope: "view_only" }
      : { id: "lb-share", title: "Lookbook", description: "", visibility: "unlisted", created_at: "2026-09-23T00:00:00Z", entries: [] };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/lookbook/lb-share");
  await page.getByRole("button", { name: "Tạo liên kết chia sẻ Lookbook" }).click();
  await expect(page.getByText("http://127.0.0.1:3100/chia-se/safe-token")).toBeVisible();
});

test("guest cannot load a private lookbook detail before signing in", async ({ page }) => {
  let lookbookRequests = 0;
  await page.route("**/api/lookbooks/lb-private", route => {
    lookbookRequests++;
    return route.fulfill({ json: { id: "lb-private", title: "Private", description: "", visibility: "private", created_at: "2026-09-23T00:00:00Z", entries: [] } });
  });
  await page.goto("/lookbook/lb-private");
  await expect(page.getByRole("heading", { name: "Đăng nhập để xem Lookbook của bạn" })).toBeVisible();
  await expect.poll(() => lookbookRequests).toBe(0);
});

test("Lookbook deletion explains its scope, honors cancel, and exposes server failure before retry", async ({ page }) => {
  let deleteAttempts = 0;
  await page.addInitScript(() => {
    localStorage.setItem("viet_stylist_auth_token", "test-lookbook-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ id: "lookbook-user", email: "lookbook@example.invalid", displayName: "Lookbook", roles: ["user"] }));
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { id: "lookbook-user", email: "lookbook@example.invalid", display_name: "Lookbook", roles: ["user"] } }));
  await page.route("**/api/lookbooks/lb-delete", route => {
    if (route.request().method() === "DELETE") {
      deleteAttempts += 1;
      return route.fulfill(deleteAttempts === 1
        ? { status: 503, json: { error: { code: "SERVICE_UNAVAILABLE", message: "Máy chủ không khả dụng." } } }
        : { json: { id: "lb-delete", status: "deleted" } });
    }
    return route.fulfill({ json: { id: "lb-delete", title: "Bộ sưu tập thử", description: "", visibility: "private", created_at: "2026-09-23T00:00:00Z", entries: [] } });
  });

  await page.goto("/lookbook/lb-delete");
  await expect(page.getByRole("heading", { name: "Bộ sưu tập thử" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa Lookbook" }).click();
  let confirm = page.getByRole("alertdialog", { name: "Xóa Lookbook này?" });
  await expect(confirm).toContainText("Các bộ phối đã lưu trong Tủ đồ vẫn được giữ");
  await confirm.getByRole("button", { name: "Hủy" }).click();
  await expect(confirm).toHaveCount(0);
  expect(deleteAttempts).toBe(0);

  await page.getByRole("button", { name: "Xóa Lookbook" }).click();
  confirm = page.getByRole("alertdialog", { name: "Xóa Lookbook này?" });
  await confirm.getByRole("button", { name: "Xóa Lookbook" }).click();
  await expect(page.getByRole("status")).toContainText("Không xóa được Lookbook");
  expect(deleteAttempts).toBe(1);

  await page.getByRole("button", { name: "Xóa Lookbook" }).click();
  await page.getByRole("alertdialog", { name: "Xóa Lookbook này?" }).getByRole("button", { name: "Xóa Lookbook" }).click();
  await expect.poll(() => deleteAttempts).toBe(2);
  await expect(page).toHaveURL(/\/lookbook$/);
});
