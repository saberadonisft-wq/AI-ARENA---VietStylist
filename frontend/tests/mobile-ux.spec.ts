import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:4100/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  // Keep authentication checks deterministic; no external identity request.
  await page.route("https://accounts.google.com/**", route => route.abort());
});

test("mobile sign-in fits narrow and short viewports, keeps focus inside and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu điều hướng" }).tap();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
  const dialog = page.getByRole("dialog", { name: "Đăng nhập hoặc tạo tài khoản" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Xác thực & Phân quyền RBAC")).toHaveCount(0);
  const email = dialog.getByLabel("Địa chỉ Email");
  await email.fill("mobile@example.invalid");
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill("mobile-password");
  await dialog.getByRole("button", { name: "Hiện mật khẩu" }).tap();
  await expect(dialog.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute("type", "text");
  expect(await email.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  const bounds = await dialog.locator("button, input").evaluateAll(elements => elements.filter(e => e.getBoundingClientRect().width > 0).map(e => {
    const r = e.getBoundingClientRect();
    return { label: e.getAttribute("aria-label") || e.textContent, width: r.width, height: r.height, right: r.right };
  }));
  for (const r of bounds) {
    expect(r.width, `${r.label} width`).toBeGreaterThanOrEqual(44);
    expect(r.height, `${r.label} height`).toBeGreaterThanOrEqual(44);
    expect(r.right).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: test.info().outputPath("sign-in-320.png") });
  await page.setViewportSize({ width: 667, height: 375 });
  await dialog.getByRole("button", { name: "Tạo tài khoản Mới" }).tap();
  await dialog.getByLabel("Họ và tên / Tên hiển thị").fill("Người dùng Mobile");
  await dialog.getByRole("button", { name: "Hoàn tất Đăng ký" }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Hoàn tất Đăng ký" })).toBeInViewport();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("navigation stays inside tablet widths and its last action remains reachable in landscape", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 812 });
    const button = page.getByRole("button", { name: "Mở menu điều hướng" });
    await expect(button).toBeInViewport();
    await button.tap();
    const nav = page.getByRole("navigation", { name: "Điều hướng trên điện thoại" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Thư viện Cổ phục" })).toBeInViewport();
    await page.getByRole("button", { name: "Đóng menu điều hướng" }).tap();
  }
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole("button", { name: "Mở menu điều hướng" }).tap();
  const register = page.getByRole("navigation", { name: "Điều hướng trên điện thoại" }).getByRole("button", { name: "Đăng ký", exact: true });
  await register.scrollIntoViewIfNeeded();
  await expect(register).toBeInViewport();
  await register.tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ đăng nhập" }).tap();
  await page.getByRole("button", { name: "Mở menu điều hướng" }).tap();
  await page.getByRole("navigation", { name: "Điều hướng trên điện thoại" }).getByRole("link", { name: "Thư viện Cổ phục" }).tap();
  await expect(page).toHaveURL(/\/thu-vien$/);
  await expect(page.getByRole("navigation", { name: "Điều hướng trên điện thoại" })).not.toBeVisible();
});

test("reduced-motion preference shows content without continuing decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const longAnimations = await page.locator("body *").evaluateAll(elements => elements.filter(e => {
    const style = getComputedStyle(e);
    return style.animationName !== "none" && parseFloat(style.animationDuration) > 0.01;
  }).map(e => e.className));
  expect(longAnimations).toEqual([]);
});
