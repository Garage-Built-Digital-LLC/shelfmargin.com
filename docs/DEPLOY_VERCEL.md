# Deploying ShelfMargin to Vercel

The app deploys as a Vite static frontend (built to `dist/`) plus serverless API
functions in `api/`. `vercel.json` wires the SPA rewrite and security headers.
Everything runs on one origin, so the frontend's relative `/api/...` calls work
with no CORS setup.

## One-time setup
1. In Vercel, the project `shelfmargin` should be connected to this Git repo.
   Set the Production Branch to the branch you deploy from.
2. Framework preset: Vite (auto-detected). Build is handled by `vercel.json`
   (`vite build` -> `dist`). No extra config needed.

## Environment variables (Vercel -> Project -> Settings -> Environment Variables)
Add these for Production (and Preview if you want previews to work).

Build-time (exposed to the browser; safe):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_STRIPE_PUBLISHABLE_KEY
- VITE_USE_LIVE            (optional: "true" to enable live catalog lookup)

Server-only (used by api/ functions; NEVER prefix with VITE_):
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_STARTER_PRICE_ID
- STRIPE_PRO_PRICE_ID
- AMAZON_SP_API_MODE=sandbox   (+ the AMAZON_SP_API_* sandbox vars from .env.example)
- APP_BASE_URL                 (set to the deployed URL, e.g. https://shelfmargin.com)
- ERROR_WEBHOOK_URL            (optional: Slack/Discord webhook for error alerts)

## Stripe webhook (only when Stripe goes live)
Point the Stripe webhook endpoint at:  https://<your-domain>/api/stripe/webhook
Then set STRIPE_WEBHOOK_SECRET to that endpoint's signing secret.
`api/stripe/webhook.js` disables Vercel's body parser so signature checks use raw bytes.

## Deploy
Push to the production branch (Vercel auto-builds), or run `vercel --prod` from the CLI.

## Endpoints (serverless)
GET  /api/health
GET  /api/catalog?isbn=...
GET  /api/stripe/status
POST /api/stripe/checkout
POST /api/stripe/webhook
POST /api/stripe/portal
GET  /api/amazon/status
POST /api/amazon/test
GET  /api/amazon/catalog?isbn=...
GET  /api/account/export
POST /api/account/delete

## Known limitation
Per-endpoint rate limiting from server.mjs is in-memory and does not carry into
serverless (each invocation is isolated). Vercel provides baseline protection; add
a shared limiter (e.g. Upstash Redis) later if abuse appears.
