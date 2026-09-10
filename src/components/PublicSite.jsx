import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  ExternalLink,
  HelpCircle,
  Lock,
  LogOut,
  Scan,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { hashForSection } from "../lib/appRoutes.js";
import { billingPlanLabel, billingStatusLabel } from "../lib/billing.js";
import { publicPath, publicRouteMeta } from "../lib/siteRoutes.js";
import { supabase, supabaseReady } from "../lib/supabase.js";

/* Iron & Orange brand (locked 2026-09) — neutral iron + clean orange, dark mode */
const BG = "#151515";        // app ground
const INK = "#E8E8E8";       // cream text
const YELLOW = "#F55E1F";    // brand rust
const GREEN = "#4E8A5A";     // buy (muted green)
const GREEN_POP = "#43C07B"; // brighter emerald for hero "win" numbers on dark
const BLUE = "#F55E1F";      // remapped primary -> rust
const RED = "#D8402E";       // pass (bright red, distinct from rust)
const MUTED = "#8A8A8A";
const LINE = "#323232";
const AMBER_BG = "#241C10";
const BLUE_BG = "#2A1710";
const GREEN_BG = "#17241C";
const RED_BG = "#241512";
const SURFACE = "#242424";
const SOFT = "#1B1B1B";
const CHARCOAL = "#0B0B0B";  // deepest charcoal card / dark section
const GOLD_INK = "#FFFFFF";  // text on rust
const CREAM = "#E8E8E8";
const CHECK_TXT = "#E0A94E";  // amber text that reads on the charcoal ground
const SUPPORT_EMAIL = "support@shelfmargin.com";

const DEMO_SCAN_PATH = `${publicPath("demo")}${hashForSection("scan")}`;

const navItems = [
  ["product", "Product"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
];

const faqItems = [
  ["Who is ShelfMargin for?", "People who buy used books to resell on Amazon."],
  ["Can I use a barcode scanner?", "Yes. Most Bluetooth scanners work like a keyboard. Scan the book and press Enter."],
  ["Is the profit number final?", "No. Treat it as a quick estimate. Always check the real Amazon listing data before buying."],
  ["Why export a list?", "So you can check your finds later, compare real Amazon prices, and avoid guessing from memory."],
  ["Do I need an account?", "Use the demo without an account. Create an account when you want to save real scans."],
  ["What will it cost?", "The beta is free while we test. The first paid plan is planned at $15/month, with a $29/month Pro plan after Amazon data is useful."],
  ["How do I get help?", `The planned support address is ${SUPPORT_EMAIL}. The domain and inbox still need to be secured before public launch.`],
  ["Is this ready for live buying decisions?", "Not yet. The app is built for testing the workflow while Amazon data connections are still being added."],
];

function StripeBar() {
  return (
    <div
      className="h-0.5 w-full"
      style={{ background: YELLOW, opacity: 0.9 }}
    />
  );
}

function ButtonLink({ href, children, tone = "dark", icon: Icon = ArrowRight }) {
  const styles = {
    dark: { backgroundColor: YELLOW, color: GOLD_INK },
    yellow: { backgroundColor: CREAM, color: "#141414" },
    blue: { backgroundColor: YELLOW, color: GOLD_INK },
    ghost: { backgroundColor: "transparent", color: INK },
  };
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-black uppercase tracking-widest"
      style={{ ...styles[tone], border: `1px solid ${tone === "ghost" ? LINE : styles[tone].backgroundColor}` }}
    >
      {children}
      {Icon && <Icon size={16} />}
    </a>
  );
}

function CheckoutButton({ planId, session, children, tone = "yellow" }) {
  const [state, setState] = useState({ loading: false, error: "" });
  const styles = {
    dark: { backgroundColor: YELLOW, color: GOLD_INK },
    yellow: { backgroundColor: CREAM, color: "#141414" },
    blue: { backgroundColor: YELLOW, color: GOLD_INK },
    ghost: { backgroundColor: "transparent", color: INK },
  };

  async function startCheckout() {
    if (!session?.access_token) {
      window.location.href = publicPath("login");
      return;
    }

    setState({ loading: true, error: "" });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });
      const body = await res.json();

      if (!res.ok || !body?.url) throw new Error(body?.error || "Checkout is not ready yet.");
      window.location.href = body.url;
    } catch (err) {
      setState({ loading: false, error: err?.message || "Checkout is not ready yet." });
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={state.loading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
        style={{ ...styles[tone], border: `1px solid ${tone === "ghost" ? LINE : styles[tone].backgroundColor}` }}
      >
        {state.loading ? "Opening checkout..." : children}
        <ArrowRight size={16} />
      </button>
      {state.error && (
        <div className="rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: RED_BG, color: RED, border: `1px solid ${RED}` }}>
          {state.error}
        </div>
      )}
    </div>
  );
}

function useBillingAccount(session) {
  const [state, setState] = useState({ loading: Boolean(session), account: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    if (!session || !supabaseReady) {
      setState({ loading: false, account: null, error: "" });
      return () => {
        cancelled = true;
      };
    }

    setState({ loading: true, account: null, error: "" });
    supabase
      .from("billing_accounts")
      .select("plan, subscription_status, current_period_end, cancel_at_period_end")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ loading: false, account: null, error: "Billing status unavailable" });
          return;
        }
        setState({ loading: false, account: data, error: "" });
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return state;
}

function useProfileRole(session) {
  const [role, setRole] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!session || !supabaseReady) {
      setRole("");
      return () => {
        cancelled = true;
      };
    }

    supabase
      .from("profiles")
      .select("role")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role || "");
      })
      .catch(() => {
        if (!cancelled) setRole("");
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return role;
}

function BillingSummary({ session }) {
  const { loading, account, error } = useBillingAccount(session);
  const plan = account ? billingPlanLabel(account.plan) : "Free beta";
  const status = account ? billingStatusLabel(account.subscription_status) : "Not connected";
  const suffix = account?.cancel_at_period_end ? " - cancels at period end" : "";

  return (
    <div
      className="px-2 py-2 font-black uppercase tracking-widest"
      style={{ border: `1px solid ${LINE}`, color: MUTED, backgroundColor: BLUE_BG }}
      title={error || "Billing status from your account."}
    >
      Subscription
      <span className="mt-1 block font-bold normal-case tracking-normal">
        {loading ? "Checking billing..." : `${plan} - ${status}${suffix}`}
      </span>
    </div>
  );
}

function PortalButton({ session }) {
  const [state, setState] = useState({ loading: false, error: "" });

  async function openPortal() {
    if (!session?.access_token) {
      window.location.href = publicPath("login");
      return;
    }

    setState({ loading: true, error: "" });
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await res.json();
      if (!res.ok || !body?.url) throw new Error(body?.error || "Billing portal is not ready yet.");
      window.location.href = body.url;
    } catch (err) {
      setState({ loading: false, error: err?.message || "Billing portal is not ready yet." });
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={openPortal}
        disabled={state.loading}
        className="flex items-center justify-between px-2 py-2 text-left font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
        style={{ border: `1px solid ${LINE}`, color: BLUE, backgroundColor: SURFACE }}
      >
        {state.loading ? "Opening billing..." : "Manage billing"} <ExternalLink size={13} />
      </button>
      {state.error && (
        <div className="px-2 py-2 font-bold normal-case tracking-normal" style={{ border: `1px solid ${RED}`, backgroundColor: RED_BG, color: RED }}>
          {state.error}
        </div>
      )}
    </div>
  );
}

function CheckoutNotice() {
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get("checkout") || "");
  }, []);

  if (status !== "success" && status !== "cancelled") return null;

  const success = status === "success";
  return (
    <div
      className="mb-5 rounded-lg px-4 py-3 text-sm font-bold"
      style={{
        backgroundColor: success ? GREEN_BG : AMBER_BG,
        color: success ? GREEN : CHECK_TXT,
        border: `1px solid ${success ? GREEN : "#B8860B"}`,
      }}
    >
      {success
        ? "Checkout finished. Your account updates after Stripe confirms the subscription."
        : "Checkout was canceled. Your plan was not changed."}
    </div>
  );
}

