-- Harden user-owned data writes before launch.
-- RLS owns row access; column grants and composite ownership checks reduce the
-- damage from accidental client-side overposting.

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.scan_verifications enable row level security;

drop policy if exists "own profile - update" on public.profiles;
create policy "own profile - update" on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own scans - update" on public.scans;
create policy "own scans - update" on public.scans
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own scan verifications - update" on public.scan_verifications;
create policy "own scan verifications - update" on public.scan_verifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.profiles from authenticated;
grant update (
  cost_per_book,
  buy_threshold,
  default_condition,
  sound_enabled,
  updated_at
) on public.profiles to authenticated;

create unique index if not exists scans_id_user_id_uidx
  on public.scans (id, user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scan_verifications_scan_owner_fk'
      and conrelid = 'public.scan_verifications'::regclass
  ) then
    alter table public.scan_verifications
      add constraint scan_verifications_scan_owner_fk
      foreign key (scan_id, user_id)
      references public.scans (id, user_id)
      on delete cascade;
  end if;
end $$;
