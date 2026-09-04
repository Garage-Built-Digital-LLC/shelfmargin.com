# Shelf Margin iOS and Apple Watch Roadmap

## Position

Shelf Margin is in a 30-day MVP build window. The webapp remains first because
it owns accounts, admin readiness, billing, scan history, exports, and Amazon
integration. Native iOS development starts on day 14 with a narrow scanner-first
scope.

The iOS app is a second product surface, not the first milestone. The Apple
Watch experience is a companion to the iPhone app, not a standalone scanner.
Apple Watch alerts should be treated as a future paid feature, most likely in
the Pro plan once native iOS is ready.

## Why Webapp First For 14 Days

- The current risk is product value, not native app polish.
- A browser-based workflow is faster to test with real books and barcode scanners.
- Web SEO matters before App Store discovery.
- Billing, account history, and exports should be stable before native work.
- Watch alerts are useful only after the buy/check/pass signal is trusted.

## Build Order

1. Finish the core webapp workflow in days 1 to 14.
2. Prove Amazon sandbox auth and catalog lookup server-side.
3. Prepare real scanner sessions with physical books.
4. Tighten billing, scan history, buy list, and exports on the web.
5. Start native iOS on day 14 with sign-in, ISBN scan, result, and save.
6. Keep production Amazon pricing/fees and beta user proof moving in parallel.
7. Add Apple Watch companion alerts as a paid Pro feature after iPhone scanning
   is reliable.

## iOS App Scope

The first iOS version should be narrow:

- Sign in to the same Shelf Margin account.
- Scan ISBNs with the phone camera or an external scanner.
- Show the same buy, check, or pass decision.
- Save books to the same cloud-backed buy list.
- Sync scan history with the webapp.
- Export or send lists from the account, not from isolated phone storage.

Avoid adding marketplace automation, complex dashboards, or team features in
the first native version.

## Apple Watch Scope

The Apple Watch should reduce phone-checking during sourcing.

Expected flow:

1. The reseller scans an ISBN on iPhone.
2. Shelf Margin calculates the decision.
3. The watch gives a haptic alert.
4. The watch shows a short result:
   - `BUY +$11.42`
   - `CHECK rank`
   - `PASS -$0.80`
5. The user can glance, keep moving, and review details later on the phone.

The watch should not be responsible for scanning, deep research, account setup,
billing, exports, or admin tools.

## Pricing Position

Apple Watch alerts are not part of the free beta or first Starter plan. They
should be reserved for a paid tier because they only become valuable after the
user is scanning enough books that phone-checking slows them down.

Current pricing position:

- Free beta: scanner workflow, scan history, buy list, exports, and field tests.
- Starter: planned $15/month solo reseller plan after live data is useful.
- Pro: planned $29/month plan for higher-volume workflows, including future
  Apple Watch alerts after the iOS app exists.

## Watch Result Design

Each watch notification should stay simple:

- Decision: buy, check, or pass.
- Estimated profit.
- Short book title when available.
- One reason, such as low profit, needs rank check, or good margin.
- Optional haptic pattern by decision type.

No long explanations, charts, or full marketplace detail on the watch.

## Day 14 Start Criteria

Start native iOS work on day 14 if these are true:

- The web scanner can accept real ISBNs reliably.
- Saved scans and buy lists work reliably from the webapp.
- Amazon sandbox auth is verified and production data is clearly scoped.
- Pricing labels still distinguish estimated data from live data.
- The iOS scope is limited to sign-in, scan, decision, save, and sync.

Start Apple Watch work only when these are true:

- iPhone scan decisions are fast and trusted.
- Users scan enough books per session that phone-checking becomes annoying.
- The decision can be summarized in one short line.
- The account sync model is stable.

## Owner Inputs Needed

- Decide whether the first iOS scanner should prioritize phone camera scanning,
  Bluetooth scanner input, or both.
- Field test how often users need a watch glance versus a phone glance.
- Decide the exact haptic/alert behavior after real sourcing sessions.
- Confirm Apple Developer Program enrollment before App Store release work.
- Decide whether iOS launch should wait for paid web users or start after beta
  usage is proven.
