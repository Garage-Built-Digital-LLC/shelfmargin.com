# Shelf Margin iOS App — Build Plan (v1 to TestFlight)

## Goal

Ship a narrow, scanner-first iOS app to TestFlight in ~2 weeks that lets a used-book
reseller sign in, scan an ISBN (phone camera or Bluetooth scanner), see the same
buy / check / pass decision the webapp gives, save it to the cloud-backed buy list,
and have it sync with the webapp. Everything else waits.

This app is treated as make-or-break, so the plan optimizes for speed to a testable
build in real hands, with the webapp remaining the source of truth for accounts,
scan history, billing, and exports.

## Decisions Locked In

- Framework: React Native via Expo (rationale below).
- Scan input: phone camera AND Bluetooth scanner in v1.
- Target: TestFlight beta in ~2 weeks (aggressive, narrow scope).
- Apple Developer Program: not yet enrolled — this is on the critical path and must
  start day 1 (see Owner Critical Path).
- Apple Watch: explicitly out of v1, deferred to a paid Pro companion later.

## Why Expo / React Native

- Reuse, not rewrite. Shelf Margin's client logic is plain JavaScript and framework
  agnostic: `src/lib/isbn.js`, `src/lib/profit.js`, `src/lib/pricing.js`,
  `src/providers/*`, `src/lib/scansRepo.js`, and the Supabase client can move into the
  app largely as-is. A Swift app would rebuild all of this from scratch.
- One backend, one contract. The app calls the same server boundaries the webapp uses
  (`/api/catalog`, `/api/amazon/catalog`), so Amazon secrets stay server-side and the
  buy/check/pass logic stays identical across web and iOS.
- Ships without a Mac. Expo Application Services (EAS) builds and submits to TestFlight
  from the cloud, removing a hardware blocker from the 2-week window.
- Camera + Bluetooth both covered. `expo-camera` reads EAN-13 (the ISBN barcode) natively;
  a Bluetooth scanner behaves as a keyboard (HID), captured by a hidden focused input —
  the same pattern the webapp already uses.
- Trade-off accepted: the Apple Watch companion is weaker in React Native than in Swift.
  Because Watch is deferred, this does not affect v1. If Watch later proves central, it
  can be built as a thin native Swift/WatchKit module that reads the same synced data.

## Architecture — How iOS Talks To What Exists

The app is a thin client over the existing backend. Nothing about the data model changes.

- Auth: Supabase email/password via `@supabase/supabase-js` with an AsyncStorage session
  adapter. Same accounts, same RLS. The admin role, trial limits, and subscription status
  all continue to be enforced server-side and by RLS exactly as they are on web.
- Catalog + decision: the app sends a normalized ISBN-13 to the hosted `/api/catalog`
  endpoint, receives the `BookData` shape defined in `src/providers/types.js`, and runs
  the shared `profit.js` engine to produce buy / check / pass plus estimated profit.
- Buy list + scan history: written through the same Supabase tables (`scans`,
  `scan_verifications`, buy list) via reused `scansRepo.js` logic. RLS scopes every row to
  the signed-in user, so sync with the webapp is automatic — same rows, two surfaces.
- Billing: read-only in v1. The app can show plan/trial status from `billing_accounts`
  (browser/app read-only, service-role written), but Stripe checkout stays on the web for
  v1 to avoid App Store in-app-purchase entanglements (see Risks).

Reuse map (copy/share into the app):

- Direct reuse: `isbn.js`, `profit.js`, `pricing.js`, `providers/types.js`,
  `providers/liveProvider.js` (network layer swapped for the hosted API), `sessionSummary.js`.
- Adapt lightly: `supabase.js` (add AsyncStorage storage adapter), `scansRepo.js`
  (same queries, RN Supabase client).
- Do not port to v1: admin tools, CSV export UI (stays web), Stripe checkout UI, public
  SEO site.

## Backend Gaps To Close For Mobile

These are small but real; the app cannot ship without them.

1. A hosted, stable API base URL. The app needs an absolute origin for `/api/*` (the webapp
   calls it same-origin today). Deploy `server.mjs` to a fixed URL (Vercel/Docker host)
   and point the app at it via an env-configured `API_BASE_URL`.
2. CORS / origin allowance for the native app's requests to `/api/*`.
3. Confirm Supabase Auth settings are mobile-ready (redirect URLs if magic links are ever
   used; email/password needs nothing special). Note the pending security items in
   `docs/SECURITY_AUDIT.md` (leaked-password protection, password min, MFA) — none block
   the beta but should be closed before public launch.
