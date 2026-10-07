import { expect, type Page } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../../src/features/studio/state";
import type { OutfitResponse } from "../../src/lib/types/api";

export const USER_A = { id: "account-a", email: "a@example.invalid", display_name: "Tài khoản A", displayName: "Tài khoản A", roles: ["user"] };
export const USER_B = { id: "account-b", email: "b@example.invalid", display_name: "Tài khoản B", displayName: "Tài khoản B", roles: ["user"] };
export const TEST_ITEM = { slot: "outerwear", itemId: "storage-test-item", variantId: "storage-test-variant", assetVersion: 1, colorHex: "#8B1E24" };
export const SERVER_OUTFIT: OutfitResponse = {
  id: "server-outfit", owner_id: USER_A.id, title: "Bộ phối đã lưu trên tài khoản", revision: 3,
  current_version_id: "server-version-3", style_mode: "traditional",
  current_snapshot: { ...structuredClone(INITIAL_DOCUMENT.snapshot), items: [TEST_ITEM] },
  created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z",
};

export async function seedLogin(page: Page) {
  await page.addInitScript(user => {
    localStorage.setItem("viet_stylist_auth_token", "token-a");
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
  }, USER_A);
}

export async function seedLegacyOutfits(page: Page) {
  await page.addInitScript(({ key, user, document }) => {
    const draft = JSON.stringify({ ...document, title: "Bộ phối cũ trên thiết bị", ownerId: user.id });
    for (const suffix of ["", ":guest", `:${user.id}`, ":managed:server-outfit", `:managed:server-outfit:${user.id}`, `:${user.id}:recovery:1`, `:${user.id}:account-choice:2`, `:${user.id}:tab-recovery:3`, `:${user.id}:conflict:4`]) {
      localStorage.setItem(`${key}${suffix}`, draft);
      sessionStorage.setItem(`${key}${suffix}`, draft);
    }
    const generation = JSON.stringify({ request: { snapshot: document.snapshot }, fingerprint: JSON.stringify(document.snapshot), job_id: "legacy-job" });
    localStorage.setItem(`vietstylist_generation:${user.id}`, generation);
    sessionStorage.setItem(`vietstylist_generation:${user.id}`, generation);
    localStorage.setItem("unrelated_preference", "keep-this");
    sessionStorage.setItem("unrelated_session_preference", "keep-this-too");
  }, { key: DRAFT_KEY, user: USER_A, document: { ...INITIAL_DOCUMENT, snapshot: SERVER_OUTFIT.current_snapshot } });
}

export async function installStorageProbe(page: Page) {
  await page.addInitScript(() => {
    const probeWindow = window as typeof window & { outfitStorageWrites: { key: string; value: string }[] };
    probeWindow.outfitStorageWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key.startsWith("viet_stylist_current_draft") || key.startsWith("vietstylist_generation:") || /"(?:snapshot|savedDocument|createDocument)"\s*:/.test(value)) {
        probeWindow.outfitStorageWrites.push({ key, value });
      }
      return setItem.call(this, key, value);
    };
  });
}

export async function assertNoStoredOutfits(page: Page, includeWrites = false) {
  await expect.poll(() => page.evaluate(key => {
    return [localStorage, sessionStorage].flatMap(storage => Object.keys(storage).filter(name => {
      const value = storage.getItem(name) || "";
      return name.startsWith(key) || name.startsWith("vietstylist_generation:") || /"(?:snapshot|savedDocument|createDocument)"\s*:/.test(value);
    }));
  }, DRAFT_KEY)).toEqual([]);
  if (includeWrites) expect(await page.evaluate(() => (window as typeof window & { outfitStorageWrites: unknown[] }).outfitStorageWrites)).toEqual([]);
}

