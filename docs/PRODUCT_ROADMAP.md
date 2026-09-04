# Shelf Margin Product Roadmap

## Direction

Shelf Margin has a 30-day MVP build window. The first 14 days should finish the
webapp foundation, then native iOS work starts while the webapp continues to be
the source of truth for accounts, scan history, billing, and exports.

## Priorities

1. Webapp first.
2. Strong SEO for used-book reseller searches.
3. Real field testing with barcode scanners and real books.
4. Use one Amazon Professional month to prove live Amazon data quickly.
5. Paid plan only after users can see clear sourcing value.
6. Start iOS app development on day 14 with a narrow scanner-first scope.
7. Apple Watch companion alerts after iPhone scanning is reliable.

## 30-Day MVP Window

Days 1 to 14 are webapp-first:

- Finish auth, admin readiness, Stripe test billing, and Amazon sandbox proof.
- Connect ISBN scans to the server-side Amazon catalog boundary.
- Keep price/rank/profit labels honest until production Amazon data is verified.
- Tighten the public site so the product is clear enough for early users.
- Prepare the scanner field-test workflow and export evidence.

Days 14 to 30 add native iOS in parallel:

- Start a narrow iPhone scanner shell that uses the same account model.
- Reuse the webapp backend boundaries instead of creating a separate data model.
- Keep Apple Watch as a paid companion feature, not a blocker for the MVP.
- Use the last week to decide what can ship as beta and what stays internal.

## Amazon Professional Month

The Amazon Professional selling plan should be treated as a one-month validation
window because it adds a roughly $40/month operating cost.

During that month, the product work should focus on:

- Getting LWA credentials and refresh-token exchange working server-side.
- Connecting ISBN scans to live Amazon lookup results.
- Running 50 to 100 real book scans.
- Measuring lookup success rate, title match rate, scan speed, buy-list saves,
  CSV exports, and estimate accuracy.
- Deciding whether live Amazon data justifies keeping the Professional plan.

See `docs/AMAZON_PROFESSIONAL_MONTH_PLAN.md` for the sprint plan and
keep-or-cancel criteria.

## Webapp First

- Keep the core scanner workflow fast in mobile browsers.
- Keep account, admin, scan history, buy list, and exports web-based first.
- Use saved scan timestamps for session history before adding a heavier session table.
- Make the app installable later as a PWA before committing to native iOS.
- Avoid iOS-only assumptions in the product model.

## SEO Plan

- Build public pages that answer simple reseller intent:
  - used book scanner app
  - book reseller profit calculator
  - ISBN scanner for resellers
  - Amazon book sourcing tool
  - book buy list app
- Public pages use real paths like `/pricing`, `/faq`, and `/privacy` locally.
- Keep app-only routes hash-based for now so scanner navigation stays simple.
- Add useful articles only after the product pages are clear.
- Keep every SEO page honest about estimated data until live data is connected.

## Profitability Plan

- Prove that users can find or avoid enough buys to justify payment.
- Do not treat the Amazon Professional plan as permanent until live scanner
  tests prove it pays for itself.
- Track real scans, checked books, buy-list saves, exports, and repeat use.
- Use `src/lib/mvpReadiness.js` as the local evidence model for deciding when
  the product is ready for paid beta, live-data spend, and later iOS planning.
- Use a simple pricing ladder: free beta, $15/month Starter, and $29/month Pro
  after live data is useful.
- Treat Apple Watch alerts as a future paid Pro feature, not a free beta
  promise.
- Do not add a team plan yet; keep the offer focused on solo book resellers.
- Avoid building expensive native apps, complex dashboards, or marketplace
  automation before the core sourcing workflow pays for itself.

## iOS Starts Day 14

The first iOS build should start on day 14, but stay narrow:

- Sign in.
- Scan ISBNs.
- Show buy, check, or pass.
- Save to the cloud-backed buy list.
- Sync with the webapp.
- Leave Apple Watch alerts for the paid Pro path once iPhone scanning works.

See `docs/IOS_WATCH_ROADMAP.md` for the iOS and Apple Watch build sequence.
