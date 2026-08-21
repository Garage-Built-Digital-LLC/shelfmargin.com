import { describe, expect, it } from "vitest";
import {
  normalizeProfilePatch,
  normalizeScanPatch,
  normalizeVerificationPatch,
} from "../lib/scansRepo.js";

describe("scans repository write guards", () => {
  it("allows only editable profile fields", () => {
    expect(normalizeProfilePatch({
      cost_per_book: "2.50",
      buy_threshold: 8,
      default_condition: "used-good",
      sound_enabled: false,
      role: "admin",
      subscription_status: "active",
      user_id: "other-user",
    })).toEqual({
      cost_per_book: 2.5,
      buy_threshold: 8,
      default_condition: "used-good",
      sound_enabled: false,
    });
  });

  it("rejects invalid profile values", () => {
    expect(normalizeProfilePatch({
      cost_per_book: -1,
      buy_threshold: "not-a-number",
      default_condition: "admin",
      sound_enabled: "yes",
    })).toEqual({});
  });

  it("allows only editable scan fields", () => {
    expect(normalizeScanPatch({
      copy_count: "3",
      condition: "used-acceptable",
      lifecycle_status: "listed",
      user_id: "other-user",
      status: "buy",
      amazon_net: 99,
    })).toEqual({
      copy_count: 3,
      condition: "used-acceptable",
      lifecycle_status: "listed",
    });
  });

  it("rejects invalid scan updates", () => {
    expect(normalizeScanPatch({
      copy_count: 0,
      condition: "broken",
      lifecycle_status: "deleted",
    })).toEqual({});
  });

  it("allows only editable verification fields", () => {
    const patch = normalizeVerificationPatch({
      actual_source_checked: "amazon+ebay",
      amazon_eligible: "restricted",
      amazon_actual_price: "14.50",
      amazon_actual_rank: "42.9",
      ebay_sold_comp: "",
      actual_shipping: "4",
      actual_fees: "1.25",
      actual_net: "9.25",
      real_decision: "watch",
      notes: "x".repeat(2100),
      scan_id: "scan-1",
      user_id: "other-user",
    });

    expect(patch).toEqual({
      actual_source_checked: "amazon+ebay",
      amazon_eligible: "restricted",
      amazon_actual_price: 14.5,
      amazon_actual_rank: 42,
      ebay_sold_comp: null,
      actual_shipping: 4,
      actual_fees: 1.25,
      actual_net: 9.25,
      real_decision: "watch",
      notes: "x".repeat(2000),
    });
  });

  it("rejects invalid verification fields", () => {
    expect(normalizeVerificationPatch({
      actual_source_checked: "walmart",
      amazon_eligible: "maybe",
      amazon_actual_price: "free",
      real_decision: "admin",
    })).toEqual({});
  });
});
