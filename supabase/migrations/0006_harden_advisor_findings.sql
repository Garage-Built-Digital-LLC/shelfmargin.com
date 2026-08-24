-- Resolve hosted Supabase advisor findings found during launch security review.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
    grant execute on function public.rls_auto_enable() to postgres;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end $$;

create index if not exists scan_verifications_scan_user_idx
  on public.scan_verifications (scan_id, user_id);

drop policy if exists "own profile - select" on public.profiles;
create policy "own profile - select" on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own profile - upsert" on public.profiles;
create policy "own profile - upsert" on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "own scans - select" on public.scans;
create policy "own scans - select" on public.scans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own scans - insert" on public.scans;
create policy "own scans - insert" on public.scans
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "own scans - delete" on public.scans;
create policy "own scans - delete" on public.scans
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own scan verifications - select" on public.scan_verifications;
create policy "own scan verifications - select" on public.scan_verifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own scan verifications - insert" on public.scan_verifications;
create policy "own scan verifications - insert" on public.scan_verifications
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "own scan verifications - delete" on public.scan_verifications;
create policy "own scan verifications - delete" on public.scan_verifications
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
