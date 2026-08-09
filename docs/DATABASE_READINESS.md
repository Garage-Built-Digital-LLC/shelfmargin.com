# ShelfMargin Database Readiness

Last checked: August 6, 2026

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

## Required Tables

- `public.profiles`
- `public.scans`
- `public.scan_verifications`

## Required Security State

- Row Level Security enabled on all required public tables.
- `profiles` has select, insert, and update policies scoped to `auth.uid() = user_id`.
- `scans` has select, insert, update, and delete policies scoped to `auth.uid() = user_id`.
- `scan_verifications` has select, insert, update, and delete policies scoped to `auth.uid() = user_id`.
- Signup trigger `on_auth_user_created` creates a profile row for new users.
- After a clean user reset, the first recreated account receives `profiles.role = 'admin'`.
- Later accounts receive `profiles.role = 'user'`.

## App-Level Verification

The anon REST checks should return `200 []` for:

- `/rest/v1/profiles?select=*&limit=1`
- `/rest/v1/scans?select=*&limit=1`
- `/rest/v1/scan_verifications?select=*&limit=1`

A `200 []` response means the table is exposed through the API and RLS is preventing unauthenticated row access instead of failing with a schema or permission error.

## Next Database Work

- Create a real test account through the app.
- Confirm the profile row is created automatically.
- Scan one book and confirm the row saves in `scans`.
- Save one book-check row and confirm it upserts into `scan_verifications`.
- Move export history from browser local storage into a database table when it becomes a product feature.
