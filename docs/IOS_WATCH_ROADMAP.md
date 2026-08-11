# Shelf Margin iOS and Apple Watch Roadmap

## Position

Shelf Margin should stay webapp-first until the scanner workflow, saved lists,
exports, pricing, and live data value are proven with real book resellers.

The iOS app is a second product surface, not the first milestone. The Apple
Watch experience is a companion to the iPhone app, not a standalone scanner.
Apple Watch alerts should be treated as a future paid feature, most likely in
the Pro plan once native iOS is ready.

## Why Wait

- The current risk is product value, not native app polish.
- A browser-based workflow is faster to test with real books and barcode scanners.
- Web SEO matters before App Store discovery.
- Billing, account history, and exports should be stable before native work.
- Watch alerts are useful only after the buy/check/pass signal is trusted.

## Build Order

1. Finish the core webapp workflow.
2. Prove real scanner sessions with physical books.
3. Wire live marketplace data behind the webapp.
4. Validate paid conversion on the web.
5. Build a PWA-quality mobile web experience.
6. Start the native iOS app when repeat usage is proven.
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

## Readiness Criteria

Start native iOS planning only when these are true:

- Real scanner tests show the workflow is useful.
- Saved scans and buy lists work reliably from the webapp.
- Live data source is connected or clearly scoped.
- Pricing is ready to test with real users.
- At least one reseller says mobile-native speed would improve sourcing.

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
