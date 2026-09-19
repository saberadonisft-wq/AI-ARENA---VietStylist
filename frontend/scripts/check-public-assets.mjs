import { readdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const forbidden = /(?:\.(?:db|sqlite\d*|bak|backup|dump|sql|log|pem|key|p12|pfx|old|orig)(?:[.-].*)?$|^\.env(?:\.|$)|^\.git$)/i;
const sqliteHeader = Buffer.from("SQLite format 3\0");

// Inspect names and signatures only. Never print file contents.
export async function inspectPublicAssets(root) {
  const violations = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        violations.push(`${relative}: symbolic links are not allowed in public`);
      } else if (forbidden.test(entry.name)) {
        violations.push(`${relative}: private data/backup file type`);
      } else if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const handle = await open(absolute, "r");
        try {
          const header = Buffer.alloc(16);
          const { bytesRead } = await handle.read(header, 0, 16, 0);
          if (bytesRead === 16 && header.equals(sqliteHeader)) {
            violations.push(`${relative}: SQLite content under a different extension`);
          }
        } finally {
          await handle.close();
        }
      }
    }
  }
  await visit(root);
  return violations.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../public/", import.meta.url));
  const violations = await inspectPublicAssets(root);
  if (violations.length) {
    console.error("Unsafe public assets:\n" + violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Public asset safety check passed.");
  }
}
