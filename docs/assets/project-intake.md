# ShelfMargin Project Intake

## Project

- Name: ShelfMargin
- Type: Vite React webapp with public marketing pages and authenticated scanner workflow
- Audience: used-book resellers sourcing books in thrift stores, library sales, garage sales, and used-book shops
- Product promise: scan ISBNs, estimate resale value, mark BUY/CHECK/PASS, save a buy list, export CSV, and check real marketplace data before purchasing

## Current Routes

Public routes:

- `/`
- `/product`
- `/pricing`
- `/faq`
- `/security`
- `/privacy`
- `/terms`
- `/login`
- `/demo`

App routes:

- `#/dashboard`
- `#/scout`
- `#/queue`
- `#/check-books`
- `#/inventory`
- `#/settings`
- `#/admin`

## Selected Visual Direction

Reseller Notebook: notebook paper, black ink, denim blue, highlighter yellow, profit green, scanner and barcode cues, used-book sourcing context.

## Asset Folder Structure

Runtime media should be saved under:

```text
public/assets/
  brand/
  icons/
  images/home/
  images/features/
  images/product/
  images/social/
  images/ads/
  video/
```

Public URLs should use `/assets/...`.

## Implementation Rule

Generated assets remain drafts until reviewed. Do not mark anything approved without owner confirmation. Do not wire an image path into code until the file exists in `public/assets`.
