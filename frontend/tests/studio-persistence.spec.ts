import { expect, test } from "@playwright/test";
import type { OutfitResponse } from "../src/lib/types/api";
import { INITIAL_DOCUMENT, parseDraft } from "../src/features/studio/state";
import { saveOutfitDocument, toOutfitSavePayload } from "../src/features/studio/persistence";
import type { OutfitSaveIdentity } from "../src/features/studio/persistence";
import { ApiError } from "../src/lib/api/client";

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
    onCheckpoint: pending => { checkpoint = pending; },
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

test("save as new recovers a pending ordinary create and makes a separate copy without updating it", async () => {
  const original = documentWithTitle("Bộ phối đã được tạo trước lỗi mạng");
  const latest = documentWithTitle("Bản sao riêng mới");
  const calls: { key: string; title: string }[] = [];
  const result = await saveOutfitDocument({
    document: latest,
    identity: { ownerId: "owner-1", createIdempotencyKey: "original-pending-key", createDocument: original },
    asNew: true,
    create: async (payload, key) => {
      calls.push({ key, title: payload.title });
      return savedOutfit(key === "original-pending-key" ? "original-outfit" : "separate-outfit", 1, { title: payload.title, snapshot: payload.snapshot });
    },
    update: async () => { throw new Error("Không được sửa bộ phối đầu tiên"); },
  });
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual({ key: "original-pending-key", title: original.title });
  expect(calls[1].key).not.toBe(calls[0].key);
  expect(calls[1].title).toBe(latest.title);
  expect(result.saved.id).toBe("separate-outfit");
});

test("retrying save as new in the open session reuses its pending key and keeps later edits", async () => {
  const original = documentWithTitle("Bản mới bị mất phản hồi");
  const latest = documentWithTitle("Bản mới được sửa sau lỗi mạng");
  let checkpoint: OutfitSaveIdentity = { ownerId: "owner-1", outfitId: "source-outfit", revision: 5 };
  let serverKey: string | undefined;
  const create = async (_payload: unknown, key: string) => {
    if (!serverKey) {
      serverKey = key;
      throw new ApiError("Mất phản hồi", "NETWORK_ERROR", 503);
    }
    expect(key).toBe(serverKey);
    return savedOutfit("new-copy", 1, original);
  };
  await expect(saveOutfitDocument({
    document: original, identity: checkpoint, asNew: true, create,
    update: async () => { throw new Error("Chưa được cập nhật"); },
    onCheckpoint: pending => { checkpoint = pending; },
  })).rejects.toThrow("Mất phản hồi");
  const reloaded = parseDraft(JSON.stringify({ ...latest, ...checkpoint }))!;
  expect(reloaded.createAsNew).toBe(true);
  const result = await saveOutfitDocument({
    document: latest, identity: reloaded, asNew: true, create,
    update: async (id, payload) => {
      expect(id).toBe("new-copy");
      expect(payload.revision).toBe(1);
      return savedOutfit(id, 2, latest);
    },
  });
  expect(result.identity).toMatchObject({ outfitId: "new-copy", revision: 2 });
  expect(result.identity.createAsNew).toBeUndefined();
});

for (const code of ["REVISION_CONFLICT", "OUTFIT_DELETED"]) {
  test(`create recovery reports ${code}, preserves the draft and permits an explicit new copy`, async () => {
    const original = documentWithTitle("Bộ phối lần đầu");
    const latest = documentWithTitle("Bản đang sửa cần giữ");
    let checkpoint: OutfitSaveIdentity = {
      ownerId: "owner-1", createIdempotencyKey: "pending-original-key", createDocument: original,
    };
    const error = new ApiError("Bộ phối không còn ở phiên bản đầu", code, 409, { outfit_id: "old-outfit", revision: 1 });
    await expect(saveOutfitDocument({
      document: latest, identity: checkpoint,
      create: async () => { throw error; },
      update: async () => { throw new Error("Không được ghi đè"); },
      onCheckpoint: pending => { checkpoint = pending; },
    })).rejects.toBe(error);
    expect(checkpoint).toMatchObject({ outfitId: "old-outfit", revision: 1, savedDocument: original });
    expect(checkpoint.createIdempotencyKey).toBeUndefined();
    expect(latest.title).toBe("Bản đang sửa cần giữ");
    const result = await saveOutfitDocument({
      document: latest, identity: checkpoint, asNew: true,
      create: async (payload, key) => {
        expect(key).not.toBe("pending-original-key");
        return savedOutfit("separate-copy", 1, { title: payload.title, snapshot: payload.snapshot });
      },
      update: async () => { throw new Error("Không được ghi đè"); },
    });
    expect(result.saved.id).toBe("separate-copy");
  });

  test(`save as new can pass a ${code} on its pending ordinary create`, async () => {
    const original = documentWithTitle("Bộ phối cũ");
    const latest = documentWithTitle("Bản sao cần lưu");
    let calls = 0;
    const result = await saveOutfitDocument({
      document: latest,
      identity: { ownerId: "owner-1", createIdempotencyKey: "pending-original-key", createDocument: original },
      asNew: true,
      create: async (payload, key) => {
        calls++;
        if (key === "pending-original-key") throw new ApiError("Lần tạo đã thay đổi", code, 409, { outfit_id: "old-outfit", revision: 1 });
        return savedOutfit("new-copy", 1, { title: payload.title, snapshot: payload.snapshot });
      },
      update: async () => { throw new Error("Không được cập nhật bộ cũ"); },
    });
    expect(calls).toBe(2);
    expect(result.saved.id).toBe("new-copy");
  });
}

test("a recovered create is checkpointed before an update failure so conflict actions retain its identity", async () => {
  const original = documentWithTitle("Bản đã tạo");
  const latest = documentWithTitle("Bản sửa chưa được lưu");
  let checkpoint: OutfitSaveIdentity = { ownerId: "owner-1", createIdempotencyKey: "pending-key-123", createDocument: original };
  await expect(saveOutfitDocument({
    document: latest, identity: checkpoint,
    create: async () => savedOutfit("recovered-outfit", 1, original),
    update: async () => { throw new ApiError("Xung đột khi cập nhật", "REVISION_CONFLICT", 409); },
    onCheckpoint: pending => { checkpoint = pending; },
  })).rejects.toThrow("Xung đột khi cập nhật");
  expect(checkpoint).toMatchObject({ outfitId: "recovered-outfit", revision: 1, savedDocument: original });
  expect(checkpoint.createIdempotencyKey).toBeUndefined();
});
