import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3100", headless: true, trace: "retain-on-failure" },
  webServer: [
    {
      command: "python ../backend/scripts/run_browser_test_server.py",
      url: "http://127.0.0.1:4100/health", reuseExistingServer: false, timeout: 30000,
    },
    {
      command: process.env.TEST_PRODUCTION === "1" ? "npm run start -- --hostname 127.0.0.1 --port 3100" : "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 120000,
      env: { NEXT_DIST_DIR: process.env.TEST_PRODUCTION === "1" ? ".next-build" : ".next-test", NEXT_PUBLIC_API_ORIGIN: "http://127.0.0.1:4100" },
    },
  ],
});
