-- Field-test verification data. This keeps app estimates in `scans` separate
-- from factual marketplace checks gathered during real-world testing.

create table if not exists public.scan_verifications (
  scan_id                uuid primary key references public.scans(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  actual_source_checked  text not null default ''
                          check (actual_source_checked in ('','amazon','ebay','amazon+ebay')),
  amazon_eligible        text not null default ''
                          check (amazon_eligible in ('','yes','no','restricted')),
  amazon_actual_price    numeric(10,2),
  amazon_actual_rank     integer,
  ebay_sold_comp         numeric(10,2),
  actual_shipping        numeric(10,2),
  actual_fees            numeric(10,2),
  actual_net             numeric(10,2),
  real_decision          text not null default ''
                          check (real_decision in ('','buy','pass','watch')),
  notes                  text not null default '',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists scan_verifications_user_idx
  on public.scan_verifications (user_id);

alter table public.scan_verifications enable row level security;

create policy "own scan verifications - select" on public.scan_verifications
  for select using (auth.uid() = user_id);
create policy "own scan verifications - insert" on public.scan_verifications
  for insert with check (auth.uid() = user_id);
create policy "own scan verifications - update" on public.scan_verifications
  for update using (auth.uid() = user_id);
create policy "own scan verifications - delete" on public.scan_verifications
  for delete using (auth.uid() = user_id);
