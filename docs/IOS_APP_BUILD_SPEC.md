# Shelf Margin iOS — Build-Ready Spec

The third planning doc. `IOS_APP_BUILD_PLAN.md` says *when* (2-week sprint),
`IOS_APP_TECHNICAL_PLAN.md` says *how* and *what to consider*; this doc is what you
code from — exact data contracts, repo layout, per-screen specs, and an ordered backlog.
Everything here is grounded in the current Shelf Margin schema and `profit.js`, so the
app matches the webapp's decisions exactly.

Framework: Expo / React Native. The app is a thin client over the existing Supabase +
Node backend. No new data model.

---

## 1. Pre-Build Readiness Checklist

Settle or start these before day 1. The first two shape all the code; the rest run as
parallel owner tasks.

Blocking-shape decisions (settle first):
- Repo structure: monorepo with a shared `core` package (recommended — see section 2).
- Environment separation: does the beta hit the production Supabase project or a
  separate/staging one? Pick before any writes happen (section 6).

Product / data risk (know before trusting decisions):
- Is live Amazon catalog + pricing proven, or still estimated? Keep honesty labels until
  verified. Building the shell against estimates is fine in parallel.
- Real decision inputs: average `cost_per_book` and `buy_threshold` (min profit worth buying).

Parallel owner tasks (needed to ship, not to code):
- Live privacy policy URL (reuse webapp `/privacy`) — Apple requires it for account apps.
- Activate `support@shelfmargin.com` inbox.
- Secure `shelfmargin.com` domain.
- Confirm App Store app name availability + reserve a bundle identifier
  (e.g. `com.shelfmargin.app`).
- Business identity: Shelf Margin is branded independently of Garage Built Digital. A
  "Shelf Margin" DBA (owner task, business/legal decision) sets the App Store **seller name**
  shown to users and the entity the Apple Developer account enrolls under; the bundle id and
  app name follow the Shelf Margin brand, not GBD.
- Bluetooth scanner model for field testing.
- Apple Developer enrollment — deferred by owner to ~Day 9 (TestFlight gate); start a few
  days ahead so approval lands in time.

---

## 2. Repository Structure (Monorepo)

Goal: web and iOS share one copy of the decision logic so they can never drift. Extract the
pure logic into an internal package both consume.

```
shelfmargin/                (repo root)
  packages/
    core/                   NEW — shared, framework-agnostic logic (no React, no DOM)
      isbn.js
      profit.js
      pricing.js
      sessionSummary.js
      providers/types.js
      package.json          ("@shelfmargin/core")
  apps/
    web/                    the existing React/Vite app (moves here)
      src/... (imports @shelfmargin/core instead of ../lib)
      server.mjs
    mobile/                 NEW — the Expo app
      ...
```

Notes:
- Keep the move mechanical: `core` is only files with zero web/native dependencies. Anything
  touching the DOM, `fetch` wiring, Supabase client, or React stays in its app.
- If a full monorepo move feels risky mid-flight, the minimum viable version is: create
  `packages/core`, move the pure files there, and have both apps import it. The web app's
  test suite (`profit.test.js`, `isbn.test.js`, etc.) moves with `core` and keeps guarding it.
- One `@shelfmargin/core` version, imported by both — this is the anti-drift guarantee.

---

## 3. Data & API Contract

The exact shapes the app depends on. Do not re-derive these in the app; import the types and
`evaluate` from `@shelfmargin/core`.

### 3.1 Catalog lookup → `BookData`

`GET {API_BASE_URL}/api/catalog?isbn=<isbn13>` returns `BookData | null` (null = no match /
non-book):

```
BookData = {
  isbn: string,            // normalized ISBN-13
  title: string,
  author: string,
  amazonPrice: number|null,  // estimated until pricing is wired
  amazonBsr: number|null,    // estimated until sales-rank is wired
  gated: boolean,            // restricted/gated category heads-up
  source: string,            // 'mock' | 'estimated' | 'amazon-sp-api-*'
  catalogSource: string,     // where title/author/ASIN came from
  priceSource: string,       // 'estimated' until pricing endpoint is wired
}
```

Live Amazon path: `GET {API_BASE_URL}/api/amazon/catalog?isbn=<isbn13>` and status at
`GET {API_BASE_URL}/api/amazon/status`. Keep secrets server-side; the app only calls these URLs.

### 3.2 Decision engine — `evaluate(book, settings)` (from core)

Input `book`: `{ amazonPrice, ebayPrice, amazonBsr, gated }` (map `BookData` → this; `ebayPrice`
is null in Amazon-only v1). Input `settings`:

```
settings = {
  costPerBook,          // from profiles.cost_per_book
  buyThreshold = 5,     // from profiles.buy_threshold
  feeModel,             // DEFAULT_FEE_MODEL unless overridden
  velocityThresholds,   // DEFAULT_VELOCITY_THRESHOLDS { fast:250000, medium:1000000 }
}
```

