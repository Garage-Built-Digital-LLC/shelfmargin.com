# Shelf Margin Stripe Billing Plan

Last checked: August 11, 2026

## Position

Stripe is planned only. Shelf Margin does not currently process payments, create
Checkout Sessions, handle webhooks, or grant paid access from Stripe state.

The first paid product should stay simple:

- Free beta while the scanner workflow is being proven.
- Starter at `$15/month` for solo book resellers.
- Pro at `$29/month` after live data and higher-volume workflow value are real.
- Apple Watch alerts are a future Pro feature after native iOS exists.

## Recommended Stripe Product Model

Use Stripe Billing with Checkout Sessions in subscription mode.

Create two active recurring prices in Stripe test mode first:

| Internal plan | Stripe product | Stripe price | Lookup key | Access level |
| --- | --- | --- | --- | --- |
| Starter | Shelf Margin Starter | `$15/month` | `shelfmargin_starter_monthly` | `starter` |
| Pro | Shelf Margin Pro | `$29/month` | `shelfmargin_pro_monthly` | `pro` |

Keep Free Beta outside Stripe until billing is ready. A free beta user should
have app access based on Supabase profile state, not a fake Stripe subscription.

## Required Provider Inputs

- Stripe account access for Garage Built Digital LLC.
- Stripe test-mode restricted API key for server-side Checkout and Portal calls.
- Stripe live-mode restricted API key before launch.
- Stripe webhook signing secret for test mode.
- Stripe webhook signing secret for live mode.
- Stripe product IDs for Starter and Pro.
- Stripe price IDs or stable lookup keys for Starter and Pro.
- Decision on whether to use a trial period when paid plans launch.
- Production domain before live webhook registration.
- Tax decision and registrations before enabling Stripe Tax.

## Required Environment Variables

These must never be added to the Vite browser app:

- `STRIPE_SECRET_KEY` or a restricted `STRIPE_RAK`
- `STRIPE_WEBHOOK_SECRET`

These can be public only if needed by a future client checkout helper:

- `VITE_STRIPE_PUBLISHABLE_KEY`

For the current Vite app, Stripe server calls require a backend boundary before
implementation. That can be a Vercel Function, Supabase Edge Function, or a
future Next.js route handler. Do not call Stripe secret APIs from browser code.

## Checkout Flow

1. User signs in with Supabase Auth.
2. User chooses Starter or Pro from the pricing/account screen.
3. Browser calls a server endpoint with the requested plan ID.
4. Server verifies the Supabase user.
5. Server maps the plan ID to a trusted Stripe price ID or lookup key.
6. Server creates a Checkout Session with `mode: "subscription"`.
7. Browser redirects to Stripe-hosted Checkout.
8. Stripe redirects back to a success URL with `session_id`.
9. App shows a pending/success state but does not grant paid access from redirect alone.
10. Webhook verifies payment/subscription state and updates Supabase.

Do not trust client-submitted price IDs, amounts, currencies, email addresses,
or paid access state.

## Customer Portal Flow

Use Stripe Customer Portal for self-service billing management:

- Update payment method.
- View invoices.
- Cancel subscription.
- Change plan when supported.

The app should show this as `Manage subscription` inside the future account menu.
The server must create the portal session from the authenticated user's stored
Stripe customer ID.

## Webhook Trust Rules

Paid access can only change after a verified webhook event or a server-side
Stripe lookup.

Every webhook handler must:

- Verify the Stripe signature with `STRIPE_WEBHOOK_SECRET`.
- Reject events with invalid signatures.
- Ignore duplicate events by storing processed Stripe event IDs.
- Verify the subscription belongs to the expected Stripe customer.
- Verify the price/product maps to a known Shelf Margin plan.
- Verify currency is `usd`.
- Verify the amount matches the expected plan price.
- Store `stripe_customer_id`, `stripe_subscription_id`, plan, status, and current period dates.
- Downgrade access when subscription status is canceled, unpaid, incomplete,
  incomplete expired, or otherwise not entitled.

## Suggested Supabase Billing Fields

The existing `profiles.subscription_status` is too small for production billing.
Add a dedicated table before implementing Stripe:

```sql
create table public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free_beta',
  subscription_status text not null default 'free_beta',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
```

RLS should allow the signed-in user to select their own billing row, but all
insert/update/delete writes should happen through trusted server code or a
locked-down function. Do not let users edit their own paid plan from the client.

Add a second table for webhook idempotency:

```sql
create table private.stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
```

## Implementation Slices

### Slice 1: Billing Data Model

- Files likely touched: Supabase migration, `docs/DATABASE_READINESS.md`.
- Provider changes required: apply migration in hosted Supabase after review.
- Local verification command: `npm test`.
- Browser verification path: account area after UI exists.
- Production/provider verification: hosted table, RLS, and write boundary proof.
- Rollback risk: medium.

### Slice 2: Server Boundary Decision

- Files likely touched: deployment/server docs, future API route or function.
- Provider changes required: Vercel or Supabase function environment variables.
- Local verification command: endpoint test once built.
- Browser verification path: `/pricing`.
- Production/provider verification: function logs with no secret leakage.
- Rollback risk: medium.

### Slice 3: Checkout Session Creation

- Files likely touched: server endpoint, pricing action UI, tests.
- Provider changes required: Stripe test products/prices and restricted key.
- Local verification command: payment endpoint tests.
- Browser verification path: `/pricing`.
- Production/provider verification: Stripe test-mode Checkout Session.
- Rollback risk: high until webhook trust is complete.

### Slice 4: Webhook Processing

- Files likely touched: webhook endpoint, billing repo, tests.
- Provider changes required: Stripe webhook endpoint and signing secret.
- Local verification command: webhook signature tests and Stripe CLI event tests.
- Browser verification path: account/subscription status.
- Production/provider verification: Stripe test events update Supabase correctly.
- Rollback risk: high.

### Slice 5: Customer Portal

- Files likely touched: portal endpoint, account menu UI, tests.
- Provider changes required: Customer Portal configuration in Stripe Dashboard.
- Local verification command: endpoint tests.
- Browser verification path: account menu -> manage subscription.
- Production/provider verification: test portal session redirect.
- Rollback risk: medium.

## Do Not Implement Yet

- Do not enable paid gating until webhooks are verified.
- Do not add Apple Watch paywall logic until iOS exists.
- Do not enable Stripe Tax until tax registrations are decided.
- Do not add secret Stripe keys to Vite or public client code.
- Do not use client-submitted price IDs or subscription status.
- Do not migrate from Supabase Auth to Clerk for billing alone.

## Launch Gate

Billing is launch-ready only when:

- Test-mode Checkout works.
- Webhook signature verification works.
- Webhook idempotency works.
- Paid status is stored server-side in Supabase.
- Canceled/failed subscriptions remove paid access.
- Customer Portal works.
- Live-mode keys and webhook endpoint are configured.
- A production domain exists.
- Privacy, terms, and refund/cancellation copy are reviewed.
