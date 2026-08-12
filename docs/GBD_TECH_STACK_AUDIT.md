# Shelf Margin GBD Tech Stack Audit

Last checked: August 11, 2026

## Current State

1. Current working directory and repo identity: Verified locally.
   - Path: `/Users/dillonwallace/Desktop/Garage Built Digital LLC/SaaS Companies/Shelf Margin/shelfmargin`
   - Remote: `https://github.com/Garage-Built-Digital-LLC/shelfmargin.com.git`
   - Branch: `main`
2. Git status: Verified locally.
   - `main` is synced with `origin/main` at `58f091f`.
   - Dirty UI files exist and must be preserved: `index.html`, `public/manifest.webmanifest`, `src/App.jsx`, `src/components/Auth.jsx`, `src/components/Ledger.jsx`, `src/components/PublicSite.jsx`, `src/index.css`.
3. Current framework and package manager: Verified in repo.
   - Vite + React, JavaScript, npm, `package-lock.json`.
   - Not Next.js and not TypeScript yet.
4. Current local run command and verified local URL: Verified locally.
   - Dev: `npm run dev`.
   - Docker: `docker compose up -d --build web`.
   - Docker URL: `http://localhost:5173`.
5. Current deployed host: Missing.
   - No `.vercel`, `vercel.json`, or hosting config was found.
6. Current database/provider state: Partly verified locally, provider-live not fully verified.
   - Supabase project URL and anon key are present in `.env.local`.
   - Repo has migrations for `profiles`, `scans`, `scan_verifications`, and first-user admin role.
   - Anon REST smoke checks returned `200 []` for required tables.
   - Hosted migration history, advisors, and two-user RLS separation were not verified in provider.
7. Current auth state: Partly verified in repo and local docs.
   - Supabase Auth is wired in the client.
   - Docs say the owner account exists and is admin.
   - Current sign-in and two-user separation were not re-tested in browser during this audit.
8. Current payment state: Planned only.
   - Pricing model exists in `src/lib/pricing.js`.
   - Stripe Checkout, Stripe products/prices, and webhooks are not implemented.
9. Current email state: Planned only.
   - `support@shelfmargin.com` is referenced as planned.
   - Resend is not installed or configured.
10. Current analytics/error/security tooling: Mixed.
   - PostHog: Missing.
   - Sentry: Missing.
   - GitHub security workflows: Missing in repo.
   - Semgrep: Missing locally and no repo workflow found.
   - Gitleaks: Installed locally and found JWT-shaped Supabase values in `.env.local` and `dist`.
   - `npm audit`: Found one high-severity advisory in `nanoid`.
11. Current launch readiness gaps: Verified locally and planned only.
   - No production host path.
   - No Stripe billing or webhook trust.
   - No transactional email provider.
   - No PostHog or Sentry.
   - Security scan findings need approval and remediation.
   - Marketplace pricing/rank data is still estimated.
   - Supabase hosted state needs provider-level verification.
12. Current owner inputs required: Verified in docs.
   - Domain, support inbox, live data source, Stripe timing, iOS scanner priority, and real book field tests remain owner inputs.

## Recommended Stack For This Project

| Layer | Chosen tool | Current status | Why this tool | Why not closest competitor | Pricing impact | Risk | Verification required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI execution | Codex | Verified locally | Current execution path and repo workflow | No switch needed | Current tool cost only | Low | Continue commit/test discipline |
| App framework | Vite + React now; reassess Next.js later | Verified in repo | Current app is scanner-heavy and mostly client-side | Next.js is better for production SEO, but migration now would slow validation | None now | Medium later if SEO grows | Reassess before public SEO push |
| Language | JavaScript now; TypeScript later | Verified in repo | Avoid broad churn during rebrand | TypeScript is better for SaaS scale but migration should be planned | None now | Medium | Add TS gradually around shared libs first |
| Hosting | Vercel | Missing | Default GBD host and good future Next.js path | Netlify/Render/Railway/Fly/Cloudflare do not solve a current project-specific issue better | Low/free tier likely at first | Medium | Link project and verify production build |
| Database/backend | Supabase | Partly verified | Already wired; auth and RLS fit solo reseller accounts | Neon lacks built-in auth; Firebase changes data model; PlanetScale is not Postgres/RLS; Railway is hosting-first | Supabase free/paid as usage grows | Medium | Hosted migration list, advisors, two-user RLS test |
| Auth | Supabase Auth | Partly verified | Solo reseller accounts do not need orgs, SSO, invites, or polished managed account UI yet | Clerk/Auth0/WorkOS add cost and complexity before team features exist; Better Auth adds ownership burden | Supabase included | Medium | Login, signup, reset, admin/user boundary |
| Payments | Stripe Checkout | Planned only | Best default for subscriptions and webhook trust | Payment Links could validate early manually; Paddle/Lemon Squeezy add MoR tradeoffs; PayPal/Square are less ideal for SaaS subscriptions | Stripe fees | Medium-high | Checkout, webhook, amount/currency/product/metadata validation |
| Email | Resend | Planned only | Simple transactional email path | Postmark is also strong; SendGrid/Mailgun/Brevo add complexity without current reason | Low at first | Medium | Domain verification and real send |
| Analytics | PostHog | Missing | Funnels/replays will help prove activation and paid readiness | GA4 weaker for product UX; Mixpanel/Amplitude higher ceremony; Plausible better for simple web analytics | Low at first | Medium | Test event from local/prod |
| Error monitoring | Sentry | Missing | Best fit for production error visibility | PostHog errors may be enough later; Better Stack/Datadog/New Relic are heavier | Low at first | Medium | Test error event |
| Security | GitHub security + Gitleaks + Semgrep | Partial/missing | Good baseline before public launch | Snyk/Sonar are useful later but not yet justified | Mostly free | Medium | Clean scans and CI gates |
| Onboarding | Built-in app onboarding | Verified direction | Early reseller workflow should stay simple and product-native | Userflow/Appcues/Intercom/Pendo are premature without user activation data | None now | Low | Track activation first |

