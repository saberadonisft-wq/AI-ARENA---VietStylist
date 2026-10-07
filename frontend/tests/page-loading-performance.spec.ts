import { expect, test, type Page, type Route } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";
import type { CatalogItem, OutfitResponse } from "../src/lib/types/api";

// These fixtures prove loading dependencies and deferred work, not real media latency.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64");
const userA = { id: "performance-a", email: "performance-a@example.invalid", display_name: "Performance A", displayName: "Performance A", roles: ["stylist"] };
const userB = { id: "performance-b", email: "performance-b@example.invalid", display_name: "Performance B", displayName: "Performance B", roles: ["user"] };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function makeItem(id: string, slot = "outerwear", garmentType = "ngu_than"): CatalogItem {
  return {
    id, name: `Trang phục ${id}`, slot, gender: "unisex", garment_type_id: garmentType,
    is_published: true, metadata: { catalog_media_id: `media-${id}` },
    variants: [{ id: `variant-${id}`, item_id: id, color_name: "Trắng", hex_color: "#FFFFFF", thickness_level: "medium", price_tier: "standard", is_default: true }],
  };
}

function makeOutfit(index: number, ownerId = userA.id): OutfitResponse {
  return {
    id: `outfit-${index}`, owner_id: ownerId, title: `Bộ phối ${index + 1}`, revision: 1,
    occasion_id: "tet", style_mode: "traditional", created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z",
    current_snapshot: {
      ...structuredClone(INITIAL_DOCUMENT.snapshot), backgroundTheme: "occasion", neutralBackgroundTheme: "white", backgroundFade: 25, occasionId: "tet", aspectRatio: "9:16",
      items: ["outerwear", "bottom"].map(slot => ({ slot, itemId: `outfit-${index}-${slot}`, assetVersion: 1, colorHex: "#FFFFFF" })),
    },
  };
}

async function send(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, json: data });
}

async function mockCatalogDefaults(route: Route) {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/catalog/garment-types") return send(route, [{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]);
  if (path === "/api/catalog/occasions") return send(route, [{ id: "tet", name: "Tết", season: "spring" }]);
  if (path === "/api/catalog/avatars") return send(route, [{ id: "avatar_nam_chuan", name: "Nam", gender: "male", skin_tone: "#f1d1b0", body_type: "standard", is_active: true, dimensions: { width: 800, height: 1200 } }]);
  return send(route, []);
}

async function authenticate(page: Page, roles = userA.roles) {
  await page.addInitScript(({ user, key, document }) => {
    localStorage.setItem("viet_stylist_auth_token", "performance-a-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem(key, JSON.stringify({ ...document, ownerId: user.id, title: "Nháp thiết bị cũ cần dọn" }));
  }, { user: { ...userA, roles }, key: DRAFT_KEY, document: INITIAL_DOCUMENT });
}

test("library starts its image while optional avatars are still withheld", async ({ page }) => {
  const avatarsStarted = deferred();
  const releaseAvatars = deferred();
  const item = makeItem("primary-shirt");
  let avatarReturned = false;
  let imageRequested = false;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/thumbnail")) {
      imageRequested = true;
      return route.fulfill({ contentType: "image/png", body: png });
    }
    if (path === "/api/catalog/items") return send(route, [item]);
    if (path === "/api/catalog/avatars") {
      avatarsStarted.resolve();
      await releaseAvatars.promise;
      avatarReturned = true;
    }
    return mockCatalogDefaults(route);
  });
  try {
    await page.goto("/thu-vien");
    await avatarsStarted.promise;
    const results = page.getByRole("region", { name: "Danh sách trang phục" });
    await expect(results.getByRole("img", { name: item.name, exact: true })).toBeVisible();
    await expect.poll(() => imageRequested).toBe(true);
    expect(avatarReturned).toBe(false);
    await expect(results).toHaveAttribute("aria-busy", "false");
  } finally {
    releaseAvatars.resolve();
  }
});

