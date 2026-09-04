-- Account lifecycle: self-serve deletion (GDPR/CCPA right to erasure).
-- Least-privilege design: the deletion primitive runs as the authenticated
-- caller via a security-definer RPC that can only ever target auth.uid().
-- The server never needs the service role key to delete an account; it simply
-- forwards the user's own bearer token to this RPC. `auth.users` cascades to
-- every user-owned table (profiles, scans, scan_verifications, billing_accounts).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Reject unauthenticated / anon calls outright.
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Deletes ONLY the caller's own auth row; the filter is pinned to auth.uid().
  -- Cascade removes all owned application rows.
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
