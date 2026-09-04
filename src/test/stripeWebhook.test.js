import { describe, expect, it, vi } from "vitest";
import { BILLING_PLANS, BILLING_STATUSES } from "../lib/billing.js";
import {
  billingPayloadFromSubscription,
  handleStripeWebhook,
  planFromPrice,
  priceMatchesPlan,
  recordStripeEvent,
  stripeWebhookReadiness,
  upsertBillingAccount,
} from "../lib/stripeWebhook.js";

const completeEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_service",
  VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
  STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
  STRIPE_STARTER_PRICE_ID: "price_starter123",
  STRIPE_PRO_PRICE_ID: "price_pro123",
};

describe("Stripe webhook billing updates", () => {
  it("reports missing Supabase service access without exposing keys", () => {
    const status = stripeWebhookReadiness({
      ...completeEnv,
      SUPABASE_SERVICE_ROLE_KEY: "",
    });

    expect(status.ready).toBe(false);
    expect(status.supabaseServiceKey.present).toBe(false);
    expect(JSON.stringify(status)).not.toContain("sb_secret");
  });

  it("maps Stripe prices to internal plans by lookup key or trusted price ID", () => {
    expect(planFromPrice({
      lookup_key: "shelfmargin_starter_monthly",
      currency: "usd",
      unit_amount: 1500,
    }, completeEnv)).toBe(BILLING_PLANS.starter);
    expect(planFromPrice({
      id: "price_pro123",
      currency: "usd",
      unit_amount: 2900,
    }, completeEnv)).toBe(BILLING_PLANS.pro);
    expect(planFromPrice({
      id: "price_attacker",
      currency: "usd",
      unit_amount: 2900,
    }, completeEnv)).toBeNull();
  });

  it("requires trusted Stripe prices to match expected currency and amount", () => {
    expect(priceMatchesPlan({ currency: "usd", unit_amount: 1500 }, BILLING_PLANS.starter)).toBe(true);
    expect(planFromPrice({
      id: "price_starter123",
      lookup_key: "shelfmargin_starter_monthly",
      currency: "eur",
      unit_amount: 1500,
    }, completeEnv)).toBeNull();
    expect(planFromPrice({
      id: "price_starter123",
      lookup_key: "shelfmargin_starter_monthly",
      currency: "usd",
      unit_amount: 1,
    }, completeEnv)).toBeNull();
  });

  it("builds a safe billing account payload from a subscription", () => {
    const payload = billingPayloadFromSubscription({
      id: "sub_123",
      customer: "cus_123",
      status: BILLING_STATUSES.active,
      cancel_at_period_end: false,
      current_period_start: 1_800_000_000,
      current_period_end: 1_802_592_000,
      metadata: { supabase_user_id: "user_123" },
      items: {
        data: [{
          price: {
            id: "price_starter123",
            lookup_key: "shelfmargin_starter_monthly",
            currency: "usd",
            unit_amount: 1500,
          },
        }],
      },
    }, completeEnv);

    expect(payload).toMatchObject({
      user_id: "user_123",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      stripe_price_lookup_key: "shelfmargin_starter_monthly",
      plan: BILLING_PLANS.starter,
      subscription_status: BILLING_STATUSES.active,
      cancel_at_period_end: false,
    });
  });

  it("upserts billing accounts with the service key only on the server side", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await upsertBillingAccount({ user_id: "user_123", plan: BILLING_PLANS.pro }, completeEnv, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/billing_accounts?on_conflict=user_id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "sb_secret_service",
          authorization: "Bearer sb_secret_service",
          prefer: "resolution=merge-duplicates,return=minimal",
        }),
      })
    );
  });

  it("records webhook ids through the service-role-only idempotency RPC", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => true }));
    const firstSeen = await recordStripeEvent(
      { id: "evt_123", type: "customer.subscription.updated" },
      completeEnv,
      fetchImpl
    );

    expect(firstSeen).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/record_stripe_event",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "sb_secret_service",
          authorization: "Bearer sb_secret_service",
        }),
        body: JSON.stringify({
          processed_event_id: "evt_123",
          processed_event_type: "customer.subscription.updated",
        }),
      })
    );
  });

  it("skips duplicate webhook events after signature verification", async () => {
    const event = {
      id: "evt_duplicate",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          metadata: { supabase_user_id: "user_123" },
          items: {
            data: [{
              price: {
                id: "price_pro123",
                lookup_key: "shelfmargin_pro_monthly",
                currency: "usd",
                unit_amount: 2900,
              },
            }],
          },
        },
      },
    };
    const stripeClient = {
      webhooks: { constructEvent: vi.fn(() => event) },
    };
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("/rpc/record_stripe_event")) {
        return { ok: true, json: async () => false };
      }
      return { ok: true };
    });

    await expect(handleStripeWebhook({
      rawBody: Buffer.from("{}"),
      signature: "sig",
      env: completeEnv,
      stripeClient,
      fetchImpl,
    })).resolves.toEqual({ received: true, processed: false, duplicate: true });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects webhook processing until the signing secret is complete", async () => {
    await expect(handleStripeWebhook({
      rawBody: Buffer.from("{}"),
      signature: "sig",
      env: { ...completeEnv, STRIPE_WEBHOOK_SECRET: "whsec_..." },
      stripeClient: { webhooks: { constructEvent: vi.fn() } },
      fetchImpl: vi.fn(),
    })).rejects.toMatchObject({
      status: 503,
      code: "stripe_webhook_not_configured",
    });
  });

  it("verifies a subscription webhook and updates billing", async () => {
    const event = {
      id: "evt_123",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          metadata: { supabase_user_id: "user_123" },
          items: {
            data: [{
              price: {
                id: "price_pro123",
                lookup_key: "shelfmargin_pro_monthly",
                currency: "usd",
                unit_amount: 2900,
              },
            }],
          },
        },
      },
    };
    const stripeClient = {
      webhooks: { constructEvent: vi.fn(() => event) },
    };
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("/rpc/record_stripe_event")) {
        return { ok: true, json: async () => true };
      }
      return { ok: true };
    });

    await expect(handleStripeWebhook({
      rawBody: Buffer.from("{}"),
      signature: "sig",
      env: completeEnv,
      stripeClient,
      fetchImpl,
    })).resolves.toEqual({ received: true, processed: true });

    expect(stripeClient.webhooks.constructEvent).toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