Returns the verdict the UI renders:

```
{
  amazonNet, ebayNet,            // number|null
  recommendedPlatform,           // 'amazon' | 'ebay' | null
  bestNet,                       // number|null
  velocity,                      // 'fast'|'medium'|'slow'|'unknown'
  status,                        // 'buy' | 'pass' | 'check'   ← the decision
  gated,                         // boolean
}
```

Rules baked in: `gated` forces `check`; no price data → `pass`; otherwise `buy` if
`bestNet >= buyThreshold`, else `pass`.

### 3.3 Tables (Supabase, all RLS-scoped to `auth.uid()`)

`profiles` (user settings — drives Settings screen and `evaluate` settings):
`cost_per_book` (num, def 1.00), `buy_threshold` (num, def 5.00),
`default_condition` ('new'|'used-good'|'used-acceptable'), `sound_enabled` (bool),
`trial_scans_used` (int, successful distinct lookups only), `subscription_status`
('trial'|'active'|'expired'). Column GRANTs block the client from writing role /
subscription_status / trial_scans_used.

`scans` (one saved scan; write a full snapshot at save time):
`isbn`, `title`, `author`, `condition` (def 'used-good'), `cost_per_book` (snapshot),
`amazon_price`, `ebay_price`, `ebay_price_basis` ('sold-median'|'active-median'),
`amazon_bsr`, `amazon_net`, `ebay_net`, `recommended_platform` ('amazon'|'ebay'),
`velocity`, `status` ('buy'|'pass'|'check'), `restricted` (bool), `copy_count` (def 1),
`bin_location`, `lifecycle_status` ('scouted'|'purchased'|'listed'|'sold'|'shipped', def
'scouted'), `session_id` (groups a sourcing run), `created_at`.

`scan_verifications` (the "book check" — one per scan, PK = scan_id):
`actual_source_checked`, `amazon_eligible`, `amazon_actual_price`, `amazon_actual_rank`,
`ebay_sold_comp`, `actual_shipping`, `actual_fees`, `actual_net`, `real_decision`
(''|'buy'|'pass'|'watch'), `notes`.

`billing_accounts`: app read-only; shows plan/subscription status.

### 3.4 Repo functions to reuse (`scansRepo.js`, via the RN Supabase client)

`currentUserId()`, `getProfile()`, `updateProfile(patch)`, `fetchScans()`, `insertScan(row)`,
`updateScan(id, patch)` (only `copy_count` / `condition` / `lifecycle_status` are writable),
`deleteAllScans()`, `fetchScanVerifications()`, `upsertScanVerification(scanId, patch)`.

### 3.5 Account endpoints

