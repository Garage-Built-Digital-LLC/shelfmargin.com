import { describe, expect, it, vi } from "vitest";
import { SCAN_CAP_CODE, SCAN_CAP_UPGRADE_PATH } from "../lib/billing.js";
import { consumeLifetimeScan, isScanCapError } from "../lib/scanCap.js";

const env = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
};

function fetchByUrl(handlers) {
  return vi.fn(async (url) => {
    const key = Object.keys(handlers).find((part) => String(url).includes(part));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    return handlers[key]();
  });
}

describe("lifetime scan cap server path", () => {
  it("skips enforcement when no signed-in token is present (demo lookups)", async () => {
    const fetchImpl = vi.fn();
    await expect(consumeLifetimeScan({
      isbn: "9780306406157",
      authHeader: "",
      env,
      fetchImpl,
    })).resolves.toEqual({ enforced: false, allowed: true, demo: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed for signed-in lookups when Supabase is not configured", async () => {
    await expect(consumeLifetimeScan({
      isbn: "9780306406157",
      authHeader: "Bearer user-token",
      env: {},
      fetchImpl: vi.fn(),
    })).rejects.toMatchObject({
      status: 503,
      code: "scan_cap_unconfigured",
    });
  });

  it("consumes a distinct ISBN through the authenticated RPC after the user is verified", async () => {
    const fetchImpl = fetchByUrl({
      "/auth/v1/user": () => ({ ok: true, json: async () => ({ id: "user_123" }) }),
      "/rpc/consume_trial_scan": () => ({
        ok: true,
        json: async () => ({ allowed: true, paid: false, used: 12, remaining: 88, cap: 100 }),
      }),
    });

    await expect(consumeLifetimeScan({
      isbn: "9780306406157",
      authHeader: "Bearer user-token",
      env,
      fetchImpl,
    })).resolves.toMatchObject({
      enforced: true,
      allowed: true,
      paid: false,
      used: 12,
      remaining: 88,
      cap: 100,
    });

    expect(fetchImpl.mock.calls[1][0]).toContain("/rpc/consume_trial_scan");
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "sb_publishable_example",
        authorization: "Bearer user-token",
      }),
      body: JSON.stringify({ p_isbn: "9780306406157" }),
    });
  });

  it("returns a paywall error when the RPC refuses a new scan", async () => {
    const fetchImpl = fetchByUrl({
      "/auth/v1/user": () => ({ ok: true, json: async () => ({ id: "user_123" }) }),
      "/rpc/consume_trial_scan": () => ({
        ok: true,
        json: async () => ({ allowed: false, paid: false, used: 100, remaining: 0, cap: 100, code: SCAN_CAP_CODE }),
      }),
    });

    await expect(consumeLifetimeScan({
      isbn: "9780132350884",
      authHeader: "Bearer user-token",
      env,
      fetchImpl,
    })).rejects.toMatchObject({
      status: 402,
      code: SCAN_CAP_CODE,
      remaining: 0,
      used: 100,
      cap: 100,
      upgradePath: SCAN_CAP_UPGRADE_PATH,
    });
  });

  it("recognizes database trigger errors as the scan cap", () => {
    expect(isScanCapError({ code: "P0001", message: "scan_cap_reached", hint: "Subscribe to Starter or Pro to keep scanning." })).toBe(true);
    expect(isScanCapError({ code: "23505", message: "duplicate" })).toBe(false);
  });
});
