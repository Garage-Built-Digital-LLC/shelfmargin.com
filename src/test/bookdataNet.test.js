import { describe, expect, it } from "vitest";
import { calcNet, calcNetFromFees, buildEntry } from "../lib/bookdata.js";

describe("calcNet fulfillment", () => {
  // price 20: referral = max(3, 0.30) = 3.00, closing = 1.80, cost = 1
  it("FBA counts the $4.49 fulfillment fee", () => {
    // 20 - 3 - 1.8 - 4.49 - 1 = 9.71
    expect(calcNet(20, 1, "fba")).toBe(9.71);
  });
  it("FBM drops the FBA fee", () => {
    // 20 - 3 - 1.8 - 0 - 1 = 14.20
    expect(calcNet(20, 1, "fbm")).toBe(14.2);
  });
  it("defaults to FBA when unspecified", () => {
    expect(calcNet(20, 1)).toBe(9.71);
  });
});

describe("buildEntry net source", () => {
  it("uses real fees when core.amazonFees is present (fulfillment ignored for the number)", () => {
    const core = { title: "T", author: "A", amazonPrice: 20, amazonFees: 6.5, fulfillment: "fba" };
    const entry = buildEntry("9780000000001", core, 1, "id1");
    // calcNetFromFees(20, 6.5, 1) = 12.5
    expect(entry.amazonNet).toBe(calcNetFromFees(20, 6.5, 1));
    expect(entry.amazonNet).toBe(12.5);
    expect(entry.fulfillment).toBe("fba");
  });
  it("falls back to the flat estimate honoring FBM when no live fees", () => {
    const core = { title: "T", author: "A", amazonPrice: 20, fulfillment: "fbm" };
    const entry = buildEntry("9780000000002", core, 1, "id2");
    expect(entry.amazonNet).toBe(calcNet(20, 1, "fbm")); // 14.20
    expect(entry.fulfillment).toBe("fbm");
  });
});
