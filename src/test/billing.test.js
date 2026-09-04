import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BILLING_PLANS,
  BILLING_STATUSES,
  STRIPE_PRICE_LOOKUP_KEYS,
  billingPlanFromLookupKey,
  billingPlanLabel,
  billingStatusLabel,
  hasAppAccess,
  hasPaidAccess,
  isKnownBillingPlan,
  isKnownSubscriptionStatus,
} from "../lib/billing.js";

describe("billing model", () => {
  it("keeps the locked pricing lookup keys mapped to internal plans", () => {
    expect(billingPlanFromLookupKey(STRIPE_PRICE_LOOKUP_KEYS.starter)).toBe(BILLING_PLANS.starter);
    expect(billingPlanFromLookupKey(STRIPE_PRICE_LOOKUP_KEYS.pro)).toBe(BILLING_PLANS.pro);
    expect(billingPlanFromLookupKey("attacker_price")).toBeNull();
  });

  it("recognizes only known plans and subscription states", () => {
    expect(isKnownBillingPlan(BILLING_PLANS.freeBeta)).toBe(true);
    expect(isKnownBillingPlan("team")).toBe(false);
    expect(isKnownSubscriptionStatus(BILLING_STATUSES.active)).toBe(true);
    expect(isKnownSubscriptionStatus("comped")).toBe(false);
  });

  it("returns plain billing labels for customer-facing account UI", () => {
    expect(billingPlanLabel(BILLING_PLANS.freeBeta)).toBe("Free beta");
    expect(billingPlanLabel(BILLING_PLANS.starter)).toBe("Starter");
    expect(billingPlanLabel("custom")).toBe("Unknown plan");
    expect(billingStatusLabel(BILLING_STATUSES.active)).toBe("Active");
    expect(billingStatusLabel("custom")).toBe("Unknown status");
  });

  it("allows free beta app access without treating it as paid", () => {
    const account = { plan: BILLING_PLANS.freeBeta, subscription_status: BILLING_STATUSES.freeBeta };

    expect(hasAppAccess(account)).toBe(true);
    expect(hasPaidAccess(account)).toBe(false);
  });

  it("requires trialing or active paid subscriptions for paid access", () => {
    expect(hasPaidAccess({ plan: BILLING_PLANS.starter, subscription_status: BILLING_STATUSES.active })).toBe(true);
    expect(hasPaidAccess({ plan: BILLING_PLANS.pro, subscription_status: BILLING_STATUSES.trialing })).toBe(true);
    expect(hasPaidAccess({ plan: BILLING_PLANS.pro, subscription_status: BILLING_STATUSES.pastDue })).toBe(false);
    expect(hasPaidAccess({ plan: BILLING_PLANS.starter, subscription_status: BILLING_STATUSES.canceled })).toBe(false);
  });

  it("keeps billing writes out of the browser-accessible RLS policy", () => {
    const migration = readFileSync("supabase/migrations/0005_billing_accounts.sql", "utf8");

    expect(migration).toContain("create policy \"own billing account - select\"");
    expect(migration).toContain("grant select on public.billing_accounts to authenticated");
    expect(migration).toContain("revoke insert, update, delete on public.billing_accounts from authenticated");
    expect(migration).toContain("private.stripe_events");
  });
});
