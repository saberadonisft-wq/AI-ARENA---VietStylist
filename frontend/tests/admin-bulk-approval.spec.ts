import { test, expect, type Page } from "@playwright/test";
import type { StylistSubmission } from "../src/lib/api/admin";

const sample = (index: number, name = `Mẫu trang phục ${index}`): StylistSubmission => ({
  id: `submission-${index}`, name, garment_type_id: "group-test", garment_type_name: "Bộ phỏng dựng",
  slot: "outerwear", gender: "unisex", era: "Đương đại – phỏng dựng", status: "pending",
  description: "Mẫu phỏng dựng để kiểm tra luồng xét duyệt.", material: "Lụa", color_name: "Xanh", hex_color: "#123456",
});

async function setup(page: Page, entries: StylistSubmission[], options: {
  role?: string;
  failures?: Record<string, { code: string; message: string; status: number }>;
  failListOffset?: number;
  holdFirstReview?: boolean;
} = {}) {
  const account = { id: "admin-1", email: "admin@example.invalid", display_name: "Admin Test", roles: [options.role || "admin"], auth_provider: "local" };
  const events: { method: string; path: string; offset?: number; limit?: number; search?: string; body?: unknown }[] = [];
  let releaseFirst!: () => void;
  const firstReview = new Promise<void>(resolve => { releaseFirst = resolve; });
  let reviewCount = 0;
  await page.addInitScript(account => {
    localStorage.setItem("viet_stylist_auth_token", "test-admin-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify({ ...account, displayName: account.display_name }));
  }, account);
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const send = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    events.push({ method, path, ...(method === "POST" ? { body: request.postDataJSON() } : {}) });
    if (path === "/api/auth/me") return send(account);
    if (path === "/api/outfits/page") return send({ items: [], next_cursor: null });
    if (path === "/api/admin/overview") return send({ users: 1, items: entries.filter(x => x.status === "approved").length, outfits: 0, lookbooks: 0, rules: 0 });
    if (path === "/api/admin/stylist-submissions") {
      const search = url.searchParams.get("search") || "";
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      Object.assign(events[events.length - 1], { offset, limit, search });
      if (offset === options.failListOffset) return send({ error: { code: "LIST_UNAVAILABLE", message: "Không tải được trang tiếp theo." } }, 503);
      const matches = entries.filter(x => x.status === "pending" && x.name.toLowerCase().includes(search.toLowerCase()));
      return send({ items: matches.slice(offset, offset + limit), total: matches.length });
    }
    const review = path.match(/^\/api\/admin\/stylist-submissions\/([^/]+)\/review$/);
    if (review && method === "POST") {
      reviewCount += 1;
      if (options.holdFirstReview && reviewCount === 1) await firstReview;
      const entry = entries.find(x => x.id === review[1])!;
      const failure = options.failures?.[entry.id];
      if (failure) {
        if (failure.code === "SUBMISSION_ALREADY_REVIEWED") entry.status = "approved";
        return send({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
      entry.status = "approved";
      return send(entry);
    }
    if (path.startsWith("/api/admin/")) return send({ items: [], total: 0 });
    return send([]);
  });
  await page.goto("/tai-khoan");
  const panel = page.getByRole("region", { name: "Quản lý hệ thống" });
  if (account.roles.includes("admin")) {
    await panel.getByRole("button", { name: "Duyệt mẫu stylist", exact: true }).click();
    await expect(panel.getByRole("button", { name: /^Duyệt tất cả/ })).toHaveText(`Duyệt tất cả (${entries.filter(x => x.status === "pending").length})`);
    await expect(panel.getByText("Đang tải dữ liệu…", { exact: true })).toHaveCount(0);
  }
  return { panel, events, releaseFirst, reviews: () => events.filter(x => x.method === "POST" && x.path.endsWith("/review")) };
}

test("bulk approval confirms the full snapshot across pages, supports cancellation and prevents repeated requests", async ({ page }) => {
  test.setTimeout(60_000);
  const entries = Array.from({ length: 121 }, (_, i) => sample(i));
  const { panel, events, reviews, releaseFirst } = await setup(page, entries, { holdFirstReview: true });
  const bulk = panel.getByRole("button", { name: /^Duyệt tất cả/ });
  await bulk.click();
  const dialog = page.getByRole("alertdialog", { name: "Duyệt tất cả mẫu đang chờ?" });
  await expect(dialog).toContainText("121 mẫu");
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(reviews()).toHaveLength(0);
  await bulk.click();
  const refreshesBefore = events.filter(x => x.path === "/api/catalog/items").length;
  await dialog.getByRole("button", { name: "Duyệt 121 mẫu", exact: true }).click();
  await expect.poll(() => reviews().length).toBe(1);
  await expect(bulk).toBeDisabled();
  await expect(panel.getByLabel("Tìm theo tên", { exact: true })).toBeDisabled();
  await expect(panel.getByRole("status").filter({ hasText: "Đang duyệt 0/121 mẫu…" })).toBeVisible();
  const beforeFirstReview = events.slice(0, events.findIndex(x => x.method === "POST"));
  expect(beforeFirstReview.some(x => x.offset === 100 && x.limit === 100)).toBe(true);
  releaseFirst();
  await expect(panel.getByRole("status").filter({ hasText: "Đã duyệt 121/121 mẫu." })).toBeVisible({ timeout: 30_000 });
  await expect(bulk).toBeDisabled();
  expect(reviews()).toHaveLength(121);
  expect(new Set(reviews().map(x => x.path)).size).toBe(121);
  expect(reviews().every(x => (x.body as { action: string }).action === "approve")).toBe(true);
  await expect.poll(() => events.filter(x => x.path === "/api/catalog/items").length).toBe(refreshesBefore + 1);
});

test("bulk approval respects search, continues after storage failure and skips a concurrently reviewed sample", async ({ page }) => {
  const entries = [sample(1, "Ôliu tốt"), sample(2, "Ôliu lỗi ảnh"), sample(3, "Ôliu đã xử lý"), sample(4, "Ôliu cuối"), sample(5, "Áo bào ngoài bộ lọc")];
  const { panel, reviews } = await setup(page, entries, { failures: {
    "submission-2": { code: "STORAGE_UNAVAILABLE", status: 503, message: "Không đọc được ảnh mẫu." },
    "submission-3": { code: "SUBMISSION_ALREADY_REVIEWED", status: 409, message: "Mẫu này đã được xét duyệt." },
  } });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByLabel("Tìm theo tên", { exact: true }).fill("Ôliu");
  const bulk = panel.getByRole("button", { name: "Duyệt tất cả (4)", exact: true });
  await expect(bulk).toBeEnabled();
  expect(await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
  await bulk.click();
  const dialog = page.getByRole("alertdialog", { name: "Duyệt tất cả mẫu đang chờ?" });
  await expect(dialog).toContainText("kết quả tìm kiếm “Ôliu”");
  await dialog.getByRole("button", { name: "Duyệt 4 mẫu", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Đã duyệt 2/4 mẫu." })).toBeVisible();
  await expect(panel.getByRole("alert")).toContainText("Ôliu lỗi ảnh: Không đọc được ảnh mẫu.");
  await expect(panel.getByRole("status").filter({ hasText: "đã được xử lý ở phiên khác" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Duyệt tất cả (1)", exact: true })).toBeEnabled();
  expect(reviews().map(x => x.path.match(/submission-\d+/)![0])).toEqual(["submission-1", "submission-2", "submission-3", "submission-4"]);
  expect(entries[4].status).toBe("pending");
});

test("a later page failing to load never publishes a partial snapshot", async ({ page }) => {
  const { panel, reviews } = await setup(page, Array.from({ length: 101 }, (_, i) => sample(i)), { failListOffset: 100 });
  await panel.getByRole("button", { name: /^Duyệt tất cả/ }).click();
  await expect(panel.getByRole("alert")).toHaveText("Không tải được trang tiếp theo.");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(reviews()).toHaveLength(0);
  await expect(panel.getByRole("button", { name: /^Duyệt tất cả/ })).toBeEnabled();
});

for (const status of [401, 403, 429]) test(`bulk approval stops on HTTP ${status} and reports untouched samples`, async ({ page }) => {
  const { panel, reviews } = await setup(page, [sample(1), sample(2), sample(3)], { failures: {
    "submission-2": { code: "REVIEW_BLOCKED", status, message: "Chưa thể tiếp tục xét duyệt." },
  } });
  await panel.getByRole("button", { name: /^Duyệt tất cả/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt 3 mẫu", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Đã dừng; 1 mẫu chưa được xử lý." })).toBeVisible();
  expect(reviews()).toHaveLength(2);
});

test("switching login sessions stops further publication", async ({ page }) => {
  const { panel, reviews, releaseFirst } = await setup(page, [sample(1), sample(2)], { holdFirstReview: true });
  await panel.getByRole("button", { name: /^Duyệt tất cả/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt 2 mẫu", exact: true }).click();
  await expect.poll(() => reviews().length).toBe(1);
  await page.evaluate(() => localStorage.setItem("viet_stylist_auth_token", "different-session-token"));
  releaseFirst();
  await expect(panel.getByLabel("Tìm theo tên", { exact: true })).toBeEnabled();
  expect(reviews()).toHaveLength(1);
});

test("an empty queue disables bulk approval", async ({ page }) => {
  const { panel, reviews } = await setup(page, []);
  await expect(panel.getByRole("button", { name: "Duyệt tất cả (0)", exact: true })).toBeDisabled();
  expect(reviews()).toHaveLength(0);
});

for (const role of ["user", "stylist"]) test(`${role} cannot access bulk approval`, async ({ page }) => {
  const { reviews } = await setup(page, [sample(1)], { role });
  await expect(page.getByRole("region", { name: "Quản lý hệ thống" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Duyệt tất cả/ })).toHaveCount(0);
  expect(reviews()).toHaveLength(0);
});
