import { expect, test } from "@playwright/test";

const VIEWPORTS = [320, 375, 414, 768, 1440];
const CORE_PAGES = [
  "/", "/studio", "/thu-vien", "/tai-khoan", "/lookbook", "/lookbook/private-test",
  "/chuyen-co-phuc", "/giai-phap", "/quan-tri", "/stylist", "/trang-phuc/ao-tac",
];

test("core pages fit the supported viewport widths", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith("/weather")
      ? {
          location: { key: "ha_noi", name: "Hà Nội", region: "Việt Nam", latitude: 21, longitude: 105 },
          weather: { temperature_c: 26, apparent_temperature_c: 27, humidity_percent: 60, weather_condition: "Nhiều mây", is_rainy: false, wind_speed_kmh: 5 },
          recommendation: { layer_advice: "", fabric_advice: "", suggested_accessories: [], reason: "" },
          cached: false,
        }
      : path === "/api/catalog/items/ao-tac"
      ? { id: "ao-tac", name: "Áo tấc minh họa", slot: "outerwear", gender: "unisex", is_published: true, metadata: {}, variants: [], asset_layers: [], occasions: [] }
      : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
  });

  for (const path of CORE_PAGES) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(dimensions.content, `${path} overflows at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    }
  }
});

test("keyboard navigation exposes a visible focus ring", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focusStyle = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return null;
    const style = window.getComputedStyle(active);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle?.outlineStyle).toBe("solid");
  expect(parseFloat(focusStyle?.outlineWidth || "0")).toBeGreaterThanOrEqual(2);
});

test("icon-only buttons on the main pages have an accessible label", async ({ page }) => {
  await page.route("http://127.0.0.1:4100/**", route => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith("/weather")
      ? {
          location: { key: "ha_noi", name: "Hà Nội", region: "Việt Nam", latitude: 21, longitude: 105 },
          weather: { temperature_c: 26, apparent_temperature_c: 27, humidity_percent: 60, weather_condition: "Nhiều mây", is_rainy: false, wind_speed_kmh: 5 },
          recommendation: { layer_advice: "", fabric_advice: "", suggested_accessories: [], reason: "" },
          cached: false,
        }
      : path === "/api/catalog/items/ao-tac"
      ? { id: "ao-tac", name: "Áo tấc minh họa", slot: "outerwear", gender: "unisex", is_published: true, metadata: {}, variants: [], asset_layers: [], occasions: [] }
      : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
  });
  const pages = ["/", "/studio", "/thu-vien", "/tai-khoan", "/lookbook", "/chuyen-co-phuc", "/quan-tri", "/stylist"];
  for (const path of pages) {
    await page.goto(path);
    const unlabeled = await page.locator("button").evaluateAll(buttons => buttons
      .filter(button => {
        const style = window.getComputedStyle(button);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const text = button.textContent?.trim();
        const nestedName = button.querySelector("[aria-label]")?.getAttribute("aria-label") || button.querySelector("svg title")?.textContent;
        return !text && !button.getAttribute("aria-label") && !button.getAttribute("title") && !nestedName;
      })
      .map(button => button.outerHTML.slice(0, 180)));
    expect(unlabeled, `${path} contains an icon-only button without an accessible name`).toEqual([]);
  }
});
