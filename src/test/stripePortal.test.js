import { describe, expect, it, vi } from "vitest";
import { createPortalSession, fetchBillingAccount } from "../lib/stripePortal.js";

const completeEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_service",
  VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
  STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
  STRIPE_STARTER_PRICE_ID: "price_starter123",
  STRIPE_PRO_PRICE_ID: "price_pro123",
  APP_BASE_URL: "http://localhost:5173/",
};

function fakeStripe() {
  return {
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({ url: "https://billing.stripe.com/session/test" })),
      },
    },
  };
}

function fetchSequence(responses) {
  return vi.fn(async () => responses.shift());
}

describe("Stripe Customer Portal foundation", () => {
  it("reads billing accounts with the server-only service key", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => [{ stripe_customer_id: "cus_123", plan: "starter", subscription_status: "active" }],
    }));

    const account = await fetchBillingAccount("user_123", completeEnv, fetchImpl);

    expect(account.stripe_customer_id).toBe("cus_123");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/billing_accounts?select=stripe_customer_id%2Cplan%2Csubscription_status&user_id=eq.user_123&limit=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "sb_secret_service",
          authorization: "Bearer sb_secret_service",
        }),
      })
    );
  });

  it("requires a signed-in user before creating a portal session", async () => {
    await expect(createPortalSession({
      authHeader: "",
      env: completeEnv,
      stripeClient: fakeStripe(),
      fetchImpl: vi.fn(),
    })).rejects.toMatchObject({ status: 401 });
  });

  it("asks users to start a paid plan before opening the portal", async () => {
    const fetchImpl = fetchSequence([
      { ok: true, json: async () => ({ id: "user_123", email: "seller@example.com" }) },
      { ok: true, json: async () => [{ stripe_customer_id: null, plan: "free_beta", subscription_status: "free_beta" }] },
    ]);

    await expect(createPortalSession({
      authHeader: "Bearer token",
      env: completeEnv,
      stripeClient: fakeStripe(),
      fetchImpl,
    })).rejects.toMatchObject({
      status: 409,
      code: "no_stripe_customer",
    });
  });

  it("creates a portal session for an existing Stripe customer", async () => {
    const stripe = fakeStripe();
    const fetchImpl = fetchSequence([
      { ok: true, json: async () => ({ id: "user_123", email: "seller@example.com" }) },
      { ok: true, json: async () => [{ stripe_customer_id: "cus_123", plan: "starter", subscription_status: "active" }] },
    ]);

    const session = await createPortalSession({
      authHeader: "Bearer token",
      env: completeEnv,
      stripeClient: stripe,
      fetchImpl,
    });

    expect(session).toEqual({ url: "https://billing.stripe.com/session/test" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:5173/pricing",
    });
  });
});
