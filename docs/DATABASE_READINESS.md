# ShelfMargin Database Readiness

Last checked: August 23, 2026

## Active Supabase Project

- Project name: Shelf Margin
- Project ref: `qvhhernpruxclgxvwyou`
- App URL variable: `VITE_SUPABASE_URL=https://qvhhernpruxclgxvwyou.supabase.co`
- Browser key variable: `VITE_SUPABASE_ANON_KEY`

Do not put the Supabase service role key in this Vite frontend app.

## Applied Migrations

- `initial_schema`
- `scan_verifications`
- `first_user_admin`
- `harden_rls_and_profile_updates`
- `billing_accounts`

## Required Tables

- `public.profiles`
- `public.scans`
- `public.scan_verifications`
- `public.billing_accounts`
- `private.stripe_events`

## Required Security State

- Row Level Security enabled on all required public tables.
- `profiles` has select, insert, and update policies scoped to `auth.uid() = user_id`.
- `scans` has select, insert, update, and delete policies scoped to `auth.uid() = user_id`.
- `scan_verifications` has select, insert, update, and delete policies scoped to `auth.uid() = user_id`.
- `billing_accounts` lets authenticated users select only their own billing row.
- `billing_accounts` blocks browser insert, update, and delete writes; future Stripe changes must happen from trusted server code.
- `private.stripe_events` is kept in the private schema for future Stripe webhook idempotency.
- Signup trigger `on_auth_user_created` creates a profile row for new users.
- Signup trigger `on_auth_user_created` creates a free-beta billing row for new users.
- After a clean user reset, the first recreated account receives `profiles.role = 'admin'`.
- Later accounts receive `profiles.role = 'user'`.

## App-Level Verification

The unsigned REST checks should return `200 []` for:

- `/rest/v1/profiles?select=*&limit=1`
- `/rest/v1/scans?select=*&limit=1`
- `/rest/v1/scan_verifications?select=*&limit=1`

A `200 []` response means the table is exposed through the API and RLS is preventing unauthenticated row access instead of failing with a schema or permission error.

The billing table should be checked with a signed-in user token:

- `/rest/v1/billing_accounts?select=*&limit=1`

Anonymous users should not be able to read billing account rows.

## Next Database Work

- Create a real test account through the app.
- Confirm the profile row is created automatically.
- Confirm the free-beta billing row is created automatically.
- Scan one book and confirm the row saves in `scans`.
- Save one book-check row and confirm it upserts into `scan_verifications`.
- Apply `0004_harden_rls_and_profile_updates.sql` and `0005_billing_accounts.sql` to hosted Supabase before public testing.
- Run a two-user RLS check after the hosted migrations are applied.
- Move export history from browser local storage into a database table when it becomes a product feature.
