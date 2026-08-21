import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.CATALOG_RATE_LIMIT_MAX = "1";

const { createShelfMarginServer } = await import("../../server.mjs");

let server;
let baseUrl;

function listen(serverInstance) {
  return new Promise((resolve) => {
    serverInstance.listen(0, "127.0.0.1", () => {
      const address = serverInstance.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(serverInstance) {
  return new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

describe("server security protections", () => {
  beforeAll(async () => {
    server = createShelfMarginServer();
    baseUrl = await listen(server);
  });

  afterAll(async () => {
    await close(server);
  });

  it("adds security headers to API responses", async () => {
    const res = await fetch(`${baseUrl}/api/catalog?isbn=not-an-isbn`);

    expect(res.status).toBe(400);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("rate limits catalog requests before hitting upstream providers", async () => {
    const res = await fetch(`${baseUrl}/api/catalog?isbn=also-not-an-isbn`);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate limit exceeded" });
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("does not serve dotfiles through the app shell fallback", async () => {
    const res = await fetch(`${baseUrl}/.env.local`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
