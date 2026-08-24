import { describe, expect, it } from "vitest";
import { mvpReadinessReport, nextMvpAction } from "../lib/mvpReadiness.js";

function entry(index, date = "2026-08-20") {
  return {
    id: `scan-${index}`,
    isbn: `97800000000${String(index).padStart(2, "0")}`,
    at: `${date}T12:00:00.000Z`,
    queued: index % 3 === 0,
    amazonNet: index % 4 === 0 ? 8 : -1,
    ebayNet: index % 5 === 0 ? 6 : 1,
  };
}

describe("MVP readiness report", () => {
  it("shows the next concrete field-test action when evidence is thin", () => {
    const report = mvpReadinessReport({
      entries: [entry(1)],
      verification: {},
      exportHistory: [],
      thresholds: {
        minScans: 2,
        minSessions: 1,
        minVerifiedRows: 1,
        minExports: 1,
        minBuyListRows: 1,
        minActualBuyRows: 1,
      },
    });

    expect(report.readyForPaidBeta).toBe(false);
    expect(report.summary.scans).toBe(1);
    expect(nextMvpAction(report)).toBe("Scan more real books with the Bluetooth scanner.");
  });

  it("marks paid beta readiness only when the core evidence exists", () => {
    const entries = [
      entry(1, "2026-08-20"),
      entry(2, "2026-08-21"),
      { ...entry(3, "2026-08-22"), queued: true },
    ];
    const verification = {
      "scan-1": { real_decision: "buy", actual_net: "7.50" },
      "scan-2": { real_decision: "pass", actual_net: "" },
      "scan-3": { real_decision: "buy", actual_net: "12.25" },
    };

    const report = mvpReadinessReport({
      entries,
      verification,
      exportHistory: [{ id: "export-1" }],
      thresholds: {
        minScans: 3,
        minSessions: 3,
        minVerifiedRows: 3,
        minExports: 1,
        minBuyListRows: 1,
        minActualBuyRows: 2,
      },
    });

    expect(report.readyForPaidBeta).toBe(true);
    expect(report.readyForLiveDataSpend).toBe(true);
    expect(report.readyForIosPlanning).toBe(false);
    expect(report.summary.actualNet).toBe(19.75);
    expect(report.score).toBe(1);
    expect(nextMvpAction(report)).toBe("Review pricing, live data cost, and paid beta onboarding before charging.");
  });

  it("does not count unknown-date scans as repeat sourcing sessions", () => {
    const report = mvpReadinessReport({
      entries: [{ id: "scan-1", queued: true }],
      thresholds: {
        minScans: 1,
        minSessions: 1,
        minVerifiedRows: 0,
        minExports: 0,
        minBuyListRows: 1,
        minActualBuyRows: 0,
      },
    });

    expect(report.summary.sourcingSessions).toBe(0);
    expect(report.checks.find((check) => check.id === "repeat-sessions").done).toBe(false);
  });
});
