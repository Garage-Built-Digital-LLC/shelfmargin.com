import { describe, expect, it, vi } from "vitest";
import { BILLING_PLANS } from "../lib/billing.js";
import {
  bearerToken,
  createCheckoutSession,
  priceIdForPlan,
  STRIPE_API_VERSION,
  STRIPE_INTEGRATION_IDENTIFIER,
} from "../lib/stripeCheckout.js";

const completeEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
  VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
  STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
  STRIPE_STARTER_PRICE_ID: "price_starter123",
  STRIPE_PRO_PRICE_ID: "price_pro123",
  APP_BASE_URL: "http://localhost:5173/",
};

function fakeStripe() {
  return {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: "https://checkout.stripe.com/c/test" })),
      },
    },
  };
}

function fakeUserFetch(user = { id: "user_123", email: "seller@example.com" }) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => user,
  }));
}

describe("Stripe checkout foundation", () => {
  it("uses the current Stripe API version", () => {
    expect(STRIPE_API_VERSION).toBe("2026-07-29.dahlia");
  });

  it("maps trusted internal plans to server-owned price IDs", () => {
    expect(priceIdForPlan(BILLING_PLANS.starter, completeEnv)).toBe("price_starter123");
    expect(priceIdForPlan(BILLING_PLANS.pro, completeEnv)).toBe("price_pro123");
    expect(priceIdForPlan("price_attacker", completeEnv)).toBe("");
  });

  it("extracts bearer tokens only from authorization headers", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("Basic abc123")).toBe("");
    expect(bearerToken("Bearer")).toBe("");
  });

  it("rejects checkout until Stripe is fully configured", async () => {
    await expect(createCheckoutSession({
      planId: BILLING_PLANS.starter,
      authHeader: "Bearer token",
      env: { ...completeEnv, STRIPE_WEBHOOK_SECRET: "whsec_..." },
      stripeClient: fakeStripe(),
      fetchImpl: fakeUserFetch(),
    })).rejects.toMatchObject({
      status: 503,
      code: "stripe_not_configured",
    });
  });

  it("rejects unknown plans before contacting Stripe", async () => {
    const stripe = fakeStripe();
    await expect(createCheckoutSession({
      planId: "enterprise",
      authHeader: "Bearer token",
      env: completeEnv,
      stripeClient: stripe,
      fetchImpl: fakeUserFetch(),
    })).rejects.toMatchObject({ status: 400 });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("requires a signed-in Supabase user", async () => {
    await expect(createCheckoutSession({
      planId: BILLING_PLANS.starter,
      authHeader: "",
      env: completeEnv,
      stripeClient: fakeStripe(),
      fetchImpl: fakeUserFetch(),
    })).rejects.toMatchObject({ status: 401 });
  });

  it("creates subscription checkout with server-owned plan data", async () => {
    const stripe = fakeStripe();
    const fetchImpl = fakeUserFetch();

    const session = await createCheckoutSession({
      planId: BILLING_PLANS.pro,
      authHeader: "Bearer user-token",
      env: completeEnv,
      stripeClient: stripe,
      fetchImpl,
    });

    expect(session).toEqual({ url: "https://checkout.stripe.com/c/test" });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.supabase.co/auth/v1/user", expect.objectContaining({
      headers: expect.objectContaining({
        apikey: "sb_publishable_example",
        authorization: "Bearer user-token",
      }),
    }));
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      client_reference_id: "user_123",
      customer_email: "seller@example.com",
      line_items: [{ price: "price_pro123", quantity: 1 }],
      integration_identifier: STRIPE_INTEGRATION_IDENTIFIER,
      success_url: "http://localhost:5173/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/pricing?checkout=cancelled",
      metadata: {
        supabase_user_id: "user_123",
        shelfmargin_plan: BILLING_PLANS.pro,
      },
    }));
  });
});
