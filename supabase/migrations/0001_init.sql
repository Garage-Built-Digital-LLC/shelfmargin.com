-- Shelf Margin initial schema.
-- Design note: `scans` is deliberately a NASCENT INVENTORY table — it carries a
-- book from scan → listed → sold → shipped so the Phase 3 fulfillment engine
-- (bulk listing, labels, Media Mail) needs no re-modeling. Every user-facing
-- table has Row Level Security so a user can only ever see their own rows.

-- === profiles ===============================================================
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  cost_per_book      numeric(10,2) not null default 1.00,
  buy_threshold      numeric(10,2) not null default 5.00,
  default_condition  text not null default 'used-good'
                       check (default_condition in ('new','used-good','used-acceptable')),
  sound_enabled      boolean not null default true,
  trial_scans_used   integer not null default 0,          -- counts SUCCESSFUL, distinct lookups only
  subscription_status text not null default 'trial'
                       check (subscription_status in ('trial','active','expired')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- === scans / inventory ======================================================
create table if not exists public.scans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  isbn                text not null,                       -- normalized ISBN-13
  title               text,
  author              text,
  condition           text not null default 'used-good',
  cost_per_book       numeric(10,2),                       -- snapshot at scan time
  amazon_price        numeric(10,2),
  ebay_price          numeric(10,2),
  ebay_price_basis    text default 'active-median',        -- 'sold-median' | 'active-median'
  amazon_bsr          integer,
  amazon_net          numeric(10,2),
  ebay_net            numeric(10,2),
  recommended_platform text check (recommended_platform in ('amazon','ebay')),
  velocity            text check (velocity in ('fast','medium','slow','unknown')),
  status              text not null check (status in ('buy','pass','check')),
  restricted          boolean not null default false,
  copy_count          integer not null default 1,
  bin_location        text,                                -- find-it-later superpower
  -- lifecycle beyond the buy decision (Phase 3):
  lifecycle_status    text not null default 'scouted'
                       check (lifecycle_status in ('scouted','purchased','listed','sold','shipped')),
  session_id          uuid,                                -- groups a sourcing run
  created_at          timestamptz not null default now()
);

create index if not exists scans_user_created_idx on public.scans (user_id, created_at desc);
create index if not exists scans_user_isbn_idx on public.scans (user_id, isbn);

-- === Row Level Security =====================================================
alter table public.profiles enable row level security;
alter table public.scans    enable row level security;

create policy "own profile - select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "own profile - upsert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = user_id);

create policy "own scans - select" on public.scans
  for select using (auth.uid() = user_id);
create policy "own scans - insert" on public.scans
  for insert with check (auth.uid() = user_id);
create policy "own scans - update" on public.scans
  for update using (auth.uid() = user_id);
create policy "own scans - delete" on public.scans
  for delete using (auth.uid() = user_id);

-- === auto-provision a profile row on signup =================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
