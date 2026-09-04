# ShelfMargin Asset Implementation Plan

## Rule

Generate and review assets first. Wire only approved or selected draft assets into runtime code after the files exist under `public/assets`.

## Runtime Wiring

| Asset ID | Public URL | Primary code location |
|---|---|---|
| `brand-logo-primary` | `/assets/brand/logo-primary.png` | `src/components/PublicSite.jsx`, `src/components/Auth.jsx` |
| `brand-mark` | `/assets/brand/brand-mark.png` | `src/components/PublicSite.jsx`, app shell header |
| `favicon-svg` | `/assets/icons/favicon.svg` | `index.html` |
| `apple-touch-icon` | `/assets/icons/apple-touch-icon.png` | `index.html` |
| `pwa-icon-192` | `/assets/icons/icon-192.png` | `public/manifest.webmanifest` |
| `pwa-icon-512` | `/assets/icons/icon-512.png` | `public/manifest.webmanifest` |
| `home-hero-desktop` | `/assets/images/home/home-hero-desktop.webp` | Homepage hero in `src/components/PublicSite.jsx` |
| `home-hero-mobile` | `/assets/images/home/home-hero-mobile.webp` | Homepage hero mobile crop in `src/components/PublicSite.jsx` |
| `product-screenshot-scan` | `/assets/images/product/app-screenshot-scan.webp` | Product page proof visual |
| `feature-notebook-workflow` | `/assets/images/features/feature-notebook-workflow.webp` | Product workflow section |
| `product-buy-list-notebook` | `/assets/images/product/buy-list-notebook.webp` | Product page after-scan section |
| `empty-state-scan` | `/assets/images/product/empty-state-scan.webp` | `src/components/Ledger.jsx` scan empty state |
| `empty-state-buy-list` | `/assets/images/product/empty-state-buy-list.webp` | `src/components/Ledger.jsx` queue/check-books empty states |
| `social-og-default` | `/assets/images/social/og-default.webp` | `index.html` Open Graph and Twitter metadata |
| `pricing-value-proof` | `/assets/images/product/pricing-value-proof.webp` | Pricing page proof section |
| `ios-app-store-scan` | `/assets/images/product/ios-app-store-scan.webp` | iOS planning/app-store source docs |

## Recommended Generation Order

1. Generate `brand-logo-primary` and `brand-mark`.
2. Pick/approve one brand direction.
3. Derive favicon, Apple touch icon, and PWA icons from the selected mark.
4. Generate homepage desktop/mobile hero assets.
5. Generate product screenshot and workflow visuals.
6. Generate empty states and social/ad assets.
7. Implement selected files in code.
8. Run `npm test`, `npm run build`, and browser visual QA at desktop and mobile widths.

## Metadata To Restore After Icons Exist

Add these back to `index.html` only after files exist:

```html
<link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg" />
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta property="og:image" content="/assets/images/social/og-default.webp" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:image" content="/assets/images/social/og-default.webp" />
```

Create `public/manifest.webmanifest` only after `icon-192.png` and `icon-512.png` exist.
