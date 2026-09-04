# ShelfMargin Asset Audit

## Current State

The rejected generated asset set was removed. The app currently uses code-rendered UI previews and lucide icons instead of runtime image assets.

## Needed Asset Set

| Priority | Asset ID | Placement | Save path |
|---:|---|---|---|
| 1 | `brand-logo-primary` | Header, auth, social source | `public/assets/brand/logo-primary.png` |
| 1 | `brand-mark` | Header icon, app mark source | `public/assets/brand/brand-mark.png` |
| 1 | `favicon-svg` | Browser tab | `public/assets/icons/favicon.svg` |
| 1 | `apple-touch-icon` | iOS home screen | `public/assets/icons/apple-touch-icon.png` |
| 1 | `pwa-icon-192` | Web app manifest | `public/assets/icons/icon-192.png` |
| 1 | `pwa-icon-512` | Web app manifest | `public/assets/icons/icon-512.png` |
| 1 | `home-hero-desktop` | Homepage first viewport | `public/assets/images/home/home-hero-desktop.webp` |
| 1 | `home-hero-mobile` | Mobile homepage first viewport | `public/assets/images/home/home-hero-mobile.webp` |
| 1 | `product-screenshot-scan` | Product page and scanner proof | `public/assets/images/product/app-screenshot-scan.webp` |
| 2 | `feature-notebook-workflow` | Workflow section | `public/assets/images/features/feature-notebook-workflow.webp` |
| 2 | `product-buy-list-notebook` | Product page buy-list proof | `public/assets/images/product/buy-list-notebook.webp` |
| 2 | `empty-state-scan` | App scan empty state | `public/assets/images/product/empty-state-scan.webp` |
| 2 | `empty-state-buy-list` | App buy-list empty state | `public/assets/images/product/empty-state-buy-list.webp` |
| 2 | `social-og-default` | Link preview | `public/assets/images/social/og-default.webp` |
| 3 | `pricing-value-proof` | Pricing page visual | `public/assets/images/product/pricing-value-proof.webp` |
| 3 | `ios-app-store-scan` | iOS/app-store screenshot source | `public/assets/images/product/ios-app-store-scan.webp` |

## Notes

- Logo/app-icon outputs may need manual vector cleanup after image generation.
- Product screenshots should preserve real app language where possible and avoid fake marketplace claims.
- Large hero images should leave negative space for live page text.
