# Asset Prompt Pack

## Project

- Project name: ShelfMargin
- Prompt pack date: 2026-08-07
- Brand profile: `docs/assets/brand-profile.md`
- Manifest: `docs/assets/asset-manifest.json`

## Global Style Rules

```text
Used-book reseller field workflow, mobile-first scanner app, practical shop-label aesthetic, warm paper background, heavy ink linework, shelf yellow accent, trust blue secondary action, buy green and pass red decision cues, realistic book stacks, barcode scanner, thrift store or library-sale sourcing context, clean copy-safe space, professional and operational.
```

## Global Negative Prompt

```text
No random decorative clutter, no fake unreadable UI text, no glossy startup gradient look, no pastel SaaS illustration style, no floating abstract shapes, no cartoon mascot, no generic stock-photo handshake, no fake marketplace logos, no guaranteed profit claims, no tiny illegible typography, no busy barcode texture behind important text.
```

## Primary ShelfMargin Logo

- Asset ID: `brand-logo-primary`
- Purpose: Exportable logo for site header, auth page, future social creative, and docs.
- Dimensions: `vector`
- File name: `logo-primary.svg`
- Save path: `public/assets/brand/logo-primary.svg`

### Main Prompt

```text
Create a clean vector-style logo concept for ShelfMargin, a scanner-first app for used-book resellers. Combine a simple barcode scanner or shelf-label mark with a strong readable ShelfMargin wordmark. Use warm paper, black ink, shelf yellow, and restrained trust blue accents. The logo should feel practical, fast, and professional, like a field tool for book sourcing and resale math. Keep it flat, high contrast, and readable in a small web header.
```

### Negative Prompt

```text
No fake marketplace logos, no cartoon books, no cute mascot, no complex 3D rendering, no glossy gradient, no tiny unreadable barcode detail, no ornate typography.
```

### Implementation Notes

Keep as draft until user approval. If the generator cannot output clean SVG, generate a high-resolution PNG concept and redraw or vectorize manually before implementation.

## ShelfMargin App Mark

- Asset ID: `brand-mark`
- Purpose: Source mark for favicon, app icons, social card accent, and future native iOS.
- Dimensions: `1024x1024`
- File name: `brand-mark.png`
- Save path: `public/assets/brand/brand-mark.png`

### Main Prompt

```text
Create a simple square app mark for ShelfMargin. Use a bold black scanner beam crossing a book spine or shelf label, with one clean barcode-like cue and a small shelf yellow accent. Background should be warm paper `#F6F5F0`; linework should be ink black `#151512`; optional trust blue `#1F5FAD` detail. The mark must remain recognizable at 32x32 and work as an iOS app icon source.
```

### Negative Prompt

```text
No text, no detailed bookshelf scene, no fake logos, no thin unreadable barcode lines, no glossy 3D icon, no gradients, no clutter.
```

## iOS And PWA Icons

- Asset IDs: `apple-touch-icon`, `pwa-icon-192`, `pwa-icon-512`
- Purpose: iOS home-screen and installable app identity.
- Dimensions: `180x180`, `192x192`, `512x512`
- File names: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- Save paths: `public/assets/icons/apple-touch-icon.png`, `public/assets/icons/icon-192.png`, `public/assets/icons/icon-512.png`

### Main Prompt

```text
Using the approved ShelfMargin app mark direction, create app icon exports that are simple, centered, and readable. Use warm paper background, heavy black ink shape, shelf yellow accent, and optional blue detail. The icon should suggest scanning book barcodes and saving resale decisions without any text.
```

### Negative Prompt

```text
No wordmark, no tiny barcode detail, no marketplace logos, no book cover titles, no glossy iOS glass effect, no complex scene.
```

### Implementation Notes

Generate from the same mark source so all icon sizes match. Add `manifest.webmanifest` after icons exist.

## Homepage Hero Desktop

- Asset ID: `home-hero-desktop`
- Purpose: First-viewport homepage/product visual.
- Dimensions: `2400x1400`
- File name: `home-hero-desktop.webp`
- Save path: `public/assets/images/home/home-hero-desktop.webp`

### Main Prompt

```text
Create a professional homepage hero image for ShelfMargin, a mobile-first scanner app for used-book resellers. Scene: a thrift store or library-sale book shelf with a handheld Bluetooth barcode scanner, a small stack of used paperbacks, shelf price stickers, and a phone showing a simplified scanner app shape. Use warm paper tones, strong black ink edges, shelf yellow highlights, trust blue accents, and realistic controlled lighting. Leave clean headline-safe space on the left. The image should feel practical, fast, field-tested, and professional.
```

### Negative Prompt

```text
No fake readable marketplace logos, no guaranteed profit numbers, no fake unreadable UI text, no generic office desk, no glossy startup gradient, no smiling stock-photo person, no clutter over the text-safe area.
```

### Implementation Notes

Use in `src/components/PublicSite.jsx` homepage hero after generation. Keep live H1 and CTAs as real text, not baked into image.

## Homepage Hero Mobile

- Asset ID: `home-hero-mobile`
- Purpose: Mobile-specific hero crop.
- Dimensions: `1200x1600`
- File name: `home-hero-mobile.webp`
- Save path: `public/assets/images/home/home-hero-mobile.webp`

### Main Prompt

```text
Create a portrait mobile hero image for ShelfMargin. Show a close, practical used-book sourcing moment: a barcode scanner pointed at a book ISBN, a small book stack, and a phone with a clean scanner-app silhouette. Keep the top third calm and copy-safe, with warm paper background, black ink linework, shelf yellow accent, and trust blue detail. The image should look professional and useful on an iPhone landing page.
```

### Negative Prompt

```text
No fake readable UI text, no marketplace logos, no face-focused stock photo, no busy bookshelf filling the whole frame, no glossy gradients, no decorative abstract shapes.
```

## Default Social OG Image

- Asset ID: `social-og-default`
- Purpose: Default Open Graph and Twitter/X preview.
- Dimensions: `1200x630`
- File name: `og-default.webp`
- Save path: `public/assets/images/social/og-default.webp`

### Main Prompt

```text
Create a 1200x630 social preview image for ShelfMargin. Use a clean warm paper background with heavy black border lines, a shelf yellow diagonal safety-label accent, a simple scanner/book/barcode mark on the right, and clear empty space on the left for real live title text. The visual should communicate scan books, estimate profit, save the list, and check before buying. Professional used-book reseller tool, not generic SaaS.
```

### Negative Prompt

```text
No tiny text, no fake logos, no fake marketplace dashboards, no unreadable UI, no glossy gradient, no cluttered book pile, no cartoon mascot.
```

### Implementation Notes

After file exists, update `index.html` with `og:image`, `twitter:card` as `summary_large_image`, and `twitter:image`.

## Scan Screen Screenshot Treatment

- Asset ID: `product-screenshot-scan`
- Purpose: Marketing product mockup and future iOS screenshot source.
- Dimensions: source screenshot plus `1800x1200` treatment
- File name: `app-screenshot-scan.webp`
- Save path: `public/assets/images/product/app-screenshot-scan.webp`

### Main Prompt

```text
Use the provided real ShelfMargin Scan screen screenshot. Preserve the actual UI and readable text. Present it as a clean mobile product screenshot on a warm paper and black ink product surface with a subtle shelf yellow accent and small scanner/book context nearby. Keep perspective minimal, avoid glare, and make the app screen easy to inspect.
```

### Negative Prompt

```text
Do not rewrite UI text, do not invent marketplace data, do not blur the app, no extreme 3D perspective, no glossy device reflection, no fake logos, no extra unreadable panels.
```

### Implementation Notes

Capture from `/demo#/scout` or signed-in `#/scout`. Redact email if using account mode.

