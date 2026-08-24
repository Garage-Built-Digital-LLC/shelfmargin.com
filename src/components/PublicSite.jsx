import { useEffect } from "react";
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
import { publicPath, publicRouteMeta } from "../lib/siteRoutes.js";

const BG = "#FFFBEB";
const INK = "#1F2937";
const YELLOW = "#FACC15";
const GREEN = "#16A34A";
const BLUE = "#2563EB";
const RED = "#DC2626";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const AMBER_BG = "#FEF3C7";
const BLUE_BG = "#EFF6FF";
const GREEN_BG = "#ECFDF5";
const RED_BG = "#FEF2F2";
const SUPPORT_EMAIL = "support@shelfmargin.com";

const ASSETS = {
  brandMark: "/assets/brand/brand-mark.png",
  logoPrimary: "/assets/brand/logo-primary.png",
  productScan: "/assets/images/product/app-screenshot-scan.webp",
};

const navItems = [
  ["product", "Product"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
];

const faqItems = [
  ["Who is ShelfMargin for?", "People who buy used books to resell on Amazon, eBay, or other marketplaces."],
  ["Can I use a barcode scanner?", "Yes. Most Bluetooth scanners work like a keyboard. Scan the book and press Enter."],
  ["Is the profit number final?", "No. Treat it as a quick estimate. Always check the real marketplace before buying."],
  ["Why export a list?", "So you can check your finds later, compare real prices, and avoid guessing from memory."],
  ["Do I need an account?", "Use the demo without an account. Create an account when you want to save real scans."],
  ["What will it cost?", "The beta is free while we test. The first paid plan is planned at $15/month, with a $29/month Pro plan after live data is useful."],
  ["How do I get help?", `The planned support address is ${SUPPORT_EMAIL}. The domain and inbox still need to be secured before public launch.`],
  ["Is this ready for live buying decisions?", "Not yet. The app is built for testing the workflow while live data connections are still being added."],
];

function StripeBar() {
  return (
    <div
      className="h-1 w-full"
      style={{ backgroundColor: BLUE, borderBottom: `1px solid ${LINE}` }}
    />
  );
}

function ButtonLink({ href, children, tone = "dark", icon: Icon = ArrowRight }) {
  const styles = {
    dark: { backgroundColor: INK, color: "#FFF" },
    yellow: { backgroundColor: YELLOW, color: INK },
    blue: { backgroundColor: BLUE, color: "#FFF" },
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

function PublicNav({ route, session, onSignOut }) {
  return (
    <header className="sticky top-0 z-20" style={{ backgroundColor: "#FFFFFF", borderBottom: `1px solid ${LINE}` }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href={publicPath("home")} className="flex min-w-0 items-center gap-2">
          <img src={ASSETS.brandMark} alt="" className="h-8 w-8 shrink-0 object-contain" />
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
              style={{ backgroundColor: BLUE, color: "#FFF", border: `1px solid ${BLUE}` }}
            >
              Account
              <ChevronDownIcon />
            </summary>
            <div
              className="absolute right-0 mt-2 w-72 rounded-lg p-3 text-xs font-bold normal-case shadow-xl"
              style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, color: INK }}
            >
              <div className="truncate font-mono" style={{ color: MUTED }}>{session.user?.email}</div>
              <div className="mt-3 grid gap-2">
                <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("dashboard")}>
                  Dashboard <ExternalLink size={13} />
                </a>
                <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("settings")}>
                  Settings <Settings size={13} />
                </a>
                <a className="flex items-center justify-between px-2 py-2 font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }} href={hashForSection("admin")}>
                  Admin setup <ShieldCheck size={13} />
                </a>
                <div
                  className="px-2 py-2 font-black uppercase tracking-widest"
                  style={{ border: `1px solid ${LINE}`, color: MUTED, backgroundColor: BLUE_BG }}
                  title="Stripe billing portal is not connected yet."
                >
                  Subscription status
                  <span className="mt-1 block font-bold normal-case tracking-normal">Free beta - billing not connected</span>
                </div>
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
            style={{ backgroundColor: INK, color: "#FFF", border: `1px solid ${INK}` }}
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
            style={{ backgroundColor: route === id ? BLUE : "transparent", color: route === id ? "#FFF" : INK }}
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
    <div className={`overflow-hidden rounded-lg ${aspect} ${className}`} style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF" }}>
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
    amber: { backgroundColor: AMBER_BG, color: "#8A6100", borderColor: "#B8860B" },
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

function ProductPreview() {
  const rows = [
    ["BUY", "The Lord of the Rings", "+$9.73", GREEN, GREEN_BG],
    ["CHECK", "To Kill a Mockingbird", "+$2.68", "#B8860B", AMBER_BG],
    ["PASS", "The Alchemist", "+$1.58", RED, RED_BG],
  ];
  return (
    <div className="w-full p-3" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF" }} aria-label="ShelfMargin app preview">
      <div className="flex items-center gap-2 px-3 py-3 text-sm font-black uppercase tracking-widest" style={{ border: `1px solid ${LINE}` }}>
        <Scan size={18} />
        Scan ISBN...
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map(([status, title, profit, color, bg]) => (
          <div key={title} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 p-3" style={{ border: `1px solid ${LINE}`, backgroundColor: bg }}>
            <span className="px-2 py-1 text-center text-xs font-black uppercase text-white" style={{ backgroundColor: color }}>{status}</span>
            <span className="truncate text-sm font-black">{title}</span>
            <span className="font-mono text-sm font-black" style={{ color }}>{profit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldScannerVisual() {
  const receiptRows = [
    ["Atomic Habits", "$11.35", "BUY", GREEN],
    ["The 5 AM Club", "$3.80", "CHECK", "#8A6100"],
    ["Old travel guide", "-$0.45", "PASS", RED],
  ];

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF", boxShadow: "0 18px 50px rgba(31, 41, 55, 0.08)" }}
      aria-label="Scanner console workflow preview"
    >
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-4 sm:p-5" style={{ borderRight: `1px solid ${LINE}` }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill tone="green">Catalog lookup live</StatusPill>
            <StatusPill>Prices estimated</StatusPill>
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
              Estimates help sort the pile. Check real marketplace data before buying inventory.
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

function HomePage({ session }) {
  return (
    <>
      <section className="pos-grid">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:py-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <StatusPill tone="blue">used-book reseller scanner</StatusPill>
            <h1 className="mt-4 text-4xl font-black leading-none sm:text-6xl">Scan. Decide. Save the buys.</h1>
            <p className="mt-5 max-w-xl text-lg font-bold leading-relaxed" style={{ color: MUTED }}>
              A fast web scanner for sourcing trips. Scan an ISBN, see an estimated net, save possible buys, then export the list.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={publicPath("demo")} tone="yellow" icon={Scan}>
                Try demo
              </ButtonLink>
              <ButtonLink href={session ? hashForSection("scan") : publicPath("login")} tone="dark">
                {session ? "Open scanner" : "Create account"}
              </ButtonLink>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
              <span className="rounded-full bg-white px-3 py-2" style={{ border: `1px solid ${LINE}` }}>Bluetooth scanner ready</span>
              <span className="rounded-full bg-white px-3 py-2" style={{ border: `1px solid ${LINE}` }}>Buy list receipt</span>
              <span className="rounded-full bg-white px-3 py-2" style={{ border: `1px solid ${LINE}` }}>CSV export</span>
            </div>
          </div>
          <FieldScannerVisual />
        </div>
      </section>

      <Band tone="blue" compact>
        <div className="grid gap-3 text-sm font-black sm:grid-cols-3">
          <div className="flex items-center gap-2"><Scan size={18} /> Scan the barcode</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={18} /> See buy / pass / check</div>
          <div className="flex items-center gap-2"><ClipboardCheck size={18} /> Save the good ones</div>
        </div>
      </Band>

      <Band>
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-center">
          <SectionTitle
            eyebrow="how it works"
            title="Four steps, built for a sourcing trip"
            body="Use it while you are standing at the shelf. Save the books worth checking and move on."
          />
          <WorkflowSteps />
        </div>
      </Band>

      <Band tone="amber">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-center">
          <SectionTitle
            eyebrow="why it helps"
            title="A shorter path from shelf to buy list"
            body="For resellers who need quick notes, clear estimates, and a list they can check later."
          />
          <SimpleBenefitList />
        </div>
      </Band>
    </>
  );
}

function ProductPage({ session }) {
  const productSteps = [
    ["At the shelf", "Scan the ISBN, enter your buy cost, and get a quick buy / check / pass read."],
    ["During the trip", "Save possible buys without leaving the scanner or losing your place in the pile."],
    ["Before checkout", "Review the buy list, remove weak picks, and export CSV for final marketplace checks."],
  ];
  const scanDetails = [
    ["Input", "Bluetooth scanner or typed ISBN"],
    ["Decision", "Buy, check, or pass"],
    ["Saved fields", "ISBN, title, cost, estimate, note"],
    ["Export", "CSV for follow-up research"],
  ];

  return (
    <>
      <Band>
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <SectionTitle
              eyebrow="product"
              title="A scanner that turns piles into a short buy list"
              body="Built for sourcing trips: scan fast, make a quick call, and keep only the books worth checking again."
            />
            <div className="mt-6" style={{ borderTop: `1px solid ${LINE}` }}>
              {productSteps.map(([title, body], index) => (
                <div key={title} className="grid gap-2 py-4 sm:grid-cols-[120px_1fr]" style={{ borderBottom: `1px solid ${LINE}` }}>
                  <div className="text-sm font-black">
                    <span className="mr-2 font-mono" style={{ color: BLUE }}>{index + 1}</span>
                    {title}
                  </div>
                  <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={publicPath("demo")} tone="yellow" icon={Scan}>
                Try scanner demo
              </ButtonLink>
              <ButtonLink href={session ? hashForSection("dashboard") : publicPath("login")} tone="dark">
                {session ? "Open dashboard" : "Create account"}
              </ButtonLink>
            </div>
          </div>
          <FieldScannerVisual />
        </div>
      </Band>
      <Band tone="blue">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <SectionTitle
            eyebrow="what it captures"
            title="Enough detail to decide, not enough to slow you down"
            body="The app should stay focused on the buying moment. Deeper research can happen after the trip."
          />
          <div className="rounded-lg bg-white px-4" style={{ border: `1px solid ${LINE}` }}>
            {scanDetails.map(([title, body]) => (
              <div key={title} className="grid gap-2 py-4 sm:grid-cols-[140px_1fr]" style={{ borderBottom: `1px solid ${LINE}` }}>
                <div className="text-sm font-black">{title}</div>
                <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Band>
      <Band>
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1fr] lg:items-center">
          <SectionTitle
            eyebrow="honest estimates"
            title="Fast sorting first. Final checks before buying."
            body="ShelfMargin is useful when it helps you move through the shelf faster. Estimated values are not a promise of sale price, rank, eligibility, fees, or profit."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Feature icon={Scan} title="Scan" body="Capture books quickly with the input already focused." tone="blue" />
            <Feature icon={ClipboardCheck} title="Save" body="Keep only the books worth another look." tone="green" />
            <Feature icon={ClipboardList} title="Export" body="Check the list later against real marketplace data." tone="amber" />
          </div>
        </div>
      </Band>
    </>
  );
}

function PricingPage({ session }) {
  const plans = [
    ["Free beta", "$0", "Test the scanner workflow while live pricing data is still being connected.", "Use now"],
    ["Starter", "$15/mo", "For one reseller who wants saved scans, buy lists, notes, and CSV export.", "Planned"],
    ["Pro", "$29/mo", "Planned for heavier sourcing once live marketplace data is useful enough.", "Later"],
  ];
  const valueChecks = [
    ["Find better picks", "Save books that look worth checking instead of guessing from memory."],
    ["Skip weak books", "Pass faster when the estimate, condition, or notes do not justify the buy."],
    ["Leave with a list", "Export CSV before you spend money or bring home a pile."],
  ];
  return (
    <Band>
      <SectionTitle
        eyebrow="pricing"
        title="Free while the scanner is being field-tested"
        body="Pricing stays simple: free beta now, then Starter at $15/month and Pro at $29/month after the product proves real sourcing value."
      />
      <div className="mt-7 overflow-hidden rounded-lg bg-white" style={{ border: `1px solid ${LINE}` }}>
        {plans.map(([name, price, note, status], index) => (
          <div
            key={name}
            className="grid gap-3 px-4 py-5 sm:grid-cols-[135px_120px_1fr_auto] sm:items-center"
            style={{ borderTop: index === 0 ? "none" : `1px solid ${LINE}`, backgroundColor: index === 0 ? AMBER_BG : "#FFFFFF" }}
          >
            <div className="text-sm font-black">{name}</div>
            <div className="font-mono text-2xl font-black">{price}</div>
            <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{note}</div>
            <span
              className="w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              style={{ backgroundColor: index === 0 ? "#FFFFFF" : BLUE_BG, color: index === 0 ? INK : BLUE, border: `1px solid ${index === 0 ? YELLOW : LINE}` }}
            >
              {status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1fr] lg:items-start">
        <div>
          <div className="text-xs font-black uppercase tracking-widest" style={{ color: BLUE }}>included</div>
          <ul className="mt-3 grid gap-2 text-sm font-bold" style={{ color: MUTED }}>
            {["Scan books", "Save scan history", "Build a buy list", "Export CSV", "Add notes before buying"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 size={16} color={GREEN} />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <ButtonLink href={session ? hashForSection("dashboard") : publicPath("login")} tone="dark">
              {session ? "Go to dashboard" : "Create free account"}
            </ButtonLink>
          </div>
        </div>
        <div className="grid gap-3">
          {[
            ["Billing", "Stripe checkout and account billing are not connected yet."],
            ["Marketplace data", "Values are estimates until live pricing and fee data are connected."],
            ["Support", `${SUPPORT_EMAIL} is planned once the domain and inbox are secured.`],
          ].map(([title, body]) => (
            <div key={title} className="grid gap-2 py-3 sm:grid-cols-[150px_1fr]" style={{ borderBottom: `1px solid ${LINE}` }}>
              <div className="text-sm font-black">{title}</div>
              <div className="text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {valueChecks.map(([title, body]) => (
          <Feature key={title} icon={CheckCircle2} title={title} body={body} tone="plain" />
        ))}
      </div>
    </Band>
  );
}

function FaqPage() {
  return (
    <Band>
      <SectionTitle eyebrow="faq" title="Quick answers" />
      <div className="mt-6" style={{ borderTop: `1px solid ${LINE}` }}>
        {faqItems.map(([q, a]) => (
          <div key={q} className="py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex items-start gap-2">
              <HelpCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-black">{q}</div>
                <div className="mt-2 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>{a}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Band>
  );
}

function SecurityPage() {
  return (
    <>
      <Band>
        <SectionTitle
          eyebrow="security"
          title="Your scans are yours"
          body="When you create an account, your scanned books and notes are saved to your account."
        />
      </Band>
      <Band tone="blue">
        <div className="grid gap-3 sm:grid-cols-3">
          <Feature icon={Lock} title="Sign in" body="Use an account to save your scans." />
          <Feature icon={Database} title="Saved records" body="Your book list stays tied to your login." />
          <Feature icon={ShieldCheck} title="Before launch" body="We will check privacy and security before any paid release." />
        </div>
      </Band>
    </>
  );
}

function PrivacyPage() {
  return (
    <Band>
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Lock size={24} />
          <h1 className="text-3xl font-black uppercase tracking-widest">Privacy Policy</h1>
        </div>
        <p className="mt-4 text-sm font-bold" style={{ color: MUTED }}>Last updated: August 6, 2026</p>
        <div className="mt-6 flex flex-col gap-4 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
          <p>The app stores account information and scan data so users can test book-sourcing workflows. Scan records may include ISBNs, titles, estimated prices, book-check notes, and buying decisions entered by the user.</p>
          <p>Authentication and database storage are handled through Supabase. Data is intended to be private to the signed-in user, protected by row-level security policies in the project database.</p>
          <p>It does not currently process payments, sell user scan data, or claim live marketplace accuracy. If payment processing, analytics, or third-party marketplace integrations are added later, this policy should be checked and updated before launch.</p>
          <p>For deletion, export, or support requests during validation, use the account email associated with your test access and contact {SUPPORT_EMAIL}. This inbox is planned and should be activated before public launch.</p>
        </div>
      </div>
    </Band>
  );
}

function TermsPage() {
  return (
    <Band>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase tracking-widest">Terms</h1>
        <p className="mt-4 text-sm font-bold" style={{ color: MUTED }}>Last updated: August 6, 2026</p>
        <div className="mt-6 flex flex-col gap-4 text-sm font-bold leading-relaxed" style={{ color: MUTED }}>
          <p>This is an early tool for testing used-book sourcing. Estimated pricing, rank, velocity, eligibility, and fee data should be independently checked before any buying decision.</p>
          <p>Users are responsible for their own marketplace compliance, resale eligibility, inventory purchases, tax treatment, and shipping decisions.</p>
          <p>The beta may change as live data integrations, billing, and account controls are added. Planned pricing is $0 during beta, $15/month for Starter, and $29/month for Pro after the paid product is ready. Customer-facing terms should be checked before any paid public launch.</p>
          <p>For support, contact {SUPPORT_EMAIL}. This inbox is planned and should be activated before public launch.</p>
        </div>
      </div>
    </Band>
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
    <div className="min-h-screen w-full" style={{ backgroundColor: BG, color: INK }}>
      <StripeBar />
      <PublicNav route={route} session={session} onSignOut={onSignOut} />
      {pages[route] || pages.home}
      <PublicFooter />
    </div>
  );
}
