# ShelfMargin Backend Security Audit

Last reviewed: September 1, 2026
Scope: database + RLS, Node server (`server.mjs` and `src/lib/*`), Stripe billing,
Supabase Auth, and account lifecycle. This audit reflects the state of the code in
the repo plus live advisor findings from Supabase project `qvhhernpruxclgxvwyou`.

## Executive summary

The data layer is in strong shape. Every user-facing table has Row Level Security,
policies are scoped to `auth.uid() = user_id`, column-level `GRANT`s stop client
overposting, the billing table is read-only to browsers, and Stripe webhooks are
signature-verified, idempotent, and only ever written by the service role through a
`security definer` RPC. The live Supabase security advisor returns a single WARN
(leaked-password protection disabled) and no ERROR-level findings.

The remaining risk is not in row security — it is in **account lifecycle and auth
policy**: there is no self-serve account deletion or data export (a compliance gap),
the password floor is 6 characters, leaked-password protection is off, and MFA is
not offered. There are also a few smaller server-side hardening opportunities.

Findings are rated: **P1** (fix before/at launch), **P2** (fix soon after launch),
**P3** (hardening / defense-in-depth).

## What is already done well (keep it)

- RLS enabled on `profiles`, `scans`, `scan_verifications`, `billing_accounts`.
- Policies use `(select auth.uid())` form, which is both correct and index-friendly.
- Column-level `GRANT`s on `profiles` prevent users from writing `role`,
  `subscription_status`, or `trial_scans_used` from the browser.
- `billing_accounts` revokes all browser write/truncate; only the service role writes it.
- Stripe webhook: signature verified, body size-limited, idempotent via
  `private.stripe_events` behind a service-role-only RPC, and plan/price validated
  against server-side rules rather than trusting the event payload.
- Service role key is server-only and documented as never-`VITE_`.
- Server sets a real CSP, `x-frame-options: DENY`, `nosniff`, referrer policy, and a
  restrictive permissions policy; static file serving blocks path traversal and dotfiles.
- First-user-admin bootstrap uses a table lock to avoid a race that could mint two admins.
- A two-user hosted RLS test script exists and exercises cross-tenant isolation.

## Findings

### P1-1 — No self-serve account deletion
There is no path for a user to delete their account and data. `auth.users` has
`on delete cascade` to every table, so a deletion primitive is one service-role call,
but no endpoint or RPC exposes it. This is a GDPR/CCPA "right to erasure" gap and a
common app-store / payment-processor requirement.
Remediation: add a service-role `security definer` RPC + authenticated server endpoint
(`POST /api/account/delete`) that verifies the caller's token and deletes only their
own `auth.users` row. Delivered in migration `0009` + `src/lib/accountLifecycle.js`.

### P1-2 — No user data export
No "download my data" path exists (GDPR "right to access" / data portability).
Remediation: authenticated `GET /api/account/export` that returns the caller's
profile, scans, verifications, and billing summary as JSON, using only their own token
so RLS enforces scoping. Delivered alongside P1-1.

### P1-3 — Leaked-password protection disabled (live advisor WARN)
Supabase Auth is not checking new passwords against HaveIBeenPwned.
Remediation: enable in Auth settings (Dashboard → Authentication → Password, or the
Management API). This is a config toggle, not a migration. Steps in the runbook below.

### P2-1 — Weak password minimum (6 chars, client-only)
`Auth.jsx` enforces `minLength={6}` in the browser only; there is no server/Auth-level
minimum or complexity requirement. Six characters is below current guidance.
Remediation: raise the Supabase Auth minimum to at least 8 and set required character
classes in Auth settings; raise the client `minLength` to match for good UX. A weak
client check with no server floor is bypassable.

### P2-2 — No MFA / 2FA option
No second factor is offered. For an app holding sourcing data and tied to billing,
TOTP enrollment is a reasonable pre- or post-launch add.
Remediation: Supabase supports TOTP MFA with `supabase.auth.mfa.*`; enable the factor
in Auth settings and add enroll/challenge UI. Scoped as a follow-up (UI work).

