# @shelfmargin/core

Shared, framework-agnostic logic for Shelf Margin — the single source of truth for the
book-sourcing decision, imported by both the web app and the (future) iOS app so the
buy/check/pass verdict can never diverge. Pure modules only (no React/DOM/network):
isbn.js, profit.js, pricing.js, sessionSummary.js, types.js.

Imported today by relative path (e.g. ../../packages/core/profit.js). The @shelfmargin/core
name + exports map are here so this can be promoted to a linked npm workspace later
(run the linking `npm install` on macOS, then switch imports to @shelfmargin/core/*).

Guarded by the vitest specs in src/test/ (profit, pricing, sessionSummary, isbn-via-profit).
