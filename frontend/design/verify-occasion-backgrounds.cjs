// Read-only visual check against a running local API and a separate browser context.
// Usage: node design/verify-occasion-backgrounds.cjs [frontend-origin] [api-origin]
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const origin = process.argv[2] || "http://127.0.0.1:3100";
  const api = process.argv[3] || "http://127.0.0.1:4000";
  const catalogResponse = await fetch(`${api}/api/catalog/items`);
  if (!catalogResponse.ok) throw new Error("Cannot read the local catalog");
  const catalog = await catalogResponse.json();
  const selected = [
    ["light", catalog.find(item => item.name.includes("giao lĩnh lót trắng"))],
    ["red", catalog.find(item => item.name === "Áo Nhật Bình Đỏ")],
    ["dark", catalog.find(item => item.name.includes("Áo bào tím"))],
  ];
  if (selected.some(([, item]) => !item)) throw new Error("The local catalog lacks a requested visual sample");
  const output = path.resolve(__dirname, "../test-results/occasion-live-visual");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [tone, item] of selected) {
      const cutoutResponse = await fetch(`${api}/api/catalog/items/${item.id}/studio-image`);
      if (!cutoutResponse.ok) throw new Error(`Cutout unavailable: ${item.name}`);
      const cutout = Buffer.from(await cutoutResponse.arrayBuffer());
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      await page.route("http://127.0.0.1:4100/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === `/api/catalog/items/${item.id}/studio-image`) {
          return route.fulfill({ contentType: "image/png", body: cutout, headers: { "Access-Control-Allow-Origin": "*" } });
        }
        if (request.method() !== "GET" && !["/api/cultural-check", "/api/color-analysis"].includes(url.pathname)) {
          return route.fulfill({ status: 403, json: { error: { message: "Read-only visual verification" } } });
        }
        const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` });
        await route.fulfill({ response });
      });
      const variant = item.variants.find(entry => entry.is_default) || item.variants[0];
      await page.addInitScript(({ item, variant }) => localStorage.setItem("viet_stylist_current_draft", JSON.stringify({
        title: "Kiểm tra nền theo hoàn cảnh", snapshot: {
          schemaVersion: 1, avatarId: "avatar_nam_chuan", poseId: "front_01", styleMode: "traditional",
          overlapDirection: "right_over_left", aspectRatio: "9:16", backgroundTheme: "white", items: [{
            itemId: item.id, slot: item.slot, variantId: variant.id, colorHex: variant.hex_color,
          }], lockedSlots: [],
        },
      })), { item, variant });
      await page.goto(`${origin}/studio`);
      await page.locator(`#content-${item.slot} image`).waitFor();
      await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); },
        `http://127.0.0.1:4100/api/catalog/items/${item.id}/studio-image`);
      for (const [occasion, label] of [["dao-pho", "Dạo phố & Check-in"], ["bieu-dien", "Biểu diễn nghệ thuật"], ["tet", "Lễ Tết Cổ truyền"]]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="board-background"]')?.getAttribute("data-background-status") === "ready");
        const artboard = page.getByTestId("outfit-artboard");
        await artboard.locator("svg").first().click({ position: { x: 3, y: 3 } });
        for (const [ratio, suffix] of [["9:16", "portrait"], ["1:1", "square"]]) {
          await page.getByRole("button", { name: ratio, exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[data-testid="board-background"]')?.getAttribute("data-background-status") === "ready");
          await artboard.screenshot({ path: path.join(output, `${occasion}-${tone}-${suffix}.png`),
            animations: "disabled", style: "header { visibility: hidden !important; }" });
        }
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`Saved 18 real-catalog flatlay screenshots to ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