test("library keeps distant cards usable without image requests and loads them once when scrolled into view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const items = Array.from({ length: 20 }, (_, index) => makeItem(`deferred-library-${index}`));
  const requested = new Set<string>();
  const imageRequestCounts = new Map<string, number>();
  const mutations: string[] = [];
  const originalDraft = JSON.stringify({ ...structuredClone(INITIAL_DOCUMENT), title: "Bản nháp thư viện cần giữ" });
  await page.addInitScript(({ key, document }) => localStorage.setItem(key, document), { key: DRAFT_KEY, document: originalDraft });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${path}`);
    if (path.endsWith("/thumbnail") || path.endsWith("/studio-image")) {
      const itemId = path.split("/")[4];
      requested.add(itemId);
      imageRequestCounts.set(itemId, (imageRequestCounts.get(itemId) || 0) + 1);
      return route.fulfill({ contentType: "image/png", body: png });
    }
    if (path === "/api/catalog/items") return send(route, items);
    return mockCatalogDefaults(route);
  });
  await page.goto("/thu-vien");
  const cards = page.getByRole("region", { name: "Danh sách trang phục" }).locator("article");
  await expect(cards).toHaveCount(20);
  const firstImage = cards.first().getByRole("img", { name: items[0].name, exact: true });
  await expect(firstImage).toHaveJSProperty("complete", true);
  // Width descriptors make naturalWidth density-corrected; positive pixels prove loading.
  await expect.poll(() => firstImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const distant = await cards.evaluateAll(elements => elements.flatMap((element, index) => index >= 3 && element.getBoundingClientRect().top > innerHeight + 250 ? [index] : []));
  expect(distant.length).toBeGreaterThan(0);
  for (const index of distant) {
    const card = cards.nth(index);
    await expect(card.getByRole("heading", { name: items[index].name, exact: true })).toHaveCount(1);
    const detailLink = card.getByRole("link", { name: `Xem chi tiết ${items[index].name}`, exact: true });
    await expect(detailLink).toHaveAttribute("href", new RegExp(`/trang-phuc/${items[index].id}\\?`));
    await expect(detailLink).not.toHaveAttribute("aria-disabled", "true");
    await expect(card.getByRole("link", { name: `Phối đồ với ${items[index].name}`, exact: true })).toHaveAttribute("href", `/studio?itemId=${items[index].id}`);
    await expect(card.locator("img")).toHaveCount(0);
    expect(await card.evaluate(element => element.innerHTML.includes("/thumbnail"))).toBe(false);
    expect(requested.has(items[index].id), `image for ${items[index].id} requested before entering the buffer`).toBe(false);
  }
  const lastHeightBefore = await cards.last().evaluate(card => card.getBoundingClientRect().height);
  await firstImage.evaluate(image => image.setAttribute("data-regression-node", "retained"));
  await cards.last().scrollIntoViewIfNeeded();
  const lastImage = cards.last().getByRole("img", { name: items[19].name, exact: true });
  await expect(lastImage).toBeVisible();
  await expect(lastImage).toHaveJSProperty("complete", true);
  await expect.poll(() => lastImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const dimensions = await lastImage.evaluate(image => ({ width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight }));
  expect(dimensions.height).toBe(dimensions.width);
  expect(requested.has(items[19].id)).toBe(true);
  expect(imageRequestCounts.get(items[19].id)).toBe(1);
  const lastHeightAfter = await cards.last().evaluate(card => card.getBoundingClientRect().height);
  expect(Math.abs(lastHeightAfter - lastHeightBefore)).toBeLessThanOrEqual(1);
  await cards.first().scrollIntoViewIfNeeded();
  await expect(firstImage).toHaveAttribute("data-regression-node", "retained");
  expect(imageRequestCounts.get(items[19].id)).toBe(1);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  expect(mutations).toEqual([]);
});

test("library keeps incomplete pagination loading until the final items page returns", async ({ page }) => {
  const finalPageStarted = deferred();
  const releaseFinalPage = deferred();
  const firstPage = Array.from({ length: 50 }, (_, index) => makeItem(`page-one-${index}`));
  const finalItem = makeItem("last-page-item");
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/thumbnail")) return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname === "/api/catalog/items") {
      if (url.searchParams.get("offset") === "50") {
        finalPageStarted.resolve();
        await releaseFinalPage.promise;
        return send(route, [finalItem]);
      }
      return send(route, firstPage);
    }
    return mockCatalogDefaults(route);
  });
  try {
    await page.goto("/thu-vien");
    await finalPageStarted.promise;
    const results = page.getByRole("region", { name: "Danh sách trang phục" });
    await expect(results).toHaveAttribute("aria-busy", "true");
    await expect(results.locator("article")).toHaveCount(0);
    releaseFinalPage.resolve();
    await expect(results.locator("article")).toHaveCount(51);
    await expect(results).toHaveAttribute("aria-busy", "false");
    await expect(results.getByRole("heading", { name: finalItem.name, exact: true })).toHaveCount(1);
  } finally {
    releaseFinalPage.resolve();
  }
});

test("an explicit catalog retry finishes before old optional data and ignores that stale batch", async ({ page }) => {
  const oldAvatarsStarted = deferred();
  const releaseOldBatch = deferred();
  const item = makeItem("retried-shirt");
  let itemAttempts = 0;
  let avatarAttempts = 0;
  let garmentTypeAttempts = 0;
  let oldResponsesFinished = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/thumbnail")) return route.fulfill({ contentType: "image/png", body: png });
    if (path === "/api/catalog/items") {
      itemAttempts++;
      return itemAttempts === 1
        ? send(route, { error: { code: "UNAVAILABLE", message: "Items unavailable" } }, 503)
        : send(route, [item]);
    }
    if (path === "/api/catalog/avatars") {
      avatarAttempts++;
      if (avatarAttempts === 1) {
        oldAvatarsStarted.resolve();
        await releaseOldBatch.promise;
        await send(route, { error: { code: "UNAVAILABLE", message: "Old avatars unavailable" } }, 503);
        oldResponsesFinished++;
        return;
      }
    }
    if (path === "/api/catalog/garment-types") {
      garmentTypeAttempts++;
      if (garmentTypeAttempts === 1) {
        await releaseOldBatch.promise;
        await send(route, [{ id: "ngu_than", name: "Dòng trang phục cũ", slot_schema: [] }]);
        oldResponsesFinished++;
        return;
      }
      return send(route, [{ id: "ngu_than", name: "Dòng trang phục mới", slot_schema: [] }]);
    }
    return mockCatalogDefaults(route);
  });
  try {
    await page.goto("/thu-vien");
    await oldAvatarsStarted.promise;
    await expect(page.getByRole("heading", { name: "Chưa tải được thư viện", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    const results = page.getByRole("region", { name: "Danh sách trang phục" });
    await expect(results.getByRole("img", { name: item.name, exact: true })).toBeVisible();
    expect(itemAttempts).toBe(2);
    expect(oldResponsesFinished).toBe(0);
    await page.getByRole("button", { name: /^Bộ lọc/ }).click();
    const filter = page.getByRole("dialog", { name: "Lọc trang phục" });
    await expect(filter.getByRole("option", { name: "Dòng trang phục mới", exact: true })).toHaveCount(1);
    releaseOldBatch.resolve();
    await expect.poll(() => oldResponsesFinished).toBe(2);
    // Let the late responses be consumed and React paint before checking retained state.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(filter.getByRole("option", { name: "Dòng trang phục mới", exact: true })).toHaveCount(1);
    await expect(filter.getByRole("option", { name: "Dòng trang phục cũ", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(results.getByRole("img", { name: item.name, exact: true })).toBeVisible();
    await expect(results.getByRole("alert")).toHaveCount(0);
  } finally {
    releaseOldBatch.resolve();
  }
});

test("detail shows its image before related heritage settles and keeps the item if heritage fails", async ({ page }) => {
  const heritageStarted = deferred();
  const releaseHeritage = deferred();
  const item = makeItem("primary-detail");
  let heritageReturned = false;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/studio-image")) return route.fulfill({ contentType: "image/png", body: png });
    if (path === `/api/catalog/items/${item.id}`) return send(route, item);
    if (path.startsWith("/api/heritage/articles/")) {
      heritageStarted.resolve();
      await releaseHeritage.promise;
      heritageReturned = true;
      return send(route, { error: { code: "UNAVAILABLE", message: "Related story unavailable" } }, 503);
    }
    return mockCatalogDefaults(route);
  });
  try {
    await page.goto(`/trang-phuc/${item.id}`);
    await heritageStarted.promise;
    const image = page.getByRole("img", { name: item.name, exact: true });
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).toHaveJSProperty("naturalWidth", 16);
    expect(heritageReturned).toBe(false);
    releaseHeritage.resolve();
    await expect.poll(() => heritageReturned).toBe(true);
    await expect(page.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Đưa vào Studio Phối đồ ngay" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Không tải được thông tin trang phục" })).toHaveCount(0);
  } finally {
    releaseHeritage.resolve();
  }
});

test("a late related article from the previous detail cannot replace the newly opened item", async ({ page }) => {
  const releaseOldHeritage = deferred();
  const first = makeItem("first-detail", "outerwear", "ngu_than");
  const second = makeItem("second-detail", "outerwear", "ao_tac");
  let oldStarted = 0;
  let oldFinished = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/studio-image") || path.endsWith("/thumbnail")) return route.fulfill({ contentType: "image/png", body: png });
    if (path === "/api/catalog/items") return send(route, [first, second]);
    if (path === `/api/catalog/items/${first.id}`) return send(route, first);
    if (path === `/api/catalog/items/${second.id}`) return send(route, second);
    if (path === "/api/heritage/articles/art_ngu_than") {
      oldStarted++;
      await releaseOldHeritage.promise;
      await send(route, { id: "art_ngu_than", title: "Bài cũ đã chậm", short_summary: "Nội dung cũ", sources: [] });
      oldFinished++;
      return;
    }
    if (path === "/api/heritage/articles/art_ao_tac") return send(route, { id: "art_ao_tac", title: "Bài mới đang xem", short_summary: "Nội dung mới", sources: [] });
    return mockCatalogDefaults(route);
  });
  try {
    await page.goto(`/trang-phuc/${first.id}`);
    await expect(page.getByRole("img", { name: first.name, exact: true })).toBeVisible();
    await expect.poll(() => oldStarted).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Quay lại Thư viện Cổ phục" }).click();
    await page.getByRole("link", { name: `Xem chi tiết ${second.name}` }).click();
    await expect(page.getByText("Nội dung mới")).toBeVisible();
    releaseOldHeritage.resolve();
    await expect.poll(() => oldFinished).toBe(oldStarted);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole("heading", { name: second.name, exact: true })).toBeVisible();
    await expect(page.getByText("Nội dung cũ")).toHaveCount(0);
  } finally {
    releaseOldHeritage.resolve();
  }
});

test("reading heritage does not load catalog; reopening the writer reuses its loaded catalog", async ({ page }) => {
  await authenticate(page);
  const item = makeItem("writer-shirt");
  let catalogRequests = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return send(route, userA);
    if (path === "/api/heritage/articles") return send(route, [{ id: "story", slug: "story", title: "Câu chuyện để đọc", short_summary: "Đọc không cần danh mục trang phục.", status: "published", version: 1 }]);
    if (path === "/api/catalog/items") {
      catalogRequests++;
      return send(route, [item]);
    }
    return mockCatalogDefaults(route);
  });
  await page.goto("/chuyen-co-phuc");
  await expect(page.getByRole("heading", { name: "Câu chuyện để đọc", exact: true })).toBeVisible();
  expect(catalogRequests).toBe(0);
  const openWriter = page.getByRole("button", { name: /Đăng tải câu chuyện mới/ });
  await openWriter.click();
  const garmentOption = page.getByRole("combobox", { name: "Trang phục liên quan", exact: true }).locator(`option[value="${item.id}"]`);
  await expect(garmentOption).toHaveCount(1);
  expect(catalogRequests).toBe(1);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await openWriter.click();
  await expect(garmentOption).toHaveCount(1);
  expect(catalogRequests).toBe(1);
});

test("heritage cover requests wait for the viewport buffer and retain mounted images after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const requested = new Set<number>();
  const articles = Array.from({ length: 12 }, (_, index) => ({ id: `story-${index}`, slug: `story-${index}`, title: `Câu chuyện ${index + 1}`, short_summary: "Tư liệu minh họa một câu chuyện cổ phục.", status: "published", version: 1, cover_image_url: `/performance-covers/${index}.png` }));
  await page.route("**/api/**", route => new URL(route.request().url()).pathname === "/api/heritage/articles" ? send(route, articles) : mockCatalogDefaults(route));
  await page.route("**/performance-covers/*.png", route => {
    requested.add(Number(new URL(route.request().url()).pathname.match(/\/(\d+)\.png$/)![1]));
    return route.fulfill({ contentType: "image/png", body: png });
  });
  await page.goto("/chuyen-co-phuc");
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(12);
  const distant = await cards.evaluateAll(elements => elements.flatMap((element, index) => element.getBoundingClientRect().top > innerHeight + 50 ? [index] : []));
  expect(distant.length).toBeGreaterThan(0);
  for (const index of distant) expect(requested.has(index), `cover ${index} requested beyond viewport buffer`).toBe(false);
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => requested.has(0)).toBe(true);
  const firstImage = cards.first().getByRole("img", { name: articles[0].title, exact: true });
  await firstImage.evaluate(image => image.setAttribute("data-regression-node", "retained"));
  const last = cards.last();
  await last.scrollIntoViewIfNeeded();
  await expect(last.getByRole("img", { name: articles[11].title, exact: true })).toBeVisible();
  await expect.poll(() => requested.has(11)).toBe(true);
  await cards.first().scrollIntoViewIfNeeded();
  await expect(firstImage).toHaveAttribute("data-regression-node", "retained");
});

test("outfit previews mount near the viewport, survive scrolling and do not cache outfits on the device", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticate(page, ["user"]);
  const outfits = Array.from({ length: 12 }, (_, index) => makeOutfit(index));
  const items = outfits.flatMap(outfit => outfit.current_snapshot!.items.map(saved => makeItem(saved.itemId, saved.slot)));
  const requested = new Set<string>();
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) mutations.push(`${req.method()} ${path}`);
    if (path.endsWith("/studio-image")) {
      requested.add(path.split("/")[4]);
      return route.fulfill({ contentType: "image/png", body: png });
    }
    if (path === "/api/auth/me") return send(route, { ...userA, roles: ["user"] });
    if (path === "/api/outfits/count") return send(route, { count: outfits.length });
    if (path === "/api/outfits/page") return send(route, { items: outfits, next_cursor: null });
    if (path === "/api/catalog/items") return send(route, items);
    return mockCatalogDefaults(route);
  });
  await page.route("**/images/studio/occasions/**", route => route.fulfill({ contentType: "image/png", body: png }));
  await page.goto("/tai-khoan");
  const cards = page.getByTestId("saved-outfit-card");
  await expect(cards).toHaveCount(12);
  const firstBoard = cards.first().getByRole("img", { name: "Ảnh bộ phối Bộ phối 1", exact: true });
  await expect(firstBoard).toBeVisible();
  expect(await cards.locator('svg[role="img"]').count()).toBeLessThan(12);
  const distant = await cards.evaluateAll(elements => elements.flatMap((element, index) => element.querySelector("figure")!.getBoundingClientRect().top > innerHeight + 250 ? [index] : []));
  expect(distant.length).toBeGreaterThan(0);
  for (const index of distant) {
    await expect(cards.nth(index).locator('svg[role="img"]')).toHaveCount(0);
    expect(requested.has(`outfit-${index}-outerwear`)).toBe(false);
    expect(requested.has(`outfit-${index}-bottom`)).toBe(false);
  }
  await firstBoard.evaluate(board => board.setAttribute("data-regression-node", "retained"));
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last().getByRole("img", { name: "Ảnh bộ phối Bộ phối 12", exact: true })).toBeVisible();
  await expect.poll(() => requested.has("outfit-11-outerwear")).toBe(true);
  await cards.first().scrollIntoViewIfNeeded();
  await expect(firstBoard).toHaveAttribute("data-regression-node", "retained");
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("performance-a-token");
  expect(mutations).toEqual([]);
});

test("a failed final catalog page exposes preview retry before avatars settle without losing the saved outfit", async ({ page }) => {
  await authenticate(page, ["user"]);
  const releaseOldAvatars = deferred();
  const firstPage = Array.from({ length: 50 }, (_, index) => makeItem(`partial-${index}`));
  const finalItem = makeItem("saved-final-page-shirt");
  const outfit = makeOutfit(0);
  outfit.current_snapshot!.items = [{ slot: "outerwear", itemId: finalItem.id, assetVersion: 1, colorHex: "#FFFFFF" }];
  let retry = false;
  let avatarsRequested = 0;
  let oldAvatarsReturned = false;
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${url.pathname}`);
    if (url.pathname.endsWith("/studio-image")) return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname === "/api/auth/me") return send(route, { ...userA, roles: ["user"] });
    if (url.pathname === "/api/outfits/count") return send(route, { count: 1 });
    if (url.pathname === "/api/outfits/page") return send(route, { items: [outfit], next_cursor: null });
    if (url.pathname === "/api/catalog/items") {
      if (retry) return send(route, [finalItem]);
      return url.searchParams.get("offset") === "50"
        ? send(route, { error: { code: "UNAVAILABLE", message: "Final page unavailable" } }, 503)
        : send(route, firstPage);
    }
    if (url.pathname === "/api/catalog/avatars") {
      avatarsRequested++;
      if (avatarsRequested === 1) {
        await releaseOldAvatars.promise;
        oldAvatarsReturned = true;
      }
    }
    return mockCatalogDefaults(route);
  });
  await page.route("**/images/studio/occasions/**", route => route.fulfill({ contentType: "image/png", body: png }));
  try {
    await page.goto("/tai-khoan");
    const card = page.getByTestId("saved-outfit-card");
    await expect(card.getByText("Chưa tải được trang phục để xem ảnh.", { exact: true })).toBeVisible();
    await expect(card.locator('svg[role="img"]')).toHaveCount(0);
    await expect(card.getByRole("heading", { name: outfit.title, exact: true })).toBeVisible();
    await expect(card.getByText("Chưa có ảnh cho trang phục đã lưu.", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    expect(oldAvatarsReturned).toBe(false);
    retry = true;
    await card.getByRole("button", { name: "Thử tải lại ảnh", exact: true }).click();
    await expect(card.getByRole("img", { name: `Ảnh bộ phối ${outfit.title}`, exact: true })).toBeVisible();
    await expect(card.locator('svg image')).toHaveAttribute("href", new RegExp(`/${finalItem.id}/studio-image`));
    expect(oldAvatarsReturned).toBe(false);
    expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    expect(mutations).toEqual([]);
  } finally {
    releaseOldAvatars.resolve();
  }
});

