import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.CATALOG_RATE_LIMIT_MAX = "1";
process.env.SENSITIVE_RATE_LIMIT_MAX = "1";

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

  it("reports Stripe configuration without exposing secret values", async () => {
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = `pk_test_${"a".repeat(100)}`;
    process.env.STRIPE_SECRET_KEY = `sk_test_${"b".repeat(100)}`;
    process.env.STRIPE_WEBHOOK_SECRET = `whsec_${"c".repeat(32)}`;
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter123";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro123";

    const res = await fetch(`${baseUrl}/api/stripe/status`);
    const text = await res.text();
    const body = JSON.parse(text);

    expect(res.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.mode).toBe("test");
    expect(text).not.toContain("sk_test_");
    expect(text).not.toContain("whsec_");
  });

  it("reports Amazon configuration without exposing token or secret values", async () => {
    process.env.AMAZON_SP_API_MODE = "sandbox";
    process.env.AMAZON_SP_API_LWA_CLIENT_ID = "amzn1.application-oa2-client.example";
    process.env.AMAZON_SP_API_LWA_CLIENT_SECRET = "amazon-secret-value";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "Atzr|amazon-refresh-token";

    const res = await fetch(`${baseUrl}/api/amazon/status`);
    const text = await res.text();
    const body = JSON.parse(text);

    expect(res.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.mode).toBe("sandbox");
    expect(body.endpointHost).toBe("sandbox.sellingpartnerapi-na.amazon.com");
    expect(text).not.toContain("amazon-secret-value");
    expect(text).not.toContain("amazon-refresh-token");
    expect(text).not.toContain("Atzr|");
  });

  it("requires admin auth before testing Amazon token exchange", async () => {
    const res = await fetch(`${baseUrl}/api/amazon/test`, { method: "POST" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in as admin." });
  });

  it("rejects checkout safely when no signed-in user is provided", async () => {
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = `pk_test_${"a".repeat(100)}`;
    process.env.STRIPE_SECRET_KEY = `sk_test_${"b".repeat(100)}`;
    process.env.STRIPE_WEBHOOK_SECRET = `whsec_${"c".repeat(32)}`;
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter123";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro123";

    const res = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: "starter" }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in before starting checkout." });
  });

  it("rate limits repeated checkout attempts", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ planId: "starter" }),
    });
    const limited = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ planId: "starter" }),
    });

    expect(res.status).toBe(401);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate limit exceeded" });
  });
});