`GET {API_BASE_URL}/api/account/export` (data export), `POST {API_BASE_URL}/api/account/delete`
(calls `delete_own_account()`; cascades the caller's rows). Both scoped by the user's own bearer
token. The app must surface both (Apple requires in-app deletion).

---

## 4. Screen Specs

Each screen: purpose · data in · actions · states · reuse. Semantics mirror `Ledger.jsx`.

### Auth
- Purpose: sign in / sign up / sign out; persist session.
- Data: Supabase Auth (email/password).
- Actions: sign in, sign up (password min 10, matching web), sign out.
- States: signed-out, loading, error (invalid creds / rate-limited), signed-in.
- Reuse: Supabase client + SecureStore session adapter.

### Scan (home)
- Purpose: turn a barcode/ISBN into a decision fast.
- Data in: camera EAN-13 reads; Bluetooth HID input; manual entry. Normalize via
  `isbn.js`; look up via `/api/catalog`; evaluate via `core`.
- Actions: scan, retry, save to buy list, adjust copy count, jump to result.
- States: idle/viewfinder, scanning, looking-up, result, no-match (null), duplicate (already
  scanned this session — show copy count), trial-limit-reached, offline/queued, error.
- Reuse: `isbn.js`, `evaluate`, catalog fetch; new native camera + hidden-input capture.

### Result
- Purpose: show the verdict and why.
- Data in: the `evaluate` verdict + `BookData`.
- Display: `status` (buy/pass/check) prominent, `bestNet` estimated profit,
  `recommendedPlatform`, `velocity` badge, estimate/data-source badge, one reason line,
  gated warning. Distinct haptic + sound per status.
- Actions: save (writes the full `scans` snapshot), open book-check, next scan.
- States: buy / pass / check / gated; estimated vs live labeling.
- Reuse: `ResultCard` semantics; new haptics via `expo-haptics`, sound via `expo-av`.

### Buy list / History (the Ledger)
- Purpose: review saved scans, sessions, and checks.
- Data in: `fetchScans()`, `fetchScanVerifications()`, `sessionSummary.js`.
- Actions: filter by status, edit `copy_count`/`condition`/`lifecycle_status`, open a book
  check, view session summary. (CSV export stays web in v1 — link out or note it.)
- States: empty, loading, list, per-item detail, offline (from cache).
- Reuse: `scansRepo` reads, `sessionSummary`; new native list UI.

### Book check (verification)
- Purpose: record real marketplace check vs the estimate.
- Data in / out: `scan_verifications` via `upsertScanVerification(scanId, patch)`.
- Actions: set `actual_source_checked`, `amazon_eligible`, actual price/rank/fees,
  `real_decision`, notes.
- Reuse: `scansRepo` verification functions.

### Settings
- Purpose: the inputs that make decisions real + account actions.
- Data in/out: `getProfile()` / `updateProfile()` for `cost_per_book`, `buy_threshold`,
  `default_condition`, `sound_enabled`.
- Also: plan/trial status (read-only from `billing_accounts` + `trial_scans_used`),
  Export my data, Delete account, Sign out.
- States: loaded, saving, saved, error.

---

## 5. Environment & Config Matrix

No hardcoded URLs or keys. Per environment supply: `API_BASE_URL`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`. Ship the anon key (public by design, RLS-gated); never ship
service-role / Stripe / Amazon secrets.

| Config            | Dev                          | Prod / Beta                    |
|-------------------|------------------------------|--------------------------------|
| API_BASE_URL      | local/hosted dev API         | stable hosted prod API (TLS)   |
| Supabase project  | dev or staging project       | decision needed (section 1)    |
| Supabase anon key | dev project anon key         | prod project anon key          |
| Crash reporting   | off or dev DSN               | prod DSN (PII scrubbed)        |

---

## 6. Implementation Backlog (ordered, maps to the 2-week sprint)

Work top to bottom. Bracketed day matches `IOS_APP_BUILD_PLAN.md`. Everything through the
TestFlight step is buildable/testable in Expo Go with no Apple account.

Foundation
1. [pre] Create `packages/core`; move `isbn.js`, `profit.js`, `pricing.js`, `sessionSummary.js`,
   `providers/types.js`; point the web app at `@shelfmargin/core`; move their tests; green suite.
2. [D1] Scaffold Expo app under `apps/mobile`; set up env config; run blank app on device via
   Expo Go.
3. [D1] EAS project init (build config only; no paid account needed until a signed build).

Auth + backend reachability
4. [D2] Supabase client with SecureStore session adapter; Auth screen; persisted session;
   same account works on web + app.
5. [D3] Deploy `server.mjs` to a stable `API_BASE_URL`; add CORS; app confirms `/api/catalog`
   returns `BookData` for a known ISBN.

Scan → decide → save
6. [D4] Camera EAN-13 scanning; normalize via `isbn.js`; lookup; handle null / duplicate.
7. [D5] Result screen from `evaluate` verdict; estimate/data-source badges; per-status
   haptic + sound.
8. [D6] Bluetooth scanner path (hidden focused input, Enter to submit); shared with camera.
9. [D7] Save full `scans` snapshot via `insertScan`; History list via `fetchScans`; confirm
   rows appear in the webapp (sync proof).

Hardening + beta
10. [D8] Duplicate/copy-count handling, offline write queue (idempotent, client-generated ids),
    session persistence, empty/error states, read-only plan/trial status, app icon + splash.
11. [D8] Book-check screen via `upsertScanVerification`; Settings screen (`updateProfile`),
    Export + Delete account actions.
12. [D9] EAS signed build → first TestFlight upload; App Store Connect record + privacy
    questionnaire; owner installs.
13. [D10] Field test 20–50 real books; log title-match + decision accuracy vs webapp; fix top
    issues; ship updated build.

---

## 7. Test Plan

- Shared logic: the existing vitest suite guards `core` (`profit.test.js`, `isbn.test.js`,
  `pricing.test.js`, `sessionSummary.test.js`) — must stay green after the move.
- App logic: thin interaction tests for the scan flow (normalize → lookup → evaluate → save
  shape).
- Sync: assert a scan saved in the app appears in the webapp and vice versa.
- Field test (decisive): 20–50 real books; record title-match rate and whether the app's
  buy/check/pass matches a manual marketplace check. Feed results into `mvpReadiness.js` metrics.

## 8. Definition of Done (v1 beta)

Signed-in user can scan (camera + Bluetooth), get an accurate buy/check/pass with estimated
profit, save it, and see the same data in the webapp. A TestFlight build installs for the owner
and one external tester. 20–50 real-book scans logged. No regressions to web accounts, RLS, or
billing. Shared logic lives in one `@shelfmargin/core` package consumed by both surfaces.

## 9. Open Decisions To Close Before Day 1

1. Monorepo `core` extraction now, or a lighter shared-file setup? (Recommend: do it.)
2. Beta on production Supabase or a separate/staging project?
3. API host: Vercel vs the existing Docker host?
4. v1 shows eBay alongside Amazon, or Amazon-only? (`evaluate` already handles a null eBay price.)
5. Bundle identifier + confirmed App Store app name.
