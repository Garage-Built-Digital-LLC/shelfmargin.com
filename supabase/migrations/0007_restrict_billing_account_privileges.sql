-- RLS does not protect TRUNCATE, so browser roles must only have the explicit
-- billing access the app needs: authenticated users can read their own row.

revoke all on public.billing_accounts from public;
revoke all on public.billing_accounts from anon;
revoke all on public.billing_accounts from authenticated;

grant select on public.billing_accounts to authenticated;
