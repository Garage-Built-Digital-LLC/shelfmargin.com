import { fieldTestSummary } from "./fieldTestSummary.js";
import { scanSessionSummary } from "./sessionSummary.js";

export const MVP_THRESHOLDS = {
  minScans: 50,
  minSessions: 3,
  minVerifiedRows: 15,
  minExports: 2,
  minBuyListRows: 5,
  minActualBuyRows: 3,
};

function countBuyList(entries = []) {
  return entries.filter((entry) => entry.queued).length;
}

function readinessItem({ id, label, current, target, done }) {
  return {
    id,
    label,
    current,
    target,
    done: done ?? current >= target,
  };
}

export function mvpReadinessReport({
  entries = [],
  verification = {},
  exportHistory = [],
  thresholds = MVP_THRESHOLDS,
} = {}) {
  const sessions = scanSessionSummary(entries).filter((session) => session.key !== "unknown");
  const fieldSummary = fieldTestSummary(entries, verification);
  const buyListRows = countBuyList(entries);
  const exports = Array.isArray(exportHistory) ? exportHistory.length : 0;

  const checks = [
    readinessItem({
      id: "real-scans",
      label: "Scan real books",
      current: entries.length,
      target: thresholds.minScans,
    }),
    readinessItem({
      id: "repeat-sessions",
      label: "Test on multiple sourcing trips",
      current: sessions.length,
      target: thresholds.minSessions,
    }),
    readinessItem({
      id: "verified-books",
      label: "Check books against marketplace facts",
      current: fieldSummary.verifiedRows,
      target: thresholds.minVerifiedRows,
    }),
    readinessItem({
      id: "buy-list",
      label: "Save possible buys",
      current: buyListRows,
      target: thresholds.minBuyListRows,
    }),
    readinessItem({
      id: "actual-buys",
      label: "Find real buy candidates",
      current: fieldSummary.buyRows,
      target: thresholds.minActualBuyRows,
    }),
    readinessItem({
      id: "exports",
      label: "Export evidence lists",
      current: exports,
      target: thresholds.minExports,
    }),
  ];

  const completed = checks.filter((check) => check.done).length;
  const score = checks.length ? completed / checks.length : 0;

  return {
    score,
    completed,
    total: checks.length,
    readyForPaidBeta: checks.every((check) => check.done),
    readyForLiveDataSpend: checks.find((check) => check.id === "verified-books")?.done && checks.find((check) => check.id === "exports")?.done,
    readyForIosPlanning: false,
    checks,
    summary: {
      scans: entries.length,
      sourcingSessions: sessions.length,
      verifiedRows: fieldSummary.verifiedRows,
      buyListRows,
      actualBuyRows: fieldSummary.buyRows,
      exports,
      actualNet: Number(fieldSummary.actualNet.toFixed(2)),
      verificationRate: fieldSummary.verificationRate,
    },
  };
}

export function nextMvpAction(report) {
  const next = report?.checks?.find((check) => !check.done);
  if (!next) return "Review pricing, live data cost, and paid beta onboarding before charging.";
  if (next.id === "real-scans") return "Scan more real books with the Bluetooth scanner.";
  if (next.id === "repeat-sessions") return "Run the scanner on separate sourcing trips, not only one desk test.";
  if (next.id === "verified-books") return "Check scanned books against real marketplace facts before buying.";
  if (next.id === "buy-list") return "Save more possible buys so the buy-list workflow gets tested.";
  if (next.id === "actual-buys") return "Find enough real buy candidates to prove the app can create value.";
  if (next.id === "exports") return "Export the book-check list so results can be reviewed outside the app.";
  return next.label;
}
