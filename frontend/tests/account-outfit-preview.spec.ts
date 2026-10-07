import { expect, test, type Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";
import { assertNoStoredOutfits } from "./helpers/device-storage";

const garmentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64");
const snapshots = [
  { ...structuredClone(INITIAL_DOCUMENT.snapshot), aspectRatio: "9:16", backgroundTheme: "occasion", occasionId: "tet", backgroundFade: 25,
    items: [{ slot: "outerwear", itemId: "shirt-1", assetVersion: 1, colorHex: "#553C9A", transform: { dx: 12, dy: 5, scale: 1.2, rotation: 15 } }] },
  { ...structuredClone(INITIAL_DOCUMENT.snapshot), aspectRatio: "1:1", backgroundTheme: "dopaper",
    items: [{ slot: "outerwear", itemId: "shirt-1", assetVersion: 1, colorHex: "#FFFFFF", transform: { dx: -8, dy: 0, scale: 0.8, rotation: -10 } }] },
];

async function setup(page: Page, { expiredPreview = false, catalogOutage = false, svgOnly = false } = {}) {
  const user = { id: "preview-admin", email: "preview@example.invalid", display_name: "Preview Admin", displayName: "Preview Admin", roles: ["admin"] };
  const outfits = snapshots.map((snapshot, index) => ({
    id: `outfit-${index}`, title: index ? "Bản phối vuông" : "Bản phối ngày Tết", owner_id: user.id,
    revision: index + 1, current_snapshot: snapshot, occasion_id: snapshot.occasionId,
    style_mode: "traditional", created_at: "2026-10-05", updated_at: "2026-10-05",
    preview_image_url: expiredPreview && !index ? "/expired-outfit.png" : undefined,
  }));
  await page.addInitScript(({ user, key, document }) => {
    localStorage.setItem("viet_stylist_auth_token", "preview-token");
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    localStorage.setItem(key, JSON.stringify({ ...document, ownerId: user.id, title: "Bản nháp cần giữ" }));
  }, { user, key: DRAFT_KEY, document: INITIAL_DOCUMENT });
  let rejectCatalog = catalogOutage;
  const mutations: string[] = [];
  await page.route("**/expired-outfit.png", route => route.fulfill({ status: 404 }));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const send = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (request.method() !== "GET") mutations.push(`${request.method()} ${path}`);
    if (path === "/api/auth/me") return send(user);
    if (path === "/api/outfits/page") return send({ items: outfits, next_cursor: null });
    if (path === "/api/admin/overview") return send({ users: 1, items: 1, outfits: 2, lookbooks: 0, rules: 0 });
    if (path.startsWith("/api/admin/")) return send({ items: [], total: 0 });
    if (path.endsWith("/studio-image")) return route.fulfill({ contentType: "image/png", body: garmentPng });
    if (path === "/api/catalog/items") {
      if (rejectCatalog) return send({ error: { code: "UNAVAILABLE", message: "Catalog unavailable" } }, 503);
      return send([{ id: "shirt-1", slot: "outerwear", name: "Áo ngũ thân", is_published: true,
        metadata: svgOnly ? {} : { catalog_media_id: "media-shirt" },
        default_layer: svgOnly ? { item_id: "shirt-1", svg_content: '<defs><linearGradient id="garment-color"><stop stop-color="VAR_COLOR_PRIMARY"/></linearGradient></defs><rect x="100" y="200" width="400" height="600" fill="url(#garment-color)"/>' } : undefined,
        variants: [{ id: "white", hex_color: "#FFFFFF", is_default: true }] }]);
    }
    if (path === "/api/catalog/occasions") return send([{ id: "tet", name: "Tết" }]);
    return send([]);
  });
  return { outfits, mutations, recoverCatalog: () => { rejectCatalog = false; } };
}