### P2-3 — 500 error responses leak internal fields
The top-level catch in `server.mjs` returns `code`, `amazonStatus`, and `amazonError`
on unexpected (non-`err.status`) errors. The message is generic, but these extra
fields can expose internal integration state to clients.
Remediation: only include `code`/`amazonStatus`/`amazonError` for errors that set
`err.status` (i.e. deliberate, client-safe errors); strip them on unexpected 500s.

### P3-1 — CSP allows `'unsafe-inline'` for scripts and styles
`script-src 'self' 'unsafe-inline'` weakens XSS defense. Inline styles are lower risk;
inline scripts are the concern.
Remediation: move toward nonce/hash-based CSP for scripts if the Vite build allows it;
at minimum, track removing `'unsafe-inline'` from `script-src`.

### P3-2 — Rate limiting is per-endpoint but not on every mutating path
Catalog and sensitive Stripe/Amazon endpoints are rate-limited; the webhook is not
(correct — it is signature-gated). New account-lifecycle endpoints must be added to the
sensitive bucket. Also note the limiter trusts `x-forwarded-for` verbatim, which is
spoofable if the app is ever exposed without a trusted proxy setting the header.
Remediation: put `/api/account/*` in the sensitive rate-limit bucket (done in this
change set); when deploying, ensure only a trusted proxy sets `x-forwarded-for`.

### P3-3 — Auth email rate limits rely on Supabase defaults
Signup/reset email flooding is bounded only by Supabase's built-in limits.
Remediation: confirm Auth rate limits in the dashboard are set conservatively for
production; consider a CAPTCHA (hCaptcha/Turnstile) on signup if abuse appears.

### P3-4 — In-memory rate-limit state is per-instance
`rateBuckets` is a process-local Map, so limits reset on restart and do not coordinate
across multiple instances/containers.
Remediation: acceptable for a single instance; if scaling horizontally, move to a
shared store (e.g. Postgres or Redis) keyed the same way.

## Live advisor snapshot (2026-09-01)

- Security: WARNs only, no ERRORs:
  - `auth_leaked_password_protection` (see P1-3) — config toggle, pending.
  - `authenticated_security_definer_function_executable` on `public.delete_own_account()`
    — ACCEPTED / intentional. Self-serve deletion requires SECURITY DEFINER (an
    authenticated user cannot delete from `auth.users` otherwise), the body is pinned
    to `auth.uid()` so a caller can only ever delete their own account, and it must
    live in the `public` API schema so the server can invoke it with the user's token.
    Not a vulnerability; do not "remediate" by revoking execute, which would break
    account deletion.
- Performance: 1 INFO — Auth DB connection strategy is absolute, not percentage-based
  (only matters when scaling instance size; safe to defer).

## Production runbook (config, not code)

These are dashboard/Management-API settings that migrations cannot set:

1. Authentication → Password: enable "leaked password protection", set minimum length
   to 8+, and require mixed character classes.
2. Authentication → Multi-Factor: enable TOTP (pairs with P2-2 UI work).
3. Authentication → Rate limits: review email/OTP limits for production traffic.
4. Confirm email confirmation is required before first sign-in (the app already
   handles the "email not confirmed" state).
5. Rotate any keys that were ever pasted outside `.env.local`; never expose the
   service role key to the browser.

## Remediation status in this change set

- P1-1 Account deletion: implemented (migration 0009 + server endpoint + settings UI); migration APPLIED to prod 2026-09-01.
- P1-2 Data export: implemented (server endpoint).
- P2-3 500 error leakage: implemented (server hardening).
- P3-2 Rate limiting on new endpoints: implemented.
- P2-1 Password floor: client minimum raised to 10 chars in `Auth.jsx`; the
  authoritative minimum must still be set in Auth settings (runbook step 1).
- P1-3 / P2-2 / P3-3: config + follow-up UI (runbook above).
