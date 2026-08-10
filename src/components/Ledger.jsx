import { useState, useRef, useEffect, useCallback } from "react";
import {
  Scan, ChevronDown, ChevronUp, Trash2, Volume2, VolumeX, Repeat, FileDown,
  PackagePlus, Send, CheckSquare, Square, TrendingUp, TrendingDown, Minus, Users, Lock, LogOut,
  LayoutDashboard, ClipboardList, Boxes, Settings, AlertTriangle, Database, CloudOff, ShieldCheck,
} from "lucide-react";
import {
  buildEntry, sourcingScore, CONDITIONS, conditionToDb, velocityToDb,
  DEMO_ISBNS, lookupCore,
} from "../lib/bookdata.js";
import { LOOKUP_STATUS, lookupBook } from "../providers/index.js";
import {
  fetchScans, insertScan, updateScan, deleteAllScans, getProfile, updateProfile,
  fetchScanVerifications, upsertScanVerification,
} from "../lib/scansRepo.js";
import { fieldTestCsv } from "../lib/fieldTestExport.js";
import {
  createExportHistoryItem,
  fieldTestSummary,
  readExportHistory,
  writeExportHistory,
} from "../lib/fieldTestSummary.js";
import { scanSessionSummary } from "../lib/sessionSummary.js";
import { DEFAULT_SECTION, hashForSection, sectionFromHash } from "../lib/appRoutes.js";
import { publicPath } from "../lib/siteRoutes.js";
import { supabaseReady } from "../lib/supabase.js";
import { cleanScan, normalizeToIsbn13 } from "../lib/isbn.js";

// palette - clean retail POS aesthetic
const BG = "#F7FAFC";
const INK = "#102033";
const YELLOW = "#FFC526";
const GREEN = "#128548";
const GREEN_BG = "#E9F8EF";
const RED = "#D83A3A";
const RED_BG = "#FDECEC";
const AMBER_BG = "#FFF7D8";
const LINE = "#D7E0EA";
const MUTED = "#64748B";
const BLUE = "#0866D8";
const BLUE_BG = "#EAF3FF";
const EMPTY_SCAN_IMAGE = "/assets/images/product/empty-state-scan.webp";

function dbToDisplayCondition(c) {
  return c === "new" ? "Like New" : c === "used-acceptable" ? "Acceptable" : "Good";
}

function rowToEntry(row) {
  const cost = row.cost_per_book != null ? Number(row.cost_per_book) : 1.5;
  const core = {
    title: row.title,
    author: row.author,
    amazonPrice: row.amazon_price != null ? Number(row.amazon_price) : 0,
    ebayPrice: row.ebay_price != null ? Number(row.ebay_price) : null,
  };
  const queued = row.lifecycle_status === "purchased";
  const entry = buildEntry(row.isbn, core, cost, row.id, {
    count: row.copy_count ?? 1,
    queued,
    condition: dbToDisplayCondition(row.condition),
    restricted: row.restricted,
    at: row.created_at,
  });
  if (queued) entry.listPrice = entry.winner === "amazon" ? entry.amazonPrice : entry.ebayPrice;
  return entry;
}

