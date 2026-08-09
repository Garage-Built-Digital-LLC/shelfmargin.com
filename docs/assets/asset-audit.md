# Asset Audit

## Project

- Project name: ShelfMargin
- Audit date: 2026-08-07
- Auditor: Codex, acting as GBD asset manager

## Audit Method

Reviewed Vite entry metadata, public assets, current routes, public site components, routed Ledger app views, auth page, legacy scanner component, CSS, and project docs. No browser screenshot capture was performed in this pass.

## Required Asset Checklist

| Asset category | Needed? | Current status | Priority | Notes |
|---|---:|---|---|---|
| Logo files | Yes | `needed` | High | Current brand exists only as live text + icon |
| Favicon/app icon | Yes | `needed` | High | Required before launch and iOS/PWA testing |
| Homepage hero image | Yes | `prompt_ready` | High | Use book-sourcing context plus current app mockup |
| Product mockups | Yes | `prompt_ready` | High | Capture real `/demo` screenshots first |
| Dashboard/app screenshots | Yes | `needed` | High | Needed for marketing, iOS App Store later, and credibility |
| Feature graphics | Yes | `prompt_ready` | Medium | Scanner/check-books/export workflow |
| Social OG images | Yes | `prompt_ready` | High | `index.html` has no image tags |
| Ad backgrounds | Later | `prompt_ready` | Low | Useful after offer and pricing are clearer |
| Email headers | Later | `needed` | Low | Only when transactional/marketing emails exist |
| Empty states | Yes | `prompt_ready` | Medium | Current empty states are icon-only |
| Loading states | No | current UI ok | Low | Text loading state is acceptable |
| Video assets | Later | `needed` | Low | Product walkthrough after workflow stabilizes |

## Route-Level Findings

| Route/component | Current visual state | Missing assets | Recommended action |
|---|---|---|---|
| `index.html` | Metadata text only | Favicon, Apple icon, app manifest, OG image, Twitter image | Add files after generation and update metadata |
| `/` in `PublicSite.jsx` | Strong copy plus React product preview | Real hero/product image and social preview | Generate hero and use app screenshot treatment |
| `/product` | Product copy plus same React preview | More credible product screenshot | Use captured demo screens in a device/mockup treatment |
| `/login` in `Auth.jsx` | Strong layout, no external asset | Brand mark and optional auth visual | Add logo and optional scanner/shelf-side visual |
| `#/dashboard` in `Ledger.jsx` | Functional cards/checklist | Optional empty/new-session graphic | Add restrained illustration only if it improves onboarding |
| `#/scout` in `Ledger.jsx` | Primary app workflow | Screenshot source, empty scan graphic | Capture live screen; add small empty state |
| `#/queue` | Functional empty state | Small buy-list empty visual | Optional medium-priority image |
| `#/check-books` | Most differentiated workflow | Feature graphic and screenshot | Prioritize screenshot/mockup here |
| `#/inventory` | Basic saved-list state | Small inventory empty visual | Optional |
| `src/components/App.jsx` | Legacy dark scanner app | Visual system drift | Treat as legacy unless still routed elsewhere |

## iOS App Consideration

Start with PWA/iOS home-screen readiness before native iOS:

- Add `manifest.webmanifest`.
- Add `apple-touch-icon.png` at 180x180.
- Add app icons at 192x192 and 512x512.
- Keep viewport/scanner behavior mobile-safe.
- Capture mobile screenshots at 390x844 and 430x932.
- Native iOS should wait until scanner workflow, live pricing source, account persistence, and paid value are proven.

## Launch Blockers

- `brand-logo-primary`
- `brand-mark`
- `favicon-svg`
- `apple-touch-icon`
- `pwa-icon-192`
- `pwa-icon-512`
- `social-og-default`
- `product-screenshot-scan`
- `product-screenshot-check-books`

## Post-Launch Assets

- Paid ad backgrounds
- Email headers
- Blog/editorial headers
- Video walkthrough
- Route-specific social images

## Notes For Prompt Pack

Prompts should use the current light shop-label palette, physical used-book sourcing context, scanner/barcode cues, and clear live-text safe zones. Avoid generated marketplace logos and avoid any visual that implies guaranteed profit or live pricing accuracy.
