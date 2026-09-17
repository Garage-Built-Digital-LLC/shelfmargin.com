-- 100-book lifetime free scan cap.
-- Distinct ISBNs are recorded in lifetime_scan_isbns. Paid Starter/Pro
-- (trialing or active) bypass the cap. Browser roles cannot write the
-- counter; only this RPC and the scans insert trigger can.

create table if not exists public.lifetime_scan_isbns (
  user_id uuid not null references auth.users(id) on delete cascade,
  isbn text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, isbn),
  constraint lifetime_scan_isbns_isbn_len check (char_length(isbn) >= 10)
);

create index if not exists lifetime_scan_isbns_user_idx
  on public.lifetime_scan_isbns (user_id);

alter table public.lifetime_scan_isbns enable row level security;

drop policy if exists "own lifetime scan isbns - select" on public.lifetime_scan_isbns;
create policy "own lifetime scan isbns - select"
  on public.lifetime_scan_isbns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.lifetime_scan_isbns from public;
revoke all on public.lifetime_scan_isbns from anon;
revoke all on public.lifetime_scan_isbns from authenticated;
grant select on public.lifetime_scan_isbns to authenticated;

insert into public.lifetime_scan_isbns (user_id, isbn)
select distinct user_id, isbn
from public.scans
where isbn is not null
  and char_length(isbn) >= 10
on conflict do nothing;

update public.profiles as p
set trial_scans_used = (
  select count(*)::integer
  from public.lifetime_scan_isbns as counted
  where counted.user_id = p.user_id
);

create or replace function public.consume_trial_scan(p_isbn text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  paid boolean;
  already boolean;
  used integer;
  cap constant integer := 100;
  normalized_isbn text;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  normalized_isbn := nullif(btrim(p_isbn), '');
  if normalized_isbn is null or char_length(normalized_isbn) < 10 then
    raise exception 'valid ISBN required' using errcode = '22023';
  end if;

  perform 1 from public.profiles where user_id = uid for update;

  select exists (
    select 1
    from public.billing_accounts
    where user_id = uid
      and plan in ('starter', 'pro')
      and subscription_status in ('trialing', 'active')
  ) into paid;

  select count(*)::integer into used
  from public.lifetime_scan_isbns
  where user_id = uid;

  if paid then
    return jsonb_build_object(
      'allowed', true,
      'paid', true,
      'used', used,
      'remaining', null,
      'cap', cap
    );
  end if;

  select exists (
    select 1
    from public.lifetime_scan_isbns
    where user_id = uid
      and isbn = normalized_isbn
  ) into already;

  if already then
    return jsonb_build_object(
      'allowed', true,
      'paid', false,
      'used', used,
      'remaining', greatest(cap - used, 0),
      'cap', cap
    );
  end if;

  if used >= cap then
    return jsonb_build_object(
      'allowed', false,
      'paid', false,
      'used', used,
      'remaining', 0,
      'cap', cap,
      'code', 'scan_cap_reached'
    );
  end if;

  insert into public.lifetime_scan_isbns (user_id, isbn)
  values (uid, normalized_isbn);
  used := used + 1;

  update public.profiles
  set trial_scans_used = used,
      updated_at = now()
  where user_id = uid;

  return jsonb_build_object(
    'allowed', true,
    'paid', false,
    'used', used,
    'remaining', greatest(cap - used, 0),
    'cap', cap
  );
end;
$$;

revoke all on function public.consume_trial_scan(text) from public;
revoke execute on function public.consume_trial_scan(text) from anon;
grant execute on function public.consume_trial_scan(text) to authenticated;

create or replace function private.enforce_lifetime_scan_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid boolean;
  already boolean;
  used integer;
  cap constant integer := 100;
begin
  select exists (
    select 1
    from public.billing_accounts
    where user_id = new.user_id
      and plan in ('starter', 'pro')
      and subscription_status in ('trialing', 'active')
  ) into paid;

  if paid then
    return new;
  end if;

  select exists (
    select 1
    from public.lifetime_scan_isbns
    where user_id = new.user_id
      and isbn = new.isbn
  ) into already;

  if already then
    return new;
  end if;

  select count(*)::integer into used
  from public.lifetime_scan_isbns
  where user_id = new.user_id;

  if used >= cap then
    raise exception 'scan_cap_reached'
      using errcode = 'P0001',
            hint = 'Subscribe to Starter or Pro to keep scanning.';
  end if;

  insert into public.lifetime_scan_isbns (user_id, isbn)
  values (new.user_id, new.isbn)
  on conflict do nothing;

  update public.profiles
  set trial_scans_used = (
    select count(*)::integer
    from public.lifetime_scan_isbns
    where user_id = new.user_id
  ),
      updated_at = now()
  where user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists scans_enforce_lifetime_cap on public.scans;
create trigger scans_enforce_lifetime_cap
  before insert on public.scans
  for each row
  execute function private.enforce_lifetime_scan_cap();