export async function mockDeviceStorageApi(page: Page, initialOutfits: OutfitResponse[] = []) {
  const outfits = new Map(initialOutfits.map(outfit => [outfit.id, structuredClone(outfit)]));
  const writes: { method: string; key?: string; body: Record<string, unknown>; authorization?: string; path: string }[] = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPcIKDAQApgIkk1w6gG4gATkergYFQDMYDkUAIA4P4BAJPv6JMAAAAASUVORK5CYII=", "base64");
  await page.route("**/device-storage-fixture.png", route => route.fulfill({ contentType: "image/png", body: png }));
  await page.route("**/ready", route => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const authorization = request.headers().authorization;
    const owner = authorization === "Bearer token-b" ? USER_B : USER_A;
    const send = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/api/auth/me") return send(owner);
    if (path === "/api/auth/login") {
      const account = request.postDataJSON().email === USER_B.email ? USER_B : USER_A;
      return send({ access_token: account.id === USER_B.id ? "token-b" : "token-a", token_type: "bearer", user: account });
    }
    if (path === "/api/catalog/items") return send([{
      id: TEST_ITEM.itemId, name: "Trang phục kiểm thử", slot: TEST_ITEM.slot, gender: "unisex", garment_type_id: "ngu_than", is_published: true,
      metadata: { real_image_url: "/device-storage-fixture.png" },
      variants: [{ id: TEST_ITEM.variantId, item_id: TEST_ITEM.itemId, color_name: "Màu gốc", hex_color: TEST_ITEM.colorHex, is_default: true }],
      default_layer: { id: "test-layer", item_id: TEST_ITEM.itemId, slot: TEST_ITEM.slot, z_index: 0, layer_type: "svg", svg_content: "<circle cx=\"50\" cy=\"50\" r=\"10\"/>" },
    }]);
    if (path === "/api/catalog/garment-types") return send([{ id: "ngu_than", name: "Ngũ thân", slot_schema: [] }]);
    if (path === "/api/catalog/avatars") return send([{ id: "avatar_nam_chuan", name: "Nam", dimensions: { width: 800, height: 1200 } }]);
    if (path === "/api/cultural-check") return send({ is_culturally_sound: true, strict_count: 0, warning_count: 0, info_count: 0, warnings: [] });
    if (path === "/api/color-analysis") return send({ dominant_color: "#1A365D", accent_colors: [], palette_type: "neutral_balance", contrast_rating: "good", contrast_ratio: 5, suggested_variants: [], aesthetic_comment: "" });
    if (path === "/api/weather") return send({ location: { name: "Hà Nội" }, weather: { temperature_c: 26 }, recommendation: { suggested_accessories: [], reason: "", fabric_advice: "", layer_advice: "" }, cached: false });
    if (path === "/api/v3/generation/status") return send({ enabled: true });
    if (path === "/api/v3/legacy-mappings") return send({ dataset_version: "dev", ruleset_version: "dev", mappings: [] });
    if (path === "/api/outfits/compare") return send({ summary_message: "Hai phương án đang mở.", style_changed: false, diffs: [] });
    if (path === "/api/outfits" && method === "GET") return send([...outfits.values()].filter(outfit => outfit.owner_id === owner.id));
    if (path.startsWith("/api/outfits/") && method === "GET") {
      const outfit = outfits.get(path.split("/").at(-1)!);
      return outfit?.owner_id === owner.id ? send(outfit) : send({ error: { code: "OUTFIT_NOT_FOUND", message: "Không tìm thấy bộ phối." } }, 404);
    }
    if (path.startsWith("/api/outfits") && (method === "POST" || method === "PUT")) {
      const body = request.postDataJSON();
      writes.push({ method, key: request.headers()["idempotency-key"], body, authorization, path });
      const id = method === "POST" ? `created-${writes.length}` : path.split("/").at(-1)!;
      const outfit: OutfitResponse = { ...SERVER_OUTFIT, id, owner_id: owner.id, title: body.title, style_mode: body.style_mode, occasion_id: body.occasion_id,
        revision: method === "POST" ? 1 : body.revision + 1, current_snapshot: body.snapshot, current_version_id: `version-${writes.length}` };
      outfits.set(id, outfit);
      return send(outfit);
    }
    return send([]);
  });
  return { writes, outfits };
}
