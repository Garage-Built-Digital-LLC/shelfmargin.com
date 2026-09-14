import { describe, expect, it } from "vitest";
import { scanSessionKey, scanSessionSummary, placeVisitSummary } from "../../packages/core/sessionSummary.js";

describe("scan session summary", () => {
  it("groups scans by date and totals units, buy list count, and estimated profit", () => {
    const sessions = scanSessionSummary([
      {
        at: "2026-08-08T14:00:00.000Z",
        count: 2,
        queued: true,
        amazonNet: 4,
      },
      {
        at: "2026-08-08T15:00:00.000Z",
        count: 1,
        queued: false,
        amazonNet: -1,
      },
      {
        at: "2026-08-07T15:00:00.000Z",
        count: 1,
        queued: true,
        amazonNet: 3,
      },
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].key).toBe("2026-08-08");
    expect(sessions[0].units).toBe(3);
    expect(sessions[0].buyList).toBe(1);
    expect(sessions[0].estimatedProfit).toBe(8);
    expect(sessions[1].key).toBe("2026-08-07");
  });

  it("handles unknown dates", () => {
    expect(scanSessionKey({})).toBe("unknown");
    expect(scanSessionSummary([{}])[0].label).toBe("Unknown date");
  });
});

describe("place visit summary", () => {
  const places = [
    { id: "p1", name: "Goodwill on 5th", kind: "thrift", lat: 40.7, lng: -74 },
    { id: "p2", name: "Library sale", kind: "library-sale" },
  ];
  const scans = [
    { location_id: "p1", at: "2026-08-08T14:00:00.000Z", count: 2, queued: true, amazonNet: 4 },
    { location_id: "p1", at: "2026-08-08T15:00:00.000Z", count: 1, queued: false, amazonNet: -1 },
    { location_id: "p1", at: "2026-08-01T10:00:00.000Z", count: 1, queued: true, amazonNet: 3 },
    { location_id: "p2", at: "2026-08-05T09:00:00.000Z", count: 5, queued: true, amazonNet: 6 },
    { at: "2026-08-02T09:00:00.000Z", count: 1, queued: false, amazonNet: 2 }, // no place → Unsorted
  ];

  it("groups scans by place then date, with per-visit and per-place totals", () => {
    const summary = placeVisitSummary(scans, places);
    // p1 (2 visits, most recent) first, p2 next, Unsorted last
    const p1 = summary.find((g) => g.placeId === "p1");
    expect(p1.place.name).toBe("Goodwill on 5th");
    expect(p1.visits).toHaveLength(2);
    expect(p1.visits[0].key).toBe("2026-08-08"); // most recent visit first
    expect(p1.visits[0].units).toBe(3);
    expect(p1.visits[0].buyList).toBe(1);
    expect(p1.visits[0].estProfit).toBe(8); // 4*2 (the -1 scan doesn't add)
    expect(p1.totals).toMatchObject({ visits: 2, units: 4, buyList: 2, estProfit: 11 });
  });

  it("puts scans with no place into an Unsorted bucket sorted last", () => {
    const summary = placeVisitSummary(scans, places);
    const last = summary[summary.length - 1];
    expect(last.placeId).toBeNull();
    expect(last.name).toBe("Unsorted");
    expect(last.totals.units).toBe(1);
  });

  it("supports db-shaped rows (location_id, amazon_net, copy_count, created_at)", () => {
    const summary = placeVisitSummary(
      [{ location_id: "p1", created_at: "2026-08-08T14:00:00.000Z", copy_count: 2, amazon_net: 5, queued: true }],
      places,
    );
    expect(summary[0].totals.units).toBe(2);
    expect(summary[0].totals.estProfit).toBe(10);
  });

  it("returns empty for no scans", () => {
    expect(placeVisitSummary([], places)).toEqual([]);
  });
});