function PublicNav({ route, session, onSignOut }) {
  const profileRole = useProfileRole(session);
  const isAdmin = profileRole === "admin";

  return (
    <header className="sticky top-0 z-20 backdrop-blur" style={{ backgroundColor: "rgba(19,32,26,0.9)", borderBottom: `1px solid ${LINE}` }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <a href={publicPath("home")} className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: CHARCOAL, color: "#FFF" }}
            aria-hidden="true"
          >
            <Scan size={18} />
          </span>
          <span className="truncate text-xl font-black tracking-tight">ShelfMargin</span>
        </a>
        <nav className="hidden items-center gap-4 text-xs font-black uppercase tracking-widest md:flex">
          {navItems.map(([id, label]) => (
            <a key={id} style={{ color: route === id ? BLUE : INK }} href={publicPath(id)}>
              {label}
            </a>
          ))}
        </nav>
        {session ? (
          <details className="relative shrink-0">
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: CHARCOAL, color: "#FFF", border: `1px solid ${CHARCOAL}` }}
            >
              Account
              <ChevronDownIcon />
            </summary>
            <div
              className="absolute right-0 mt-2 w-72 rounded-lg p-3 text-xs font-bold normal-case shadow-xl"
              style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: INK }}
            >
              <div className="truncate font-mono" style={{ color: MUTED }}>{session.user?.email}</div>
              <div className="mt-3 grid gap-2">
                <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("dashboard")}>
                  Dashboard <ExternalLink size={13} />
                </a>
                <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("settings")}>
                  Settings <Settings size={13} />
                </a>
                {isAdmin && (
                  <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("admin")}>
                    Admin dashboard <ShieldCheck size={13} />
                  </a>
                )}
                <BillingSummary session={session} />
                <PortalButton session={session} />
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
        ) : (
          <a
            href={publicPath("login")}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: CHARCOAL, color: "#FFF", border: `1px solid ${CHARCOAL}` }}
          >
            Sign in
          </a>
        )}
      </div>
      <nav
        className="grid grid-cols-3 gap-0 border-t-2 text-center text-[10px] font-black uppercase tracking-widest md:hidden"
        style={{ borderColor: LINE }}
      >
        {navItems.map(([id, label]) => (
          <a
            key={id}
            href={publicPath(id)}
            className="px-1 py-2"
            style={{ backgroundColor: route === id ? BLUE : "transparent", color: route === id ? GOLD_INK : INK }}
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FramedImage({ src, alt, aspect = "aspect-[4/3]", className = "", imgClassName = "object-cover" }) {
  return (
    <div className={`overflow-hidden rounded-lg ${aspect} ${className}`} style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE }}>
      <img src={src} alt={alt} className={`h-full w-full ${imgClassName}`} loading="lazy" />
    </div>
  );
}

function Band({ children, tone = "plain", compact = false }) {
  const bg = tone === "blue" ? BLUE_BG : tone === "green" ? GREEN_BG : tone === "amber" ? AMBER_BG : tone === "red" ? RED_BG : "transparent";
  return (
    <section style={{ backgroundColor: bg, borderTop: `1px solid ${LINE}` }}>
      <div className={`mx-auto max-w-6xl px-4 ${compact ? "py-6" : "py-10 sm:py-12"}`}>{children}</div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, body }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>{eyebrow}</div>}
      <h2 className="text-2xl font-black leading-tight sm:text-3xl">{title}</h2>
      {body && <p className="mt-3 text-sm font-bold sm:text-base" style={{ color: MUTED }}>{body}</p>}
    </div>
  );
}

function Feature({ icon: Icon, title, body, tone = "plain" }) {
  const bg = tone === "green" ? GREEN_BG : tone === "amber" ? AMBER_BG : tone === "blue" ? BLUE_BG : "transparent";
  return (
    <div className="py-4" style={{ borderTop: `1px solid ${LINE}`, backgroundColor: bg }}>
      <Icon size={22} />
      <div className="mt-3 text-sm font-black">{title}</div>
      <div className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
    </div>
  );
}

function StatusPill({ children, tone = "amber" }) {
  const styles = {
    amber: { backgroundColor: AMBER_BG, color: CHECK_TXT, borderColor: "#B8860B" },
    blue: { backgroundColor: BLUE_BG, color: BLUE, borderColor: BLUE },
    green: { backgroundColor: GREEN_BG, color: GREEN, borderColor: GREEN },
  };
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest"
      style={{ border: `1px solid ${styles[tone].borderColor}`, ...styles[tone] }}
    >
      {children}
    </span>
  );
}

