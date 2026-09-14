-- Places & Trips: location-tagged sourcing history.
-- A "place" is a sourcing spot (thrift store, library sale, estate sale…).
-- Each scan can be tagged with the place it was found at (scans.location_id);
-- a "visit" is derived as (place, calendar date) in packages/core. Additive
-- and fully backward-compatible: location_id is nullable, so existing scans
-- and every current flow are untouched.

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null default 'other'
               check (kind in ('thrift','library-sale','garage-sale','estate-sale','bookstore','store','other')),
  lat         double precision,
  lng         double precision,
  address     text,
  notes       text not null default '',
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists places_user_idx on public.places (user_id, archived, created_at desc);

alter table public.places enable row level security;

create policy "own places - select" on public.places
  for select using (auth.uid() = user_id);
create policy "own places - insert" on public.places
  for insert with check (auth.uid() = user_id);
create policy "own places - update" on public.places
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own places - delete" on public.places
  for delete using (auth.uid() = user_id);

-- Tag scans with the place they were sourced at. ON DELETE SET NULL so deleting
-- a place never deletes scan history — those scans just fall back to "Unsorted".
alter table public.scans
  add column if not exists location_id uuid references public.places(id) on delete set null;

create index if not exists scans_user_location_idx
  on public.scans (user_id, location_id, created_at desc);
