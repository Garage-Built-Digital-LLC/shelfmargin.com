-- Service-role-only RPC for Stripe webhook idempotency.
-- `private.stripe_events` is intentionally outside exposed schemas, so the
-- server records events through this narrowly granted function.

create or replace function public.record_stripe_event(processed_event_id text, processed_event_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.stripe_events (event_id, event_type)
  values (processed_event_id, processed_event_type);

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.record_stripe_event(text, text) from public;
revoke execute on function public.record_stripe_event(text, text) from anon;
revoke execute on function public.record_stripe_event(text, text) from authenticated;
grant execute on function public.record_stripe_event(text, text) to service_role;
