import { useState, useRef, useEffect, useCallback } from "react";
import {
  Scan, ChevronDown, ChevronUp, Trash2, Volume2, VolumeX, Repeat, FileDown,
  PackagePlus, Send, CheckSquare, Square, TrendingUp, TrendingDown, Minus, Users, Lock, LogOut,
  LayoutDashboard, ClipboardList, Boxes, Settings, AlertTriangle, Database, CloudOff, ShieldCheck,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "../lib/useTheme.js";
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
import { scanSessionSummary } from "../../packages/core/sessionSummary.js";
import { DEFAULT_SECTION, hashForSection, sectionFromHash } from "../lib/appRoutes.js";
import { publicPath } from "../lib/siteRoutes.js";
import { supabase, supabaseReady } from "../lib/supabase.js";
import { cleanScan, normalizeToIsbn13 } from "../../packages/core/isbn.js";

// Slate Apricot palette: calm field-tool base, warm CTA, sharp verdict colors.
/* Iron & Orange brand (locked 2026-09) — theme-aware via --sm-* tokens (index.css).
   Resolve to dark by default; the app root carries data-sm-theme so light mode
   flips every one of these at runtime. */
const BG = "var(--sm-app)";          // app ground
const INK = "var(--sm-ink)";         // primary text
const YELLOW = "var(--sm-gold)";     // brand orange (primary/active)
const GREEN = "var(--sm-buy)";       // buy verdict
const GREEN_BG = "var(--sm-buy-tint)";
const RED = "var(--sm-pass)";        // pass verdict
const RED_BG = "var(--sm-pass-tint)";
const AMBER_BG = "var(--sm-check-tint)";
const LINE = "var(--sm-line-strong)";
const MUTED = "var(--sm-muted)";
const BLUE = "var(--sm-gold)";       // remapped: primary action/link -> orange
const BLUE_BG = "var(--sm-gold-tint)";
const SURFACE = "var(--sm-panel)";   // card surface
const SOFT = "var(--sm-panel-2)";    // alt panel
const DARK = "var(--sm-panel)";      // raised card
const APP_BG = "var(--sm-ground)";   // deepest ground
const APP_PANEL = "var(--sm-app)";
const DARK_SURFACE = "var(--sm-panel-2)";
const DARK_MUTED = "var(--sm-muted)";
const GOLD_INK = "var(--sm-gold-ink)"; // text on orange
const CHECK_TXT = "var(--sm-check-txt)"; // amber text
const CHECK_BORDER = "var(--sm-check-border)";
const DEMO_SCAN_PATH = `${publicPath("demo")}${hashForSection("scan")}`;

function dbToDisplayCondition(c) {
  return c === "new" ? "Like New" : c === "used-acceptable" ? "Acceptable" : "Good";
}

function rowToEntry(row) {
  const cost = row.cost_per_book != null ? Number(row.cost_per_book) : 1.5;
  const core = {
    title: row.title,
    author: row.author,
    amazonPrice: row.amazon_price != null ? Number(row.amazon_price) : 0,
  };
  const queued = row.lifecycle_status === "purchased";
  const entry = buildEntry(row.isbn, core, cost, row.id, {
    count: row.copy_count ?? 1,
    queued,
    condition: dbToDisplayCondition(row.condition),
    restricted: row.restricted,
    at: row.created_at,
  });
  if (queued) entry.listPrice = entry.amazonPrice;
  return entry;
}

function entryToRow(entry, userId, cost, threshold) {
  const bestNet = entry.amazonNet ?? -Infinity;
  const status = entry.restricted ? "check" : bestNet >= threshold ? "buy" : "pass";
  return {
    user_id: userId,
    isbn: entry.isbn,
    title: entry.title,
    author: entry.author,
    condition: "used-good",
    cost_per_book: cost,
    amazon_price: entry.amazonPrice,
    ebay_price: null,
    ebay_net: null,
    amazon_bsr: entry.velocity?.current ?? null,
    amazon_net: Number(entry.amazonNet.toFixed(2)),
    recommended_platform: "amazon",
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
    <div className="h-1 w-full" style={{ backgroundColor: DARK, borderBottom: `1px solid ${LINE}` }} />
  );
}

function BrandMark({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-[18px] w-[26px] grid-cols-[3px_5px_2px_6px_4px] items-end gap-0.5" aria-hidden="true">
        <span className="h-[17px] rounded-sm" style={{ backgroundColor: "currentColor" }} />
        <span className="h-[11px] rounded-sm" style={{ backgroundColor: "currentColor" }} />
        <span className="h-[18px] rounded-sm" style={{ backgroundColor: "currentColor" }} />
        <span className="h-[9px] rounded-sm" style={{ backgroundColor: "currentColor" }} />
        <span className="h-[14px] rounded-sm" style={{ backgroundColor: "currentColor" }} />
      </span>
      {!compact && <span className="text-lg font-black tracking-tight normal-case">ShelfMargin</span>}
    </span>
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
  const color = velocity.tier === "Fast" ? GREEN : velocity.tier === "Moderate" ? CHECK_BORDER : RED;
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
      className="min-w-0 rounded-xl px-3 py-2 text-left flex items-center gap-2"
      style={{
        backgroundColor: active ? YELLOW : SURFACE,
        color: INK,
        border: `1px solid ${active ? YELLOW : LINE}`,
        boxShadow: active ? "0 10px 22px rgba(255, 184, 107, 0.22)" : "none",
      }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0">
        <span className="block text-xs font-black truncate">{label}</span>
        {detail && <span className="block text-[10px] font-mono truncate" style={{ color: MUTED }}>{detail}</span>}
      </span>
    </button>
  );
}

function BottomNav({ view, queuedCount, savedCount, onNavigate }) {
  const items = [
    { id: "scan", label: "Scan", detail: "barcode", icon: Scan },
    { id: "queue", label: "Buy List", detail: `${queuedCount}`, icon: PackagePlus },
    { id: "field", label: "Check", detail: "prices", icon: ClipboardList },
    { id: "inventory", label: "Saved", detail: `${savedCount}`, icon: Boxes },
    { id: "settings", label: "Settings", detail: "setup", icon: Settings },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
      style={{ backgroundColor: "color-mix(in srgb, var(--sm-app) 92%, transparent)", borderColor: LINE, backdropFilter: "blur(14px)" }}
      aria-label="Workflow navigation"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1.5">
        {items.map(({ id, label, detail, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="min-h-14 rounded-2xl px-1 py-2 text-center transition"
              style={{
                backgroundColor: active ? YELLOW : SURFACE,
                color: active ? GOLD_INK : INK,
                border: `1px solid ${active ? YELLOW : LINE}`,
                boxShadow: active ? "0 8px 22px rgba(232, 178, 58, 0.28)" : "none",
              }}
            >
              <Icon size={18} className="mx-auto" />
              <span className="mt-1 block text-[11px] font-black leading-none">{label}</span>
              <span className="mt-0.5 block text-[9px] font-mono font-bold" style={{ color: active ? GOLD_INK : MUTED, opacity: active ? 0.7 : 1 }}>
                {detail}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
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
        style={{ color: INK, border: `1px solid ${LINE}`, backgroundColor: SURFACE }}
      >
        Account <ChevronDown size={13} />
      </summary>
      <div
        className="absolute right-0 z-30 mt-2 w-72 rounded-lg p-3 text-xs shadow-xl"
        style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: INK }}
      >
        <div className="truncate font-mono font-bold normal-case" style={{ color: MUTED }}>{session?.user?.email}</div>
        {profileRole === "admin" && (
          <div className="mt-2 inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: GOLD_INK, backgroundColor: YELLOW }}>
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
          <button
            type="button"
            onClick={() => onNavigate("scannerTest")}
            className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest"
            style={{ border: `1px solid ${LINE}` }}
          >
            Scanner test <Scan size={13} />
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
  const toneBg = tone === "buy" ? GREEN_BG : tone === "warn" ? AMBER_BG : tone === "action" ? BLUE_BG : SURFACE;
  const toneColor = tone === "buy" ? GREEN : tone === "warn" ? CHECK_TXT : tone === "action" ? BLUE : INK;
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: toneBg, border: `1px solid ${LINE}`, boxShadow: "0 6px 18px rgba(30, 41, 59, 0.08)" }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
      <div className="text-2xl font-black font-mono" style={{ color: toneColor }}>{value}</div>
    </div>
  );
}

function EstimateBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
      style={{ color: CHECK_TXT, backgroundColor: AMBER_BG, border: `1px solid #B8860B` }}
    >
      <AlertTriangle size={10} /> est
    </span>
  );
}

function AdminCheck({ done, label, detail }) {
  return (
    <div className="flex items-start gap-3 px-2 py-2" style={{ backgroundColor: done ? GREEN_BG : AMBER_BG, border: `1px solid ${LINE}` }}>
      {done ? <CheckSquare size={17} color={GREEN} className="mt-0.5 shrink-0" /> : <Square size={17} color={CHECK_TXT} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-widest">{label}</div>
        <div className="mt-0.5 text-xs font-bold normal-case" style={{ color: MUTED }}>{detail}</div>
      </div>
    </div>
  );
}

function catalogSourceLabel(entry) {
  const source = entry.catalogSource || entry.source || LOOKUP_STATUS.mode;
  if (source === "amazon-sp-api") return "Amazon catalog";
  if (source === "amazon-sp-api-sandbox") return "Amazon sandbox catalog";
  if (source === "openlibrary") return "Open Library catalog";
  if (source === "openlibrary-search") return "Open Library search";
  if (source === "google-books") return "Google Books catalog";
  if (source === "estimated") return "Estimated sample data";
  if (source === "sample") return "Sample data";
  return source;
}

function DataSourceBadge({ entry }) {
  const source = entry.catalogSource || entry.source || LOOKUP_STATUS.mode;
  const amazon = source === "amazon-sp-api" || source === "amazon-sp-api-sandbox";
  const color = amazon ? BLUE : CHECK_TXT;
  const bg = amazon ? BLUE_BG : AMBER_BG;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}` }}
    >
      {catalogSourceLabel(entry)}
    </span>
  );
}

function typedIsbnStatus(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const cleaned = cleanScan(value);
  const normalized = normalizeToIsbn13(value);
  if (normalized) return normalized;
  if (cleaned.length < 10) return "reading...";
  return "check ISBN";
}

function decisionMeta(entry, threshold) {
  const bestNet = entry.amazonNet ?? -Infinity;
  const meets = bestNet >= threshold;
  const label = entry.restricted ? "check" : meets ? "buy" : "pass";
  const color = entry.restricted ? CHECK_TXT : meets ? GREEN : RED;
  const bg = entry.restricted ? AMBER_BG : meets ? GREEN_BG : RED_BG;
  return { bestNet, meets, label, color, bg };
}

function VerdictHero({ entry, threshold, onSave, onDetails }) {
  if (!entry) return null;
  const { bestNet, meets, label } = decisionMeta(entry, threshold);
  const saved = entry.queued;
  // Full-color verdict flood — the whole card takes the decision color.
  const flood = entry.restricted
    ? { bg: "#D98B2B", deep: "#B87A1E", ink: "#231A05", word: "CHECK" }
    : meets
      ? { bg: "#4E8A5A", deep: "#3C6E46", ink: "#F3F8F2", word: "BUY" }
      : { bg: "#D8402E", deep: "#B22F20", ink: "#FBECEA", word: "PASS" };
  const netTotal = bestNet * entry.count;
  return (
    <div
      className="relative mb-4 overflow-hidden rounded-3xl px-5 pb-5 pt-4"
      style={{
        background: `linear-gradient(160deg, ${flood.bg} 0%, ${flood.deep} 100%)`,
        color: flood.ink,
        boxShadow: `0 22px 50px -12px ${flood.deep}80`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ opacity: 0.7 }}>
          latest scan
        </span>
        {entry.restricted && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: "rgba(0,0,0,0.16)" }}>
            <Lock size={11} /> gated
          </span>
        )}
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-6xl font-black leading-none tracking-tight sm:text-7xl">{flood.word}</div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.7 }}>net profit</div>
          <div className="font-mono text-3xl font-black leading-none sm:text-4xl">
            {netTotal >= 0 ? "+" : "−"}${Math.abs(netTotal).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-3 truncate text-base font-black" title={entry.title}>
        {entry.title}
        {entry.count > 1 && <span className="ml-1 font-mono" style={{ opacity: 0.7 }}>×{entry.count}</span>}
      </div>
      <div className="mt-0.5 truncate text-xs font-bold" style={{ opacity: 0.75 }}>
        {entry.author} · list ${entry.amazonPrice.toFixed(2)} · buy line ${threshold}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => !saved && onSave(entry.id)}
          disabled={saved}
          className="min-h-12 rounded-xl text-sm font-black uppercase tracking-widest"
          style={{ backgroundColor: flood.ink, color: flood.bg, opacity: saved ? 0.55 : 1 }}
        >
          {saved ? "saved to buy list" : "save to buy list"}
        </button>
        <button
          type="button"
          onClick={() => onDetails(entry.id)}
          className="min-h-12 rounded-xl text-sm font-black uppercase tracking-widest"
          style={{ backgroundColor: "rgba(0,0,0,0.18)", color: flood.ink }}
        >
          details
        </button>
      </div>
    </div>
  );
}

function StickyDecisionBar({ entry, threshold, onSave, onDetails }) {
  if (!entry) return null;
  const { bestNet, label, color } = decisionMeta(entry, threshold);
  const saved = entry.queued;
  return (
    <div
      className="sticky bottom-20 z-20 -mx-3 mt-4 px-3 py-2 sm:bottom-0"
      style={{ backgroundColor: "rgba(17, 24, 39, 0.96)", borderTop: `1px solid rgba(255,255,255,0.12)`, backdropFilter: "blur(10px)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
        <div className="min-w-0">
          <div className="truncate font-black uppercase tracking-widest" style={{ color }}>last scan: {label}</div>
          <div className="truncate normal-case" style={{ color: DARK_MUTED }}>{entry.title}</div>
        </div>
        <div className="font-mono text-lg font-black" style={{ color }}>
          {bestNet >= 0 ? "+" : ""}${(bestNet * entry.count).toFixed(2)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => !saved && onSave(entry.id)}
          disabled={saved}
          className="min-h-12 rounded-lg text-sm font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: saved ? "#94A3B8" : GREEN }}
        >
          {saved ? "saved" : "buy"}
        </button>
        <button
          type="button"
          onClick={() => onDetails(entry.id)}
          className="min-h-12 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ backgroundColor: DARK, color: "#FFF" }}
        >
          check
        </button>
        <button
          type="button"
          onClick={() => onDetails(entry.id)}
          className="min-h-12 rounded-lg text-sm font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: RED }}
        >
          pass
        </button>
      </div>
    </div>
  );
}

function OwnerInputItem({ label, detail }) {
  return (
    <div className="px-2 py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE }}>
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
    <div className="rounded-2xl px-4 py-10 text-center" style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE, boxShadow: "0 10px 28px rgba(30, 41, 59, 0.08)" }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="mx-auto mb-4 aspect-[4/3] w-full max-w-xs rounded-lg object-cover object-bottom"
          style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE }}
          loading="lazy"
        />
      ) : Icon && <Icon size={28} className="mx-auto mb-3" color={MUTED} />}
      <div className="text-sm font-black uppercase tracking-widest">{title}</div>
      {body && <div className="mt-2 text-sm font-bold max-w-md mx-auto" style={{ color: MUTED }}>{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function FirstRunScan({ sampleBooks, scanValue, scanning, onFocusInput }) {
  const steps = [
    { n: "1", icon: Scan, t: "Scan the barcode", d: "Point a Bluetooth scanner or your camera at the barcode — or just type the ISBN. The field stays focused so you can rip through a whole shelf." },
    { n: "2", icon: TrendingUp, t: "Read the verdict", d: "One clear call — BUY, PASS, or CHECK — with your true net profit after every Amazon fee, the $1.80 media fee included." },
    { n: "3", icon: PackagePlus, t: "Save the winners", d: "Send buys to your list as you go, then export the whole trip to CSV when you check out." },
  ];
  return (
    <div className="rounded-2xl p-5" style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE, boxShadow: "0 10px 28px rgba(0, 0, 0, 0.12)" }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: YELLOW, color: GOLD_INK }}>
          <Scan size={22} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-black uppercase tracking-widest">Let’s find your first winner</div>
          <div className="text-xs font-bold" style={{ color: MUTED }}>Three taps from barcode to buy decision.</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className="flex items-start gap-3 rounded-xl px-3 py-3" style={{ backgroundColor: SOFT, border: `1px solid ${LINE}` }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-black" style={{ backgroundColor: BLUE_BG, color: YELLOW }}>{s.n}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><Icon size={13} /> {s.t}</div>
                <div className="mt-0.5 text-xs font-bold normal-case" style={{ color: MUTED }}>{s.d}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-black uppercase tracking-widest" style={{ color: MUTED }}>No book handy? Try a sample</div>
        <div className="flex flex-wrap gap-2">
          {sampleBooks.map((b) => (
            <button
              key={b.isbn}
              type="button"
              onClick={() => scanValue(b.isbn)}
              disabled={scanning}
              className="rounded-full px-3 py-2 text-xs font-black transition disabled:opacity-40"
              style={{ backgroundColor: APP_PANEL, border: `1px solid ${LINE}`, color: INK }}
            >
              {b.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onFocusInput}
          className="mt-3 w-full rounded-xl py-3 text-sm font-black uppercase tracking-widest"
          style={{ backgroundColor: YELLOW, color: GOLD_INK }}
        >
          Scan a book
        </button>
      </div>
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
            style={{ border: `1px solid ${LINE}`, backgroundColor: step.done ? GREEN_BG : SURFACE }}
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
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: CHECK_TXT }}>start here</div>
        <div className="mt-2 text-xl font-black uppercase tracking-widest leading-tight">Set your buying rules</div>
        <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
          Start with your real book cost and the profit you need before a book is worth checking.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs font-black uppercase tracking-widest">
            cost per book
            <span className="mt-1 flex items-center gap-2 px-2 py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE }}>
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
            <span className="mt-1 flex items-center gap-2 px-2 py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE }}>
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
          style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}
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
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-3 py-1.5 text-[11px] font-bold"
        style={{ backgroundColor: BLUE_BG, color: BLUE }}>
        <CloudOff size={13} />
        <span className="font-black">Demo mode</span>
        <span style={{ opacity: 0.7 }}>· sample data, nothing saves ·</span>
        <a href={publicPath("login")} className="font-black" style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
          Create a free account
        </a>
      </div>
    );
  }

  const ready = supabaseReady && verificationReady && !loading;
  const bg = ready ? GREEN_BG : supabaseReady ? AMBER_BG : RED_BG;
  const color = ready ? GREEN : supabaseReady ? CHECK_TXT : RED;
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
        className="mt-1 w-full px-2 py-1.5 text-xs font-mono normal-case outline-none"
        style={{ border: `2px solid ${LINE}`, color: INK, backgroundColor: SURFACE }}
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
        className="mt-1 w-full px-2 py-1.5 text-xs font-bold normal-case outline-none"
        style={{ border: `2px solid ${LINE}`, color: INK, backgroundColor: SURFACE }}
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
    if (entry.queued) entry.listPrice = entry.amazonPrice;
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

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function AccountDataCard({ session, onSignOut, demoMode }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const token = session?.access_token || "";

  async function handleExport() {
    if (!token) { setMsg({ tone: "err", text: "Sign in to export your data." }); return; }
    setBusy("export"); setMsg(null);
    try {
      const res = await fetch("/api/account/export", { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export failed. Try again in a moment.");
      const data = await res.json();
      downloadJson(`shelfmargin-data-${new Date().toISOString().slice(0, 10)}.json`, data);
      setMsg({ tone: "ok", text: "Your data downloaded as JSON." });
    } catch (err) { setMsg({ tone: "err", text: err.message || "Export failed." }); }
    finally { setBusy(""); }
  }

  async function handleDelete() {
    if (!token) { setMsg({ tone: "err", text: "Sign in to delete your account." }); return; }
    setBusy("delete"); setMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Deletion failed. Try again or contact support.");
      setMsg({ tone: "ok", text: "Account deleted. Signing you out..." });
      setTimeout(() => { if (onSignOut) onSignOut(); }, 1200);
    } catch (err) { setMsg({ tone: "err", text: err.message || "Deletion failed." }); setBusy(""); }
  }

  if (demoMode) {
    return (
      <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
        <div className="text-xs font-black uppercase tracking-widest mb-1">account &amp; data</div>
        <div className="text-xs font-bold" style={{ color: MUTED }}>Sign in to export or delete your account data.</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
      <div className="text-xs font-black uppercase tracking-widest mb-3">account &amp; data</div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleExport} disabled={busy === "export"}
            className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}>
            <FileDown size={14} /> {busy === "export" ? "preparing..." : "export my data"}
          </button>
          <span className="text-xs font-bold" style={{ color: MUTED }}>Download every scan, setting, and billing record as JSON.</span>
        </div>
        <div className="pt-3" style={{ borderTop: `2px solid ${LINE}` }}>
          {!confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => { setConfirmDelete(true); setMsg(null); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
                style={{ backgroundColor: RED_BG, color: RED, border: `2px solid ${RED}` }}>
                <Trash2 size={14} /> delete account
              </button>
              <span className="text-xs font-bold" style={{ color: MUTED }}>Permanently removes your account and all data.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-3 py-3" style={{ backgroundColor: RED_BG, border: `2px solid ${RED}` }}>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest" style={{ color: RED }}>
                <AlertTriangle size={14} /> this cannot be undone
              </div>
              <div className="text-xs font-bold" style={{ color: INK }}>
                Deleting removes your profile, every scan and verification, and your billing record. Export first if you want a copy.
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <button onClick={handleDelete} disabled={busy === "delete"}
                  className="px-3 py-2 text-xs font-black uppercase tracking-widest"
                  style={{ backgroundColor: RED, color: "#FFF", border: `2px solid ${RED}` }}>
                  {busy === "delete" ? "deleting..." : "yes, delete everything"}
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={busy === "delete"}
                  className="px-3 py-2 text-xs font-black uppercase tracking-widest"
                  style={{ backgroundColor: SURFACE, color: INK, border: `2px solid ${LINE}` }}>
                  cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {msg && (
          <div className="px-3 py-2 text-xs font-bold" style={{ border: `1px solid ${msg.tone === "err" ? RED : GREEN}`, color: msg.tone === "err" ? RED : GREEN }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}

function MfaCard({ demoMode }) {
  const [state, setState] = useState("loading");
  const [enroll, setEnroll] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = (data?.totp || []).filter((f) => f.status === "verified");
      setState(verified.length ? "verified" : "none");
    } catch { setState("error"); setMsg({ tone: "err", text: "Could not load two-factor status." }); }
  }, []);

  useEffect(() => { if (!demoMode) refresh(); }, [demoMode, refresh]);

  async function startEnroll() {
    setBusy(true); setMsg(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnroll({ factorId: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret });
      setState("enrolling");
    } catch (err) { setMsg({ tone: "err", text: err.message || "Could not start setup. Enable TOTP in Supabase Auth first." }); }
    finally { setBusy(false); }
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code: code.trim() });
      if (error) throw error;
      setEnroll(null); setCode("");
      setMsg({ tone: "ok", text: "Two-factor authentication is on." });
      await refresh();
    } catch (err) { setMsg({ tone: "err", text: err.message || "That code did not verify. Try again." }); }
    finally { setBusy(false); }
  }

  async function cancelEnroll() {
    if (enroll?.factorId) { try { await supabase.auth.mfa.unenroll({ factorId: enroll.factorId }); } catch { /* best effort */ } }
    setEnroll(null); setCode(""); setMsg(null); setState("none");
  }

  async function removeMfa() {
    setBusy(true); setMsg(null);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp || []).filter((f) => f.status === "verified");
      for (const f of verified) await supabase.auth.mfa.unenroll({ factorId: f.id });
      setMsg({ tone: "ok", text: "Two-factor authentication removed." });
      await refresh();
    } catch (err) { setMsg({ tone: "err", text: err.message || "Could not remove two-factor." }); }
    finally { setBusy(false); }
  }

  const notice = msg ? (
    <div className="px-3 py-2 text-xs font-bold" style={{ border: `1px solid ${msg.tone === "err" ? RED : GREEN}`, color: msg.tone === "err" ? RED : GREEN }}>{msg.text}</div>
  ) : null;

  if (demoMode) {
    return (
      <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
        <div className="text-xs font-black uppercase tracking-widest mb-1">two-factor auth</div>
        <div className="text-xs font-bold" style={{ color: MUTED }}>Sign in to add an extra layer of security to your account.</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} color={state === "verified" ? GREEN : MUTED} />
        <div className="text-xs font-black uppercase tracking-widest">two-factor auth</div>
        {state === "verified" && <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5" style={{ backgroundColor: GREEN_BG, color: GREEN }}>on</span>}
      </div>
      <div className="flex flex-col gap-3">
        {state === "loading" && <div className="text-xs font-bold" style={{ color: MUTED }}>Checking status...</div>}
        {state === "none" && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={startEnroll} disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: BLUE, color: "#FFF", border: `2px solid ${LINE}` }}>
              <Lock size={14} /> {busy ? "starting..." : "enable 2fa"}
            </button>
            <span className="text-xs font-bold" style={{ color: MUTED }}>Use an authenticator app (Google Authenticator, Authy, 1Password).</span>
          </div>
        )}
        {state === "error" && (
          <button onClick={refresh} className="px-3 py-2 text-xs font-black uppercase tracking-widest self-start" style={{ backgroundColor: SURFACE, color: INK, border: `2px solid ${LINE}` }}>retry</button>
        )}
        {state === "enrolling" && enroll && (
          <div className="flex flex-col gap-3 px-3 py-3" style={{ backgroundColor: BLUE_BG, border: `2px solid ${BLUE}` }}>
            <div className="text-xs font-bold" style={{ color: INK }}>1. Scan this QR code in your authenticator app.</div>
            {enroll.qr ? <img src={enroll.qr} alt="Two-factor QR code" width={160} height={160} style={{ backgroundColor: "#FFF", padding: 8, border: `2px solid ${LINE}` }} /> : null}
            {enroll.secret ? <div className="text-xs font-bold" style={{ color: MUTED }}>Can&rsquo;t scan? Enter this key: <span className="font-mono normal-case" style={{ color: INK }}>{enroll.secret}</span></div> : null}
            <div className="text-xs font-bold" style={{ color: INK }}>2. Enter the 6-digit code it shows.</div>
            <div className="flex flex-wrap items-center gap-2">
              <input inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="000000"
                className="w-28 px-3 py-2 bg-transparent outline-none font-mono text-base tracking-widest" style={{ border: `1px solid ${LINE}`, color: INK }} />
              <button onClick={confirmEnroll} disabled={busy || code.length !== 6}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest"
                style={{ backgroundColor: busy || code.length !== 6 ? "#E5E7EB" : GREEN, color: "#FFF", border: `2px solid ${LINE}` }}>
                {busy ? "verifying..." : "verify"}
              </button>
              <button onClick={cancelEnroll} disabled={busy}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest"
                style={{ backgroundColor: SURFACE, color: INK, border: `2px solid ${LINE}` }}>cancel</button>
            </div>
          </div>
        )}
        {state === "verified" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold" style={{ color: MUTED }}>Your account is protected by an authenticator app.</span>
            <button onClick={removeMfa} disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: RED_BG, color: RED, border: `2px solid ${RED}` }}>
              <Trash2 size={14} /> {busy ? "removing..." : "remove 2fa"}
            </button>
          </div>
        )}
        {notice}
      </div>
    </div>
  );
}

function Ledger({ session, onSignOut, demoMode = false }) {
  const [view, setView] = useState(() => (
    typeof window === "undefined" ? DEFAULT_SECTION : sectionFromHash(window.location.hash)
  ));
  const [isbn, setIsbn] = useState("");
  const [cost, setCost] = useState(1.0);
  const [threshold, setThreshold] = useState(3.0);
  const [soundOn, setSoundOn] = useState(true);
  const [fulfillment, setFulfillmentState] = useState(() => {
    try { return localStorage.getItem("sm-fulfillment") === "fbm" ? "fbm" : "fba"; } catch { return "fba"; }
  });
  function changeFulfillment(next) {
    const v = next === "fbm" ? "fbm" : "fba";
    setFulfillmentState(v);
    try { localStorage.setItem("sm-fulfillment", v); } catch { /* ignore */ }
  }
  const { theme, toggle: toggleTheme } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openCheckId, setOpenCheckId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState({});
  const [verification, setVerification] = useState({});
  const [verificationSync, setVerificationSync] = useState({});
  const [verificationReady, setVerificationReady] = useState(true);
  const [exportHistory, setExportHistory] = useState([]);
  const [profileRole, setProfileRole] = useState("");
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeStatusError, setStripeStatusError] = useState("");
  const [amazonStatus, setAmazonStatus] = useState(null);
  const [amazonStatusError, setAmazonStatusError] = useState("");
  const [amazonTest, setAmazonTest] = useState({ loading: false, message: "", ok: false });
  const [scannerTestValue, setScannerTestValue] = useState("");
  const [scannerTestRows, setScannerTestRows] = useState([]);
  const inputRef = useRef(null);
  const scannerTestRef = useRef(null);
  const toastTimer = useRef(null);
  // Per-session lookup cache: isbn+fulfillment -> core. Re-scanning the same
  // book (or the same trip revisited) reuses the result instead of spending
  // another set of throttled SP-API calls.
  const lookupCacheRef = useRef(new Map());
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
          const demoSection = sectionFromHash(window.location.hash);
          const shouldSeedDemo = !["scan", "scannerTest", "settings"].includes(demoSection);
          setEntries(shouldSeedDemo ? buildDemoEntries(cost) : []);
          setVerification(shouldSeedDemo ? {
            [`demo-${DEMO_ISBNS[0]}`]: {
              actual_source_checked: "amazon",
              amazon_eligible: "yes",
              amazon_actual_price: "33.90",
              amazon_actual_rank: "48210",
              actual_shipping: "4.49",
              actual_fees: "6.89",
              actual_net: "21.52",
              real_decision: "buy",
              notes: "Verified on Amazon — technical titles hold their used value.",
            },
          } : {});
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

  useEffect(() => {
    let alive = true;
    if (profileRole !== "admin") {
      setStripeStatus(null);
      setStripeStatusError("");
      setAmazonStatus(null);
      setAmazonStatusError("");
      setAmazonTest({ loading: false, message: "", ok: false });
      return () => {
        alive = false;
      };
    }

    fetch("/api/stripe/status")
      .then((response) => {
        if (!response.ok) throw new Error("status unavailable");
        return response.json();
      })
      .then((data) => {
        if (!alive) return;
        setStripeStatus(data);
        setStripeStatusError("");
      })
      .catch(() => {
        if (!alive) return;
        setStripeStatus(null);
        setStripeStatusError("Stripe status unavailable");
      });

    fetch("/api/amazon/status")
      .then((response) => {
        if (!response.ok) throw new Error("status unavailable");
        return response.json();
      })
      .then((data) => {
        if (!alive) return;
        setAmazonStatus(data);
        setAmazonStatusError("");
      })
      .catch(() => {
        if (!alive) return;
        setAmazonStatus(null);
        setAmazonStatusError("Amazon status unavailable");
      });

    return () => {
      alive = false;
    };
  }, [profileRole]);

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
    await scanValue(isbn);
  }

  async function scanValue(rawInput) {
    const raw = String(rawInput || "").trim();
    if (!raw || scanning) return;
    const normalizedIsbn = normalizeToIsbn13(raw);
    if (!normalizedIsbn) {
      playPass();
      setIsbn("");
      showToast("scan a full ISBN barcode", "pass");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setScanning(true);
    setIsbn("");
    try {
      const cacheKey = `${normalizedIsbn}:${fulfillment}`;
      let core = lookupCacheRef.current.get(cacheKey);
      if (!core) {
        core = await lookupBook(normalizedIsbn, { fulfillment });
        if (core) {
          // Bound the cache so a very long session can't grow it without limit.
          if (lookupCacheRef.current.size > 500) lookupCacheRef.current.clear();
          lookupCacheRef.current.set(cacheKey, core);
        }
      }
      if (!core) {
        playPass();
        showToast("not found — check the ISBN", "pass");
        return;
      }
      if (!core.title || core.title === "UNIDENTIFIED TITLE") {
        playPass();
        showToast("title not found — check the ISBN", "pass");
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
      const bestNet = temp.amazonNet;
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
      en.id === id ? { ...en, queued: true, listPrice: en.amazonPrice, condition: "Good" } : en
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
    const bestNet = en.amazonNet ?? -Infinity;
    return bestNet >= threshold ? sum + bestNet * en.count : sum;
  }, 0);
  const buyCount = entries.filter((en) => (en.amazonNet ?? -Infinity) >= threshold).length;
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

  async function testAmazonConnectionFromAdmin() {
    if (!session?.access_token) {
      setAmazonTest({ loading: false, message: "Sign in as admin first.", ok: false });
      return;
    }

    setAmazonTest({ loading: true, message: "", ok: false });
    try {
      const res = await fetch("/api/amazon/test", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.connected) throw new Error(body?.error || "Amazon connection test failed.");
      setAmazonTest({
        loading: false,
        message: `Amazon token test passed in ${body.mode || "sandbox"} mode.`,
        ok: true,
      });
      setAmazonStatus((current) => current ? { ...current, configured: true } : current);
    } catch (err) {
      setAmazonTest({
        loading: false,
        message: err?.message || "Amazon connection test failed.",
        ok: false,
      });
    }
  }

  const toastColor = toast?.tone === "buy" ? GREEN : toast?.tone === "pass" ? RED : toast?.tone === "action" ? BLUE : CHECK_BORDER;
  const toastBg = toast?.tone === "buy" ? GREEN_BG : toast?.tone === "pass" ? RED_BG : toast?.tone === "action" ? BLUE_BG : AMBER_BG;
  const verifiedCount = entries.filter((entry) => verification[verificationKey(entry)]?.real_decision).length;
  const summary = fieldTestSummary(entries, verification);
  const latestEntry = entries[0] || null;
  const sampleBooks = DEMO_ISBNS.slice(0, 5).map((code) => {
    const core = lookupCore(code);
    return { isbn: code, title: core?.title || code };
  });
  const queuedEstimatedTotal = queued.reduce((sum, en) => {
    const bestNet = en.amazonNet ?? -Infinity;
    return sum + bestNet * en.count;
  }, 0);
  const stripeConfigured = Boolean(stripeStatus?.configured);
  const amazonConfigured = Boolean(amazonStatus?.configured);
  const amazonMetricValue = amazonConfigured
    ? amazonStatus?.mode === "production" ? "Live" : "Sandbox"
    : "Waiting";
  const missingAmazonPieces = amazonStatus?.pieces
    ? Object.entries(amazonStatus.pieces).filter(([, present]) => !present).map(([key]) => key)
    : [];
  const amazonPieceLabels = {
    endpoint: "API endpoint",
    marketplaceId: "marketplace ID",
    lwaClientId: "LWA client ID",
    lwaClientSecret: "LWA client secret",
    refreshToken: "refresh token",
  };
  const missingAmazonLabels = missingAmazonPieces.map((key) => amazonPieceLabels[key] || key);
  const amazonReadinessDetail = amazonStatusError || (amazonConfigured
    ? `${amazonStatus.mode || "sandbox"} credentials ready for ${amazonStatus.marketplaceId || "Amazon marketplace"}.`
    : missingAmazonPieces.length
      ? `Use the paid Amazon month to add: ${missingAmazonLabels.join(", ")}.`
      : "Waiting on Amazon SP-API credentials.");
  const adminProofChecks = [
    ["Real scans", totalUnits > 0, totalUnits > 0 ? `${totalUnits} scanned` : "Scan real books next."],
    ["Verified checks", summary.verifiedRows > 0, summary.verifiedRows > 0 ? `${summary.verifiedRows} checked` : "Add real Amazon checks."],
    ["Buy list", queued.length > 0, queued.length > 0 ? `${queued.length} saved` : "Save at least one possible buy."],
    ["CSV export", exportHistory.length > 0, exportHistory.length > 0 ? `${exportHistory.length} recent export${exportHistory.length === 1 ? "" : "s"}` : "Export one field-test CSV."],
  ];
  const adminLaunchChecks = [
    ["Supabase", supabaseReady, supabaseReady ? "Accounts and scans can save." : "Add Supabase URL and anon key."],
    ["Admin account", profileRole === "admin", session?.user?.email || "Signed in account"],
    ["Stripe test billing", stripeConfigured, stripeStatusError || (stripeConfigured ? "Checkout, webhook, and portal config are present." : "Add all Stripe keys and price IDs.")],
    ["Amazon SP-API", amazonConfigured, amazonReadinessDetail],
    ["Evidence quality", summary.verificationRate >= 0.5, summary.totalRows ? `${Math.round(summary.verificationRate * 100)}% verified` : "No scans to verify yet."],
  ];

  return (
    <div className="shelf-theme min-h-screen w-full" data-sm-theme={theme} style={{ backgroundColor: APP_BG, color: INK }}>
      <StripeBar />
      <div className="mx-auto min-h-screen max-w-3xl px-3 pb-28 pt-4" style={{ backgroundColor: APP_PANEL }}>
        <div className="mb-3 rounded-2xl px-3 py-3 shadow-sm" style={{ backgroundColor: SURFACE, color: INK, border: `1px solid ${LINE}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BrandMark />
                {demoMode && (
                  <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: INK, backgroundColor: YELLOW }}>
                    demo
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-xs font-mono font-bold" style={{ color: MUTED }}>
                {session?.user?.email}
              </div>
            </div>
            {profileRole === "admin" && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                style={{ color: GOLD_INK, backgroundColor: YELLOW }}>
                admin
              </span>
            )}
            <AccountMenu
              session={session}
              profileRole={profileRole}
              demoMode={demoMode}
              onNavigate={navigate}
              onSignOut={onSignOut}
            />
          </div>

          <div className="mt-3 flex items-center gap-4 rounded-xl px-3 py-2 text-xs font-bold" style={{ border: `1px solid ${LINE}`, backgroundColor: SOFT }}>
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-black font-mono" style={{ color: INK }}>{totalUnits}</span>
              <span className="uppercase tracking-widest" style={{ color: MUTED }}>scanned</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-black font-mono" style={{ color: GREEN }}>${totalProfit.toFixed(2)}</span>
              <span className="uppercase tracking-widest" style={{ color: MUTED }}>est. profit</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-black font-mono" style={{ color: INK }}>{buyCount}</span>
              <span className="uppercase tracking-widest" style={{ color: MUTED }}>buys</span>
            </span>
            <button
              onClick={toggleTheme}
              aria-label={theme === "light" ? "switch to dark mode" : "switch to light mode"}
              title={theme === "light" ? "Switch to dark" : "Switch to light"}
              className="ml-auto shrink-0"
            >
              {theme === "light" ? <Moon size={15} color={MUTED} /> : <Sun size={15} color={MUTED} />}
            </button>
            <button
              onClick={() => { const v = !soundOn; setSoundOn(v); persistProfile({ sound_enabled: v }); }}
              aria-label="toggle sound"
              className="shrink-0"
            >
              {soundOn ? <Volume2 size={15} color={MUTED} /> : <VolumeX size={15} color={MUTED} />}
            </button>
          </div>
        </div>

        <SyncStatus demoMode={demoMode} verificationReady={verificationReady} loading={loading} />

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
              <button onClick={() => navigate("scan")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
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
                onDemo={DEMO_SCAN_PATH}
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
                        <div className="text-sm font-black uppercase tracking-widest" style={{ color: row.valid ? GREEN : CHECK_TXT }}>
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
            {!demoMode && (
              <>
                <PageHeader
                  title="Field Scanner"
                  subtitle="Scan fast. Decide where the book should go."
                />
                <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
                  style={{ backgroundColor: AMBER_BG, color: CHECK_TXT, border: "1px solid #B8860B" }}>
                  <span>{LOOKUP_STATUS.mode === "live-catalog" ? "catalog lookup" : "sample catalog"}</span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span>estimates until you verify</span>
                </div>
              </>
            )}

            <form onSubmit={addEntry} className="mb-3">
              <div className="scanner-pulse relative overflow-hidden rounded-2xl p-3" style={{ border: `2px solid ${LINE}`, backgroundColor: DARK, boxShadow: "0 18px 44px rgba(0, 0, 0, 0.26)" }}>
                <div className="flex items-center gap-3 rounded-xl px-3 py-5" style={{ border: `1px dashed ${LINE}`, backgroundColor: DARK_SURFACE }}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: YELLOW, color: GOLD_INK }}>
                    <Scan size={23} />
                  </div>
                  <input ref={inputRef} autoFocus value={isbn} onChange={(e) => setIsbn(e.target.value)}
                    disabled={scanning}
                    placeholder={scanning ? "Looking up book..." : "Scan or type ISBN"}
                    className="flex-1 bg-transparent outline-none text-xl font-mono font-black tracking-wide"
                    style={{ color: INK }} />
                  <button
                    type="submit"
                    disabled={scanning || !isbn.trim()}
                    className="shrink-0 rounded-xl px-3 py-3 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: YELLOW, color: GOLD_INK }}
                  >
                    {scanning ? "..." : "look up"}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold">
                  <span style={{ color: DARK_MUTED }}>
                    {scanning ? "Looking up ISBN. Amazon sandbox may fall back to public catalog." : "Type an ISBN and press Enter, or click Look up."}
                  </span>
                  <span className="font-mono" style={{ color: DARK_MUTED }}>
                    {typedIsbnStatus(isbn)}
                  </span>
                </div>
              </div>
            </form>

            {demoMode && (
              <div className="mb-4">
                <div className="mb-2 text-[11px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
                  No book handy? Tap one to try
                </div>
                <div className="flex flex-wrap gap-2">
                  {sampleBooks.map((b) => (
                    <button
                      key={b.isbn}
                      type="button"
                      onClick={() => scanValue(b.isbn)}
                      disabled={scanning}
                      className="rounded-full px-3 py-2 text-xs font-black transition disabled:opacity-40"
                      style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: INK }}
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold">
              <span style={{ color: MUTED }}>
                {demoMode ? "Demo scans do not save." : `${LOOKUP_STATUS.label}. ${supabaseReady ? "Scans save to your account." : "Scans will not save yet."}`}
              </span>
              <a href={DEMO_SCAN_PATH} className="font-black uppercase tracking-widest" style={{ color: BLUE }}>
                Demo
              </a>
            </div>

            <div className="mb-4 grid gap-2 text-xs font-bold uppercase tracking-widest sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>cost/bk</span><span>$</span>
                <input type="number" step="0.25" value={cost}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setCost(v); persistProfile({ cost_per_book: v }); }}
                  className="w-16 bg-transparent border-b outline-none font-mono normal-case" style={{ borderColor: LINE, color: INK }} />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>buy min</span><span>$</span>
                <input type="number" step="0.5" value={threshold}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setThreshold(v); persistProfile({ buy_threshold: v }); }}
                  className="w-16 bg-transparent border-b outline-none font-mono normal-case" style={{ borderColor: GREEN, color: GREEN }} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 sm:col-span-2" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>fulfillment</span>
                <div className="flex overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                  {[["fba", "FBA"], ["fbm", "FBM"]].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => changeFulfillment(val)}
                      className="px-3 py-1 font-black uppercase tracking-widest"
                      style={{
                        backgroundColor: fulfillment === val ? YELLOW : "transparent",
                        color: fulfillment === val ? GOLD_INK : INK,
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-4 -mt-2 text-xs font-bold normal-case" style={{ color: MUTED }}>
              {fulfillment === "fbm"
                ? "FBM: you ship it yourself — no FBA fee counted (your shipping cost isn't included)."
                : "FBA: Amazon ships — the FBA fulfillment fee is counted in profit."}
            </div>

            {!loading && entries.length > 0 && (
              <VerdictHero
                entry={latestEntry}
                threshold={threshold}
                onSave={addToQueue}
                onDetails={(id) => setOpenId((current) => (current === id ? null : id))}
              />
            )}

            {loading ? (
              <div className="text-center py-16 text-sm font-black uppercase tracking-widest" style={{ color: MUTED }}>
                loading your scans…
              </div>
            ) : entries.length === 0 ? (
              demoMode ? (
                <EmptyState
                  icon={Scan}
                  title="No scans yet"
                  body="Tap a sample above, or type an ISBN to see a live verdict. Demo scans don’t save."
                />
              ) : (
                <FirstRunScan
                  sampleBooks={sampleBooks}
                  scanValue={scanValue}
                  scanning={scanning}
                  onFocusInput={() => inputRef.current?.focus()}
                />
              )
            ) : (
            <div className="flex flex-col gap-2">
              {entries.map((en) => {
                const open = openId === en.id;
                const { bestNet, meets, label: statusLabel, color: statusColor, bg: statusBg } = decisionMeta(en, threshold);
                const score = sourcingScore(bestNet, threshold, en.velocity, en.offers);
                const scoreColor = score.band === "Strong" ? GREEN : score.band === "Moderate" ? CHECK_BORDER : RED;
                const sparkColor = en.velocity.trend === "up" ? GREEN : en.velocity.trend === "down" ? RED : DARK_MUTED;
                const routeLabel = en.restricted
                  ? "Check Amazon first"
                  : meets
                    ? "Possible Amazon buy"
                    : bestNet >= 0
                      ? `Below your $${threshold} buy line`
                      : "No profit after fees";
                return (
                  <div key={en.id} className="scan-result-row overflow-hidden rounded-2xl" style={{ backgroundColor: SURFACE, color: INK, border: `1px solid ${LINE}`, boxShadow: "0 10px 26px rgba(23, 23, 23, 0.08)" }}>
                    <div className="w-full flex items-stretch gap-2 px-3 py-3">
                      <button onClick={() => setOpenId(open ? null : en.id)} className="grid flex-1 grid-cols-[84px_1fr_auto] items-center gap-3 text-left min-w-0 sm:grid-cols-[104px_1fr_auto]">
                        <span className="flex min-h-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-white sm:min-h-20" style={{ backgroundColor: statusColor }}>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">action</span>
                          <span className="flex items-center gap-1 text-2xl font-black uppercase leading-none">
                            {en.restricted && <Lock size={14} />}
                            {statusLabel}
                          </span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: statusColor }}>
                            {routeLabel}
                          </div>
                          <div className="mt-1 text-base font-black truncate">
                            {en.title}
                            {en.count > 1 && <span className="ml-1 font-mono" style={{ color: MUTED }}>×{en.count}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="hidden sm:inline-flex"><Sparkline history={en.history} color={sparkColor} /></span>
                            <VelocityBadge velocity={en.velocity} />
                            <span className="text-xs font-mono" style={{ color: MUTED }}>
                              #{en.velocity.current.toLocaleString()}
                            </span>
                            <span
                              className="flex items-center gap-0.5 text-xs font-bold"
                              style={{ color: en.offers <= 5 ? GREEN : en.offers <= 15 ? CHECK_BORDER : RED }}
                            >
                              <Users size={11} /> {en.offers}
                            </span>
                            <span className="text-xs font-black rounded px-1" style={{ color: "#FFF", backgroundColor: scoreColor }}>
                              {score.total}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-xl px-3 py-2 text-right shrink-0" style={{ color: MUTED, backgroundColor: SOFT, border: `1px solid ${LINE}` }}>
                          <span className="block text-[9px] font-black uppercase tracking-widest">net</span>
                          <span className="block text-xl font-black font-mono" style={{ color: bestNet >= 0 ? GREEN : RED }}>
                            {bestNet >= 0 ? "+" : ""}${(bestNet * en.count).toFixed(2)}
                          </span>
                        </span>
                      </button>
                      {meets && !en.queued && (
                        <button onClick={() => addToQueue(en.id)} title="save to buy list" className="shrink-0 p-1" style={{ color: BLUE }}>
                          <PackagePlus size={18} />
                        </button>
                      )}
                      {en.queued && <span className="text-xs font-black uppercase shrink-0" style={{ color: BLUE }}>saved</span>}
                      <button onClick={() => setOpenId(open ? null : en.id)} style={{ color: MUTED }}>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    {open && (
                      <div className="px-4 pb-3 text-xs font-mono" style={{ borderTop: `1px dashed ${LINE}`, color: INK }}>
                        <div className="pt-3 mb-3 text-sm font-bold normal-case" style={{ color: MUTED }}>
                          {reasonForEntry(en, bestNet, threshold)}
                        </div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <DataSourceBadge entry={en} />
                          <span
                            className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest"
                            style={{ color: CHECK_TXT, backgroundColor: AMBER_BG, border: "1px solid #B8860B" }}
                          >
                            profit estimated
                          </span>
                          {en.asin && (
                            <span className="text-[10px] font-mono font-bold" style={{ color: MUTED }}>
                              ASIN {en.asin}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 pt-1 mb-3 sm:grid-cols-[1fr_1fr]">
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1 flex items-center gap-2" style={{ color: MUTED }}>
                              {["amazon-sp-api", "amazon-sp-api-sandbox"].includes(en.priceSource) ? "Amazon (live)" : "Amazon estimate"}
                            </div>
                            <div>{en.itemCondition ? `${en.itemCondition.toLowerCase()} ` : ""}list ${en.amazonPrice.toFixed(2)}</div>
                            <div>profit ${en.amazonNet.toFixed(2)}</div>
                            {en.amazonFees != null && (
                              <div style={{ color: MUTED }}>fees ${en.amazonFees.toFixed(2)} · live</div>
                            )}
                          </div>
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1 flex items-center gap-2" style={{ color: MUTED }}>Data confidence</div>
                            <div>{catalogSourceLabel(en)}</div>
                            <div>{en.amazonMode ? `${en.amazonMode} mode` : "fallback catalog"}</div>
                          </div>
                        </div>
                        {en.restricted && (
                          <div
                            className="flex items-center gap-2 px-2 py-2 mb-3 text-xs font-bold rounded-lg"
                            style={{ backgroundColor: AMBER_BG, border: `2px solid #B8860B`, color: CHECK_TXT }}
                          >
                            <Lock size={14} />
                            gated category — Amazon approval required before you can list this title
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg" style={{ border: `1px solid ${LINE}`, backgroundColor: SOFT }}>
                          <span className="text-lg font-black px-2 py-1 rounded" style={{ color: "#FFF", backgroundColor: scoreColor }}>
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
                            {en.amazonBsr != null ? (
                              <div>#{en.amazonBsr.toLocaleString()} in Books <span style={{ color: GREEN }}>· live</span></div>
                            ) : (
                              <div>#{en.category.rank} in {en.category.name}</div>
                            )}
                          </div>
                          <div>
                            <div className="uppercase font-bold tracking-widest mb-1" style={{ color: MUTED }}>other sellers</div>
                            <div style={{ color: en.offers <= 5 ? GREEN : en.offers <= 15 ? CHECK_BORDER : RED }}>
                              {en.offers} seller{en.offers === 1 ? "" : "s"} listed
                            </div>
                          </div>
                        </div>

                        <div className="mt-2" style={{ color: MUTED }}>{en.isbn} · {en.author} · copies: {en.count}</div>
                        {en.priceSource === "estimated" && (
                          <div className="mt-1" style={{ color: MUTED }}>
                            catalog: {catalogSourceLabel(en)} · resale prices estimated
                          </div>
                        )}
                        {["amazon-sp-api", "amazon-sp-api-sandbox"].includes(en.priceSource) && (
                          <div className="mt-1" style={{ color: GREEN }}>
                            live Amazon {en.priceSource === "amazon-sp-api-sandbox" ? "sandbox " : ""}price &amp; rank
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
              style={{ backgroundColor: AMBER_BG, color: CHECK_TXT, border: `2px solid #B8860B` }}>
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
            <div className="rounded-2xl px-3 py-3" style={{ border: `1px solid ${LINE}`, backgroundColor: summary.verifiedRows ? GREEN_BG : DARK, color: INK }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest">check summary</div>
                  <div className="mt-1 text-xs font-bold" style={{ color: summary.verifiedRows ? MUTED : DARK_MUTED }}>
                    {summary.verifiedRows}/{summary.totalRows} books checked · {Math.round(summary.verificationRate * 100)}% done
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: summary.verifiedRows ? MUTED : DARK_MUTED }}>real profit</div>
                  <div className="text-xl font-black font-mono" style={{ color: summary.actualNet >= 0 ? GREEN : RED }}>
                    ${summary.actualNet.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-widest">
                <div className="rounded-lg py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: GREEN_BG, color: INK }}>buy {summary.buyRows}</div>
                <div className="rounded-lg py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: RED_BG, color: INK }}>pass {summary.passRows}</div>
                <div className="rounded-lg py-2" style={{ border: `1px solid ${LINE}`, backgroundColor: AMBER_BG, color: INK }}>watch {summary.watchRows}</div>
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
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
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
                  const open = openCheckId === key;
                  const { bestNet, label: statusLabel, color: statusColor, bg: statusBg } = decisionMeta(en, threshold);
                  const finalDecision = actual.real_decision || "";
                  const finalColor = finalDecision === "buy" ? GREEN : finalDecision === "pass" ? RED : finalDecision === "watch" ? CHECK_TXT : MUTED;
                  return (
                    <div key={key} className="overflow-hidden rounded-2xl" style={{ border: `1px solid rgba(255,255,255,0.12)`, backgroundColor: DARK, color: INK, boxShadow: "0 16px 34px rgba(17, 24, 39, 0.20)" }}>
                      <div className="px-3 py-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: statusColor }}>
                                app says {statusLabel}
                              </span>
                              <span className="font-mono text-xs font-black" style={{ color: statusColor }}>
                                {bestNet >= 0 ? "+" : ""}${bestNet.toFixed(2)} est.
                              </span>
                            </div>
                            <div className="mt-2 text-base font-black leading-tight">{en.title}</div>
                            <div className="mt-1 truncate text-xs font-mono" style={{ color: DARK_MUTED }}>{en.isbn} · {en.author}</div>
                          </div>
                          {finalDecision ? (
                            <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-black uppercase tracking-widest text-white" style={{ backgroundColor: finalColor }}>
                              {finalDecision}
                            </span>
                          ) : <EstimateBadge />}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            ["buy", GREEN, "Buy"],
                            ["pass", RED, "Pass"],
                            ["watch", CHECK_TXT, "Watch"],
                          ].map(([value, color, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => updateVerification(en, { real_decision: value })}
                              className="min-h-11 rounded-xl text-xs font-black uppercase tracking-widest"
                              style={{
                                backgroundColor: finalDecision === value ? color : statusBg,
                                color: finalDecision === value ? "#FFFFFF" : color,
                                border: `1px solid ${finalDecision === value ? color : LINE}`,
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold" style={{ color: sync === "error" ? RED : sync === "saved" ? GREEN : DARK_MUTED }}>
                            {sync === "saving" ? "saving..." : sync === "saved" ? "saved" : sync === "error" ? "save failed" : sync === "unsaved" ? "unsaved changes" : "not checked"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenCheckId(open ? null : key)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase tracking-widest"
                              style={{ color: INK, border: `1px solid rgba(255,255,255,0.16)`, backgroundColor: DARK_SURFACE }}
                            >
                              details {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              onClick={() => saveVerification(en)}
                              disabled={sync === "saving"}
                              className="px-3 py-1.5 text-xs font-black uppercase tracking-widest"
                              style={{ backgroundColor: sync === "saving" ? "#CFCFC5" : BLUE, color: "#FFF", border: `1px solid ${BLUE}` }}
                            >
                              save
                            </button>
                          </div>
                        </div>
                      </div>

                      {open && (
                        <div className="border-t px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.16)", backgroundColor: DARK_SURFACE }}>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <VerifySelect
                              label="Checked source"
                              value={actual.actual_source_checked}
                              onChange={(value) => updateVerification(en, { actual_source_checked: value })}
                              options={[
                                { value: "", label: "not checked" },
                                { value: "amazon", label: "Amazon" },
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
                            <VerifyInput label="Shipping" value={actual.actual_shipping} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_shipping: value })} />
                            <VerifyInput label="Fees" value={actual.actual_fees} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_fees: value })} />
                            <VerifyInput label="Real profit" value={actual.actual_net} type="number" placeholder="0.00" onChange={(value) => updateVerification(en, { actual_net: value })} />
                          </div>
                          <div className="mt-2">
                            <VerifyInput label="Notes" value={actual.notes} placeholder="condition, damage, bad comps..." onChange={(value) => updateVerification(en, { notes: value })} />
                          </div>
                        </div>
                      )}
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
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
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
            <AccountDataCard session={session} onSignOut={onSignOut} demoMode={demoMode} />
            <MfaCard demoMode={demoMode} />
            <div className="px-3 py-3 text-xs font-bold" style={{ backgroundColor: AMBER_BG, color: CHECK_TXT, border: `2px solid #B8860B` }}>
                  Prices are still estimates. Always check Amazon before buying. Saving: {supabaseReady ? "on" : "off"}.
            </div>
          </div>
        )}

        {view === "admin" && (
          <div className="flex flex-col gap-3">
            <PageHeader
              title="ShelfMargin admin"
              subtitle="Private business readiness, billing setup, and field-test proof."
              action={<ShieldCheck size={22} color={profileRole === "admin" ? GREEN : MUTED} />}
            />

            {profileRole !== "admin" ? (
              <EmptyState
                icon={ShieldCheck}
                title="Admin only"
                body="The first recreated account becomes admin. Sign in with that account to see setup checks."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
                    back to scan
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricBox label="Account" value="Admin" tone="action" />
                  <MetricBox label="Stripe" value={stripeConfigured ? "Ready" : "Check"} tone={stripeConfigured ? "buy" : "warn"} />
                  <MetricBox label="Amazon" value={amazonMetricValue} tone={amazonConfigured ? "buy" : "warn"} />
                  <MetricBox label="Scans" value={totalUnits} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricBox label="Buy List" value={queued.length} tone="buy" />
                  <MetricBox label="Est. Profit" value={`$${totalProfit.toFixed(2)}`} tone="buy" />
                  <MetricBox label="Avg Est." value={`$${averageProfit.toFixed(2)}`} />
                  <MetricBox label="Verified" value={`${Math.round(summary.verificationRate * 100)}%`} tone={summary.verificationRate >= 0.5 ? "buy" : "warn"} />
                </div>

                <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: SURFACE }}>
                  <div className="text-xs font-black uppercase tracking-widest mb-3">business readiness</div>
                  <div className="flex flex-col gap-2">
                    {adminLaunchChecks.map(([label, done, detail]) => (
                      <AdminCheck key={label} done={done} label={label} detail={detail} />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                    <button
                      type="button"
                      onClick={testAmazonConnectionFromAdmin}
                      disabled={amazonTest.loading}
                      className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: amazonConfigured ? GREEN : YELLOW, color: amazonConfigured ? "#FFFFFF" : INK, border: `1px solid ${amazonConfigured ? GREEN : YELLOW}` }}
                    >
                      {amazonTest.loading ? "Testing Amazon..." : "Test Amazon connection"}
                    </button>
                    {(amazonTest.message || !amazonConfigured) && (
                      <div
                        className="rounded-xl px-3 py-2 text-xs font-bold"
                        style={{
                          backgroundColor: amazonTest.ok ? GREEN_BG : AMBER_BG,
                          color: amazonTest.ok ? GREEN : CHECK_TXT,
                          border: `1px solid ${amazonTest.ok ? GREEN : CHECK_BORDER}`,
                        }}
                      >
                        {amazonTest.message || "Now that Amazon is approved, add the client ID, client secret, and refresh token, then run this test."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 py-3" style={{ border: `2px solid ${LINE}` }}>
                  <div className="text-xs font-black uppercase tracking-widest mb-3">field-test proof</div>
                  <div className="flex flex-col gap-2">
                    {adminProofChecks.map(([label, done, detail]) => (
                      <AdminCheck key={label} done={done} label={label} detail={detail} />
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: BLUE_BG }}>
                    <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>revenue path</div>
                    <div className="text-sm font-bold leading-relaxed" style={{ color: INK }}>
                      Free beta first. Starter at $15/mo after real scans prove the scanner saves time or prevents bad buys.
                    </div>
                  </div>
                  <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: GREEN_BG }}>
                    <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: GREEN }}>current proof</div>
                    <div className="text-sm font-bold leading-relaxed" style={{ color: INK }}>
                      {summary.verifiedRows} verified of {summary.totalRows} scanned. Actual net recorded on {summary.actualNetCount} book{summary.actualNetCount === 1 ? "" : "s"}.
                    </div>
                  </div>
                  <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: AMBER_BG }}>
                    <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: CHECK_TXT }}>launch blockers</div>
                    <div className="text-sm font-bold leading-relaxed" style={{ color: INK }}>
                      Amazon Professional developer access, live scan proof, support inbox/domain, legal review, and paid-access webhook proof still need final verification.
                    </div>
                  </div>
                </div>

                <div className="px-3 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: AMBER_BG }}>
                  <div className="text-xs font-black uppercase tracking-widest mb-3">owner inputs needed</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <OwnerInputItem label="Confirm admin login" detail="Sign in and make sure the admin badge shows by your email." />
                    <OwnerInputItem label="Scan real books" detail="Test 20 to 50 books with the scanner you plan to use." />
                    <OwnerInputItem label="Set buy rules" detail="Choose your true cost per book and minimum profit." />
                    <OwnerInputItem label="Check real prices" detail="Compare app estimates against Amazon before buying." />
                    <OwnerInputItem label="Finish Amazon setup" detail="Use the paid Professional month to add credentials and prove live data quickly." />
                    <OwnerInputItem label="Legal pages" detail="Check privacy, terms, and support email before public launch." />
                  </div>
                </div>

                <div className="px-3 py-3 text-sm font-bold" style={{ border: `2px solid ${LINE}`, backgroundColor: BLUE_BG, color: BLUE }}>
                  User management needs a server-side admin API before it can list or delete other accounts safely. Keep the service role key out of this browser app.
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  <button onClick={() => navigate("scan")} className="py-3 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
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
              subtitle="Saved books to check before you spend money."
            />

            {queued.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="No books saved yet"
                body="When a book looks good, tap the box icon to save it here."
                action={
                  <button onClick={() => navigate("scan")} className="px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: GOLD_INK, border: `2px solid ${LINE}` }}>
                    scan books
                  </button>
                }
              />
            ) : (
              <>
                <div className="mb-3 overflow-hidden rounded-2xl" style={{ backgroundColor: DARK, color: INK, border: `1px solid rgba(255,255,255,0.12)`, boxShadow: "0 16px 34px rgba(17, 24, 39, 0.20)" }}>
                  <div className="grid grid-cols-3 text-center">
                    <div className="px-3 py-3">
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: DARK_MUTED }}>saved</div>
                      <div className="font-mono text-2xl font-black">{queued.length}</div>
                    </div>
                    <div className="border-l px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(22, 163, 74, 0.16)" }}>
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#86EFAC" }}>est. net</div>
                      <div className="font-mono text-2xl font-black" style={{ color: GREEN }}>${queuedEstimatedTotal.toFixed(2)}</div>
                    </div>
                    <div className="border-l px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.16)" }}>
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: DARK_MUTED }}>selected</div>
                      <div className="font-mono text-2xl font-black">{selectedQueued.length}</div>
                    </div>
                  </div>
                  <div className="border-t px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(255,255,255,0.16)", color: DARK_MUTED }}>
                    Use this as a checkout list. Estimates still need a real Amazon check before buying.
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: DARK_SURFACE, color: INK, border: `1px solid rgba(255,255,255,0.12)` }}>
                  <button onClick={selectAll} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />} select all
                  </button>
                  <span className="text-xs font-bold" style={{ color: DARK_MUTED }}>{selectedQueued.length || queued.length} ready to export</span>
                </div>
                <div className="mb-4 flex flex-col gap-2 font-mono text-xs">
                  {queued.map((en) => {
                    const { bestNet, color } = decisionMeta(en, threshold);
                    const isSelected = Boolean(selected[en.id]);
                    return (
                    <div key={en.id} className="rounded-2xl px-3 py-3" style={{ backgroundColor: isSelected ? DARK : DARK_SURFACE, color: INK, border: `1px solid ${isSelected ? YELLOW : "rgba(255,255,255,0.12)"}`, boxShadow: isSelected ? "0 14px 30px rgba(255, 184, 107, 0.16)" : "0 10px 22px rgba(17, 24, 39, 0.16)" }}>
                      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                        <button onClick={() => toggleSelect(en.id)} className="shrink-0" style={{ color: isSelected ? YELLOW : DARK_MUTED }}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md px-2 py-1 font-sans text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: GREEN_BG, color: GREEN }}>
                              buy
                            </span>
                            <span className="font-sans text-sm font-black truncate">
                              {en.title}
                            </span>
                            {en.count > 1 && <span className="font-mono" style={{ color: DARK_MUTED }}>x{en.count}</span>}
                          </div>
                          <div className="mt-1 truncate text-xs font-mono" style={{ color: DARK_MUTED }}>{en.isbn} · Amazon-first check</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="rounded-xl px-3 py-2 font-black" style={{ color, backgroundColor: bestNet >= 0 ? GREEN_BG : RED_BG }}>
                            <span className="block font-sans text-[9px] font-black uppercase tracking-widest">est.</span>
                            {bestNet >= 0 ? "+" : ""}${(bestNet * en.count).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 pl-8 text-xs font-bold uppercase tracking-widest sm:grid-cols-[auto_auto_1fr]">
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: APP_PANEL, color: INK }}>
                          <span style={{ color: MUTED }}>price</span><span>$</span>
                          <input type="number" step="0.5" value={en.listPrice ?? 0}
                            onChange={(e) => updateQueued(en.id, { listPrice: parseFloat(e.target.value) || 0 })}
                            className="w-14 bg-transparent border-b-2 outline-none font-mono normal-case" style={{ borderColor: LINE, color: INK }} />
                        </div>
                        <select value={en.condition || "Good"} onChange={(e) => updateQueued(en.id, { condition: e.target.value })}
                          className="rounded-xl px-3 py-2 outline-none normal-case text-xs font-bold" style={{ backgroundColor: APP_PANEL, border: `1px solid ${LINE}`, color: INK }}>
                          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="hidden items-center text-[10px] font-black uppercase tracking-widest sm:flex" style={{ color: DARK_MUTED }}>
                          verify before checkout
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="sticky bottom-20 flex flex-wrap gap-2 rounded-2xl p-2 sm:bottom-0" style={{ backgroundColor: DARK, border: `1px solid rgba(255,255,255,0.12)`, boxShadow: "0 -10px 30px rgba(17, 24, 39, 0.20)" }}>
                  <button onClick={pushOffers} disabled={selectedQueued.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black uppercase tracking-widest"
                    style={{ backgroundColor: selectedQueued.length ? GREEN : "#CFCFC5", color: "#FFF" }}>
                    <Send size={14} /> mark checked
                  </button>
                  <button onClick={exportBuyList}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black uppercase tracking-widest"
                    style={{ backgroundColor: BLUE, color: "#FFF" }}>
                    <FileDown size={14} /> {selectedQueued.length > 0 ? "export selected" : "export CSV"}
                  </button>
                  <button onClick={removeFromQueue} disabled={selectedQueued.length === 0}
                    className="flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-black uppercase tracking-widest"
                    style={{ border: `1px solid rgba(255,255,255,0.16)`, color: selectedQueued.length ? RED : DARK_MUTED }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <BottomNav view={view} queuedCount={queued.length} savedCount={totalUnits} onNavigate={navigate} />
    </div>
  );
}

export default Ledger;
