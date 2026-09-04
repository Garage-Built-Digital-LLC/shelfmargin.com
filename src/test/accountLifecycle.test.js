import { describe, expect, it, vi } from "vitest";
import { exportUserData, deleteUserAccount } from "../lib/accountLifecycle.js";

const env = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
};

const authHeader = "Bearer user-token-abc";

// Routes fetch calls by URL so we can assert per-endpoint behavior and headers.
function router(handlers) {
  return vi.fn(async (url, options = {}) => {
    for (const [needle, handler] of handlers) {
      if (url.includes(needle)) return handler(url, options);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const okUser = () => ({ ok: true, json: async () => ({ id: "user_123", email: "a@b.co", created_at: "2026-01-01T00:00:00Z" }) });

describe("account data export", () => {
  it("requires a bearer token", async () => {
    await expect(exportUserData({ authHeader: "", env, fetchImpl: vi.fn() }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("fetches every owned table with the caller's own token and returns scoped data", async () => {
    const seen = [];
    const fetchImpl = router([
      ["/auth/v1/user", okUser],
      ["/rest/v1/profiles", (u, o) => { seen.push(["profiles", o.headers.authorization]); return { ok: true, json: async () => [{ user_id: "user_123" }] }; }],
      ["/rest/v1/scans", (u, o) => { seen.push(["scans", o.headers.authorization]); return { ok: true, json: async () => [{ id: "s1" }] }; }],
      ["/rest/v1/scan_verifications", () => ({ ok: true, json: async () => [] })],
      ["/rest/v1/billing_accounts", () => ({ ok: true, json: async () => [{ plan: "free_beta" }] })],
    ]);

    const out = await exportUserData({ authHeader, env, fetchImpl });

    expect(out.account.id).toBe("user_123");
    expect(out.data.profiles).toHaveLength(1);
    expect(out.data.billing_accounts[0].plan).toBe("free_beta");
    // Every table read must carry the USER's bearer token (RLS scopes it), never a service key.
    for (const [, auth] of seen) expect(auth).toBe("Bearer user-token-abc");
  });

  it("surfaces a 502 if a table read fails", async () => {
    const fetchImpl = router([
      ["/auth/v1/user", okUser],
      ["/rest/v1/profiles", () => ({ ok: false, json: async () => ({}) })],
    ]);
    await expect(exportUserData({ authHeader, env, fetchImpl })).rejects.toMatchObject({ status: 502 });
  });
});

describe("account deletion", () => {
  it("requires a bearer token", async () => {
    await expect(deleteUserAccount({ authHeader: "", env, fetchImpl: vi.fn() }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("verifies the user then calls the delete_own_account RPC with the user's token", async () => {
    let rpcAuth = null;
    const fetchImpl = router([
      ["/auth/v1/user", okUser],
      ["/rest/v1/rpc/delete_own_account", (u, o) => { rpcAuth = o.headers.authorization; return { ok: true, json: async () => null }; }],
    ]);

    const out = await deleteUserAccount({ authHeader, env, fetchImpl });
    expect(out).toEqual({ deleted: true });
    expect(rpcAuth).toBe("Bearer user-token-abc");
  });

  it("fails closed if the RPC errors", async () => {
    const fetchImpl = router([
      ["/auth/v1/user", okUser],
      ["/rest/v1/rpc/delete_own_account", () => ({ ok: false, json: async () => ({}) })],
    ]);
    await expect(deleteUserAccount({ authHeader, env, fetchImpl })).rejects.toMatchObject({ status: 502 });
  });
});
