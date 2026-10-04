import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ui-detail-fixes.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: { NEXT_DIST_DIR: ".next-ui-detail-fixes", NEXT_PUBLIC_API_ORIGIN: "http://127.0.0.1:4100" },
    timeout: 180000,
    reuseExistingServer: false,
  },
});
