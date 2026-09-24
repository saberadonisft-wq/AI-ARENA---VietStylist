import { test, expect, Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";

async function setup(page: Page, role = "admin") {
  const admin = { id: "admin-1", email: "admin@example.invalid", display_name: "Admin Test", roles: [role], auth_provider: "local" };
  let student = { id: "student-1", email: "student@example.invalid", display_name: "Sinh viên Test", roles: ["user"], is_active: true, auth_provider: "local", created_at: "2026-09-23" };
  let garment: any = { id: "shirt-1", name: "Áo thử nghiệm", garment_type_id: "ngu_than", slot: "outerwear", gender: "unisex", is_published: false, metadata: {}, variants: [] };
  let outfit = { id: "look-1", title: "Bộ phối sinh viên", owner_id: student.id, revision: 1, current_snapshot: INITIAL_DOCUMENT.snapshot, style_mode: "traditional", occasion_id: "ky_yeu", created_at: "2026-09-23", updated_at: "2026-09-23" };
  const requests: { method: string; path: string; body: any }[] = [];
  await page.addInitScript(({ admin, document, key }) => {
    localStorage.setItem("viet_stylist_auth_token", "test-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ ...admin, displayName: admin.display_name }));
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ ...document, title: "Bản nháp riêng admin", ownerId: admin.id }));
  }, { admin, document: INITIAL_DOCUMENT, key: DRAFT_KEY });
  await page.route("**/api/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const method = request.method(); const body = method === "GET" ? null : request.postDataJSON();
    requests.push({ method, path, body });
    const send = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/auth/me") return send(admin);
    if (path === "/api/admin/overview") return send({ users: 2, items: 1, outfits: 1, lookbooks: 0, rules: 0 });
    if (path === "/api/admin/users/student-1") { student = { ...student, ...(body.is_active === undefined ? {} : { is_active: body.is_active }), ...(body.is_stylist === undefined ? {} : { roles: body.is_stylist ? ["user", "stylist"] : ["user"] }) }; return send({ status: "updated" }); }
    if (path === "/api/admin/users") return send({ items: [student], total: 1 });
    if (path === "/api/admin/items/shirt-1" && method === "PUT") { garment = { ...garment, ...body }; return send({ status: "updated" }); }
    if (path === "/api/admin/items/shirt-1" && method === "DELETE") { garment = null; return send({ status: "deleted" }); }
    if (path === "/api/admin/items") return send({ items: garment ? [garment] : [], total: garment ? 1 : 0 });
    if (path === "/api/admin/outfits/look-1") { if (method === "PUT") outfit = { ...outfit, title: body.title, revision: outfit.revision + 1, current_snapshot: body.snapshot }; return send(outfit); }
    if (path === "/api/admin/outfits") return send({ items: [outfit], total: 1 });
    if (path === "/api/admin/lookbooks") return send({ items: [], total: 0 });
    if (path === "/api/catalog/garment-types") return send([{ id: "ngu_than", name: "Ngũ thân" }]);
    if (path === "/api/stylist/catalog-submissions") return method === "DELETE"
      ? send({ status: "deleted" })
      : send({ items: [{ id: "submission-1", name: "Áo giao lĩnh thử nghiệm", garment_type_id: "ngu_than", slot: "outerwear", gender: "unisex", status: "pending", era: "Nguyễn", material: "Lụa", color_name: "Đỏ son" }], total: 1 });
    if (path === "/api/cultural-check") return send({ warnings: [], strict_count: 0, warning_count: 0, info_count: 0, is_culturally_sound: true });
    if (path === "/api/color-analysis") return send({ accent_colors: [], suggested_variants: [], contrast_rating: "good", contrast_ratio: 5 });
    if (path === "/api/weather") return send({ location: {}, weather: {}, recommendation: { suggested_accessories: [] } });
    return send([]);
  });
  return requests;
}

