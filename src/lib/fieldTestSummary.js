function verificationForEntry(entry, verification = {}) {
  return verification[entry.id] || verification[entry.isbn] || {};
}

function numeric(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fieldTestSummary(entries, verification = {}) {
  const rows = entries.map((entry) => verificationForEntry(entry, verification));
  const verified = rows.filter((row) => row.real_decision);
  const buy = verified.filter((row) => row.real_decision === "buy");
  const pass = verified.filter((row) => row.real_decision === "pass");
  const watch = verified.filter((row) => row.real_decision === "watch");
  const actualNetValues = buy.map((row) => numeric(row.actual_net)).filter((value) => value != null);
  const actualNet = actualNetValues.reduce((sum, value) => sum + value, 0);

  return {
    totalRows: entries.length,
    verifiedRows: verified.length,
    unverifiedRows: Math.max(0, entries.length - verified.length),
    buyRows: buy.length,
    passRows: pass.length,
    watchRows: watch.length,
    actualNet,
    actualNetCount: actualNetValues.length,
    verificationRate: entries.length ? verified.length / entries.length : 0,
  };
}

export function createExportHistoryItem({ entries, verification, exportedAt = new Date().toISOString() }) {
  const summary = fieldTestSummary(entries, verification);
  return {
    id: exportedAt,
    exportedAt,
    totalRows: summary.totalRows,
    verifiedRows: summary.verifiedRows,
    buyRows: summary.buyRows,
    actualNet: Number(summary.actualNet.toFixed(2)),
  };
}

export function readExportHistory(storage, key) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeExportHistory(storage, key, history, item, limit = 5) {
  const next = [item, ...history.filter((existing) => existing.id !== item.id)].slice(0, limit);
  storage.setItem(key, JSON.stringify(next));
  return next;
}
