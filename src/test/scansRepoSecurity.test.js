import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [],
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  },
  from: vi.fn((table) => {
    const builder = {
      update: vi.fn((payload) => {
        const call = { table, op: "update", payload };
        mocks.calls.push(call);
        return {
          eq: vi.fn(async (field, value) => {
            call.eq = { field, value };
            return { error: null };
          }),
        };
      }),
      upsert: vi.fn((payload, options) => {
        const call = { table, op: "upsert", payload, options };
        mocks.calls.push(call);
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: payload, error: null })),
          })),
        };
      }),
    };
    return builder;
  }),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    auth: mocks.auth,
    from: mocks.from,
  },
}));

const { updateProfile, updateScan, upsertScanVerification } = await import("../lib/scansRepo.js");

describe("scans repo security guards", () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    mocks.auth.getUser.mockClear();
    mocks.from.mockClear();
  });

  it("only sends safe profile fields to Supabase updates", async () => {
    await updateProfile({
      cost_per_book: "2.50",
      buy_threshold: 8,
      default_condition: "used-good",
      sound_enabled: false,
      role: "admin",
      subscription_status: "active",
      trial_scans_used: 0,
      user_id: "attacker",
    });

    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0]).toMatchObject({
      table: "profiles",
      op: "update",
      eq: { field: "user_id", value: "user-1" },
    });
    expect(mocks.calls[0].payload).toEqual({
      cost_per_book: 2.5,
      buy_threshold: 8,
      default_condition: "used-good",
      sound_enabled: false,
      updated_at: expect.any(String),
    });
  });

  it("drops invalid scan update fields", async () => {
    await updateScan("scan-1", {
      copy_count: 3,
      lifecycle_status: "purchased",
      condition: "used-good",
      user_id: "attacker",
      status: "buy",
      recommended_platform: "amazon",
    });

    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0]).toMatchObject({
      table: "scans",
      op: "update",
      eq: { field: "id", value: "scan-1" },
    });
    expect(mocks.calls[0].payload).toEqual({
      copy_count: 3,
      lifecycle_status: "purchased",
      condition: "used-good",
    });
  });

  it("keeps verification ownership fields server-derived", async () => {
    const saved = await upsertScanVerification("scan-1", {
      user_id: "attacker",
      scan_id: "other-scan",
      actual_source_checked: "amazon+ebay",
      amazon_eligible: "yes",
      amazon_actual_price: "14.25",
      amazon_actual_rank: "1234",
      actual_net: "",
      real_decision: "buy",
      notes: "checked in store",
      role: "admin",
    });

    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0]).toMatchObject({
      table: "scan_verifications",
      op: "upsert",
      options: { onConflict: "scan_id" },
    });
    expect(mocks.calls[0].payload).toEqual({
      scan_id: "scan-1",
      user_id: "user-1",
      actual_source_checked: "amazon+ebay",
      amazon_eligible: "yes",
      amazon_actual_price: 14.25,
      amazon_actual_rank: 1234,
      actual_net: null,
      real_decision: "buy",
      notes: "checked in store",
      updated_at: expect.any(String),
    });
    expect(saved).toEqual(mocks.calls[0].payload);
  });
});