for (const width of [375, 1440]) {
  test(`account outfit cards show saved colors, placement and background without caching outfits at ${width}px`, async ({ page }) => {
    const { mutations } = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tai-khoan");
    await page.getByRole("button", { name: "Bộ phối của tôi (2)" }).click();
    const cards = page.getByTestId("saved-outfit-card");
    await expect(cards).toHaveCount(2);
    for (let index = 0; index < 2; index++) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const svg = card.getByRole("img", { name: `Ảnh bộ phối ${index ? "Bản phối vuông" : "Bản phối ngày Tết"}` });
      await expect(svg).toBeVisible();
      const image = svg.locator("image");
      await expect(image).toHaveCount(1);
      await expect(image).toHaveAttribute("href", index ? /studio-image$/ : /color=%23553C9A/);
      await expect(svg.locator('[id$="item-transform-outerwear"]')).toHaveAttribute("transform", new RegExp(`rotate\\(${index ? -10 : 15}\\) scale\\(${index ? 0.8 : 1.2}\\)`));
      await expect(card.getByRole("group", { name: "Thu phóng bảng phối" })).toHaveCount(0);
      await expect(card.getByRole("region", { name: "Điều chỉnh trang phục" })).toHaveCount(0);
      await expect(card.locator('[data-studio-drag="true"]')).toHaveCount(0);
      await expect(card.locator(".studio-drag-preview")).toHaveCount(0);
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await expect(cards.first().getByTestId("board-background")).toHaveAttribute("data-background-status", "ready");
    const ids = await cards.evaluateAll(nodes => nodes.flatMap(node => Array.from(node.querySelectorAll("[id]"), element => element.id)));
    expect(new Set(ids).size).toBe(ids.length);
    if (width === 375) {
      const tabs = page.getByRole("button", { name: "Bộ phối của tôi (2)" });
      expect(await tabs.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await assertNoStoredOutfits(page);
    expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("preview-token");
    expect(mutations).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`outfit-cards-${width}.png`), fullPage: true });
  });
}

test("an expired outfit preview falls back to the saved outfit instead of a broken image", async ({ page }) => {
  await setup(page, { expiredPreview: true });
  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Bộ phối của tôi (2)" }).click();
  const card = page.getByTestId("saved-outfit-card").first();
  await expect(card.getByRole("img", { name: "Ảnh bộ phối Bản phối ngày Tết" })).toHaveJSProperty("tagName", "svg");
  await expect(card.locator("svg image")).toHaveCount(1);
});

test("outfit previews retry a catalog outage while retaining the saved server outfit and login", async ({ page }) => {
  const { recoverCatalog } = await setup(page, { catalogOutage: true });
  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Bộ phối của tôi (2)" }).click();
  const card = page.getByTestId("saved-outfit-card").first();
  await expect(card.getByText("Chưa tải được trang phục để xem ảnh.")).toBeVisible();
  recoverCatalog();
  await card.getByRole("button", { name: "Thử tải lại ảnh" }).click();
  await expect(card.getByRole("img", { name: "Ảnh bộ phối Bản phối ngày Tết" })).toBeVisible();
  await assertNoStoredOutfits(page);
  expect(await page.evaluate(() => localStorage.getItem("viet_stylist_auth_token"))).toBe("preview-token");
});

test("SVG outfit previews isolate gradient IDs and saved colors between cards", async ({ page }) => {
  await setup(page, { svgOnly: true });
  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Bộ phối của tôi (2)" }).click();
  const cards = page.getByTestId("saved-outfit-card");
  for (let index = 0; index < 2; index++) {
    await cards.nth(index).scrollIntoViewIfNeeded();
    const svg = cards.nth(index).getByRole("img");
    const gradient = svg.locator("linearGradient");
    await expect(gradient).toHaveCount(1);
    await expect(gradient.locator("stop")).toHaveAttribute("stop-color", index ? "#FFFFFF" : "#553C9A");
    const gradientId = await gradient.getAttribute("id");
    await expect(svg.locator("rect")).toHaveAttribute("fill", `url(#${gradientId})`);
  }
  const ids = await cards.evaluateAll(nodes => nodes.flatMap(node => Array.from(node.querySelectorAll("[id]"), element => element.id)));
  expect(new Set(ids).size).toBe(ids.length);
});