## Competitor Check

- Supabase remains the best current fit versus Neon, Firebase, PlanetScale, and Railway because Auth plus Postgres plus RLS are already wired.
- Supabase Auth remains the best current fit versus Clerk, Auth0, Better Auth, and WorkOS because Shelf Margin is solo-account first.
- Stripe Checkout is the right planned payment layer versus Paddle, Lemon Squeezy, PayPal, and Square unless merchant-of-record handling becomes a requirement.
- Resend is the right planned email layer versus Postmark, SendGrid, Mailgun, and Brevo because the first need is simple transactional mail.
- PostHog is the right planned analytics layer versus GA4, Mixpanel, Amplitude, and Plausible because product activation and session replay matter more than simple pageviews.
- Sentry is the right planned error layer versus PostHog error tracking, Better Stack, Datadog, and New Relic because production app errors need a mature dedicated path.
- GitHub security, Semgrep, and Gitleaks are enough before launch; Snyk and Sonar can wait until dependency/container/compliance risk is higher.
- Built-in onboarding is still the right call versus Userflow, Appcues, Intercom, and Pendo until real activation data shows onboarding friction.
- Vercel is still the default host versus Netlify, Render, Railway, Fly.io, and Cloudflare because the project may later move to Next.js for SEO.

## Priority Order

1. Keep Vite working locally and in Docker while the webapp is validated.
2. Verify Supabase hosted migrations, advisors, and two-user RLS.
3. Verify Supabase Auth login, signup, reset, admin, and user boundaries.
4. Plan Stripe Checkout and webhook trust before paid access.
5. Add Resend only after the domain and sending identity are ready.
6. Add PostHog before beta traffic or serious onboarding experiments.
7. Add Sentry before public launch.
8. Add Gitleaks and Semgrep launch gates after approving remediation.
9. Improve in-app onboarding based on field-test friction.
10. Reassess Next.js, TypeScript, Snyk, Clerk, and onboarding SaaS only after usage data exists.

## Implementation Slices

### Slice 1: Local And Stack Baseline

- Files likely touched: `docs/GBD_TECH_STACK_AUDIT.md`, `README.md`.
- Provider changes required: none.
- Local verification command: `npm test && npm run build`.
- Browser verification path: `/`.
- Production/provider verification: none.
- Rollback risk: low.

### Slice 2: Security Scan Remediation

- Files likely touched: `.dockerignore`, `.gitleaks.toml` or scan config, `package-lock.json`, `package.json`.
- Provider changes required: none.
- Local verification command: `gitleaks detect --source . --no-git --redact --verbose && npm audit --audit-level=moderate && npm test && npm run build`.
- Browser verification path: `/`.
- Production/provider verification: none.
- Rollback risk: medium because dependency updates can affect builds.
- Approval required before implementation.

### Slice 3: Supabase Hosted Verification

- Files likely touched: `docs/DATABASE_READINESS.md`.
- Provider changes required: read-only provider checks first.
- Local verification command: `npm test`.
- Browser verification path: `/login`, `#/dashboard`, `#/field-test`.
- Production/provider verification: migration list, advisors, two-user RLS proof.
- Rollback risk: low for audit, high for any schema changes.

### Slice 4: Stripe Checkout Plan

- Files likely touched: `docs/STRIPE_BILLING_PLAN.md`, later server/API files after framework decision.
- Provider changes required: Stripe products, prices, webhook endpoint, webhook secret.
- Local verification command: payment tests once implemented.
- Browser verification path: `/pricing`, account/subscription page.
- Production/provider verification: Stripe test-mode checkout and webhook events.
- Rollback risk: high until webhook trust is proven.

Status: planned in `docs/STRIPE_BILLING_PLAN.md`; no Stripe code or provider
changes have been implemented.

### Slice 5: Analytics And Error Visibility

- Files likely touched: `src/lib/analytics.js`, `src/lib/monitoring.js`, env docs.
- Provider changes required: PostHog project key, Sentry DSN.
- Local verification command: `npm test && npm run build`.
- Browser verification path: `/`, `/login`, `#/dashboard`.
- Production/provider verification: test PostHog event and test Sentry event.
- Rollback risk: medium because browser telemetry must respect privacy policy.

## Launch Blockers

- Local Gitleaks currently flags `.env.local` and generated `dist` output.
- `npm audit` currently reports one high-severity `nanoid` advisory.
- No production host is configured.
- Stripe is not implemented.
- Resend is not implemented.
- PostHog and Sentry are not implemented.
- Supabase hosted state still needs provider-level verification.
- Marketplace price/rank data remains estimated and must not be marketed as live accuracy.
