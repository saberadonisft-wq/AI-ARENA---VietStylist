import { test, expect } from "@playwright/test";

test("browser history database is not publicly served", async ({ request }) => {
  const endpoint = "/images/temp_coccoc.db";
  expect((await request.head(endpoint)).status()).toBe(404);
  expect((await request.get(endpoint)).status()).toBe(404);
});