4. Amazon data honesty. Labels must keep distinguishing estimated vs live data on iOS just
   as on web, until production Amazon pricing is verified.

## Two-Week Sprint (10 working days)

Week 1 — from zero to scanning against real data.

- Day 1: Owner starts Apple Developer enrollment (see Critical Path). Scaffold the Expo app,
  wire EAS project, set `API_BASE_URL`, get a blank app running on a physical iPhone via
  Expo Go / dev build.
- Day 2: Supabase auth in the app — sign in / sign up / sign out, persisted session,
  gated "signed-in" state. Verify the same account works on web and app.
- Day 3: Deploy the API to a stable URL, add CORS, and confirm the app can call
  `/api/catalog` and get the `BookData` shape back for a known ISBN.
- Day 4: Camera scanning — `expo-camera` reading EAN-13, normalize via `isbn.js`, one clean
  scan → catalog lookup → result. Handle no-match / phantom scans.
- Day 5: Result screen — reuse `profit.js` to render buy / check / pass + estimated profit,
  matching the webapp's `ResultCard` semantics. Estimated-vs-live labeling intact.

Week 2 — from scanning to a beta build in real hands.

- Day 6: Bluetooth scanner path — hidden focused input capturing HID keyboard reads, Enter
  to submit, shared with the camera path. Test with the actual scanner you field-test with.
- Day 7: Save to buy list via reused `scansRepo.js`; scan history list; confirm rows appear
  in the webapp (sync proof).
- Day 8: Hardening — duplicate detection, offline/error states, session persistence,
  empty states, basic app icon + splash. Read-only plan/trial status display.
- Day 9: EAS build + first TestFlight upload. Run the App Store Connect setup (app record,
  privacy questionnaire, beta test info). Internal install on your device.
- Day 10: Real field test — scan 20–50 real books on the app, log title-match and decision
  accuracy against the webapp, fix top issues, ship an updated TestFlight build.

## v1 Scope

In scope:

- Sign in to the same Shelf Margin account.
- Scan ISBNs by phone camera or Bluetooth scanner.
- Buy / check / pass decision + estimated profit, identical logic to web.
- Save to the cloud-backed buy list; view scan history; sync with webapp.
- Read-only plan/trial status.

Explicitly out of scope for v1 (protect the timeline):

- Apple Watch companion / haptic alerts.
- In-app Stripe purchase / plan upgrades (checkout stays on web).
- CSV export UI, admin tools, public SEO pages.
- Marketplace automation, dashboards, team features.

## Owner Critical Path (do these, in this order)

1. Start Apple Developer Program enrollment today — approval can take a few days and blocks
   TestFlight. This is the single most time-sensitive owner task.
2. Confirm the hosting target for the API (Vercel or Docker host) so it gets a stable URL.
3. Provide the Bluetooth scanner model you plan to field test with.
4. Provide the two test inputs the decision engine needs to be realistic: average cost per
   book and minimum profit worth buying.
5. Keep Amazon in the agreed one-month Professional validation posture; keep estimated-vs-live
   labels honest in the app.

## Risks And Mitigations

- Apple Developer approval delay → start day 1; all non-TestFlight work proceeds in parallel
  so approval is never the thing everyone waits on.
- In-app purchase policy → v1 keeps paid upgrades on the web to avoid Apple's IAP requirement
  and review friction; revisit for a later version.
- Camera scan reliability on worn/damaged barcodes → Bluetooth scanner path is the fallback,
  and both are in v1 for exactly this reason.
- Estimated vs live Amazon data → do not imply live pricing in the app until production Amazon
  data is verified; keep the honesty labels.
- Scope creep → the "explicitly out of scope" list is the contract; anything new goes to v1.1.

## Definition Of Done (v1 beta)

- A signed-in user can scan (camera and Bluetooth), get an accurate buy/check/pass decision,
  save it, and see the same data in the webapp.
- A TestFlight build is installable by the owner and at least one external tester.
- 20–50 real-book field scans logged with title-match and decision-accuracy notes.
- No regressions to webapp accounts, RLS, or billing.

## After v1

- Close the pending Auth security items before public App Store launch.
- App Store submission (screenshots, privacy nutrition labels, review notes).
- Apple Watch companion alerts as a paid Pro feature once iPhone scanning is trusted and
  sourcing volume makes phone-checking the bottleneck.
- Revisit in-app plan upgrades if App Store distribution warrants it.
