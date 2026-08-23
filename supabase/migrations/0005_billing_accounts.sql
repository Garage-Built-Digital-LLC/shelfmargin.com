-- Billing foundation for future Stripe subscriptions.
-- This records account entitlement state but does not process payments.

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_lookup_key text,
  plan text not null default 'free_beta'
    check (plan in ('free_beta', 'starter', 'pro')),
  subscription_status text not null default 'free_beta'
    check (
      subscription_status in (
        'free_beta',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_accounts enable row level security;

drop policy if exists "own billing account - select" on public.billing_accounts;
create policy "own billing account - select" on public.billing_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.billing_accounts from anon;
revoke insert, update, delete on public.billing_accounts from authenticated;
grant select on public.billing_accounts to authenticated;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

insert into public.billing_accounts (user_id)
select user_id
from public.profiles
on conflict (user_id) do nothing;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  next_role text;
begin
  lock table public.profiles in share row exclusive mode;

  if exists (select 1 from public.profiles where role = 'admin') then
    next_role := 'user';
  else
    next_role := 'admin';
  end if;

  insert into public.profiles (user_id, role)
  values (new.id, next_role)
  on conflict (user_id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
