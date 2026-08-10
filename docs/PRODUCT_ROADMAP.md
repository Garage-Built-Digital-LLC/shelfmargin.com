# Shelf Margin Product Roadmap

## Direction

Shelf Margin is a webapp first. The first profitable product should work in a
browser on desktop and mobile before we build a native iOS app.

## Priorities

1. Webapp first.
2. Strong SEO for used-book reseller searches.
3. Real field testing with barcode scanners and real books.
4. Live marketplace data after the workflow is proven.
5. Paid plan only after users can see clear sourcing value.
6. iOS app after the webapp has a proven workflow and retention.
7. Apple Watch companion alerts after iPhone scanning is reliable.

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
  - Amazon and eBay book sourcing tool
  - book buy list app
- Public pages use real paths like `/pricing`, `/faq`, and `/privacy` locally.
- Keep app-only routes hash-based for now so scanner navigation stays simple.
- Add useful articles only after the product pages are clear.
- Keep every SEO page honest about estimated data until live data is connected.

## Profitability Plan

- Prove that users can find or avoid enough buys to justify payment.
- Track real scans, checked books, buy-list saves, exports, and repeat use.
- Use a simple pricing ladder: free beta, $15/month Starter, and $29/month Pro
  after live data is useful.
- Do not add a team plan yet; keep the offer focused on solo book resellers.
- Avoid building expensive native apps, complex dashboards, or marketplace
  automation before the core sourcing workflow pays for itself.

## iOS Later

The iOS app should wait until:

- The web scanner workflow is stable.
- Real scanner tests show repeated use.
- Live data is connected.
- Pricing is validated.
- Users ask for camera scanning, push reminders, or offline sourcing enough to
  justify native development.

See `docs/IOS_WATCH_ROADMAP.md` for the iOS and Apple Watch build sequence.
