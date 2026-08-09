# Brand Profile

## Project

- Project name: ShelfMargin
- Brand owner: Garage Built Digital LLC
- Last updated: 2026-08-07

## Brand Position

ShelfMargin is a scanner-first webapp for used-book resellers. The visual system should feel practical, fast, and field-ready: software someone can trust while standing in a thrift store aisle, warehouse, library sale, or garage with a Bluetooth barcode scanner in hand.

The brand should communicate quick decisions, clean resale math, and a disciplined check-before-buy workflow. It should not imply live marketplace accuracy until provider integrations are complete.

## Visual Style

- Primary style: Shop-label utility, reseller field workflow, practical premium
- Interface mood: Focused, high-contrast, mobile-first, operator-facing
- Texture level: Subtle matte paper, shelf tags, barcode labels, and scanner hardware cues
- Detail level: Enough to feel real, never cluttered around CTA or form surfaces
- Photography direction: Realistic used-book shelves, barcode scanner, paperback/hardcover stacks, laptop or phone with app context
- Illustration direction: Restrained linework for empty states, no mascots

## Color Palette

The current app uses a cream/yellow/blue/green/red shop-label palette, not the default dark GBD system.

| Role | Color | Hex | Notes |
|---|---:|---:|---|
| Warm paper background | Primary page foundation | `#F6F5F0` | Current public/app background |
| Ink | Main text and borders | `#151512` | Strong linework and labels |
| Shelf yellow | Primary CTA/highlight | `#FFC400` | Use sparingly for action and stripe motif |
| Trust blue | Secondary CTA/navigation | `#1F5FAD` | Demo, sync, account, saved states |
| Buy green | Positive decision | `#1E8E4A` | Buy/profit/saved success |
| Pass red | Negative decision | `#C6301E` | Pass/error warnings |
| Muted gray | Secondary copy | `#6B6A63` | Notes and metadata |

## Typography Direction

- Keep the current strong uppercase label language.
- Use readable sans-serif UI text and mono numerals for ISBNs/prices.
- Avoid playful, futuristic, decorative, or luxury editorial typography.
- Do not bake paragraphs or fake dashboard text into generated images.

## Asset Rules

- Use real screenshots for app mockups whenever possible.
- Keep generated product imagery factual: scanning, checking, exporting, and list-building.
- Leave copy-safe space for live text on homepage and social assets.
- Do not show Amazon, eBay, or customer logos as generated brand marks.
- Do not imply final prices, live BSR, eligibility, fees, or guaranteed profit.
- iOS/app icons should be simple marks, not detailed generated scenes.

## Negative Prompt Rules

```text
No random decorative clutter, no fake unreadable UI text, no glossy startup gradient look, no pastel SaaS illustration style, no floating abstract shapes, no cartoon mascot, no generic stock-photo handshake, no fake marketplace logos, no guaranteed profit claims, no unreadable barcode-like noise over headline space.
```

## Approval Standard

An asset is ready only if it fits the used-book reseller workflow, works in its exact route or iOS/PWA surface, avoids false marketplace-data claims, and is saved at the manifest path. Final logo and app icon work remains draft until user-approved.