function StripeSetupPanel() {
  const [status, setStatus] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("Billing status is unavailable.");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStatus({ loading: false, data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setStatus({ loading: false, data: null, error: err?.message || "Billing status is unavailable." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = status.data;
  const items = [
    ["Browser key", data?.publishableKey?.present && data?.publishableKey?.validPrefix],
    ["Server key", data?.secretKey?.present && data?.secretKey?.validPrefix],
    ["Webhook secret", data?.webhookSecret?.present && data?.webhookSecret?.validPrefix && data?.webhookSecret?.likelyComplete],
    ["Starter price", data?.starterPriceId?.present && data?.starterPriceId?.validPrefix],
    ["Pro price", data?.proPriceId?.present && data?.proPriceId?.validPrefix],
  ];

  return (
    <div className="rounded-lg bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black uppercase tracking-widest">Stripe setup</div>
          <div className="mt-1 text-sm font-bold" style={{ color: MUTED }}>
            {status.loading
              ? "Checking billing setup..."
              : data?.configured
                ? "Checkout is ready for signed-in test users."
                : "Checkout is wired, but setup is not complete yet."}
          </div>
        </div>
        <StatusPill tone={data?.configured ? "green" : "amber"}>
          {data?.configured ? "ready" : "needs setup"}
        </StatusPill>
      </div>
      {status.error ? (
        <div className="mt-3 rounded-lg px-3 py-2 text-sm font-bold" style={{ backgroundColor: RED_BG, color: RED, border: `1px solid ${RED}` }}>
          {status.error}
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {items.map(([label, ready]) => (
            <div key={label} className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: ready ? GREEN_BG : AMBER_BG, color: ready ? GREEN : CHECK_TXT, border: `1px solid ${ready ? GREEN : "#B8860B"}` }}>
              {ready ? "Ready" : "Missing"}
              <span className="mt-1 block normal-case tracking-normal" style={{ color: INK }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductPreview() {
  const rows = [
    ["BUY", "New Plant Parent", "+$6.16", GREEN],
    ["CHECK", "Greens glorious greens!", "+$2.35", CHECK_TXT],
    ["PASS", "Old-fashioned cures", "-$1.19", RED],
  ];
  return (
    <div className="w-full overflow-hidden rounded-2xl" style={{ backgroundColor: CHARCOAL, color: "#FFF", boxShadow: "0 26px 70px rgba(23, 35, 31, 0.22)" }} aria-label="ShelfMargin app preview">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#B8C7C2" }}>field scanner</div>
          <div className="mt-1 text-sm font-black">9780132350884</div>
        </div>
        <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: GREEN_BG, color: GREEN }}>
          catalog found
        </span>
      </div>
      <div className="p-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: "#F8FAF9", color: INK }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-black leading-tight">Clean Code</div>
              <div className="mt-1 text-sm font-bold" style={{ color: MUTED }}>Robert C. Martin</div>
            </div>
            <span className="rounded-lg px-3 py-2 text-sm font-black text-white" style={{ backgroundColor: GREEN }}>BUY</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg px-2 py-3" style={{ backgroundColor: SOFT }}>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>cost</div>
              <div className="font-mono text-lg font-black">$1.50</div>
            </div>
            <div className="rounded-lg px-2 py-3" style={{ backgroundColor: AMBER_BG }}>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>price</div>
              <div className="font-mono text-lg font-black">$14.75</div>
            </div>
            <div className="rounded-lg px-2 py-3" style={{ backgroundColor: GREEN_BG }}>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>est. net</div>
              <div className="font-mono text-lg font-black" style={{ color: GREEN }}>+$6.16</div>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {rows.map(([status, title, profit, color]) => (
          <div key={title} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{status}</span>
            <span className="truncate text-sm font-black">{title}</span>
            <span className="font-mono text-sm font-black" style={{ color }}>{profit}</span>
          </div>
          ))}
        </div>
        <div className="mt-4 text-xs font-bold leading-relaxed" style={{ color: "#B8C7C2" }}>
          Catalog lookup is working. Profit remains estimated until production Amazon pricing is verified.
        </div>
      </div>
    </div>
  );
}

function FieldScannerVisual() {
  const receiptRows = [
    ["Atomic Habits", "$11.35", "BUY", GREEN],
    ["The 5 AM Club", "$3.80", "CHECK", CHECK_TXT],
    ["Old travel guide", "-$0.45", "PASS", RED],
  ];

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ border: `1px solid ${LINE}`, backgroundColor: SURFACE, boxShadow: "0 18px 50px rgba(31, 41, 55, 0.08)" }}
      aria-label="Scanner console workflow preview"
    >
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-4 sm:p-5" style={{ borderRight: `1px solid ${LINE}` }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill tone="green">Catalog lookup live</StatusPill>
            <StatusPill>Amazon pending</StatusPill>
          </div>

          <div className="rounded-lg p-3" style={{ backgroundColor: AMBER_BG, border: `1px solid ${YELLOW}` }}>
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
              <span>Scan ISBN</span>
              <span>Bluetooth ready</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-3" style={{ border: `1px solid ${LINE}` }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: BLUE_BG, color: BLUE }}>
                <Scan size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-base font-black">9780143127796</div>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  scanner stays focused
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">Atomic Habits</div>
                <div className="mt-1 text-sm font-bold" style={{ color: MUTED }}>
                  James Clear · catalog lookup
                </div>
              </div>
              <span className="shrink-0 rounded-lg px-3 py-2 text-sm font-black text-white" style={{ backgroundColor: GREEN }}>
                BUY
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg text-center" style={{ border: `1px solid ${LINE}` }}>
              <div className="px-2 py-3">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Est. sell</div>
                <div className="font-mono text-lg font-black">$14.75</div>
              </div>
              <div className="border-l px-2 py-3" style={{ borderColor: LINE }}>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Cost</div>
                <div className="font-mono text-lg font-black">$2.00</div>
              </div>
              <div className="border-l px-2 py-3" style={{ borderColor: LINE, backgroundColor: GREEN_BG }}>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Est. net</div>
                <div className="font-mono text-lg font-black" style={{ color: GREEN }}>$11.35</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-widest">
              <span className="rounded-lg py-3 text-white" style={{ backgroundColor: GREEN }}>Buy</span>
              <span className="rounded-lg py-3" style={{ backgroundColor: YELLOW, color: INK }}>Check</span>
              <span className="rounded-lg py-3 text-white" style={{ backgroundColor: RED }}>Pass</span>
            </div>

            <div className="mt-3 text-xs font-bold leading-relaxed" style={{ color: MUTED }}>
              Estimates help sort the pile. Check real Amazon data before buying inventory.
            </div>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-widest">Buy list</div>
              <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>Receipt preview</div>
            </div>
            <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: BLUE_BG, color: BLUE }}>
              CSV ready
            </span>
          </div>
          <div className="overflow-hidden rounded-lg bg-white font-mono text-xs" style={{ border: `1px solid ${LINE}` }}>
            {receiptRows.map(([title, profit, status, color]) => (
              <div key={title} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3" style={{ borderBottom: `1px dashed ${LINE}` }}>
                <div className="min-w-0">
                  <div className="truncate font-black">{title}</div>
                  <div className="mt-1 font-sans text-[10px] font-black uppercase tracking-widest" style={{ color }}>
                    {status}
                  </div>
                </div>
                <span className="font-black" style={{ color }}>
                  {profit}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3" style={{ backgroundColor: AMBER_BG }}>
              <span className="font-black">Estimated total</span>
              <span className="font-black" style={{ color: GREEN }}>$14.70</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest">
            <div className="rounded-lg bg-white px-2 py-3" style={{ border: `1px solid ${LINE}` }}>Scan</div>
            <div className="rounded-lg bg-white px-2 py-3" style={{ border: `1px solid ${LINE}` }}>Save</div>
            <div className="rounded-lg bg-white px-2 py-3" style={{ border: `1px solid ${LINE}` }}>Export</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductWorkflowVisual() {
  const flow = [
    ["1", "Scan", "9780143127796", BLUE, BLUE_BG],
    ["2", "Call", "BUY +$11.35 est.", GREEN, GREEN_BG],
    ["3", "Save", "Buy list", CHECK_TXT, AMBER_BG],
    ["4", "Export", "CSV", INK, "#F9FAFB"],
  ];
  const checkRows = [
    ["Atomic Habits", "BUY", "+$11.35", GREEN, GREEN_BG],
    ["The 5 AM Club", "CHECK", "+$3.80", CHECK_TXT, AMBER_BG],
    ["Old travel guide", "PASS", "-$0.45", RED, RED_BG],
  ];

  return (
    <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: "0 22px 60px rgba(31, 41, 55, 0.10)" }}>
      <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="p-4 sm:p-5" style={{ backgroundColor: SURFACE, color: CREAM }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-widest">field mode</div>
            <StatusPill>Amazon pending</StatusPill>
          </div>
          <div className="mt-6 rounded-[28px] bg-white p-3 text-left" style={{ color: INK }}>
            <div className="rounded-[22px] p-4" style={{ border: `3px solid ${INK}` }}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
                <span>9:41</span>
                <span>scan</span>
              </div>
              <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: BLUE_BG, border: `1px dashed ${BLUE}` }}>
                <div className="flex items-center gap-3">
                  <Scan size={22} color={BLUE} />
                  <div>
                    <div className="font-mono text-lg font-black">9780143127796</div>
                    <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>scanner stays focused</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: GREEN_BG, border: `1px solid ${GREEN}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-black">Atomic Habits</div>
                    <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>James Clear</div>
                  </div>
                  <span className="rounded-lg px-3 py-2 text-xs font-black text-white" style={{ backgroundColor: GREEN }}>BUY</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>est. net</div>
                    <div className="text-xl font-black" style={{ color: GREEN }}>+$11.35</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>cost</div>
                    <div className="text-xl font-black">$2.00</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-widest">
                <span className="rounded-xl py-3 text-white" style={{ backgroundColor: GREEN }}>Buy</span>
                <span className="rounded-xl py-3" style={{ backgroundColor: YELLOW, color: INK }}>Check</span>
                <span className="rounded-xl py-3 text-white" style={{ backgroundColor: RED }}>Pass</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-4">
            {flow.map(([step, label, value, color, bg]) => (
              <div key={label} className="rounded-xl p-3" style={{ backgroundColor: bg, border: `1px solid ${LINE}` }}>
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: color }}>
                  {step}
                </div>
                <div className="mt-3 text-xs font-black uppercase tracking-widest">{label}</div>
                <div className="mt-1 truncate text-sm font-bold" style={{ color: MUTED }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest">buy list</div>
                <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>Short enough to check before checkout</div>
              </div>
              <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: BLUE_BG, color: BLUE }}>
                CSV ready
              </span>
            </div>
            <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
              {checkRows.map(([title, status, net, color, bg], index) => (
                <div key={title} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3" style={{ backgroundColor: bg, borderTop: index === 0 ? "none" : `1px solid ${LINE}` }}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black">{title}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest" style={{ color }}>{status}</div>
                  </div>
                  <div className="font-mono text-sm font-black" style={{ color }}>{net}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-xl p-4 text-sm font-bold leading-relaxed" style={{ backgroundColor: AMBER_BG, color: CHECK_TXT, border: `1px solid #B8860B` }}>
            Estimates help sort the pile. Real marketplace price, fees, rank, and restrictions still need to be checked before buying.
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowSteps() {
  const steps = [
    ["Scan", "Use a barcode scanner or type the ISBN."],
    ["Estimate", "See buy, pass, or needs-check."],
    ["Save", "Keep possible buys in one list."],
    ["Export", "Download a CSV for final checks."],
  ];

  return (
    <div className="grid gap-0" style={{ borderTop: `1px solid ${LINE}` }}>
      {steps.map(([title, body], index) => (
        <div key={title} className="grid gap-2 py-4 sm:grid-cols-[96px_1fr]" style={{ borderBottom: `1px solid ${LINE}` }}>
          <div className="text-sm font-black">
            <span className="mr-2 font-mono" style={{ color: BLUE }}>{index + 1}</span>
            {title}
          </div>
          <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
            {body}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleBenefitList() {
  const items = [
    "Know which books are worth a second look.",
    "Avoid keeping the whole trip in your head.",
    "Export a simple list for checking real prices.",
  ];

  return (
    <ul className="grid gap-3 text-base font-bold" style={{ color: MUTED }}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" color={GREEN} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function HowItWorksCards() {
  const steps = [
    ["1", "Scan the ISBN", "Point a Bluetooth scanner or your camera at the barcode. ShelfMargin normalizes the ISBN and pulls the title and author."],
    ["2", "See the true net", "We subtract referral, the media closing fee, FBA, and your cost — then show one clear verdict: buy, check, or pass."],
    ["3", "Save & export", "Good finds drop onto your buy list with copy counts and notes. Export the whole run to CSV when you check out."],
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {steps.map(([num, title, body]) => (
        <div key={num} className="rounded-2xl p-6" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm font-black" style={{ color: BLUE, border: `1.5px solid ${BLUE}` }}>
            {num}
          </div>
          <div className="mt-4 text-lg font-black">{title}</div>
          <div className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
        </div>
      ))}
    </div>
  );
}

function FeeReceipt() {
  const rows = [
    ["Amazon price", "$18.40", INK, false],
    ["Referral (15%)", "-$2.76", RED, false],
    ["Media closing fee", "-$1.80", CHECK_TXT, true],
    ["FBA fulfillment", "-$4.49", RED, false],
    ["Your cost", "-$1.00", RED, false],
  ];
  return (
    <div className="rounded-2xl p-6 font-mono" style={{ backgroundColor: SURFACE, border: `1px solid #B8860B`, boxShadow: "0 18px 40px rgba(23,23,23,0.10)" }} aria-label="Example profit breakdown">
      <div className="mb-4 text-sm font-black" style={{ letterSpacing: "0.02em" }}>THE BAND OF BROTHERS · used-good</div>
      {rows.map(([label, val, color, flag]) => (
        <div
          key={label}
          className="flex items-center justify-between px-2 py-2 text-sm font-bold"
          style={flag
            ? { backgroundColor: AMBER_BG, color: CHECK_TXT, borderRadius: 8, margin: "2px -4px", fontWeight: 800 }
            : { borderBottom: `1px dashed ${LINE}`, color: MUTED }}
        >
          <span>{label}</span>
          <span style={{ color: flag ? CHECK_TXT : color }}>{val}</span>
        </div>
      ))}
      <div className="mt-3 flex items-center justify-between px-2 pt-3" style={{ borderTop: `2px solid ${INK}` }}>
        <span className="text-base font-black">Net profit</span>
        <span className="text-lg font-black" style={{ color: GREEN }}>+$8.35</span>
      </div>
    </div>
  );
}

function HomeFeature({ icon: Icon, title, body }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: BLUE_BG, color: BLUE }}>
        <Icon size={20} />
      </div>
      <div className="mt-3 text-base font-black">{title}</div>
      <div className="mt-1 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
    </div>
  );
}

function NotebookPhone() {
  const bars = [6, 10, 8, 13, 11, 16, 14];
  return (
    <div className="relative mx-auto" style={{ maxWidth: 320 }}>
      <div style={{ backgroundColor: "#12100C", borderRadius: 42, padding: 12, boxShadow: "0 26px 60px rgba(23,23,23,0.28)" }}>
        <div style={{ backgroundColor: SURFACE, borderRadius: 32, padding: "18px 18px 20px" }}>
          {/* screen header */}
          <div className="flex items-center justify-between">
            <div style={{ display: "grid", gap: 3 }} aria-hidden>
              <span style={{ width: 18, height: 2, background: INK, borderRadius: 2 }} />
              <span style={{ width: 18, height: 2, background: INK, borderRadius: 2 }} />
              <span style={{ width: 18, height: 2, background: INK, borderRadius: 2 }} />
            </div>
            <span className="sm-hand" style={{ fontSize: 26, lineHeight: 1 }}>Scan.</span>
            <Scan size={18} color={MUTED} />
          </div>

          {/* scan box */}
          <div className="mt-3 flex items-center justify-center" style={{ border: `2px solid ${BLUE}`, borderRadius: 14, height: 96, position: "relative" }}>
            <div className="flex items-end" style={{ gap: 3, height: 52 }}>
              {[3,2,4,2,5,3,2,4,3,5,2,3,4,2,3,5,3,2,4,3].map((w, i) => (
                <span key={i} style={{ width: w, height: 52, background: INK, borderRadius: 1 }} />
              ))}
            </div>
          </div>

          {/* verdict markers */}
          <div className="mt-4 sm-hand" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 30, lineHeight: 1.15 }}>
            <span><span className="sm-mk sm-mk-buy">Buy</span></span>
            <span><span className="sm-mk sm-mk-check">Check.</span></span>
            <span><span className="sm-mk sm-mk-pass">Pass</span></span>
          </div>

          {/* profit sparkline */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-black" style={{ minWidth: 52 }}>Profit</span>
            <div className="flex items-end" style={{ gap: 3, height: 18 }}>
              {bars.map((h, i) => (
                <span key={i} style={{ width: 5, height: h, background: GREEN, borderRadius: 1, opacity: 0.55 + i * 0.06 }} />
              ))}
            </div>
          </div>

          {/* rank stars */}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-black" style={{ minWidth: 52 }}>Rank</span>
            <span style={{ color: YELLOW, letterSpacing: 2, fontSize: 15 }}>
              <span style={{ color: "#C9A93F" }}>★★★</span><span style={{ color: LINE }}>★★</span>
            </span>
          </div>

          <div className="mt-4 pt-3 text-center" style={{ borderTop: `1px dashed ${LINE}` }}>
            <span className="sm-inklink text-sm font-black">CSV</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroScanner() {
  const bars = [3,2,4,2,5,3,2,4,3,5,2,3,4,2,3,5,3,2,4,3,2,5,3,2,4];
  return (
    <div className="mx-auto" style={{ maxWidth: 336 }}>
      <div style={{ backgroundColor: "#0A0A0A", borderRadius: 42, padding: 12, border: "1px solid rgba(245,94,31,0.28)", boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 60px rgba(245,94,31,0.10)" }}>
        <div style={{ backgroundColor: SURFACE, borderRadius: 32, padding: "20px 18px 22px", border: `1px solid ${LINE}` }}>
          {/* header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-end gap-0.5" aria-hidden style={{ height: 16 }}>
                <span style={{ width: 3, height: 8, background: INK }} />
                <span style={{ width: 3, height: 14, background: INK }} />
                <span style={{ width: 3, height: 6, background: INK }} />
                <span style={{ width: 3, height: 12, background: YELLOW }} />
              </span>
              <span className="text-lg font-black">Scan</span>
            </div>
            <div className="text-right font-mono text-[10px] leading-tight" style={{ color: MUTED }}>
              session · <b style={{ color: GREEN_POP }}>4 buys</b><br />18 scanned
            </div>
          </div>

          {/* scan box */}
          <div className="mt-3 grid place-items-center" style={{ border: `2px dashed ${LINE}`, borderRadius: 16, height: 118, position: "relative", overflow: "hidden", backgroundColor: BG }}>
            <span style={{ position: "absolute", left: 8, top: 8, width: 20, height: 20, borderLeft: `3px solid ${BLUE}`, borderTop: `3px solid ${BLUE}`, borderRadius: "6px 0 0 0" }} />
            <span style={{ position: "absolute", right: 8, top: 8, width: 20, height: 20, borderRight: `3px solid ${BLUE}`, borderTop: `3px solid ${BLUE}`, borderRadius: "0 6px 0 0" }} />
            <span style={{ position: "absolute", left: 8, bottom: 8, width: 20, height: 20, borderLeft: `3px solid ${BLUE}`, borderBottom: `3px solid ${BLUE}`, borderRadius: "0 0 0 6px" }} />
            <span style={{ position: "absolute", right: 8, bottom: 8, width: 20, height: 20, borderRight: `3px solid ${BLUE}`, borderBottom: `3px solid ${BLUE}`, borderRadius: "0 0 6px 0" }} />
            <span className="flex items-end" style={{ gap: 3, height: 56 }}>
              {bars.map((w, i) => (<span key={i} style={{ width: w, height: 56, background: INK, borderRadius: 1 }} />))}
            </span>
          </div>
          <div className="mt-2 text-center font-mono text-xs" style={{ color: MUTED }}>ISBN 978-0-306-40615-7</div>

          {/* verdict */}
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: GREEN_POP, color: "#08130C" }}>Buy</span>
              <span className="ml-auto font-mono text-[11px]" style={{ color: MUTED }}>velocity · fast</span>
            </div>
            <div className="mt-2 font-mono font-black leading-none" style={{ fontSize: 40, color: GREEN_POP, textShadow: "0 0 26px rgba(67,192,123,0.30)" }}>+$11.42</div>
            <div className="mt-2 text-sm font-bold leading-snug" style={{ color: MUTED }}>Clears your $5 buy line on Amazon with room to spare.</div>
            <div className="mt-3 text-base font-black leading-tight">Structure &amp; Interpretation of Computer Programs</div>
            <div className="text-xs font-bold" style={{ color: MUTED }}>Abelson &amp; Sussman</div>

            {/* receipt */}
            <div className="mt-3 pt-2 font-mono text-xs" style={{ borderTop: `1px dashed ${LINE}`, color: MUTED }}>
              {[["Amazon price", "$24.99"], ["Fees + FBA", "−$8.57"], ["Your cost", "−$5.00"]].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between py-0.5"><span>{l}</span><span>{v}</span></div>
              ))}
              <div className="mt-1 flex items-center justify-between pt-1 font-black" style={{ borderTop: `1px solid ${LINE}`, color: INK }}>
                <span>Net</span><span style={{ color: GREEN_POP }}>+$11.42</span>
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-black">
            <span className="rounded-xl px-2 py-3" style={{ border: `2px solid ${LINE}`, backgroundColor: BG, color: INK }}>Pass</span>
            <span className="rounded-xl px-2 py-3 text-white" style={{ backgroundColor: BLUE }}>Save to buy list</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripStat({ value, label, sub, marker = false }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
      <div className="font-mono text-3xl font-black leading-none" style={{ color: INK }}>
        {marker ? <span className="sm-mk sm-mk-buy">{value}</span> : value}
      </div>
      <div className="mt-3 text-sm font-black">{label}</div>
      <div className="mt-1 text-xs font-bold" style={{ color: MUTED }}>{sub}</div>
    </div>
  );
}

function HomePage({ session }) {
  const primaryHref = session ? hashForSection("scan") : publicPath("login");
  return (
    <>
      {/* ---- HERO ---- */}
      <section>
        <div className="sm-hero-glow mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest" style={{ backgroundColor: SURFACE, color: MUTED, border: `1px solid ${LINE}` }}>
              For used-book resellers · <span style={{ color: GREEN }}>Free during beta</span>
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[0.98] sm:text-6xl">
              Know the{" "}
              <span
                style={{
                  color: YELLOW,
                  textShadow: "0 0 34px rgba(245,94,31,0.35)",
                  borderBottom: `3px solid ${YELLOW}`,
                  paddingBottom: "0.04em",
                }}
              >
                margin
              </span>{" "}
              before you buy the book.
            </h1>
            <p className="mt-5 max-w-md text-xl font-bold leading-relaxed" style={{ color: MUTED }}>
              A scanning app for used-book resellers. Scan any book and instantly see if it’ll turn a profit on Amazon — after every fee — so you only buy the winners.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink href={primaryHref} tone="blue" icon={ArrowRight}>
                Start free beta
              </ButtonLink>
              <ButtonLink href="#how" tone="ghost">
                See how it works
              </ButtonLink>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs font-bold" style={{ color: MUTED }}>
              <span>No card</span>
              <span aria-hidden style={{ color: LINE }}>•</span>
              <span>Bluetooth scanner ready</span>
              <span aria-hidden style={{ color: LINE }}>•</span>
              <span>Honest estimates, always</span>
            </div>
          </div>
          <HeroScanner />
        </div>
      </section>

      {/* ---- TRUST STRIP ---- */}
      <section style={{ backgroundColor: SOFT, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-4 text-center font-mono text-sm font-bold" style={{ color: MUTED }}>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} color={BLUE} /> Counts the <b style={{ color: INK }}>$1.80 media closing fee</b></span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} color={BLUE} /> <b style={{ color: INK }}>Amazon-first</b> decisions</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} color={BLUE} /> Live title &amp; author lookup</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} color={BLUE} /> Buy list &amp; <b style={{ color: INK }}>CSV export</b></span>
        </div>
      </section>

      {/* ---- WHAT IT IS / GUT vs SHELFMARGIN ---- */}
      <Band>
        <SectionTitle
          eyebrow="What it is"
          title="A profit check for every book you pick up."
          body="Sourcing means facing thousands of used books with no way to tell the $12 winners from the worthless. ShelfMargin turns that guess into a one-second answer — right there in the aisle."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl p-6" style={{ backgroundColor: RED_BG, border: `1px solid ${LINE}` }}>
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: RED }}>Buying on gut</div>
            <ul className="mt-4 grid gap-3 text-sm font-bold" style={{ color: MUTED }}>
              <li>You carry home books that never sell.</li>
              <li>The 15% referral and $1.80 media fee quietly erase your margin at payout.</li>
              <li>You leave real money on the shelf because you can’t check fast enough.</li>
            </ul>
          </div>
          <div className="rounded-2xl p-6" style={{ backgroundColor: GREEN_BG, border: `1px solid ${LINE}` }}>
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: GREEN }}>Buying with ShelfMargin</div>
            <ul className="mt-4 grid gap-3 text-sm font-bold" style={{ color: INK }}>
              <li>See the true net after every Amazon fee before you spend a dollar.</li>
              <li>Keep only the books that clear your own profit line.</li>
              <li>Scan a whole trip in minutes and leave with a clean buy list.</li>
            </ul>
          </div>
        </div>
      </Band>

      {/* ---- HOW IT WORKS ---- */}
      <span id="how" style={{ display: "block", scrollMarginTop: 80 }} aria-hidden />
      <Band>
        <SectionTitle
          eyebrow="Three taps, no math"
          title="From barcode to buy decision in about a second."
          body="Built for the aisle, not the desk — big targets, one clear answer, and a running buy list you can export."
        />
        <div className="mt-8">
          <HowItWorksCards />
        </div>
      </Band>

      {/* ---- THE MARGIN (differentiator) ---- */}
      <Band tone="amber">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>Why the number is honest</div>
            <h2 className="text-2xl font-black leading-tight sm:text-3xl">The fee everyone forgets is the one that loses money.</h2>
            <p className="mt-4 text-base font-bold leading-relaxed sm:text-lg" style={{ color: MUTED }}>
              Books are a media category, so Amazon adds a <b style={{ color: INK }}>$1.80 variable closing fee</b> to every sale on top of the 15% referral. Leave it out and a “$2 profit” is really a loss. ShelfMargin counts it every time — and shows you the whole receipt, not just a green checkmark.
            </p>
          </div>
          <FeeReceipt />
        </div>
      </Band>

      {/* ---- WHY IT PAYS ---- */}
      <Band tone="blue">
        <SectionTitle
          eyebrow="Why it pays for itself"
          title="One good sourcing trip covers the year."
          body="Most books you scan are a fast pass. The few that clear your line are the whole game — and they add up quickly."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TripStat value="200" label="books scanned" sub="a Saturday library sale" />
          <TripStat value="185" label="skipped in seconds" sub="fast pass, no second-guessing" />
          <TripStat value="15" label="buys clear your line" sub="≈ +$7.80 net each" />
          <TripStat value="~$117" label="est. profit this trip" sub="after all Amazon fees" marker />
        </div>
        <div className="mt-6 rounded-2xl p-5 text-sm font-bold leading-relaxed" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: MUTED }}>
          ShelfMargin is <b style={{ color: INK }}>$15/mo</b>. Find one extra $8 book a week you’d otherwise have passed, and it’s already paid for itself — the rest is margin. <span>These are example estimates, not guarantees; always check the live Amazon listing before buying.</span>
        </div>
      </Band>

      {/* ---- FEATURES ---- */}
      <Band>
        <SectionTitle
          eyebrow="Made for real sourcing runs"
          title="Everything you need in the aisle. Nothing you don’t."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <HomeFeature icon={Scan} title="Scanner-first input" body="Bluetooth scanners just work — one scan, one Enter, one verdict. No fiddling between books." />
          <HomeFeature icon={ClipboardList} title="Buy list & notes" body="Save maybes, add a bin location, and jot a note before you spend a dollar." />
          <HomeFeature icon={ClipboardCheck} title="Duplicate detection" body="Scanned this title already? A copy count keeps you from doubling up by mistake." />
          <HomeFeature icon={Database} title="One-tap CSV export" body="Export a whole sourcing session to CSV — your list, your data, ready for the next step." />
          <HomeFeature icon={CheckCircle2} title="Session summaries" body="Every trip is grouped by date so you can see what a shelf, sale, or store returned." />
          <HomeFeature icon={ShieldCheck} title="Honest labels" body="Estimates say “estimate” until live Amazon data is connected. We never dress up a guess as a fact." />
        </div>
      </Band>

      {/* ---- CTA ---- */}
      <Band tone="blue">
        <div className="rounded-2xl px-6 py-10 text-center sm:px-10 sm:py-14" style={{ backgroundColor: BLUE, color: GOLD_INK }}>
          <h2 className="text-2xl font-black leading-tight sm:text-3xl" style={{ color: GOLD_INK }}>Stop guessing at the shelf.</h2>
          <p className="mx-auto mt-3 max-w-xl text-base font-bold" style={{ color: "rgba(8,8,8,0.86)" }}>
            Join the free beta, scan your next haul, and see the real margin before you spend a dime.
          </p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={primaryHref} tone="yellow" icon={ArrowRight}>
              Start free beta
            </ButtonLink>
          </div>
        </div>
      </Band>
    </>
  );
}

function ProductPage({ session }) {
  const productSteps = [
    ["Scan", "Type an ISBN or use a Bluetooth scanner. The field stays ready for the next book."],
    ["Match", "ShelfMargin finds the title and author through the server catalog path."],
    ["Decide", "The app gives a first buy, check, or pass call with estimated economics."],
    ["Save", "Good candidates go into a short list you can verify and export."],
  ];
  const readiness = [
    ["Working now", "typed ISBNs, scanner payload cleanup, catalog fallback, buy list, CSV export"],
    ["In progress", "Amazon production catalog, live pricing, fee accuracy, rank confidence"],
    ["Later", "native iOS, Apple Watch alerts, higher-volume Pro workflows"],
  ];

  return (
    <>
      <section style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <StatusPill tone="blue">Product</StatusPill>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[0.98] sm:text-6xl">
              A field tool for used-book buying.
            </h1>
            <p className="mt-5 max-w-xl text-lg font-bold leading-relaxed" style={{ color: MUTED }}>
              ShelfMargin is designed for the aisle: scan the book, get a fast first read, save the ones worth checking, and move on.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink href={session ? hashForSection("dashboard") : publicPath("login")} tone="blue" icon={ArrowRight}>
                {session ? "Open scanner" : "Start free beta"}
              </ButtonLink>
              <ButtonLink href={DEMO_SCAN_PATH} tone="ghost" icon={Scan}>
                Try the scanner
              </ButtonLink>
            </div>
          </div>
          <HeroScanner />
        </div>
      </section>

      <Band>
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <SectionTitle
            eyebrow="workflow"
            title="The product is one loop"
            body="A reseller should be able to repeat this flow dozens of times without the interface getting in the way."
          />
          <div className="grid gap-0 rounded-2xl" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
            {productSteps.map(([title, body], index) => (
              <div key={title} className="grid gap-3 px-5 py-5 sm:grid-cols-[56px_140px_1fr] sm:items-start" style={{ borderTop: index === 0 ? "none" : `1px solid ${LINE}` }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-black" style={{ backgroundColor: index === 0 ? YELLOW : SOFT, color: index === 0 ? INK : BLUE }}>
                  {index + 1}
                </div>
                <div className="text-base font-black">{title}</div>
                <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="blue">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <SectionTitle
            eyebrow="data status"
            title="Clear about what is proven"
            body="The site should feel professional without overstating the product. We show what works today and what is still being validated."
          />
          <div className="grid gap-0 rounded-2xl" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
            {readiness.map(([label, body], index) => (
              <div key={label} className="grid gap-3 px-5 py-5 sm:grid-cols-[140px_1fr]" style={{ borderTop: index === 0 ? "none" : `1px solid ${LINE}` }}>
                <div className="text-sm font-black">{label}</div>
                <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="blue">
        <div className="rounded-2xl px-6 py-10 text-center sm:px-10 sm:py-14" style={{ backgroundColor: BLUE, color: GOLD_INK }}>
          <h2 className="text-2xl font-black leading-tight sm:text-3xl" style={{ color: GOLD_INK }}>Try it on your next sourcing trip.</h2>
          <p className="mx-auto mt-3 max-w-xl text-base font-bold" style={{ color: "rgba(8,8,8,0.86)" }}>
            Free during beta. Scan a book, see the real margin after fees, and decide in a second.
          </p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={session ? hashForSection("dashboard") : publicPath("login")} tone="yellow" icon={ArrowRight}>
              {session ? "Open scanner" : "Start free beta"}
            </ButtonLink>
          </div>
        </div>
      </Band>
    </>
  );
}

function PricingPage({ session }) {
  const profileRole = useProfileRole(session);
  const isAdmin = profileRole === "admin";
  const primaryHref = session ? hashForSection("dashboard") : publicPath("login");
  const Ck = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M3 8.5l3 3 7-7" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const freeFeats = ["Scan books & save history", "Build a buy list", "Notes before buying", "One-tap CSV export"];
  const starterFeats = ["Everything in Free beta", "Account scan history", "Saved buy lists & field-test exports", "Live Amazon checks when connected"];
  const proFeats = ["Everything in Starter", "Advanced live-data checks", "Faster sourcing tools", "Apple Watch alerts (later)"];

  function PlanCTA({ planId, tone }) {
    if (isAdmin) {
      return (
        <CheckoutButton planId={planId} session={session} tone={tone}>
          {session ? `Test ${planId === "starter" ? "Starter" : "Pro"}` : "Sign in"}
        </CheckoutButton>
      );
    }
    return <ButtonLink href={primaryHref} tone={tone}>Join the waitlist</ButtonLink>;
  }

  return (
    <>
      <Band>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>Pricing</div>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Free while we prove it. Fair once it pays for itself.</h1>
          <p className="mt-3 text-base font-bold leading-relaxed" style={{ color: MUTED }}>
            Start free during the beta. Paid plans switch on only after live Amazon data makes the scanner clearly worth it.
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-2xl"><CheckoutNotice /></div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3 lg:items-start">
          {/* Free beta */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
            <h3 className="text-xl font-black">Free beta</h3>
            <div className="mt-2 font-mono text-4xl font-black">$0</div>
            <div className="font-mono text-xs font-bold" style={{ color: MUTED }}>during beta</div>
            <div className="mt-3 text-sm font-bold" style={{ color: MUTED, minHeight: "2.6em" }}>Early testers scanning real books with us.</div>
            <ul className="mt-4 grid gap-2 text-sm font-bold">
              {freeFeats.map((f) => (<li key={f} className="flex items-start gap-2"><Ck />{f}</li>))}
            </ul>
            <div className="mt-6"><ButtonLink href={primaryHref} tone="blue">{session ? "Open scanner" : "Start free"}</ButtonLink></div>
          </div>

          {/* Starter — featured */}
          <div className="relative rounded-2xl p-6" style={{ backgroundColor: SURFACE, border: `2px solid ${BLUE}`, boxShadow: "0 16px 40px rgba(23,23,23,0.10)" }}>
            <span className="absolute -top-3 left-6 rounded-md px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: YELLOW, color: INK }}>Planned</span>
            <h3 className="text-xl font-black">Starter</h3>
            <div className="mt-2 font-mono text-4xl font-black">$15<span className="text-sm font-bold" style={{ color: MUTED }}> /mo</span></div>
            <div className="font-mono text-xs font-bold" style={{ color: MUTED }}>after live data is useful</div>
            <div className="mt-3 text-sm font-bold" style={{ color: MUTED, minHeight: "2.6em" }}>Solo resellers who source regularly.</div>
            <ul className="mt-4 grid gap-2 text-sm font-bold">
              {starterFeats.map((f) => (<li key={f} className="flex items-start gap-2"><Ck />{f}</li>))}
            </ul>
            <div className="mt-6"><PlanCTA planId="starter" tone="blue" /></div>
            <div className="mt-2 text-center font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
              {isAdmin ? "admin test checkout" : "switches on after live data"}
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
            <h3 className="text-xl font-black">Pro</h3>
            <div className="mt-2 font-mono text-4xl font-black">$29<span className="text-sm font-bold" style={{ color: MUTED }}> /mo</span></div>
            <div className="font-mono text-xs font-bold" style={{ color: MUTED }}>higher-volume workflow</div>
            <div className="mt-3 text-sm font-bold" style={{ color: MUTED, minHeight: "2.6em" }}>Higher-volume resellers who need speed.</div>
            <ul className="mt-4 grid gap-2 text-sm font-bold">
              {proFeats.map((f) => (<li key={f} className="flex items-start gap-2"><Ck />{f}</li>))}
            </ul>
            <div className="mt-6"><PlanCTA planId="pro" tone="ghost" /></div>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs font-bold leading-relaxed" style={{ color: MUTED }}>
          Prices, ranks, and verdicts are estimates until live Amazon data is connected. No team plan yet — the beta is focused on solo resellers. Questions? {SUPPORT_EMAIL}.
        </p>
        {isAdmin && <div className="mt-8"><StripeSetupPanel /></div>}
      </Band>
    </>
  );
}

function FaqPage() {
  return (
    <Band>
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>FAQ</div>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">Questions, answered.</h1>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-3">
        {faqItems.map(([q, a]) => (
          <div key={q} className="rounded-2xl p-5" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}` }}>
            <div className="text-base font-black">{q}</div>
            <div className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{a}</div>
          </div>
        ))}
      </div>
    </Band>
  );
}

function SecurityPage() {
  return (
    <Band>
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>Security</div>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">Your scans are yours.</h1>
        <p className="mt-3 text-base font-bold leading-relaxed" style={{ color: MUTED }}>
          When you create an account, your scanned books and notes are saved privately to your login — protected by row-level security in the database.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-3">
        <HomeFeature icon={Lock} title="Private by default" body="Row-level security means you can only ever see your own scans and notes — never anyone else's." />
        <HomeFeature icon={Database} title="Saved to your account" body="Your buy list and history stay tied to your login and sync across devices." />
        <HomeFeature icon={ShieldCheck} title="Checked before launch" body="Security and leaked-password protections are verified before any paid release." />
      </div>
    </Band>
  );
}

function LegalPage({ eyebrow, title, updated, children }) {
  return (
    <Band>
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>{eyebrow}</div>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 font-mono text-xs font-bold" style={{ color: MUTED }}>Last updated: {updated}</p>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl p-6 text-sm font-bold leading-relaxed" style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: MUTED }}>
          {children}
        </div>
      </div>
    </Band>
  );
}

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="August 26, 2026">
      <p>The app stores account information and scan data so users can test book-sourcing workflows. Scan records may include ISBNs, titles, estimated prices, book-check notes, and buying decisions entered by the user.</p>
      <p>Authentication and database storage are handled through Supabase. Data is intended to be private to the signed-in user, protected by row-level security policies in the project database.</p>
      <p>It does not currently process live payments, sell user scan data, or claim live Amazon accuracy. Stripe billing is in test setup, and Amazon data is still pending final connection. If live billing, analytics, or Amazon integrations are added later, this policy should be checked and updated before launch.</p>
      <p>For deletion, export, or support requests during validation, use the account email associated with your test access and contact {SUPPORT_EMAIL}. This inbox is planned and should be activated before public launch.</p>
    </LegalPage>
  );
}

function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Use" updated="August 6, 2026">
      <p>This is an early tool for testing used-book sourcing. Estimated pricing, rank, velocity, eligibility, and fee data should be independently checked before any buying decision.</p>
      <p>Users are responsible for their own marketplace compliance, resale eligibility, inventory purchases, tax treatment, and shipping decisions.</p>
      <p>The beta may change as live data integrations, billing, and account controls are added. Planned pricing is $0 during beta, $15/month for Starter, and $29/month for Pro after the paid product is ready. Customer-facing terms should be checked before any paid public launch.</p>
      <p>For support, contact {SUPPORT_EMAIL}. This inbox is planned and should be activated before public launch.</p>
    </LegalPage>
  );
}

function PublicFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${LINE}` }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs font-black uppercase tracking-widest">
        <span>Scan - check - export</span>
        <div className="flex flex-wrap gap-4">
          <a href={publicPath("product")}>Product</a>
          <a href={publicPath("pricing")}>Pricing</a>
          <a href={publicPath("security")}>Security</a>
          <a href={publicPath("privacy")}>Privacy</a>
          <a href={publicPath("terms")}>Terms</a>
        </div>
      </div>
    </footer>
  );
}

export default function PublicSite({ route = "home", session, onSignOut }) {
  useEffect(() => {
    const meta = publicRouteMeta(route);
    document.title = meta.title;
    const updates = [
      ["name", "description", meta.description],
      ["property", "og:title", meta.title],
      ["property", "og:description", meta.description],
      ["name", "twitter:title", meta.title],
      ["name", "twitter:description", meta.description],
    ];

    updates.forEach(([attr, key, value]) => {
      const el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (el) el.setAttribute("content", value);
    });
  }, [route]);

  const pages = {
    product: <ProductPage session={session} />,
    pricing: <PricingPage session={session} />,
    faq: <FaqPage />,
    security: <SecurityPage />,
    privacy: <PrivacyPage />,
    terms: <TermsPage />,
    home: <HomePage session={session} />,
  };

  return (
    <div className="shelf-theme min-h-screen w-full" style={{ backgroundColor: BG, color: INK }}>
      <StripeBar />
      <PublicNav route={route} session={session} onSignOut={onSignOut} />
      {pages[route] || pages.home}
      <PublicFooter />
    </div>
  );
}
