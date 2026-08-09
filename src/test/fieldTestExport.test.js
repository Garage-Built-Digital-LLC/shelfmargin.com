import { describe, expect, it } from "vitest";
import { FIELD_TEST_HEADERS, fieldTestCsv, fieldTestRows } from "../lib/fieldTestExport.js";

const entry = {
  id: "scan-1",
  at: Date.UTC(2026, 7, 6, 14, 30),
  isbn: "9780306406157",
  title: 'The "C" Programming Language',
  author: "Kernighan & Ritchie",
  count: 2,
  amazonPrice: 34.99,
  ebayPrice: 29,
  amazonNet: 21.45,
  ebayNet: 19.86,
  winner: "amazon",
  velocity: { tier: "Fast" },
  restricted: false,
};

describe("book-check export", () => {
  it("builds rows with app estimates and blank actual verification fields", () => {
    const [row] = fieldTestRows([entry], { cost: 1.5, threshold: 5 });

    expect(row.isbn).toBe("9780306406157");
    expect(row.copies).toBe(2);
    expect(row.app_status_est).toBe("buy");
    expect(row.app_recommended_channel_est).toBe("amazon");
    expect(row.app_amazon_price_est).toBe("34.99");
    expect(row.actual_source_checked).toBe("");
    expect(row.real_decision).toBe("");
  });

  it("exports stable CSV headers and escapes quoted titles", () => {
    const csv = fieldTestCsv([entry], { cost: 1.5, threshold: 5 });
    const lines = csv.split("\n");

    expect(lines[0]).toBe(FIELD_TEST_HEADERS.join(","));
    expect(lines[1]).toContain('"The ""C"" Programming Language"');
    expect(lines[1]).toContain("9780306406157");
  });

  it("exports edited actual verification fields", () => {
    const [row] = fieldTestRows([entry], {
      cost: 1.5,
      threshold: 5,
      verification: {
        "scan-1": {
          actual_source_checked: "amazon+ebay",
          amazon_eligible: "yes",
          amazon_actual_price: "31.50",
          actual_net: "16.20",
          real_decision: "buy",
          notes: "clean copy",
        },
      },
    });

    expect(row.actual_source_checked).toBe("amazon+ebay");
    expect(row.amazon_eligible).toBe("yes");
    expect(row.actual_net).toBe("16.20");
    expect(row.real_decision).toBe("buy");
    expect(row.notes).toBe("clean copy");
  });
});
