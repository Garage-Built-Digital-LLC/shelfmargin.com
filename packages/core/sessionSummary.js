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
    const bestNet = entry.amazonNet ?? -Infinity;
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

// ---------------------------------------------------------------------------
// Places & Trips: group scans by PLACE, then by date, into visits.
//
// A "visit" is one sourcing run at a place on a date (same date logic as
// scanSessionSummary). Scans with no location_id collect under a synthetic
// "Unsorted" place (id === null). Pure — no I/O, so web and iOS share it.
//
// @param {Array} scans   scan/entry rows (need location_id + at/created_at)
// @param {Array} places  the user's places [{ id, name, kind, lat, lng, ... }]
// @returns places, most-recently-visited first:
//   [{ placeId, place, name, visits: [{ key, label, entries, units, buyList,
//      estProfit, firstAt, lastAt }], totals: { visits, units, buyList,
//      estProfit, firstAt, lastAt } }]
// ---------------------------------------------------------------------------
const UNSORTED_KEY = "__unsorted__";

export function placeVisitSummary(scans = [], places = []) {
  const placeById = new Map();
  (places || []).forEach((p) => { if (p && p.id != null) placeById.set(String(p.id), p); });

  // group[placeKey] -> { place, visits: Map<dateKey, visit> }
  const groups = new Map();

  (scans || []).forEach((entry) => {
    const rawId = entry?.location_id ?? entry?.locationId ?? null;
    const placeKey = rawId != null ? String(rawId) : UNSORTED_KEY;
    const place = rawId != null ? (placeById.get(placeKey) || null) : null;

    let group = groups.get(placeKey);
    if (!group) {
      group = {
        placeId: rawId != null ? rawId : null,
        place,
        name: place?.name || (rawId != null ? "Unknown place" : "Unsorted"),
        visits: new Map(),
      };
      groups.set(placeKey, group);
    }

    const dateKey = scanSessionKey(entry);
    let visit = group.visits.get(dateKey);
    if (!visit) {
      visit = {
        key: dateKey,
        label: scanSessionLabel(dateKey),
        entries: [],
        units: 0,
        buyList: 0,
        estProfit: 0,
        firstAt: entryTime(entry),
        lastAt: entryTime(entry),
      };
      group.visits.set(dateKey, visit);
    }

    const count = entry.count ?? entry.copy_count ?? 1;
    const bestNet = entry.amazonNet ?? entry.amazon_net ?? -Infinity;
    const t = entryTime(entry);
    visit.entries.push(entry);
    visit.units += count;
    if (entry.queued) visit.buyList += 1;
    if (Number.isFinite(bestNet) && bestNet > 0) visit.estProfit += bestNet * count;
    visit.firstAt = Math.min(visit.firstAt || t, t);
    visit.lastAt = Math.max(visit.lastAt || t, t);
  });

  const result = [...groups.values()].map((group) => {
    const visits = [...group.visits.values()].sort((a, b) => b.lastAt - a.lastAt);
    const totals = visits.reduce(
      (acc, v) => ({
        visits: acc.visits + 1,
        units: acc.units + v.units,
        buyList: acc.buyList + v.buyList,
        estProfit: acc.estProfit + v.estProfit,
        firstAt: Math.min(acc.firstAt, v.firstAt),
        lastAt: Math.max(acc.lastAt, v.lastAt),
      }),
      { visits: 0, units: 0, buyList: 0, estProfit: 0, firstAt: Infinity, lastAt: 0 },
    );
    return { placeId: group.placeId, place: group.place, name: group.name, visits, totals };
  });

  // Most-recently-visited first; the Unsorted bucket always sinks to the bottom.
  return result.sort((a, b) => {
    if (a.placeId === null && b.placeId !== null) return 1;
    if (b.placeId === null && a.placeId !== null) return -1;
    return b.totals.lastAt - a.totals.lastAt;
  });
}
