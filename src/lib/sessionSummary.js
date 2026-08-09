function entryTime(entry) {
  const raw = entry?.at ?? entry?.created_at;
  const time = typeof raw === "number" ? raw : Date.parse(raw || "");
  return Number.isFinite(time) ? time : 0;
}

export function scanSessionKey(entry) {
  const time = entryTime(entry);
  if (!time) return "unknown";
  return new Date(time).toISOString().slice(0, 10);
}

export function scanSessionLabel(key) {
  if (key === "unknown") return "Unknown date";
  return new Date(`${key}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function scanSessionSummary(entries = []) {
  const groups = new Map();

  entries.forEach((entry) => {
    const key = scanSessionKey(entry);
    const current = groups.get(key) || {
      key,
      label: scanSessionLabel(key),
      entries: [],
      units: 0,
      buyList: 0,
      estimatedProfit: 0,
      firstAt: entryTime(entry),
      lastAt: entryTime(entry),
    };
    const count = entry.count ?? 1;
    const bestNet = Math.max(entry.amazonNet ?? -Infinity, entry.ebayNet ?? -Infinity);
    current.entries.push(entry);
    current.units += count;
    if (entry.queued) current.buyList += 1;
    if (Number.isFinite(bestNet) && bestNet > 0) current.estimatedProfit += bestNet * count;
    current.firstAt = Math.min(current.firstAt || entryTime(entry), entryTime(entry));
    current.lastAt = Math.max(current.lastAt || entryTime(entry), entryTime(entry));
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => b.lastAt - a.lastAt);
}
