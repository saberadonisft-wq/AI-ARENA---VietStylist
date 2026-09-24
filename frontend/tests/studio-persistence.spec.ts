import { expect, test } from "@playwright/test";
import type { OutfitResponse } from "../src/lib/types/api";
import { INITIAL_DOCUMENT, parseDraft } from "../src/features/studio/state";
import { saveOutfitDocument, toOutfitSavePayload } from "../src/features/studio/persistence";

function documentWithTitle(title: string) {
  return { title, snapshot: structuredClone(INITIAL_DOCUMENT.snapshot) };
}

function savedOutfit(id: string, revision: number, document: { title: string; snapshot: typeof INITIAL_DOCUMENT.snapshot }): OutfitResponse {
  return {
    id,
    title: document.title,
    revision,
    style_mode: document.snapshot.styleMode,
    current_snapshot: document.snapshot,
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
  };
}

test("shared save policy updates one saved outfit with its current revision", async () => {
  const document = documentWithTitle("Bản phối đã chỉnh sửa");
  let updatePayload: any;
  let createCalls = 0;
  const result = await saveOutfitDocument({
    document,
    identity: { ownerId: "owner-1", outfitId: "outfit-1", revision: 8 },
    create: async () => { createCalls += 1; throw new Error("Không được tạo bản mới"); },
    update: async (id, payload) => {
      expect(id).toBe("outfit-1");
      updatePayload = payload;
      return savedOutfit(id, 9, document);
    },
  });

  expect(createCalls).toBe(0);
  expect(updatePayload.revision).toBe(8);
  expect(updatePayload).toEqual({ ...toOutfitSavePayload(document), revision: 8 });
  expect(result.identity).toMatchObject({ ownerId: "owner-1", outfitId: "outfit-1", revision: 9 });
  expect(result.identity.savedDocument?.title).toBe(document.title);
});

test("shared save policy resolves an uncertain create with the same key before updating newer work", async () => {
  const original = documentWithTitle("Bản gửi trước khi mất phản hồi");
  const latest = documentWithTitle("Chỉnh sửa sau khi mất phản hồi");
  const createCalls: { payload: unknown; key: string }[] = [];
  const updateCalls: { id: string; payload: any }[] = [];
  const result = await saveOutfitDocument({
    document: latest,
    identity: {
      ownerId: "owner-1",
      createIdempotencyKey: "stable-retry-key-123",
      createDocument: original,
    },
    create: async (payload, key) => {
      createCalls.push({ payload, key });
      return savedOutfit("outfit-recovered", 1, original);
    },
    update: async (id, payload) => {
      updateCalls.push({ id, payload });
      return savedOutfit(id, 2, latest);
    },
  });

  expect(createCalls).toEqual([{ payload: toOutfitSavePayload(original), key: "stable-retry-key-123" }]);
  expect(updateCalls).toEqual([{ id: "outfit-recovered", payload: { ...toOutfitSavePayload(latest), revision: 1 } }]);
  expect(result.identity).toMatchObject({ outfitId: "outfit-recovered", revision: 2 });
  expect(result.identity.createIdempotencyKey).toBeUndefined();
  expect(result.identity.createDocument).toBeUndefined();
});

test("new create key and exact submitted document are checkpointed before POST", async () => {
  const document = documentWithTitle("Nháp cần lưu");
  let checkpoint: any = null;
  let keySent = "";
  const result = await saveOutfitDocument({
    document,
    identity: { ownerId: "owner-1" },
    onPendingCreate: pending => { checkpoint = pending; },
    create: async (payload, key) => {
      keySent = key;
      expect(checkpoint).toMatchObject({ createIdempotencyKey: key, createDocument: document });
      expect(payload).toEqual(toOutfitSavePayload(document));
      return savedOutfit("outfit-new", 1, document);
    },
    update: async () => { throw new Error("Không được cập nhật bộ chưa lưu"); },
  });

  expect(keySent).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  expect(result.identity).toMatchObject({ ownerId: "owner-1", outfitId: "outfit-new", revision: 1 });
});

test("legacy account retry fields migrate to the shared create receipt format", () => {
  const document = documentWithTitle("Nháp cũ");
  const parsed = parseDraft(JSON.stringify({
    ...document,
    ownerId: "owner-1",
    pendingSaveKey: "legacy-retry-key-123",
    pendingSavePayload: { ...toOutfitSavePayload(document) },
  }));

  expect(parsed).toMatchObject({
    ownerId: "owner-1",
    createIdempotencyKey: "legacy-retry-key-123",
    createDocument: document,
  });
  expect(parsed).not.toHaveProperty("pendingSaveKey");
});
