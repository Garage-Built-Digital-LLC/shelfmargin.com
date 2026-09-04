import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAdminUser } from "../lib/adminAuth.js";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
}

describe("admin auth guard", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects requests without a bearer token", async () => {
    resetEnv();

    await expect(verifyAdminUser({ authHeader: "" })).rejects.toMatchObject({
      status: 401,
      message: "Sign in as admin.",
    });
  });

  it("allows a verified admin profile", async () => {
    resetEnv();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "user-1", email: "admin@example.com" }) };
      }
      if (String(url).includes("/rest/v1/profiles")) {
        return { ok: true, json: async () => [{ role: "admin" }] };
      }
      throw new Error(`unexpected URL ${url}`);
    });

    const result = await verifyAdminUser({ authHeader: "Bearer user-token", fetchImpl });

    expect(result).toEqual({ role: "admin" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain("user_id=eq.user-1");
  });

  it("rejects non-admin profiles", async () => {
    resetEnv();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "user-1", email: "user@example.com" }) };
      }
      return { ok: true, json: async () => [{ role: "user" }] };
    });

    await expect(verifyAdminUser({ authHeader: "Bearer user-token", fetchImpl })).rejects.toMatchObject({
      status: 403,
      message: "Admin access required.",
    });
  });
});