## Check Books Screenshot Treatment

- Asset ID: `product-screenshot-check-books`
- Purpose: Show the verification workflow that differentiates ShelfMargin from a simple scanner.
- Dimensions: source screenshot plus `1800x1200` treatment
- File name: `app-screenshot-check-books.webp`
- Save path: `public/assets/images/product/app-screenshot-check-books.webp`

### Main Prompt

```text
Use the provided real ShelfMargin Check Books screen screenshot. Preserve the actual UI and readable text. Present it as a clean mobile product screenshot with used-book sourcing context: book stack, pencil/checklist cue, barcode scanner nearby, warm paper background, black ink borders, shelf yellow and trust blue accents. The composition should make the check-before-buy workflow feel credible and professional.
```

### Negative Prompt

```text
Do not rewrite UI text, do not invent fake data, no marketplace logos, no glossy phone reflection, no extreme perspective, no clutter, no decorative abstract shapes.
```

## Scan Check Export Feature Graphic

- Asset ID: `feature-scan-check-export`
- Purpose: Visual support for product feature section.
- Dimensions: `1600x1000`
- File name: `feature-scan-check-export.webp`
- Save path: `public/assets/images/features/feature-scan-check-export.webp`

### Main Prompt

```text
Create a focused feature graphic for ShelfMargin showing the workflow: scan a book barcode, mark buy/pass/check, save to a buy list, then export a CSV. Use simple structured panels, book shelf labels, scanner beam, checklist marks, and export sheet cue. Use warm paper, black ink, shelf yellow, trust blue, buy green, and pass red. Keep the graphic clean and readable without fake detailed UI text.
```

### Negative Prompt

```text
No fake dashboards full of unreadable text, no abstract blobs, no puzzle metaphor, no mascot, no marketplace logos, no guaranteed profit claims.
```

## Scanner Empty State

- Asset ID: `empty-state-scan`
- Purpose: Small visual for no scans state in Ledger scan page.
- Dimensions: `800x600`
- File name: `empty-state-scan.webp`
- Save path: `public/assets/images/product/empty-state-scan.webp`

### Main Prompt

```text
Create a restrained empty-state visual for ShelfMargin's scanner page. Show a simple barcode scanner resting beside one blank book spine and a small shelf label, drawn with black ink linework on warm paper, with a small shelf yellow accent. It should feel functional and calm, sized for an app empty state, not decorative.
```

### Negative Prompt

```text
No cartoon mascot, no sad face, no fake UI text, no busy book pile, no glossy gradients, no cute illustration style.
```

## Beta Tester Ad Background

- Asset ID: `ad-background-beta`
- Purpose: Future beta tester paid/social creative.
- Dimensions: `1600x900`
- File name: `ad-background-beta.webp`
- Save path: `public/assets/images/ads/ad-background-beta.webp`

### Main Prompt

```text
Create a campaign background for ShelfMargin beta testers: used-book reseller scanning barcodes in a real sourcing environment, practical and professional. Leave strong copy-safe space for headline and CTA. Use warm paper, black ink, shelf yellow, trust blue, and subtle book shelf context. The image should make the offer feel like a useful field tool for resellers, not a generic tech app.
```

### Negative Prompt

```text
No guaranteed profit claims, no fake marketplace logos, no smiling stock-photo shopper, no cluttered background, no tiny text, no glossy SaaS gradient.
```
