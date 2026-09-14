import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { placeVisitSummary } from "../../packages/core/sessionSummary.js";

const INK = "var(--sm-ink)";
const MUTED = "var(--sm-muted)";
const LINE = "var(--sm-line-strong)";
const SURFACE = "var(--sm-panel)";
const SOFT = "var(--sm-panel-2)";
const YELLOW = "var(--sm-gold)";
const GREEN = "var(--sm-buy)";
const RED = "var(--sm-pass)";
const GOLD_INK = "var(--sm-gold-ink)";

const KIND_LABEL = {
  thrift: "Thrift", "library-sale": "Library sale", "garage-sale": "Garage sale",
  "estate-sale": "Estate sale", bookstore: "Bookstore", store: "Store", other: "Place",
};

function money(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---- interactive map (Leaflet + OpenStreetMap) ---------------------------
function PlacesMap({ places, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!elRef.current) return undefined;
    const withCoords = (places || []).filter((p) => p.lat != null && p.lng != null);
    const map = L.map(elRef.current, { attributionControl: true, scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    if (withCoords.length) {
      const markers = withCoords.map((p) => {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 9, color: "#F55E1F", fillColor: "#F55E1F", fillOpacity: 0.85, weight: 2,
        });
        m.bindPopup(`<b>${escapeHtml(p.name)}</b>`);
        m.on("click", () => onSelect?.(p.id));
        return m;
      });
      const group = L.featureGroup(markers).addTo(map);
      map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 14 });
    } else {
      map.setView([39.5, -98.35], 3); // continental US
    }
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, [places, onSelect]);

  return (
    <div
      ref={elRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height: 260, border: `1px solid ${LINE}`, background: SOFT }}
    />
  );
}

// ---- one book row inside a visit -----------------------------------------
function BookRow({ entry, threshold }) {
  const net = entry.amazonNet ?? null;
  const isBuy = net != null && net >= threshold && !entry.restricted;
  const color = entry.restricted ? YELLOW : isBuy ? GREEN : RED;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" style={{ borderTop: `1px solid ${LINE}` }}>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold" style={{ color: INK }}>{entry.title || entry.isbn}</div>
        <div className="truncate text-xs" style={{ color: MUTED }}>{entry.author || entry.isbn}{entry.count > 1 ? ` · ×${entry.count}` : ""}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-black" style={{ color }}>{net == null ? "—" : money(net)}</div>
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>
          {entry.restricted ? "check" : isBuy ? "buy" : "pass"}
        </div>
      </div>
    </div>
  );
}

// ---- one place, expandable into its visits -------------------------------
function PlaceCard({ group, threshold, expanded, onToggle }) {
  const t = group.totals;
  const isUnsorted = group.placeId === null;
  return (
    <div className="rounded-2xl" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <MapPin size={18} color={isUnsorted ? MUTED : YELLOW} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black" style={{ color: INK }}>{group.name}</div>
          <div className="text-xs font-bold" style={{ color: MUTED }}>
            {isUnsorted ? "no place set" : (KIND_LABEL[group.place?.kind] || "Place")} · {t.visits} visit{t.visits === 1 ? "" : "s"} · {t.units} scanned · {t.buyList} buys
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-black" style={{ color: t.estProfit > 0 ? GREEN : MUTED }}>{money(t.estProfit)}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>est. profit</div>
        </div>
        {expanded ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          {group.visits.map((v) => (
            <VisitBlock key={v.key} visit={v} threshold={threshold} />
          ))}
        </div>
      )}
    </div>
  );
}

function VisitBlock({ visit, threshold }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: SOFT, border: `1px solid ${LINE}` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-black" style={{ color: INK }}>{visit.label}</span>
        <span className="text-xs font-bold" style={{ color: MUTED }}>
          {visit.units} scanned · {visit.buyList} buys · <span style={{ color: visit.estProfit > 0 ? GREEN : MUTED }}>{money(visit.estProfit)}</span>
        </span>
      </button>
      {open && (
        <div className="mt-1">
          {visit.entries.map((e) => <BookRow key={e.id || e.isbn} entry={e} threshold={threshold} />)}
        </div>
      )}
    </div>
  );
}

export default function PlacesView({ entries, places, threshold = 3, onBack, onNavigateScan }) {
  const summary = useMemo(() => placeVisitSummary(entries || [], places || []), [entries, places]);
  const [expandedId, setExpandedId] = useState(null);
  const hasAnyCoords = (places || []).some((p) => p.lat != null && p.lng != null);
  const keyFor = (g) => (g.placeId === null ? "__unsorted__" : g.placeId);

  // Show every saved place (even with zero visits yet), plus the Unsorted
  // bucket for scans with no place. Visited places sort by recency; the rest
  // follow; Unsorted always sinks to the bottom.
  const groups = useMemo(() => {
    const byId = new Map(summary.map((g) => [keyFor(g), g]));
    const rows = [];
    (places || []).forEach((p) => {
      rows.push(byId.get(p.id) || {
        placeId: p.id, place: p, name: p.name, visits: [],
        totals: { visits: 0, units: 0, buyList: 0, estProfit: 0, firstAt: 0, lastAt: 0 },
      });
    });
    const unsorted = byId.get("__unsorted__");
    if (unsorted) rows.push(unsorted);
    return rows.sort((a, b) => {
      if (a.placeId === null) return 1;
      if (b.placeId === null) return -1;
      return (b.totals.lastAt || 0) - (a.totals.lastAt || 0);
    });
  }, [summary, places]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-black uppercase tracking-widest" style={{ color: MUTED }}>
          <ArrowLeft size={14} /> Scan
        </button>
        <h1 className="ml-1 text-lg font-black" style={{ color: INK }}>Places &amp; Trips</h1>
      </div>

      {places && places.length > 0 && hasAnyCoords && (
        <div className="mb-4">
          <PlacesMap places={places} onSelect={(id) => setExpandedId(id)} />
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl px-4 py-10 text-center" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
          <MapPin size={22} color={MUTED} className="mx-auto" />
          <div className="mt-2 text-sm font-black" style={{ color: INK }}>No places yet</div>
          <div className="mx-auto mt-1 max-w-xs text-xs font-bold" style={{ color: MUTED }}>
            Set “Sourcing at” on the scan screen before a trip, and your scans will collect here by place and date.
          </div>
          <button type="button" onClick={onNavigateScan} className="mt-3 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK }}>
            Go to Scan
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <PlaceCard
              key={keyFor(group)}
              group={group}
              threshold={threshold}
              expanded={expandedId === keyFor(group)}
              onToggle={() => setExpandedId((cur) => (cur === keyFor(group) ? null : keyFor(group)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
