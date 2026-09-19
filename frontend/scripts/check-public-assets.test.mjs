import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectPublicAssets } from "./check-public-assets.mjs";

test("blocks nested private data, backups and renamed SQLite without reading records", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vietstylist-public-"));
  try {
    await mkdir(path.join(root, "images"));
    await writeFile(path.join(root, "images", "history.DB"), "test fixture");
    await writeFile(path.join(root, "images", "backup.sql.gz"), "test fixture");
    await writeFile(path.join(root, "images", ".env.local"), "test fixture");
    await writeFile(path.join(root, "images", "renamed.png"), "SQLite format 3\0");
    await writeFile(path.join(root, "images", "safe.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const errors = await inspectPublicAssets(root);
    assert.equal(errors.length, 4);
    assert.ok(errors.some(e => e.includes("renamed.png: SQLite")));
    assert.ok(errors.every(e => !e.includes("test fixture")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
