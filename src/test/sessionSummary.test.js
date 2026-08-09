import { describe, expect, it } from "vitest";
import { scanSessionKey, scanSessionSummary } from "../lib/sessionSummary.js";

describe("scan session summary", () => {
  it("groups scans by date and totals units, buy list count, and estimated profit", () => {
    const sessions = scanSessionSummary([
      {
        at: "2026-08-08T14:00:00.000Z",
        count: 2,
        queued: true,
        amazonNet: 4,
        ebayNet: 6,
      },
      {
        at: "2026-08-08T15:00:00.000Z",
        count: 1,
        queued: false,
        amazonNet: -1,
        ebayNet: 2,
      },
      {
        at: "2026-08-07T15:00:00.000Z",
        count: 1,
        queued: true,
        amazonNet: 3,
        ebayNet: null,
      },
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].key).toBe("2026-08-08");
    expect(sessions[0].units).toBe(3);
    expect(sessions[0].buyList).toBe(1);
    expect(sessions[0].estimatedProfit).toBe(14);
    expect(sessions[1].key).toBe("2026-08-07");
  });

  it("handles unknown dates", () => {
    expect(scanSessionKey({})).toBe("unknown");
    expect(scanSessionSummary([{}])[0].label).toBe("Unknown date");
  });
});
