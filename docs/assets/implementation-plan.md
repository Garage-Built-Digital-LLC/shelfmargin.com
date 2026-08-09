# Asset Implementation Plan

## Project

- Project name: ShelfMargin
- Date: 2026-08-07
- Manifest: `docs/assets/asset-manifest.json`
- Prompt pack: `docs/assets/prompt-pack.md`

## Instructions For Coding Agent

Read the manifest first. Implement only assets that exist at their expected `save_path`, unless the task is specifically to add metadata paths for generated files. Do not mark assets `implemented` or `approved` without file existence and user confirmation where required.

## Asset Placement

| Asset ID | Save path | Used in | Implementation type | Status |
|---|---|---|---|---|
| `brand-logo-primary` | `public/assets/brand/logo-primary.svg` | `PublicSite.jsx`, `Auth.jsx`, `Ledger.jsx` | Header/auth logo | `needed` |
| `brand-mark` | `public/assets/brand/brand-mark.png` | Icons/social source | Brand source image | `prompt_ready` |
| `favicon-svg` | `public/assets/icons/favicon.svg` | `index.html` | Favicon link | `needed` |
| `apple-touch-icon` | `public/assets/icons/apple-touch-icon.png` | `index.html` | iOS home-screen icon | `prompt_ready` |
| `pwa-icon-192` | `public/assets/icons/icon-192.png` | `manifest.webmanifest` | PWA icon | `prompt_ready` |
| `pwa-icon-512` | `public/assets/icons/icon-512.png` | `manifest.webmanifest` | PWA icon | `prompt_ready` |
| `home-hero-desktop` | `public/assets/images/home/home-hero-desktop.webp` | `PublicSite.jsx` | Responsive hero/product image | `prompt_ready` |
| `home-hero-mobile` | `public/assets/images/home/home-hero-mobile.webp` | `PublicSite.jsx` | Responsive mobile hero image | `prompt_ready` |
| `social-og-default` | `public/assets/images/social/og-default.webp` | `index.html` | OG/Twitter metadata | `prompt_ready` |
| `product-screenshot-scan` | `public/assets/images/product/app-screenshot-scan.webp` | `PublicSite.jsx` | Product screenshot/mockup | `needed` |
| `product-screenshot-check-books` | `public/assets/images/product/app-screenshot-check-books.webp` | `PublicSite.jsx` | Product screenshot/mockup | `needed` |
| `feature-scan-check-export` | `public/assets/images/features/feature-scan-check-export.webp` | `PublicSite.jsx` | Feature image | `prompt_ready` |
| `empty-state-scan` | `public/assets/images/product/empty-state-scan.webp` | `Ledger.jsx` | Empty-state inline image | `prompt_ready` |

## Immediate Implementation Sequence

1. Generate or design `brand-mark`, then derive favicon and app icons.
2. Add `index.html` links:
   - `/assets/icons/favicon.svg`
   - `/assets/icons/apple-touch-icon.png`
   - `/manifest.webmanifest`
3. Create `public/manifest.webmanifest` after icon files exist.
4. Generate `social-og-default` and update `index.html`:
   - `og:image`
   - `twitter:card` to `summary_large_image`
   - `twitter:image`
5. Capture real screenshots from `/demo#/scout` and `/demo#/check-books`.
6. Generate screenshot treatments from the real screenshots.
7. Add homepage/product imagery to `src/components/PublicSite.jsx` with stable aspect ratios and meaningful `alt` text.
8. Add the scan empty-state image to `Ledger.jsx` only if it improves the compact mobile layout.

## iOS/PWA Readiness Plan

Before considering a native iOS app, complete this webapp-first asset pass:

- Icons: 180x180, 192x192, 512x512.
- Manifest: `name`, `short_name`, `start_url`, `display`, `theme_color`, `background_color`, and icons.
- Screenshots: mobile portrait app screenshots for Scan and Check Books.
- Metadata: app title, description, social image, favicon, touch icon.
- Visual QA: iPhone-sized viewport at public home, login, demo scan, and check-books route.

Native iOS should come after field testing proves the workflow and live data/provider assumptions. The current public copy already says the webapp is first and iOS comes later.

## Screenshot Capture Guidance

Use current rendered UI as source, not generated fake app screens:

- `http://localhost:5173/demo#/scout`
- `http://localhost:5173/demo#/check-books`
- `http://localhost:5173/demo#/dashboard`

Capture at:

- 390x844 for iPhone 12/13/14 common viewport.
- 430x932 for large iPhone.
- 1440x1100 for desktop marketing context.

Redact real account email if using signed-in routes instead of demo.

## Verification Checklist

- Manifest paths exist for every implemented asset.
- `npm run build` passes after code references are added.
- Browser loads public home and app routes without broken image requests.
- Hero text remains readable on mobile and desktop.
- Product screenshot is inspectable and not distorted.
- iOS icon looks recognizable at 32x32 and 180x180.
- Metadata image URL resolves directly.

## User Generation Required

Generate or approve these first:

- `public/assets/brand/logo-primary.svg`
- `public/assets/brand/brand-mark.png`
- `public/assets/icons/favicon.svg`
- `public/assets/icons/apple-touch-icon.png`
- `public/assets/icons/icon-192.png`
- `public/assets/icons/icon-512.png`
- `public/assets/images/social/og-default.webp`
- `public/assets/images/home/home-hero-desktop.webp`
- `public/assets/images/home/home-hero-mobile.webp`
