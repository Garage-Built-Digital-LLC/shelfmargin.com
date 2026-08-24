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
});
