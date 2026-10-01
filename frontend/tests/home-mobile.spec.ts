import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:4100/**", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("home content and touch targets fit phones, landscape, tablet and desktop", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 375, height: 812 },
    { width: 430, height: 932 },
    { width: 667, height: 375 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const clipped = await page.locator("main h1, main h2, main h3, main p, main dl, main a").evaluateAll(elements =>
      elements.filter(element => element.getClientRects().length > 0).flatMap(element => {
        const box = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1 || text.left < -1 || text.right > innerWidth + 1
          ? [element.textContent?.trim().slice(0, 70)] : [];
      }),
    );
    expect(clipped, `Clipped content at ${viewport.width}px`).toEqual([]);

    const undersized = await page.locator("main a").evaluateAll(elements => elements.flatMap(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.width < 44 || box.height < 44) ? [element.textContent?.trim()] : [];
    }));
    expect(undersized, `Small touch targets at ${viewport.width}px`).toEqual([]);

    const titleLines = await page.locator("h1").evaluate(element => {
      const first = document.createRange();
      first.selectNodeContents(element.firstChild!);
      const second = document.createRange();
      second.selectNodeContents(element.querySelector("span")!);
      return { first: first.getClientRects().length, second: second.getClientRects().length };
    });
    expect(titleLines).toEqual({ first: 1, second: 1 });

    if (viewport.width < 640) {
      const cards = page.getByRole("region", { name: "Bảo Tàng Thu Nhỏ 5 Hình Thái Cổ Phục" }).getByRole("link");
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
      expect(second!.x).toBeGreaterThan(first!.x + first!.width);
    }
  }
});

test("touch shortcuts and keyboard gallery links reach visible garment content below the header", async ({ page }) => {
  await page.getByRole("link", { name: "Tìm hiểu 5 dáng áo" }).tap();
  const shortcuts = page.getByRole("navigation", { name: "Chọn dáng áo" });
  await expect(shortcuts).toBeInViewport();
  for (const label of ["Giao Lĩnh", "Viên Lĩnh", "Nhật Bình", "Áo Tấc", "Ngũ Thân Tay Chẽn"]) {
    const link = shortcuts.getByRole("link", { name: label, exact: true });
    const target = page.locator((await link.getAttribute("href"))!);
    await link.tap();
    await expect(target).toBeFocused();
    await expect(target).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await target.boundingBox())!.y).toBeGreaterThanOrEqual(64);
    await expect(target.getByRole("img").first()).toBeInViewport();
  }

  const gallery = page.getByRole("region", { name: "Bảo Tàng Thu Nhỏ 5 Hình Thái Cổ Phục" });
  const card = gallery.getByRole("link").last();
  const target = page.locator((await card.getAttribute("href"))!);
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(target).toBeFocused();
  await expect(target.getByRole("img").first()).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("mobile-garment.png") });
});

test("enlarged text remains readable and mobile navigation works with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const clippedText = await page.locator("main h1, main h2, main h3, main p, main dd, main a").evaluateAll(elements =>
    elements.filter(element => element.getClientRects().length > 0).flatMap(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = range.getBoundingClientRect();
      return box.left < -1 || box.right > innerWidth + 1 ? [element.textContent?.trim().slice(0, 70)] : [];
    }),
  );
  expect(clippedText).toEqual([]);
  await page.getByRole("link", { name: "Tìm hiểu 5 dáng áo" }).tap();
  await page.getByRole("navigation", { name: "Chọn dáng áo" }).getByRole("link", { name: "Áo Tấc", exact: true }).tap();
  await expect(page.locator("#garment-ao-tac")).toBeFocused();
  await expect(page.locator("#garment-ao-tac")).toHaveCSS("opacity", "1");
});

for (const width of [375, 767, 768, 1440]) {
  test(`backgrounds load only the matching composition at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
    const page = await context.newPage();
    const requestedImages: string[] = [];
    page.on("request", request => {
      if (request.resourceType() === "image") requestedImages.push(new URL(request.url()).pathname);
    });
    await page.route("http://127.0.0.1:4100/**", route => route.fulfill({ json: [] }));
    try {
      await page.goto("/");
      const backgrounds = page.locator("main picture img");
      await expect(backgrounds).toHaveCount(6);
      for (const [index, background] of (await backgrounds.all()).entries()) {
        await background.scrollIntoViewIfNeeded();
        await expect.poll(() => background.evaluate((image: HTMLImageElement) =>
          image.complete && image.naturalWidth > 0,
        )).toBe(true);
        const { selected, desktop, mobile } = await background.evaluate((image: HTMLImageElement) => ({
          selected: new URL(image.currentSrc).pathname,
          desktop: image.getAttribute("src")!,
          mobile: image.parentElement!.querySelector("source")!.getAttribute("srcset")!,
        }));
        expect(selected).toBe(width < 768 ? mobile : desktop);
        expect(requestedImages).toContain(selected);
        expect(requestedImages).not.toContain(width < 768 ? desktop : mobile);
        if (index === 0) {
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: test.info().outputPath(`hero-${width}.png`) });
        }
      }
    } finally {
      await context.close();
    }
  });
}