test("admin grants and revokes stylist, locks user, and edits catalog on account page", async ({ page }) => {
  const requests = await setup(page);
  await page.goto("/tai-khoan");
  await expect(page.getByRole("heading", { name: "Quản lý hệ thống" })).toBeVisible();
  await page.getByRole("button", { name: "Cấp quyền stylist", exact: true }).click();
  let confirm = page.getByRole("alertdialog", { name: "Cấp quyền stylist?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Hủy" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  expect(requests.filter(r => r.method === "PATCH")).toHaveLength(0);
  await page.getByRole("button", { name: "Cấp quyền stylist", exact: true }).click();
  confirm = page.getByRole("alertdialog", { name: "Cấp quyền stylist?" });
  await confirm.getByRole("button", { name: "Cấp quyền" }).click();
  await expect(page.getByRole("button", { name: "Thu hồi stylist", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thu hồi stylist", exact: true }).click();
  confirm = page.getByRole("alertdialog", { name: "Thu hồi quyền stylist?" });
  await expect(confirm).toContainText("sẽ mất quyền stylist");
  await confirm.getByRole("button", { name: "Thu hồi quyền" }).click();
  await expect(page.getByRole("button", { name: "Cấp quyền stylist", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Khóa tài khoản", exact: true }).click();
  confirm = page.getByRole("alertdialog", { name: "Khóa tài khoản?" });
  await expect(confirm).toContainText("không thể đăng nhập");
  await confirm.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(page.getByRole("button", { name: "Mở khóa", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trang phục", exact: true }).click();
  await page.getByRole("button", { name: "Sửa trang phục", exact: true }).click();
  await page.getByLabel("Tên trang phục", { exact: true }).fill("Áo đã chỉnh sửa");
  await page.getByRole("button", { name: "Lưu trang phục", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Áo đã chỉnh sửa" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  confirm = page.getByRole("alertdialog", { name: "Xóa nội dung này?" });
  await confirm.getByRole("button", { name: "Xóa nội dung" }).click();
  await expect(page.getByText("Chưa có dữ liệu phù hợp.")).toBeVisible();
  expect(requests.filter(r => r.method === "PATCH").map(r => r.body)).toEqual([{ is_stylist: true }, { is_stylist: false }, { is_active: false }]);
});

test("admin Studio edits foreign outfit through admin API and preserves personal draft", async ({ page }) => {
  const requests = await setup(page);
  await page.goto("/studio?loadOutfit=look-1&manage=1");
  const title = page.locator("input").first();
  await expect(title).toHaveValue("Bộ phối sinh viên");
  await title.fill("Admin sửa bộ phối");
  await page.getByRole("button", { name: "Lưu bộ phối", exact: true }).click();
  await expect.poll(() => requests.filter(r => r.method === "PUT" && r.path === "/api/admin/outfits/look-1").length).toBe(1);
  expect(requests.find(r => r.method === "PUT")?.body.revision).toBe(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).title, DRAFT_KEY)).toBe("Bản nháp riêng admin");
  expect(requests.some(r => r.path === "/api/outfits/look-1")).toBe(false);
});

test("student cannot see admin controls", async ({ page }) => {
  await setup(page, "user");
  await page.goto("/tai-khoan");
  await expect(page.getByRole("heading", { name: "Quản lý hệ thống" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cấp quyền stylist", exact: true })).toHaveCount(0);
});

test("stylist confirms removal of a submitted garment and cancellation preserves it", async ({ page }) => {
  const requests = await setup(page, "stylist");
  await page.goto("/stylist");
  await page.getByRole("button", { name: "Mẫu trang phục (1)", exact: true }).click();
  await page.getByRole("button", { name: "Xóa mẫu", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Xóa mẫu đã gửi?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Hủy" }).click();
  await expect(confirm).toHaveCount(0);
  expect(requests.filter(r => r.method === "DELETE" && r.path.includes("catalog-submissions"))).toHaveLength(0);
  await page.getByRole("button", { name: "Xóa mẫu", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Xóa mẫu đã gửi?" }).getByRole("button", { name: "Xóa mẫu" }).click();
  await expect.poll(() => requests.filter(r => r.method === "DELETE" && r.path.includes("catalog-submissions")).length).toBe(1);
  await expect(page.getByText("Đã xóa mẫu “Áo giao lĩnh thử nghiệm”.", { exact: true })).toBeVisible();
});

test("admin controls remain within mobile viewport", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tai-khoan");
  const panel = page.getByRole("region", { name: "Quản lý hệ thống" });
  await expect(panel.getByRole("button", { name: "Cấp quyền stylist", exact: true })).toBeVisible();
  const overflow = await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1);
  expect(overflow).toBe(false);
});
