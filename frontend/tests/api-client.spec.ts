import { test, expect } from "@playwright/test";
import { apiFetch } from "../src/lib/api/client";

test("API errors preserve request tracing and server retry delay", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED", message: "wait", request_id: "req_test", details: {} } }), { status: 429, headers: { "Retry-After": "17" } });
  try {
    await expect(apiFetch("/error-test")).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", statusCode: 429, requestId: "req_test", retryAfter: 17 });
  } finally { globalThis.fetch = original; }
});

test("already cancelled requests propagate cancellation without a misleading timeout", async () => {
  const original = globalThis.fetch;
  const abort = new AbortController();
  abort.abort();
  globalThis.fetch = async (_url, options) => {
    expect(options?.signal?.aborted).toBe(true);
    throw new DOMException("Aborted", "AbortError");
  };
  try {
    await expect(apiFetch("/abort-test", { signal: abort.signal })).rejects.toMatchObject({ code: "REQUEST_CANCELLED", statusCode: 0 });
  } finally { globalThis.fetch = original; }
});

test("invalid success response is not reported as successful data", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>proxy error</html>", { headers: { "X-Request-ID": "proxy-request" } });
  try {
    await expect(apiFetch("/invalid-test")).rejects.toMatchObject({ name: "ApiError", code: "INVALID_RESPONSE", requestId: "proxy-request" });
  } finally { globalThis.fetch = original; }
});

test("catalog reads recheck access and publication after the session changes", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (new Headers(options?.headers).get("Authorization") === "Bearer revoked") {
      return new Response(JSON.stringify({ error: { code: "TOKEN_EXPIRED", message: "expired" } }), { status: 401 });
    }
    return new Response(JSON.stringify(calls === 1 ? [{ id: "published-item" }] : []));
  };
  try {
    expect(await apiFetch("/api/catalog/items?test=publication")).toEqual([{ id: "published-item" }]);
    await expect(apiFetch("/api/catalog/items?test=publication", { headers: { Authorization: "Bearer revoked" } })).rejects.toMatchObject({ statusCode: 401 });
    expect(await apiFetch("/api/catalog/items?test=publication")).toEqual([]);
    expect(calls).toBe(3);
  } finally { globalThis.fetch = original; }
});

test("a prior catalog response cannot satisfy a cancelled request", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response("[]");
  };
  try {
    await apiFetch("/api/catalog/items?test=cancellation");
    const abort = new AbortController(); abort.abort();
    await expect(apiFetch("/api/catalog/items?test=cancellation", { signal: abort.signal })).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
  } finally { globalThis.fetch = original; }
});
