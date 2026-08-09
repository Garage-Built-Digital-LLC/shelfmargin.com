import { describe, expect, it } from "vitest";
import {
  createExportHistoryItem,
  fieldTestSummary,
  readExportHistory,
  writeExportHistory,
} from "../lib/fieldTestSummary.js";

const entries = [
  { id: "scan-1", isbn: "111" },
  { id: "scan-2", isbn: "222" },
  { id: "scan-3", isbn: "333" },
];

describe("book-check summary", () => {
  it("summarizes verified decisions and actual net", () => {
    const summary = fieldTestSummary(entries, {
      "scan-1": { real_decision: "buy", actual_net: "9.73" },
      "scan-2": { real_decision: "pass", actual_net: "-1.25" },
      "scan-3": { real_decision: "watch", actual_net: "" },
    });

    expect(summary.totalRows).toBe(3);
    expect(summary.verifiedRows).toBe(3);
    expect(summary.buyRows).toBe(1);
    expect(summary.passRows).toBe(1);
    expect(summary.watchRows).toBe(1);
    expect(summary.actualNet).toBe(9.73);
    expect(summary.verificationRate).toBe(1);
  });

  it("creates compact export history items", () => {
    const item = createExportHistoryItem({
      entries,
      verification: { "scan-1": { real_decision: "buy", actual_net: "9.73" } },
      exportedAt: "2026-08-06T18:00:00.000Z",
    });

    expect(item.totalRows).toBe(3);
    expect(item.verifiedRows).toBe(1);
    expect(item.buyRows).toBe(1);
    expect(item.actualNet).toBe(9.73);
  });

  it("reads and writes export history safely", () => {
    const store = new Map();
    const storage = {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
    };
    const item = { id: "export-1", totalRows: 2 };

    const next = writeExportHistory(storage, "history", [], item);

    expect(next).toEqual([item]);
    expect(readExportHistory(storage, "history")).toEqual([item]);
  });
});
