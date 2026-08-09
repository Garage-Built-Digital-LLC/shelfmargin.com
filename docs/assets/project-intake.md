# Project Intake

## Project Basics

- Project name: ShelfMargin
- Project type: Mobile-first Vite React webapp and public marketing site
- Target customer: Used-book resellers sourcing books from thrift stores, library sales, garage sales, and bulk lots
- Primary business goal: Prove the scanner workflow and value before paid launch or native iOS build
- Primary conversion goal: Get testers into demo or account-based scan sessions
- Offer/product type: Early free scanner webapp for validating buy/pass/check decisions
- Brand maturity: draft
- Launch priority: Improve professional polish without hiding the current estimate-only/provider-readiness boundary

## Tech Stack

- Framework: Vite 8, React 19
- Styling: Tailwind CSS utilities plus component-local constants; older scanner CSS remains in `src/index.css`
- Hosting: Docker/Vite local preview currently documented from prior work as `localhost:5173`
- Database/auth: Supabase client and migrations; live provider status must be revalidated before public claims
- Image handling notes: Static files should live in `public/assets` and be referenced as `/assets/...`

## Main Pages And Routes

| Route | Page purpose | Asset needs |
|---|---|---|
| `/` | Public homepage | Hero/product visual, default OG image |
| `/product` | Product explanation | Product mockup or screenshot treatment |
| `/pricing` | Early free pricing | No heavy image needed; use shared brand assets |
| `/faq` | Objection handling | No image needed |
| `/security` | Account/data trust | Small trust/security graphic optional |
| `/privacy` | Legal content | Logo/favicon only |
| `/terms` | Legal content | Logo/favicon only |
| `/login` | Auth and signup | Brand mark, optional auth-side visual |
| `/demo` | Demo Ledger app | Screenshot source for product mockups |
| `#/dashboard` | User home | Empty-state illustration optional |
| `#/scout` | Scanner | Screenshot source and empty scan state |
| `#/queue` | Buy list | Empty-state illustration optional |
| `#/check-books` | Verification workflow | Feature graphic and screenshot source |
| `#/inventory` | Saved books | Empty-state illustration optional |
| `#/settings` | Scan rules | No image needed |
| `#/admin` | Setup checks | No image needed |

## Existing Assets

| Asset | Current path/location | Quality | Notes |
|---|---|---|---|
| Logo | Icon+text rendered in React with Lucide `Scan` | Draft | No exported logo file |
| Favicon | Missing | Blocking | `index.html` does not link favicon |
| App icon | Missing | Blocking for iOS/PWA consideration | No manifest or touch icon |
| Product screenshots | Missing | Needed | App can produce real screenshots from `/demo` |
| Social image | Missing | Blocking | `index.html` lacks `og:image` and `twitter:image` |
| Hero image | Missing | Supporting/blocking for professional marketing polish | Homepage uses component mockup only |

## Visual Direction

Use a used-book sourcing visual language: bookstore shelf edges, price stickers, barcode scanner beam, paperback stacks, clipboard/export cues, and mobile UI screens. Keep the current cream/yellow/blue shop-label palette unless the user explicitly asks for a darker rebrand.

## Asset Generation Constraints

- AI-generated imagery can be used for hero, social, ads, empty states, and stylized screenshot treatments.
- Real app screenshots should be captured from the current app for product mockups.
- Avoid real people/faces unless explicitly requested.
- Avoid customer and marketplace logos unless supplied and licensed.
- Avoid claims that estimated pricing is live/final.
- App icons and logo drafts need user approval before `approved` status.

## Launch Priority

- Launch-blocking assets: favicon, Apple/app icons, default social OG image, primary logo export.
- Launch-supporting assets: homepage hero, product screenshot mockups, auth visual, feature/check-books visual.
- Post-launch assets: ad backgrounds, email headers, blog headers, alternate social crops, video walkthrough.

## Open Questions

- Final logo direction: wordmark-only, scanner mark, barcode/shelf mark, or current Lucide-style mark.
- Native iOS timing: keep PWA/iOS home-screen support first, then consider native after field testing.
- Whether to preserve the current light shop-label palette or move the whole product toward darker GBD defaults.
