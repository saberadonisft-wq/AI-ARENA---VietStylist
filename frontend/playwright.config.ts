import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/integration/**",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: { NEXT_DIST_DIR: ".next-test", NEXT_PUBLIC_API_ORIGIN: "http://127.0.0.1:4100" },
    timeout: 120000,
    reuseExistingServer: false,
  },
});
