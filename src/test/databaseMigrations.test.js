import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function migration(path) {
  return readFileSync(path, "utf8");
}

describe("database hardening migrations", () => {
  it("keeps advisor policy rewrites scoped to authenticated users", () => {
    const sql = migration("supabase/migrations/0006_harden_advisor_findings.sql");

    expect(sql).toContain("revoke execute on function public.rls_auto_enable() from anon");
    expect(sql).toContain("revoke execute on function public.rls_auto_enable() from authenticated");
    expect(sql).toContain("grant execute on function public.rls_auto_enable() to service_role");
    expect(sql).toContain("create index if not exists scan_verifications_scan_user_idx");

    const policyStatements = sql
      .split(";")
      .filter((statement) => statement.includes("create policy"));

    expect(policyStatements).toHaveLength(8);
    policyStatements.forEach((statement) => {
      expect(statement).toMatch(/\bto authenticated\b/);
      expect(statement).not.toMatch(/\bto anon\b/);
    });
  });

  it("keeps billing account browser privileges select-only", () => {
    const sql = migration("supabase/migrations/0007_restrict_billing_account_privileges.sql");

    expect(sql).toContain("revoke all on public.billing_accounts from public");
    expect(sql).toContain("revoke all on public.billing_accounts from anon");
    expect(sql).toContain("revoke all on public.billing_accounts from authenticated");
    expect(sql).toContain("grant select on public.billing_accounts to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|truncate|all)\s+on public\.billing_accounts to authenticated/i);
  });

  it("keeps Stripe webhook idempotency RPC service-role only", () => {
    const sql = migration("supabase/migrations/0008_stripe_webhook_idempotency_rpc.sql");

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("insert into private.stripe_events");
    expect(sql).toContain("revoke execute on function public.record_stripe_event(text, text) from anon");
    expect(sql).toContain("revoke execute on function public.record_stripe_event(text, text) from authenticated");
    expect(sql).toContain("grant execute on function public.record_stripe_event(text, text) to service_role");
  });

  it("keeps self-serve account deletion pinned to the caller and authenticated-only", () => {
    const sql = migration("supabase/migrations/0009_account_lifecycle.sql");

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("delete from auth.users where id = (select auth.uid())");
    expect(sql).toContain("revoke execute on function public.delete_own_account() from anon");
    expect(sql).toContain("grant execute on function public.delete_own_account() to authenticated");
    // Must never be exposed to anon/public with broad grants.
    expect(sql).not.toMatch(/grant\s+execute\s+on function public\.delete_own_account\(\) to anon/i);
  });
});
