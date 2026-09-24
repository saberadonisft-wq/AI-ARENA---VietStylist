import { expect, test } from "@playwright/test";
import { DRAFT_KEY, INITIAL_DOCUMENT } from "../src/features/studio/state";
import { ownerDraftKey } from "../src/features/studio/persistence";

test("account retries a lost create response with the persisted idempotency key after reload", async ({ page }) => {
  const user = { id: "draft-owner", email: "draft@example.invalid", display_name: "Draft Owner", displayName: "Draft Owner", roles: ["user"] };
  const draft = { ...INITIAL_DOCUMENT, title: "Nháp cần đồng bộ", ownerId: user.id };
  const createRequests: { key: string | undefined; body: any }[] = [];
  let serverRecord: any = null;
  let serverCreates = 0;

  await page.addInitScript(({ token, user, key, draft }) => {
    localStorage.setItem("viet_stylist_auth_token", token);
    localStorage.setItem("viet_stylist_user", JSON.stringify(user));
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(draft));
  }, { token: "account-draft-token", user, key: ownerDraftKey(user.id), draft });

  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const send = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/me") return send(user);
    if (path === "/api/outfits" && method === "GET") return send([]);
    if (path === "/api/outfits" && method === "POST") {
      const key = request.headers()["idempotency-key"];
      const body = request.postDataJSON();
      createRequests.push({ key, body });
      if (!serverRecord) {
        serverCreates += 1;
        serverRecord = {
          id: "server-outfit-1",
          owner_id: user.id,
          title: body.title,
          revision: 1,
          style_mode: body.style_mode,
          current_snapshot: body.snapshot,
          created_at: "2026-09-24T00:00:00Z",
          updated_at: "2026-09-24T00:00:00Z",
        };
        return route.abort("failed");
      }
      if (key !== createRequests[0]?.key || JSON.stringify(body) !== JSON.stringify(createRequests[0]?.body)) {
        return send({ error: { code: "IDEMPOTENCY_CONFLICT", message: "Mã lưu không khớp." } }, 409);
      }
      return send(serverRecord);
    }
    return send([]);
  });

  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Nháp trên thiết bị (1)" }).click();
  await page.getByRole("button", { name: "Lưu vào Tủ đồ" }).click();
  await expect(page.getByText(/Không xác nhận được kết quả lưu do mất kết nối/)).toBeVisible();
  expect(createRequests).toHaveLength(1);
  expect(createRequests[0].key).toBeTruthy();

  const checkpoint = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key) || "null"), { key: ownerDraftKey(user.id) });
  expect(checkpoint.createIdempotencyKey).toBe(createRequests[0].key);
  expect(checkpoint.createDocument).toMatchObject({ title: draft.title, snapshot: draft.snapshot });

  await page.reload();
  await page.getByRole("button", { name: "Nháp trên thiết bị (1)" }).click();
  const reloadedDraft = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key) || "null"), { key: ownerDraftKey(user.id) });
  expect(reloadedDraft.createIdempotencyKey).toBe(createRequests[0].key);
  expect(reloadedDraft.createDocument).toMatchObject({ title: draft.title, snapshot: draft.snapshot });
  await page.getByRole("button", { name: "Lưu vào Tủ đồ" }).click();
  await expect.poll(() => createRequests.length).toBe(2);
  expect(createRequests[1].key).toBe(createRequests[0].key);
  expect(createRequests[1].body).toEqual(createRequests[0].body);
  await expect(page.getByRole("button", { name: "Đã lưu vào Tủ đồ" })).toBeDisabled();

  expect(serverCreates).toBe(1);
  const savedDraft = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key) || "null"), { key: ownerDraftKey(user.id) });
  expect(savedDraft).toMatchObject({ outfitId: "server-outfit-1", revision: 1, ownerId: user.id });
  expect(savedDraft.createIdempotencyKey).toBeUndefined();
});
