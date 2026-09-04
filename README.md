# Shelf Margin

Shelf Margin is a simple scanner-first app for used-book resellers. Scan or type
an ISBN, see an estimated buy/pass/check decision, save possible buys, check
real prices before spending money, and export the list.

## What Works Now

- Scanner-friendly focused input for Bluetooth barcode scanners.
- Scanner Test page for checking raw barcode scanner reads before saving scans.
- ISBN-10/13 cleanup and price-add-on stripping in `src/lib/isbn.js`.
- Profit calculation with Amazon media fee assumptions in `src/lib/profit.js`.
- Live ISBN title/author lookup when `VITE_USE_LIVE=true`.
- Amazon-first scan results with an estimated buy / check / pass verdict.
- Duplicate detection with copy counts.
- Buy list, saved scans, book-check notes, and CSV export.
- Dated scan-session summaries based on saved scan timestamps.
- Supabase-backed accounts, profiles, scans, and book-check rows.
- First recreated account becomes admin through `supabase/migrations/0003_first_user_admin.sql`.
- Local Docker preview with `docker-compose.yml`.

## Run Locally

```bash
npm install
npm run dev
npm test
npm run build
```

## Run With Docker

```bash
docker compose up -d --build web
```

Local address:

```text
http://localhost:5173
```

## Product Boundary

Shelf Margin can pull live title/author catalog metadata when
`VITE_USE_LIVE=true`. Marketplace prices, ranks, seller counts, fees, and
buy/pass/check verdicts are still estimates until live Amazon data is wired
through a server-side endpoint. Always check real
marketplace prices, fees, condition, and seller restrictions before buying
books.

## Owner Inputs

Owner decisions and real-world test inputs are tracked in
`docs/OWNER_INPUTS.md`.

## Product Roadmap

Webapp-first, SEO, profitability, and iOS-later direction is tracked in
`docs/PRODUCT_ROADMAP.md`.

## Demo ISBNs

- `9781449373320` Designing Data-Intensive Applications — clear buy
- `9780984782857` Cracking the Coding Interview — clear buy
- `9780735211292` Atomic Habits — oversupplied bestseller, pass
- `9780399226908` The Very Hungry Caterpillar — common kids' penny book, pass