function entryToRow(entry, userId, cost, threshold) {
  const bestNet = Math.max(entry.amazonNet, entry.ebayNet ?? -Infinity);
  const status = entry.restricted ? "check" : bestNet >= threshold ? "buy" : "pass";
  return {
    user_id: userId,
    isbn: entry.isbn,
    title: entry.title,
    author: entry.author,
    condition: "used-good",
    cost_per_book: cost,
    amazon_price: entry.amazonPrice,
    ebay_price: entry.ebayPrice,
    ebay_price_basis: "active-median",
    amazon_bsr: entry.velocity?.current ?? null,
    amazon_net: Number(entry.amazonNet.toFixed(2)),
    ebay_net: entry.ebayNet != null ? Number(entry.ebayNet.toFixed(2)) : null,
    recommended_platform: entry.winner,
    velocity: velocityToDb(entry.velocity?.tier),
    status,
    restricted: entry.restricted,
    copy_count: entry.count ?? 1,
    lifecycle_status: "scouted",
  };
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StripeBar() {
  return (
    <div className="h-1 w-full" style={{ backgroundColor: YELLOW, borderBottom: `1px solid ${LINE}` }} />
  );
}

function Sparkline({ history, color, width = 56, height = 20 }) {
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  const pts = history
    .map((v, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VelocityBadge({ velocity }) {
  const color = velocity.tier === "Fast" ? GREEN : velocity.tier === "Moderate" ? "#B8860B" : RED;
  const Icon = velocity.trend === "up" ? TrendingUp : velocity.trend === "down" ? TrendingDown : Minus;
  return (
    <span className="flex items-center gap-1 text-xs font-black uppercase" style={{ color }}>
      <Icon size={12} /> {velocity.tier}
    </span>
  );
}

function reasonForEntry(entry, bestNet, threshold) {
  if (entry.restricted) return "Check this one first. It may need approval before you can sell it.";
  if (bestNet >= threshold) return "Looks worth checking. Profit is above your buy minimum.";
  return "Probably skip. Estimated profit is below your buy minimum.";
}

function ShellButton({ active, icon: Icon, label, detail, href, onClick }) {
  return (
    <button
      onClick={onClick}
      data-href={href}
      className="min-w-0 rounded-lg px-3 py-2 text-left flex items-center gap-2"
      style={{
        backgroundColor: active ? BLUE : "#FFFFFF",
        color: active ? "#FFFFFF" : INK,
        border: `1px solid ${active ? BLUE : LINE}`,
        boxShadow: active ? "0 6px 18px rgba(8, 102, 216, 0.18)" : "0 1px 2px rgba(16, 32, 51, 0.04)",
      }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase tracking-widest truncate">{label}</span>
        {detail && <span className="block text-[10px] font-mono truncate" style={{ color: active ? "#DCEBFF" : MUTED }}>{detail}</span>}
      </span>
    </button>
  );
}

function AccountMenu({ session, profileRole, demoMode, onNavigate, onSignOut }) {
  if (demoMode) {
    return (
      <a href={publicPath("login")} className="flex items-center gap-1 shrink-0" style={{ color: INK }}>
        <LogOut size={12} /> create account
      </a>
    );
  }

  return (
    <details className="relative shrink-0">
      <summary
        className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 text-xs font-black uppercase tracking-widest"
        style={{ color: INK, border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF" }}
      >
        Account <ChevronDown size={13} />
      </summary>
      <div
        className="absolute right-0 z-30 mt-2 w-72 rounded-lg p-3 text-xs shadow-xl"
        style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, color: INK }}
      >
        <div className="truncate font-mono font-bold normal-case" style={{ color: MUTED }}>{session?.user?.email}</div>
        {profileRole === "admin" && (
          <div className="mt-2 inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "#FFF", backgroundColor: BLUE }}>
            admin
          </div>
        )}
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest"
            style={{ border: `1px solid ${LINE}` }}
          >
            Dashboard <LayoutDashboard size={13} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest"
            style={{ border: `1px solid ${LINE}` }}
          >
            Settings <Settings size={13} />
          </button>
          {profileRole === "admin" && (
            <button
              type="button"
              onClick={() => onNavigate("admin")}
              className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest"
              style={{ border: `1px solid ${LINE}` }}
            >
              Admin setup <ShieldCheck size={13} />
            </button>
          )}
          <button
            type="button"
            className="px-2 py-2 text-left font-black uppercase tracking-widest"
            style={{ border: `1px solid ${LINE}`, color: MUTED, backgroundColor: BLUE_BG }}
            title="Stripe billing portal is not connected yet."
          >
            Subscription status
            <span className="mt-1 block font-bold normal-case tracking-normal">Free beta - Stripe not connected</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest"
            style={{ border: `1px solid ${LINE}`, color: RED }}
          >
            Sign out <LogOut size={13} />
          </button>
        </div>
      </div>
    </details>
  );
}

function MetricBox({ label, value, tone = "plain" }) {
  const toneBg = tone === "buy" ? GREEN_BG : tone === "warn" ? AMBER_BG : tone === "action" ? BLUE_BG : "#FFFFFF";
  const toneColor = tone === "buy" ? GREEN : tone === "warn" ? "#8A6100" : tone === "action" ? BLUE : INK;
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: toneBg, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(16, 32, 51, 0.04)" }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
      <div className="text-2xl font-black font-mono" style={{ color: toneColor }}>{value}</div>
    </div>
  );
}

function EstimateBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
      style={{ color: "#8A6100", backgroundColor: AMBER_BG, border: `1px solid #B8860B` }}
    >
      <AlertTriangle size={10} /> est
    </span>
  );
}

function AdminCheck({ done, label, detail }) {
  return (
    <div className="flex items-start gap-3 px-2 py-2" style={{ backgroundColor: done ? GREEN_BG : AMBER_BG, border: `1px solid ${LINE}` }}>
      {done ? <CheckSquare size={17} color={GREEN} className="mt-0.5 shrink-0" /> : <Square size={17} color="#8A6100" className="mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-widest">{label}</div>
        <div className="mt-0.5 text-xs font-bold normal-case" style={{ color: MUTED }}>{detail}</div>
      </div>
    </div>
  );
}

function OwnerInputItem({ label, detail }) {
  return (
    <div className="px-2 py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFDF6" }}>
      <div className="text-xs font-black uppercase tracking-widest">{label}</div>
      <div className="mt-0.5 text-xs font-bold normal-case" style={{ color: MUTED }}>{detail}</div>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-black uppercase tracking-widest leading-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, imageSrc, imageAlt = "", title, body, action }) {
  return (
    <div className="rounded-lg px-4 py-10 text-center" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF" }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="mx-auto mb-4 aspect-[4/3] w-full max-w-xs rounded-lg object-cover object-bottom"
          style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF" }}
          loading="lazy"
        />
      ) : Icon && <Icon size={28} className="mx-auto mb-3" color={MUTED} />}
      <div className="text-sm font-black uppercase tracking-widest">{title}</div>
      {body && <div className="mt-2 text-sm font-bold max-w-md mx-auto" style={{ color: MUTED }}>{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function OnboardingChecklist({ totalUnits, queuedCount, verifiedCount, onScan, onFieldTest, demoMode }) {
  const steps = [
    { label: "Scan one book", done: totalUnits > 0, action: onScan },
    { label: "Save one possible buy", done: queuedCount > 0, action: onScan },
    { label: "Check one book", done: verifiedCount > 0, action: onFieldTest },
    { label: "Export your list", done: false, action: onFieldTest },
  ];

  return (
    <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: demoMode ? BLUE_BG : "transparent" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-widest">first useful scan session</div>
          <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>
            Start with one small shelf and see if the app helps.
          </div>
        </div>
        {demoMode && (
          <span className="shrink-0 px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "#FFF", backgroundColor: BLUE }}>
            demo
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <button
            key={step.label}
            onClick={step.action}
            className="flex items-center gap-2 px-2 py-2 text-left text-xs font-bold"
            style={{ border: `1px solid ${LINE}`, backgroundColor: step.done ? GREEN_BG : "#FFFDF6" }}
          >
            {step.done ? <CheckSquare size={16} color={GREEN} /> : <Square size={16} color={MUTED} />}
            <span>{step.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FirstSessionPanel({ cost, threshold, onCostChange, onThresholdChange, onScan, onDemo }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
      <div className="p-4" style={{ border: `2px solid ${LINE}`, backgroundColor: AMBER_BG }}>
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: "#8A6100" }}>start here</div>
        <div className="mt-2 text-xl font-black uppercase tracking-widest leading-tight">Set your buying rules</div>
        <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
          Start with your real book cost and the profit you need before a book is worth checking.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs font-black uppercase tracking-widest">
            cost per book
            <span className="mt-1 flex items-center gap-2 px-2 py-2" style={{ border: `2px solid ${LINE}`, backgroundColor: "#FFFDF6" }}>
              <span>$</span>
              <input
                type="number"
                step="0.25"
                value={cost}
                onChange={(e) => onCostChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent outline-none font-mono normal-case"
              />
            </span>
          </label>
          <label className="text-xs font-black uppercase tracking-widest">
            min profit
            <span className="mt-1 flex items-center gap-2 px-2 py-2" style={{ border: `2px solid ${LINE}`, backgroundColor: "#FFFDF6" }}>
              <span>$</span>
              <input
                type="number"
                step="0.5"
                value={threshold}
                onChange={(e) => onThresholdChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent outline-none font-mono normal-case"
                style={{ color: GREEN }}
              />
            </span>
          </label>
        </div>
        <button
          onClick={onScan}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest"
          style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}
        >
          <Scan size={16} />
          open scout
        </button>
      </div>
      <div className="p-4" style={{ border: `2px solid ${LINE}`, backgroundColor: BLUE_BG }}>
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>next step</div>
        <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
          When you are ready, scan a small shelf. Until then, use the demo to see how buy, pass, and check decisions look.
        </p>
        <a
          href={onDemo}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest"
          style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}
        >
          try demo
        </a>
      </div>
    </div>
  );
}

function ExportHistoryList({ history }) {
  if (history.length === 0) {
    return (
      <div className="px-3 py-3 text-xs font-bold" style={{ border: `2px solid ${LINE}`, color: MUTED }}>
        No exports yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((item) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs font-bold" style={{ border: `2px solid ${LINE}` }}>
          <div>
            <div className="font-black uppercase tracking-widest">{new Date(item.exportedAt).toLocaleString()}</div>
            <div className="mt-1 font-mono" style={{ color: MUTED }}>
              {item.verifiedRows}/{item.totalRows} verified · {item.buyRows} buys
            </div>
          </div>
          <div className="font-mono text-sm font-black" style={{ color: item.actualNet >= 0 ? GREEN : RED }}>
            ${item.actualNet.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SyncStatus({ demoMode, verificationReady, loading }) {
  if (demoMode) {
    return (
      <div className="mb-3 flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
        style={{ backgroundColor: BLUE_BG, color: BLUE, border: `2px solid ${BLUE}` }}>
        <CloudOff size={14} />
        demo mode - sample data only - create an account to save real scans
      </div>
    );
  }

  const ready = supabaseReady && verificationReady && !loading;
  const bg = ready ? GREEN_BG : supabaseReady ? AMBER_BG : RED_BG;
  const color = ready ? GREEN : supabaseReady ? "#8A6100" : RED;
  const label = ready
    ? "scans saving"
    : supabaseReady
      ? "saving starting"
      : "supabase not configured";

  return (
    <div className="mb-3 flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
      style={{ backgroundColor: bg, color, border: `2px solid ${color}` }}>
      <Database size={14} />
      {label}
    </div>
  );
}

function VerifyInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
      {label}
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent px-2 py-1.5 text-xs font-mono normal-case outline-none"
        style={{ border: `2px solid ${LINE}`, color: INK }}
      />
    </label>
  );
}

function VerifySelect({ label, value, onChange, options }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
      {label}
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent px-2 py-1.5 text-xs font-bold normal-case outline-none"
        style={{ border: `2px solid ${LINE}`, color: INK }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function rowToVerification(row) {
  return {
    actual_source_checked: row.actual_source_checked || "",
    amazon_eligible: row.amazon_eligible || "",
    amazon_actual_price: row.amazon_actual_price ?? "",
    amazon_actual_rank: row.amazon_actual_rank ?? "",
    ebay_sold_comp: row.ebay_sold_comp ?? "",
    actual_shipping: row.actual_shipping ?? "",
    actual_fees: row.actual_fees ?? "",
    actual_net: row.actual_net ?? "",
    real_decision: row.real_decision || "",
    notes: row.notes || "",
  };
}

function buildDemoEntries(cost) {
  return DEMO_ISBNS.slice(0, 6).map((isbn, index) => {
    const entry = buildEntry(isbn, { isbn, ...lookupCore(isbn) }, cost, `demo-${isbn}`, {
      count: index === 0 ? 2 : 1,
      queued: index === 0,
      condition: "Good",
    });
    if (entry.queued) entry.listPrice = entry.winner === "amazon" ? entry.amazonPrice : entry.ebayPrice;
    return entry;
  });
}

function useTones(enabled) {
  const ctxRef = useRef(null);
  const getCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  };
  const beep = useCallback((freq, duration, delay = 0) => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) {}
  }, [enabled]);
  return {
    playBuy: () => beep(880, 0.12),
    playPass: () => beep(220, 0.18),
    playDuplicate: () => { beep(660, 0.08, 0); beep(660, 0.08, 0.12); },
    playAction: () => { beep(520, 0.07, 0); beep(780, 0.09, 0.09); },
  };
}

function Ledger({ session, onSignOut, demoMode = false }) {
  const [view, setView] = useState(() => (
    typeof window === "undefined" ? DEFAULT_SECTION : sectionFromHash(window.location.hash)
  ));
  const [isbn, setIsbn] = useState("");
  const [cost, setCost] = useState(1.5);
  const [threshold, setThreshold] = useState(5.0);
  const [soundOn, setSoundOn] = useState(true);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState({});
  const [verification, setVerification] = useState({});
  const [verificationSync, setVerificationSync] = useState({});
  const [verificationReady, setVerificationReady] = useState(true);
  const [exportHistory, setExportHistory] = useState([]);
  const [profileRole, setProfileRole] = useState("");
  const [scannerTestValue, setScannerTestValue] = useState("");
  const [scannerTestRows, setScannerTestRows] = useState([]);
  const inputRef = useRef(null);
  const scannerTestRef = useRef(null);
  const toastTimer = useRef(null);
  const userId = session?.user?.id;
  const exportHistoryKey = `shelfmargin:field-exports:${demoMode ? "demo" : userId || "anonymous"}`;
  const { playBuy, playPass, playDuplicate, playAction } = useTones(soundOn);

  useEffect(() => {
    const onHashChange = () => setView(sectionFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", hashForSection(DEFAULT_SECTION));
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (demoMode) {
          setEntries(buildDemoEntries(cost));
          setVerification({
            [`demo-${DEMO_ISBNS[0]}`]: {
              actual_source_checked: "amazon+ebay",
              amazon_eligible: "yes",
              amazon_actual_price: "18.50",
              amazon_actual_rank: "3043",
              ebay_sold_comp: "15.90",
              actual_shipping: "4.00",
              actual_fees: "2.77",
              actual_net: "9.73",
              real_decision: "buy",
              notes: "Demo row showing a completed verification.",
            },
          });
          setVerificationReady(true);
          return;
        }
        const profile = await getProfile().catch(() => null);
        if (alive && profile) {
          setProfileRole(profile.role || "");
          if (profile.cost_per_book != null) setCost(Number(profile.cost_per_book));
          if (profile.buy_threshold != null) setThreshold(Number(profile.buy_threshold));
          if (profile.sound_enabled != null) setSoundOn(profile.sound_enabled);
        }
        const rows = await fetchScans();
        if (alive) setEntries(rows.map(rowToEntry));
        try {
          const verificationRows = await fetchScanVerifications();
          if (alive) {
            const next = {};
            verificationRows.forEach((row) => {
              next[row.scan_id] = rowToVerification(row);
            });
            setVerification(next);
            setVerificationReady(true);
          }
        } catch (err) {
          if (alive) {
            setVerificationReady(false);
          }
        }
      } catch (e) {
        if (alive) showToast("couldn't load your scans", "pass");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [demoMode]);

  useEffect(() => { if (view === "scan" && !loading) inputRef.current?.focus(); }, [view, loading]);

  useEffect(() => {
    if (view === "scannerTest") scannerTestRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setExportHistory(readExportHistory(window.localStorage, exportHistoryKey));
  }, [exportHistoryKey]);

  function showToast(msg, tone) {
    setToast({ msg, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function persistProfile(patch) {
    if (demoMode) return;
    updateProfile(patch).catch(() => {});
  }

  function navigate(sectionId) {
    const nextHash = hashForSection(sectionId);
    if (window.location.hash === nextHash) {
      setView(sectionId);
      return;
    }
    window.location.hash = nextHash;
  }

  function verificationKey(entry) {
    return entry.id || entry.isbn;
  }

  function updateVerification(entry, patch) {
    const key = verificationKey(entry);
    setVerification((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...patch,
      },
    }));
    setVerificationSync((prev) => ({ ...prev, [key]: "unsaved" }));
  }

  async function addEntry(e) {
    e.preventDefault();
    const raw = isbn.trim();
    if (!raw || scanning) return;
    setScanning(true);
    setIsbn("");
    try {
      const core = await lookupBook(raw);
      if (!core) {
        playPass();
        showToast("not found — check the ISBN", "pass");
        return;
      }
      const existing = entries.find((en) => en.isbn === core.isbn);
      if (existing) {
        const newCount = existing.count + 1;
        const updated = { ...existing, count: newCount };
        setEntries([updated, ...entries.filter((en) => en.id !== existing.id)]);
        playDuplicate();
        showToast(`already scanned — ${existing.title} (×${newCount})`, "dup");
        if (!demoMode) updateScan(existing.id, { copy_count: newCount }).catch(() => {});
        return;
      }
      const temp = buildEntry(core.isbn, core, cost, demoMode ? `demo-${core.isbn}` : `tmp-${core.isbn}`);
      const bestNet = Math.max(temp.amazonNet, temp.ebayNet ?? -Infinity);
      const meets = bestNet >= threshold;
      setEntries((prev) => [temp, ...prev]);
      if (temp.restricted) { playPass(); showToast(`check — ${temp.title}`, "check"); }
      else if (meets) { playBuy(); showToast(`buy — ${temp.title}`, "buy"); }
      else { playPass(); showToast(`pass — ${temp.title}`, "pass"); }
      if (demoMode) return;
      try {
        const row = await insertScan(entryToRow(temp, userId, cost, threshold));
        setEntries((prev) => prev.map((en) => (en.id === temp.id ? { ...en, id: row.id } : en)));
      } catch (err) {
        setEntries((prev) => prev.filter((en) => en.id !== temp.id));
        showToast("couldn't save scan", "pass");
      }
    } finally {
      setScanning(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function recordScannerHardwareTest(e) {
    e.preventDefault();
    const raw = scannerTestValue.trim();
    if (!raw) return;
    const now = Date.now();
    const cleaned = cleanScan(raw);
    const normalized = normalizeToIsbn13(raw);
    setScannerTestRows((prev) => {
      const gapMs = prev[0]?.at ? now - prev[0].at : null;
      return [{
        id: `${now}-${raw}`,
        raw,
        cleaned,
        isbn: normalized || "",
        valid: Boolean(normalized),
        gapMs,
        at: now,
      }, ...prev].slice(0, 25);
    });
    setScannerTestValue("");
    showToast(normalized ? "scanner read valid ISBN" : "scan captured - not a valid ISBN", normalized ? "action" : "dup");
    requestAnimationFrame(() => scannerTestRef.current?.focus());
  }

  function addToQueue(id) {
    setEntries((prev) => prev.map((en) =>
      en.id === id ? { ...en, queued: true, listPrice: en.winner === "amazon" ? en.amazonPrice : en.ebayPrice, condition: "Good" } : en
    ));
    playAction();
    showToast("saved to buy list", "action");
    if (demoMode) return;
    updateScan(id, { lifecycle_status: "purchased", condition: conditionToDb("Good") }).catch(() => {});
  }
  function updateQueued(id, patch) {
    setEntries((prev) => prev.map((en) => (en.id === id ? { ...en, ...patch } : en)));
    if (demoMode) return;
    if (patch.condition) updateScan(id, { condition: conditionToDb(patch.condition) }).catch(() => {});
  }
  function toggleSelect(id) { setSelected((s) => ({ ...s, [id]: !s[id] })); }

  const totalProfit = entries.reduce((sum, en) => {
    const bestNet = Math.max(en.amazonNet, en.ebayNet ?? -Infinity);
    return bestNet >= threshold ? sum + bestNet * en.count : sum;
  }, 0);
  const buyCount = entries.filter((en) => Math.max(en.amazonNet, en.ebayNet ?? -Infinity) >= threshold).length;
  const checkCount = entries.filter((en) => en.restricted).length;
  const duplicateUnits = entries.reduce((sum, en) => sum + Math.max(0, (en.count ?? 1) - 1), 0);
  const queued = entries.filter((en) => en.queued);
  const selectedQueued = queued.filter((en) => selected[en.id]);
  const allSelected = queued.length > 0 && queued.every((en) => selected[en.id]);
  const totalUnits = entries.reduce((s, en) => s + en.count, 0);
  const averageProfit = buyCount > 0 ? totalProfit / buyCount : 0;
  const scanSessions = scanSessionSummary(entries);

  function selectAll() {
    const next = {};
    queued.forEach((en) => (next[en.id] = !allSelected));
    setSelected(next);
  }
  function pushOffers() {
    if (selectedQueued.length === 0) return;
    playAction();
    showToast(`marked ${selectedQueued.length} book${selectedQueued.length > 1 ? "s" : ""} checked`, "action");
  }
  function removeFromQueue() {
    if (selectedQueued.length === 0) return;
    const ids = selectedQueued.map((en) => en.id);
    setEntries((prev) => prev.map((en) => (selected[en.id] ? { ...en, queued: false } : en)));
    setSelected({});
    showToast("removed from queue", "dup");
    if (demoMode) return;
    ids.forEach((id) => updateScan(id, { lifecycle_status: "scouted" }).catch(() => {}));
  }
  function clearScans() {
    setEntries([]);
    setSelected({});
    setVerification({});
    if (demoMode) return;
    deleteAllScans().catch(() => showToast("couldn't clear on server", "pass"));
  }

  function exportFieldTest() {
    if (entries.length === 0) return;
    const exportedAt = new Date().toISOString();
    const stamp = exportedAt.slice(0, 10);
    downloadTextFile(`shelfmargin-check-books-${stamp}.csv`, fieldTestCsv(entries, { cost, threshold, verification }));
    if (typeof window !== "undefined") {
      const item = createExportHistoryItem({ entries, verification, exportedAt });
      setExportHistory((history) => writeExportHistory(window.localStorage, exportHistoryKey, history, item));
    }
    playAction();
    showToast(`exported ${entries.length} scan${entries.length === 1 ? "" : "s"}`, "action");
  }

  function exportBuyList() {
    if (queued.length === 0) return;
    const rows = selectedQueued.length > 0 ? selectedQueued : queued;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`shelfmargin-buy-list-${stamp}.csv`, fieldTestCsv(rows, { cost, threshold, verification }));
    playAction();
    showToast(`exported ${rows.length} buy-list book${rows.length === 1 ? "" : "s"}`, "action");
  }

  async function saveVerification(entry) {
    const key = verificationKey(entry);
    if (!entry.id || String(entry.id).startsWith("tmp-")) {
      showToast("wait for scan to save first", "pass");
      return;
    }
    if (demoMode) {
      setVerificationSync((prev) => ({ ...prev, [key]: "saved" }));
      showToast("demo check saved", "action");
      return;
    }
    setVerificationSync((prev) => ({ ...prev, [key]: "saving" }));
    try {
      const saved = await upsertScanVerification(entry.id, verification[key] || {});
      setVerification((prev) => ({ ...prev, [entry.id]: rowToVerification(saved) }));
      setVerificationSync((prev) => ({ ...prev, [key]: "saved" }));
      setVerificationReady(true);
      showToast("book check saved", "action");
    } catch (err) {
      setVerificationSync((prev) => ({ ...prev, [key]: "error" }));
      setVerificationReady(false);
      showToast("couldn't save check", "pass");
    }
  }

  const toastColor = toast?.tone === "buy" ? GREEN : toast?.tone === "pass" ? RED : toast?.tone === "action" ? BLUE : "#B8860B";
  const toastBg = toast?.tone === "buy" ? GREEN_BG : toast?.tone === "pass" ? RED_BG : toast?.tone === "action" ? BLUE_BG : AMBER_BG;
  const verifiedCount = entries.filter((entry) => verification[verificationKey(entry)]?.real_decision).length;
  const summary = fieldTestSummary(entries, verification);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: BG, color: INK }}>
      <StripeBar />
      <div className="max-w-3xl mx-auto px-3 py-4">
        <div className="flex items-center justify-between mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate normal-case font-mono">{session?.user?.email}</span>
            {profileRole === "admin" && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                style={{ color: "#FFF", backgroundColor: BLUE }}>
                admin
              </span>
            )}
          </span>
          <AccountMenu
            session={session}
            profileRole={profileRole}
            demoMode={demoMode}
            onNavigate={navigate}
            onSignOut={onSignOut}
          />
        </div>

        <SyncStatus demoMode={demoMode} verificationReady={verificationReady} loading={loading} />

        <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF", boxShadow: "0 1px 2px rgba(16, 32, 51, 0.04)" }}>
          <div className="px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>scanned</div>
            <div className="text-2xl font-black font-mono">{totalUnits}</div>
          </div>
          <div className="px-4 py-3 border-l" style={{ borderColor: LINE, backgroundColor: BLUE_BG }}>
            <div className="text-xs font-bold uppercase tracking-widest">est. profit</div>
            <div className="text-2xl font-black font-mono" style={{ color: BLUE }}>${totalProfit.toFixed(2)}</div>
          </div>
          <div className="px-4 py-3 border-l text-right flex flex-col justify-between items-end" style={{ borderColor: LINE }}>
            <button onClick={() => { const v = !soundOn; setSoundOn(v); persistProfile({ sound_enabled: v }); }} aria-label="toggle sound">
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} color={MUTED} />}
            </button>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>possible buys</div>
              <div className="text-2xl font-black font-mono">{buyCount}</div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-3 px-3 pt-2 pb-3 mb-3" style={{ backgroundColor: BG, borderBottom: `1px solid ${LINE}` }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <ShellButton active={view === "dashboard"} icon={LayoutDashboard} label="Dashboard" detail={`${totalUnits} books`} href={hashForSection("dashboard")} onClick={() => navigate("dashboard")} />
            <ShellButton active={view === "scan"} icon={Scan} label="Scan" detail="barcode" href={hashForSection("scan")} onClick={() => navigate("scan")} />
            <ShellButton active={view === "scannerTest"} icon={Scan} label="Scanner Test" detail={`${scannerTestRows.length} reads`} href={hashForSection("scannerTest")} onClick={() => navigate("scannerTest")} />
            <ShellButton active={view === "queue"} icon={PackagePlus} label="Buy List" detail={`${queued.length} saved`} href={hashForSection("queue")} onClick={() => navigate("queue")} />
            <ShellButton active={view === "field"} icon={ClipboardList} label="Check Books" detail="real prices" href={hashForSection("field")} onClick={() => navigate("field")} />
            <ShellButton active={view === "inventory"} icon={Boxes} label="Saved" detail="all books" href={hashForSection("inventory")} onClick={() => navigate("inventory")} />
            <ShellButton active={view === "settings"} icon={Settings} label="Settings" detail={`$${threshold} min`} href={hashForSection("settings")} onClick={() => navigate("settings")} />
            {profileRole === "admin" && (
              <ShellButton active={view === "admin"} icon={ShieldCheck} label="Admin" detail="setup" href={hashForSection("admin")} onClick={() => navigate("admin")} />
            )}
          </div>
        </div>

        <div className="h-9 mb-1">
          {toast && (
            <div className="px-3 py-1.5 text-xs font-black uppercase tracking-widest flex items-center gap-2"
              style={{ backgroundColor: toastBg, color: toastColor, border: `2px solid ${toastColor}` }}>
              {toast.tone === "dup" && <Repeat size={12} />}
              {toast.tone === "action" && <Send size={12} />}
              {toast.msg}
            </div>
          )}
        </div>

        {view === "dashboard" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Dashboard"
              subtitle="Your current scan session."
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricBox label="Books Scanned" value={totalUnits} />
              <MetricBox label="Possible Buys" value={buyCount} tone="buy" />
              <MetricBox label="Needs Check" value={checkCount} tone="warn" />
              <MetricBox label="Duplicates" value={duplicateUnits} tone="action" />
            </div>

            {scanSessions.length > 0 && (
              <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest">scan sessions</div>
                    <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>
                      Recent sourcing days from your saved scans.
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("inventory")}
                    className="shrink-0 px-3 py-1.5 text-xs font-black uppercase tracking-widest"
                    style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}
                  >
                    saved
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {scanSessions.slice(0, 2).map((sessionGroup) => (
                    <div key={sessionGroup.key} className="px-2 py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: BLUE_BG }}>
                      <div className="text-xs font-black uppercase tracking-widest">{sessionGroup.label}</div>
                      <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>
                        {sessionGroup.units} books · {sessionGroup.buyList} saved · ${sessionGroup.estimatedProfit.toFixed(2)} est.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <OnboardingChecklist
              totalUnits={totalUnits}
              queuedCount={queued.length}
              verifiedCount={verifiedCount}
              demoMode={demoMode}
              onScan={() => navigate("scan")}
              onFieldTest={() => navigate("field")}
            />

            <div className="px-3 py-3" style={{ borderTop: `2px solid ${LINE}` }}>
              <div className="text-xs font-black uppercase tracking-widest mb-2">quick reminder</div>
              <div className="grid sm:grid-cols-3 gap-2 text-xs font-bold">
                <div className="px-2 py-2" style={{ backgroundColor: AMBER_BG }}>
                  Profit numbers are estimates.
                </div>
                <div className="px-2 py-2" style={{ backgroundColor: BLUE_BG }}>
                  Check real prices before buying.
                </div>
                <div className="px-2 py-2" style={{ backgroundColor: GREEN_BG }}>
                  {supabaseReady ? "Your scans can save to your account." : "Scans will not save until Supabase is configured."}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <button onClick={() => navigate("scan")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                start scanning
              </button>
              <button onClick={() => navigate("field")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}>
                check books
              </button>
            </div>

            {!loading && totalUnits === 0 && !demoMode && (
              <FirstSessionPanel
                cost={cost}
                threshold={threshold}
                onCostChange={(v) => { setCost(v); persistProfile({ cost_per_book: v }); }}
                onThresholdChange={(v) => { setThreshold(v); persistProfile({ buy_threshold: v }); }}
                onScan={() => navigate("scan")}
                onDemo={publicPath("demo")}
              />
            )}
          </div>
        )}

        {view === "scannerTest" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Scanner Test"
              subtitle="Test the barcode scanner before saving real book scans."
            />

            <div className="px-3 py-2 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: BLUE_BG, color: BLUE, border: `2px solid ${BLUE}` }}>
              test reads do not save to your scan history
            </div>

            <form onSubmit={recordScannerHardwareTest}>
              <div className="flex items-center gap-2 px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
                <Scan size={22} color={INK} />
                <input
                  ref={scannerTestRef}
                  autoFocus
                  value={scannerTestValue}
                  onChange={(e) => setScannerTestValue(e.target.value)}
                  placeholder="SCAN TEST BARCODE..."
                  className="flex-1 bg-transparent outline-none text-lg font-mono font-bold tracking-wide"
                  style={{ color: INK }}
                />
              </div>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricBox label="Test Reads" value={scannerTestRows.length} />
              <MetricBox label="Valid ISBNs" value={scannerTestRows.filter((row) => row.valid).length} tone="buy" />
              <MetricBox label="Bad Reads" value={scannerTestRows.filter((row) => !row.valid).length} tone="warn" />
              <MetricBox
                label="Last Gap"
                value={scannerTestRows[0]?.gapMs == null ? "--" : `${(scannerTestRows[0].gapMs / 1000).toFixed(1)}s`}
                tone="action"
              />
            </div>

            <div className="px-3 py-3 text-sm font-bold" style={{ border: `2px solid ${LINE}` }}>
              Scan the same book a few times. Good scanner setup should send one complete ISBN and press Enter automatically. If you see partial numbers, duplicate reads, or invalid ISBNs, adjust scanner settings before testing real books.
            </div>

            {scannerTestRows.length === 0 ? (
              <EmptyState
                icon={Scan}
                title="No test reads yet"
                body="Scan any book barcode here. Nothing on this page creates a saved scan."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {scannerTestRows.map((row) => (
                  <div key={row.id} className="px-3 py-2" style={{ border: `2px solid ${LINE}`, backgroundColor: row.valid ? GREEN_BG : AMBER_BG }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black uppercase tracking-widest" style={{ color: row.valid ? GREEN : "#8A6100" }}>
                          {row.valid ? "valid isbn" : "check scanner"}
                        </div>
                        <div className="mt-1 text-xs font-mono break-all" style={{ color: MUTED }}>
                          raw: {row.raw}
                        </div>
                        <div className="text-xs font-mono break-all" style={{ color: MUTED }}>
                          cleaned: {row.cleaned || "--"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black font-mono">{row.isbn || "--"}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                          {row.gapMs == null ? "first read" : `${(row.gapMs / 1000).toFixed(1)}s gap`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scannerTestRows.length > 0 && (
              <button
                onClick={() => setScannerTestRows([])}
                className="flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest"
                style={{ border: `2px solid ${LINE}`, color: RED }}
              >
                <Trash2 size={14} /> clear test reads
              </button>
            )}
          </div>
        )}

        {view === "scan" && (
          <>
            <PageHeader
              title="Scan"
              subtitle="Scan book barcodes or type ISBNs."
            />

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: "#FFFFFF", color: "#8A6100", border: `1px solid ${LINE}` }}>
              <span className="rounded-full px-2 py-1" style={{ backgroundColor: AMBER_BG, border: "1px solid #E2B203" }}>
                {LOOKUP_STATUS.mode === "live-catalog" ? "catalog lookup" : "sample catalog"}
              </span>
              <span style={{ color: MUTED }}>prices still estimates</span>
            </div>

            <form onSubmit={addEntry} className="mb-3">
              <div className="scanner-pulse relative overflow-hidden flex items-center gap-3 rounded-lg px-4 py-5" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF", boxShadow: "0 10px 30px rgba(8, 102, 216, 0.08)" }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: BLUE_BG, color: BLUE }}>
                  <Scan size={22} />
                </div>
                <input ref={inputRef} autoFocus value={isbn} onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Scan ISBN or type barcode" className="flex-1 bg-transparent outline-none text-lg font-mono font-bold tracking-wide"
                  style={{ color: INK }} />
              </div>
            </form>

            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold">
              <span style={{ color: MUTED }}>
                {demoMode ? "Demo scans do not save." : `${LOOKUP_STATUS.label}. ${supabaseReady ? "Scans save to your account." : "Scans will not save yet."}`}
              </span>
              <a href={publicPath("demo")} className="font-black uppercase tracking-widest" style={{ color: BLUE }}>
                Demo
              </a>
            </div>

            <div className="mb-4 grid gap-2 text-xs font-bold uppercase tracking-widest sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>cost/bk</span><span>$</span>
                <input type="number" step="0.25" value={cost}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setCost(v); persistProfile({ cost_per_book: v }); }}
                  className="w-16 bg-transparent border-b outline-none font-mono normal-case" style={{ borderColor: LINE, color: INK }} />
              </div>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>buy min</span><span>$</span>
                <input type="number" step="0.5" value={threshold}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setThreshold(v); persistProfile({ buy_threshold: v }); }}
                  className="w-16 bg-transparent border-b outline-none font-mono normal-case" style={{ borderColor: GREEN, color: GREEN }} />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-sm font-black uppercase tracking-widest" style={{ color: MUTED }}>
                loading your scans…
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={Scan}
                imageSrc={EMPTY_SCAN_IMAGE}
                imageAlt="Barcode scanner and used book ready for the first ShelfMargin scan."
                title="No scans yet"
                body="Scan a book barcode or type an ISBN above. The field stays focused for Bluetooth scanners."
              />
            ) : (
            <div className="flex flex-col gap-2">
              {entries.map((en) => {
                const open = openId === en.id;
                const bestNet = Math.max(en.amazonNet, en.ebayNet ?? -Infinity);
                const meets = bestNet >= threshold;
                const score = sourcingScore(bestNet, threshold, en.velocity, en.offers);
                const scoreColor = score.band === "Strong" ? GREEN : score.band === "Moderate" ? "#B8860B" : RED;
                const statusColor = en.restricted ? "#B8860B" : meets ? GREEN : RED;
                const statusBg = en.restricted ? AMBER_BG : meets ? GREEN_BG : RED_BG;
                const statusLabel = en.restricted ? "check" : meets ? "buy" : "pass";
                const sparkColor = en.velocity.trend === "up" ? GREEN : en.velocity.trend === "down" ? RED : MUTED;
                return (
                  <div key={en.id} className="scan-result-row overflow-hidden rounded-lg" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(16, 32, 51, 0.04)" }}>
                    <div className="w-full flex items-stretch gap-2 px-2 py-2 sm:px-3">
                      <button onClick={() => setOpenId(open ? null : en.id)} className="grid flex-1 grid-cols-[82px_1fr_auto] items-center gap-3 text-left min-w-0 sm:grid-cols-[96px_1fr_auto]">
                        <span className="decision-badge flex min-h-14 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-sm font-black uppercase tracking-widest text-white sm:min-h-16 sm:text-base" style={{ backgroundColor: statusColor }}>
                          {en.restricted && <Lock size={11} />}
                          {statusLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-black truncate">
                            {en.title}
                            {en.count > 1 && <span className="ml-1 font-mono" style={{ color: MUTED }}>×{en.count}</span>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="hidden sm:inline-flex"><Sparkline history={en.history} color={sparkColor} /></span>
                            <VelocityBadge velocity={en.velocity} />
                            <span className="text-xs font-mono" style={{ color: MUTED }}>
                              #{en.velocity.current.toLocaleString()}
                            </span>
                            <span
                              className="flex items-center gap-0.5 text-xs font-bold"
                              style={{ color: en.offers <= 5 ? GREEN : en.offers <= 15 ? "#B8860B" : RED }}
                            >
                              <Users size={11} /> {en.offers}
                            </span>
                            <span className="text-xs font-black px-1" style={{ color: "#FFF", backgroundColor: scoreColor }}>
                              {score.total}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-lg px-2 py-1 text-lg font-black font-mono shrink-0 text-right sm:text-xl" style={{ color: statusColor, backgroundColor: statusBg }}>
                          {bestNet >= 0 ? "+" : ""}${(bestNet * en.count).toFixed(2)}
                        </span>
                      </button>
                      {meets && !en.queued && (
                        <button onClick={() => addToQueue(en.id)} title="save to buy list" className="shrink-0 p-1" style={{ color: BLUE }}>
                          <PackagePlus size={18} />
                        </button>
                      )}
                      {en.queued && <span className="text-xs font-black uppercase shrink-0" style={{ color: BLUE }}>saved</span>}
                      <button onClick={() => setOpenId(open ? null : en.id)}>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    {open && (
                      <div className="px-4 pb-3 text-xs font-mono" style={{ borderTop: `1px dashed ${LINE}` }}>
                        <div className="pt-3 mb-3 text-sm font-bold normal-case" style={{ color: MUTED }}>
                          {reasonForEntry(en, bestNet, threshold)}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1 mb-3">
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1 flex items-center gap-2" style={{ color: MUTED }}>amazon</div>
                            <div>list ${en.amazonPrice.toFixed(2)}</div>
                            <div>profit ${en.amazonNet.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1 flex items-center gap-2" style={{ color: MUTED }}>ebay</div>
                            <div>list {en.ebayPrice != null ? `$${en.ebayPrice.toFixed(2)}` : "—"}</div>
                            <div>profit {en.ebayNet != null ? `$${en.ebayNet.toFixed(2)}` : "—"}</div>
                          </div>
                        </div>
                        {en.restricted && (
                          <div
                            className="flex items-center gap-2 px-2 py-2 mb-3 text-xs font-bold"
                            style={{ backgroundColor: AMBER_BG, border: `2px solid #B8860B`, color: "#8A6100" }}
                          >
                            <Lock size={14} />
                            gated category — Amazon approval required before you can list this title
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-3 px-2 py-2" style={{ border: `1px solid ${LINE}` }}>
                          <span className="text-lg font-black px-2 py-1" style={{ color: "#FFF", backgroundColor: scoreColor }}>
                            {score.total}
                          </span>
                          <div>
                            <div className="font-bold uppercase tracking-widest" style={{ color: scoreColor }}>{score.band} book score</div>
                            <div style={{ color: MUTED }}>profit, speed, and competition</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1" style={{ color: MUTED }}>sales rank</div>
                            <div>#{en.category.rank} in {en.category.name}</div>
                          </div>
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1" style={{ color: MUTED }}>other sellers</div>
                            <div style={{ color: en.offers <= 5 ? GREEN : en.offers <= 15 ? "#B8860B" : RED }}>
                              {en.offers} seller{en.offers === 1 ? "" : "s"} listed
                            </div>
                          </div>
                        </div>

                        <div className="mt-2" style={{ color: MUTED }}>{en.isbn} · {en.author} · copies: {en.count}</div>
                        {en.priceSource === "estimated" && (
                          <div className="mt-1" style={{ color: MUTED }}>
                            catalog: {en.catalogSource || en.source || LOOKUP_STATUS.mode} · resale prices estimated
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {entries.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-5">
                <button onClick={exportFieldTest} className="flex items-center gap-1 text-xs uppercase tracking-widest font-black" style={{ color: BLUE }}>
                  <FileDown size={13} /> export list
                </button>
                <button onClick={clearScans} className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold" style={{ color: MUTED }}>
                  <Trash2 size={12} /> clear scans
                </button>
              </div>
            )}
          </>
        )}

        {view === "field" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Check Books"
              subtitle="Double-check books before spending money."
              action={<EstimateBadge />}
            />

            <div className="px-3 py-2 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: AMBER_BG, color: "#8A6100", border: `2px solid #B8860B` }}>
              estimates only - use this page to double-check books
            </div>
            {!verificationReady && (
              <div className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: RED_BG, color: RED, border: `2px solid ${RED}` }}>
                Book checks are not ready in this database yet. You can still export your list.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricBox label="Books" value={entries.length} />
              <MetricBox label="Checked" value={verifiedCount} tone="action" />
              <MetricBox label="Possible Buys" value={buyCount} tone="buy" />
              <MetricBox label="Checks" value={checkCount} tone="warn" />
            </div>
            <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: summary.verifiedRows ? GREEN_BG : "transparent" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest">check summary</div>
                  <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>
                    {summary.verifiedRows}/{summary.totalRows} books checked · {Math.round(summary.verificationRate * 100)}% done
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>real profit</div>
                  <div className="text-xl font-black font-mono" style={{ color: summary.actualNet >= 0 ? GREEN : RED }}>
                    ${summary.actualNet.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-widest">
                <div className="py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: GREEN_BG }}>buy {summary.buyRows}</div>
                <div className="py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: RED_BG }}>pass {summary.passRows}</div>
                <div className="py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: AMBER_BG }}>watch {summary.watchRows}</div>
              </div>
            </div>
            <div className="px-3 py-3 text-sm font-bold" style={{ border: `2px solid ${LINE}` }}>
              Use this page to double-check books that looked good while scanning. Add the real price, shipping, fees, and your final decision.
            </div>

            {entries.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No books to check"
                body="Scan books first, then come back here to double-check them."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                    open scout
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map((en) => {
                  const key = verificationKey(en);
                  const actual = verification[key] || {};
                  const sync = verificationSync[key];
                  const bestNet = Math.max(en.amazonNet, en.ebayNet ?? -Infinity);
                  const statusLabel = en.restricted ? "check" : bestNet >= threshold ? "buy" : "pass";
                  return (
                    <div key={key} className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: actual.real_decision ? GREEN_BG : "transparent" }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black truncate">{en.title}</div>
                          <div className="text-xs font-mono" style={{ color: MUTED }}>{en.isbn} · app says {statusLabel} · est. profit ${bestNet.toFixed(2)}</div>
                        </div>
                        {actual.real_decision ? (
                          <span className="text-xs font-black uppercase px-2 py-1 shrink-0" style={{ color: "#FFF", backgroundColor: actual.real_decision === "buy" ? GREEN : RED }}>
                            {actual.real_decision}
                          </span>
                        ) : <EstimateBadge />}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <VerifySelect
                          label="Checked where"
                          value={actual.actual_source_checked}
                          onChange={(value) => updateVerification(en, { actual_source_checked: value })}
                          options={[
                            { value: "", label: "not checked" },
                            { value: "amazon", label: "Amazon" },
                            { value: "ebay", label: "eBay" },
                            { value: "amazon+ebay", label: "Amazon + eBay" },
                          ]}
                        />
                        <VerifySelect
                          label="Can sell on Amazon"
                          value={actual.amazon_eligible}
                          onChange={(value) => updateVerification(en, { amazon_eligible: value })}
                          options={[
                            { value: "", label: "unknown" },
                            { value: "yes", label: "yes" },
                            { value: "no", label: "no" },
                            { value: "restricted", label: "restricted" },
                          ]}
                        />
                        <VerifyInput label="Amazon price" value={actual.amazon_actual_price} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { amazon_actual_price: value })} />
                        <VerifyInput label="Amazon rank" value={actual.amazon_actual_rank} type="number" placeholder="rank" onChange={(value) => updateVerification(en, { amazon_actual_rank: value })} />
                        <VerifyInput label="eBay sold price" value={actual.ebay_sold_comp} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { ebay_sold_comp: value })} />
                        <VerifyInput label="Shipping" value={actual.actual_shipping} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_shipping: value })} />
                        <VerifyInput label="Fees" value={actual.actual_fees} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_fees: value })} />
                        <VerifyInput label="Real profit" value={actual.actual_net} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_net: value })} />
                      </div>

                      <div className="grid sm:grid-cols-[160px_1fr] gap-2 mt-2">
                        <VerifySelect
                          label="Final decision"
                          value={actual.real_decision}
                          onChange={(value) => updateVerification(en, { real_decision: value })}
                          options={[
                            { value: "", label: "undecided" },
                            { value: "buy", label: "buy" },
                            { value: "pass", label: "pass" },
                            { value: "watch", label: "watch" },
                          ]}
                        />
                        <VerifyInput label="Notes" value={actual.notes} placeholder="condition, damage, bad comps..." onChange={(value) => updateVerification(en, { notes: value })} />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold" style={{ color: sync === "error" ? RED : sync === "saved" ? GREEN : MUTED }}>
                          {sync === "saving" ? "saving..." : sync === "saved" ? "saved" : sync === "error" ? "save failed" : sync === "unsaved" ? "unsaved changes" : "not checked"}
                        </span>
                        <button
                          onClick={() => saveVerification(en)}
                          disabled={sync === "saving"}
                          className="px-3 py-1.5 text-xs font-black uppercase tracking-widest"
                          style={{ backgroundColor: sync === "saving" ? "#CFCFC5" : BLUE, color: "#FFF", border: `2px solid ${LINE}` }}
                        >
                          save check
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={exportFieldTest} disabled={entries.length === 0}
              className="flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: entries.length ? BLUE : "#CFCFC5", color: "#FFF", border: `2px solid ${LINE}` }}>
              <FileDown size={16} /> export list
            </button>
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-widest">recent exports</div>
              <ExportHistoryList history={exportHistory} />
            </div>
          </div>
        )}

        {view === "inventory" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Saved Books"
              subtitle="Saved scan history grouped by date."
            />

            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Scanned" value={entries.length} />
              <MetricBox label="Buy List" value={queued.length} tone="action" />
              <MetricBox label="Sessions" value={scanSessions.length} />
            </div>
            {entries.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="No saved books yet"
                body="Scan books first. Anything you scan will show here."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                    open scan
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {scanSessions.map((sessionGroup) => (
                  <div key={sessionGroup.key} className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black uppercase tracking-widest">{sessionGroup.label}</div>
                        <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>
                          {sessionGroup.units} books · {sessionGroup.buyList} saved to buy list
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>est. profit</div>
                        <div className="text-lg font-black font-mono" style={{ color: sessionGroup.estimatedProfit >= 0 ? GREEN : RED }}>
                          ${sessionGroup.estimatedProfit.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {sessionGroup.entries.map((en) => (
                        <div key={en.id} className="px-3 py-2 flex items-center justify-between gap-3" style={{ border: `1px solid ${LINE}`, backgroundColor: en.queued ? BLUE_BG : "transparent" }}>
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{en.title}</div>
                            <div className="text-xs font-mono" style={{ color: MUTED }}>{en.isbn} · copies {en.count}</div>
                          </div>
                          <div className="text-xs font-black uppercase shrink-0" style={{ color: en.queued ? BLUE : MUTED }}>
                            {en.queued ? "buy list" : "scanned"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "settings" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Settings"
              subtitle="Basic scan settings."
            />

            <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
              <div className="text-xs font-black uppercase tracking-widest mb-3">scan rules</div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span style={{ color: MUTED }}>cost/bk</span><span>$</span>
                  <input type="number" step="0.25" value={cost}
                    onChange={(e) => { const v = parseFloat(e.target.value) || 0; setCost(v); persistProfile({ cost_per_book: v }); }}
                    className="w-16 bg-transparent border-b-2 outline-none font-mono normal-case" style={{ borderColor: LINE, color: INK }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: MUTED }}>buy min</span><span>$</span>
                  <input type="number" step="0.5" value={threshold}
                    onChange={(e) => { const v = parseFloat(e.target.value) || 0; setThreshold(v); persistProfile({ buy_threshold: v }); }}
                    className="w-16 bg-transparent border-b-2 outline-none font-mono normal-case" style={{ borderColor: GREEN, color: GREEN }} />
                </div>
                <button onClick={() => { const v = !soundOn; setSoundOn(v); persistProfile({ sound_enabled: v }); }} className="flex items-center gap-2">
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} color={MUTED} />} sound {soundOn ? "on" : "off"}
                </button>
              </div>
            </div>
            <div className="px-3 py-3 text-xs font-bold" style={{ backgroundColor: AMBER_BG, color: "#8A6100", border: `2px solid #B8860B` }}>
              Prices are still estimates. Always check real marketplaces before buying. Saving: {supabaseReady ? "on" : "off"}.
            </div>
          </div>
        )}

        {view === "admin" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="Admin"
              subtitle="Simple setup checks for this account."
              action={<ShieldCheck size={22} color={profileRole === "admin" ? GREEN : MUTED} />}
            />

            {profileRole !== "admin" ? (
              <EmptyState
                icon={ShieldCheck}
                title="Admin only"
                body="The first recreated account becomes admin. Sign in with that account to see setup checks."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                    back to scan
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricBox label="Account" value="Admin" tone="action" />
                  <MetricBox label="Books" value={totalUnits} />
                  <MetricBox label="Buy List" value={queued.length} tone="buy" />
                  <MetricBox label="Avg Est." value={`$${averageProfit.toFixed(2)}`} />
                </div>

                <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
                  <div className="text-xs font-black uppercase tracking-widest mb-3">setup checks</div>
                  <div className="flex flex-col gap-2">
                    <AdminCheck done={supabaseReady} label="Supabase connected" detail="Accounts and scans can save." />
                    <AdminCheck done={profileRole === "admin"} label="Admin account ready" detail={session?.user?.email || "Signed in account"} />
                    <AdminCheck done={totalUnits > 0} label="First scan tested" detail={totalUnits > 0 ? `${totalUnits} book${totalUnits === 1 ? "" : "s"} scanned` : "Scan a real book next."} />
                    <AdminCheck done={queued.length > 0} label="Buy list tested" detail={queued.length > 0 ? `${queued.length} saved for checking` : "Save one good-looking book."} />
                  </div>
                </div>

                <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: AMBER_BG }}>
                  <div className="text-xs font-black uppercase tracking-widest mb-3">owner inputs needed</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <OwnerInputItem label="Confirm admin login" detail="Sign in and make sure the admin badge shows by your email." />
                    <OwnerInputItem label="Scan real books" detail="Test 20 to 50 books with the scanner you plan to use." />
                    <OwnerInputItem label="Set buy rules" detail="Choose your true cost per book and minimum profit." />
                    <OwnerInputItem label="Check real prices" detail="Compare app estimates against Amazon, eBay, and any buyback source." />
                    <OwnerInputItem label="Pick data source" detail="Decide which live marketplace provider we should wire first." />
                    <OwnerInputItem label="Legal pages" detail="Check privacy, terms, and support email before public launch." />
                  </div>
                </div>

                <div className="px-3 py-3 text-sm font-bold" style={{ border: `2px solid ${LINE}`, backgroundColor: BLUE_BG, color: BLUE }}>
                  User management needs a server-side admin API before it can list or delete other accounts safely. Keep the service role key out of this browser app.
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  <button onClick={() => navigate("scan")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                    scan real books
                  </button>
                  <button onClick={() => navigate("settings")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}>
                    scan settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {view === "queue" && (
          <>
            <PageHeader
              title="Buy List"
              subtitle="Books you may want to buy after checking."
            />

            {queued.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="No books saved yet"
                body="When a book looks good, tap the box icon to save it here."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK, border: `2px solid ${LINE}` }}>
                    scan books
                  </button>
                }
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <button onClick={selectAll} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />} select all ({queued.length})
                  </button>
                  <span className="text-xs font-bold" style={{ color: MUTED }}>{selectedQueued.length} selected</span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  {queued.map((en) => (
                    <div key={en.id} className="px-3 py-2" style={{ backgroundColor: BLUE_BG, border: `2px solid ${LINE}` }}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleSelect(en.id)} className="shrink-0">
                          {selected[en.id] ? <CheckSquare size={18} color={BLUE} /> : <Square size={18} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">
                            {en.title} {en.count > 1 && <span className="font-mono" style={{ color: MUTED }}>×{en.count}</span>}
                          </div>
                          <div className="text-xs font-mono" style={{ color: MUTED }}>{en.isbn} · via {en.winner}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 pl-8 text-xs font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          <span style={{ color: MUTED }}>price</span><span>$</span>
                          <input type="number" step="0.5" value={en.listPrice ?? 0}
                            onChange={(e) => updateQueued(en.id, { listPrice: parseFloat(e.target.value) || 0 })}
                            className="w-14 bg-transparent border-b-2 outline-none font-mono normal-case" style={{ borderColor: LINE }} />
                        </div>
                        <select value={en.condition || "Good"} onChange={(e) => updateQueued(en.id, { condition: e.target.value })}
                          className="bg-transparent border-b-2 outline-none normal-case text-xs font-bold" style={{ borderColor: LINE }}>
                          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sticky bottom-0 flex flex-wrap gap-2 p-2" style={{ backgroundColor: BG, borderTop: `2px solid ${LINE}` }}>
                  <button onClick={pushOffers} disabled={selectedQueued.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest"
                    style={{ backgroundColor: selectedQueued.length ? GREEN : "#CFCFC5", color: "#FFF" }}>
                    <Send size={14} /> mark checked
                  </button>
                  <button onClick={exportBuyList}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest"
                    style={{ backgroundColor: BLUE, color: "#FFF" }}>
                    <FileDown size={14} /> {selectedQueued.length > 0 ? "export selected" : "export CSV"}
                  </button>
                  <button onClick={removeFromQueue} disabled={selectedQueued.length === 0}
                    className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-black uppercase tracking-widest"
                    style={{ border: `2px solid ${LINE}`, color: selectedQueued.length ? RED : MUTED }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Ledger;