test("preview refresh uses the new revision and an old owner response cannot reappear after account switch", async ({ page }) => {
  await authenticate(page, ["user"]);
  const original = makeOutfit(0);
  const revised = { ...structuredClone(original), revision: 2 };
  revised.current_snapshot!.items[0].colorHex = "#553C9A";
  const nextOwner = { ...makeOutfit(1, userB.id), title: "Bộ phối tài khoản B" };
  const items = [original, nextOwner].flatMap(outfit => outfit.current_snapshot!.items.map(saved => makeItem(saved.itemId, saved.slot)));
  let current = original;
  let holdOwnerA = false;
  const oldRequestStarted = deferred();
  const releaseOldRequest = deferred();
  const oldRequestFinished = deferred();
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const isOwnerB = request.headers().authorization?.includes("performance-b-token");
    if (path.endsWith("/studio-image")) return route.fulfill({ contentType: "image/png", body: png });
    if (path === "/api/auth/me") return send(route, isOwnerB ? userB : { ...userA, roles: ["user"] });
    if (path === "/api/catalog/items") return send(route, items);
    if (path === "/api/outfits/count") return send(route, { count: 1 });
    if (path === "/api/outfits/page") {
      if (isOwnerB) return send(route, { items: [nextOwner], next_cursor: null });
      if (holdOwnerA) {
        oldRequestStarted.resolve();
        await releaseOldRequest.promise;
        await send(route, { items: [current], next_cursor: null });
        oldRequestFinished.resolve();
        return;
      }
      return send(route, { items: [current], next_cursor: null });
    }
    return mockCatalogDefaults(route);
  });
  await page.route("**/images/studio/occasions/**", route => route.fulfill({ contentType: "image/png", body: png }));
  try {
    await page.goto("/tai-khoan");
    const cards = page.getByTestId("saved-outfit-card");
    await expect(cards.first().getByRole("img", { name: "Ảnh bộ phối Bộ phối 1", exact: true })).toBeVisible();
    current = revised;
    await page.getByTitle("Tải lại danh sách", { exact: true }).click();
    const firstGarment = cards.first().locator('svg image[href*="/outfit-0-outerwear/studio-image"]');
    await expect(firstGarment).toHaveAttribute("href", /color=%23553C9A/);
    holdOwnerA = true;
    await page.getByTitle("Tải lại danh sách", { exact: true }).click();
    await oldRequestStarted.promise;
    await page.evaluate(user => {
      localStorage.setItem("viet_stylist_auth_token", "performance-b-token");
      localStorage.setItem("viet_stylist_user", JSON.stringify(user));
      window.dispatchEvent(new StorageEvent("storage", { key: "viet_stylist_auth_token", newValue: "performance-b-token" }));
    }, userB);
    await expect(cards.getByRole("heading", { name: nextOwner.title, exact: true })).toBeVisible();
    releaseOldRequest.resolve();
    await oldRequestFinished.promise;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(cards).toHaveCount(1);
    await expect(cards.getByRole("heading", { name: original.title, exact: true })).toHaveCount(0);
    await expect(cards.getByRole("img", { name: `Ảnh bộ phối ${nextOwner.title}`, exact: true })).toBeVisible();
  } finally {
    releaseOldRequest.resolve();
  }
});
