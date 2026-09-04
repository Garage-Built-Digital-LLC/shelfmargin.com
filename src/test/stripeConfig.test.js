import { describe, expect, it } from "vitest";
import { publicStripeStatus, stripeConfigStatus } from "../lib/stripeConfig.js";

describe("Stripe configuration status", () => {
  it("recognizes a complete test-mode Stripe setup", () => {
    const status = stripeConfigStatus({
      VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
      STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
      STRIPE_STARTER_PRICE_ID: "price_starter123",
      STRIPE_PRO_PRICE_ID: "price_pro123",
    });

    expect(status.configured).toBe(true);
    expect(status.mode).toBe("test");
    expect(status.modeMismatch).toBe(false);
  });

  it("flags short webhook secrets as incomplete", () => {
    const status = stripeConfigStatus({
      VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
      STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
      STRIPE_WEBHOOK_SECRET: "whsec_...",
      STRIPE_STARTER_PRICE_ID: "price_starter123",
      STRIPE_PRO_PRICE_ID: "price_pro123",
    });

    expect(status.configured).toBe(false);
    expect(status.checks.webhookSecret.present).toBe(true);
    expect(status.checks.webhookSecret.validPrefix).toBe(true);
    expect(status.checks.webhookSecret.likelyComplete).toBe(false);
  });

  it("flags mixed live and test keys", () => {
    const status = stripeConfigStatus({
      VITE_STRIPE_PUBLISHABLE_KEY: `pk_live_${"a".repeat(100)}`,
      STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
      STRIPE_STARTER_PRICE_ID: "price_starter123",
      STRIPE_PRO_PRICE_ID: "price_pro123",
    });

    expect(status.configured).toBe(false);
    expect(status.mode).toBe("mixed");
    expect(status.modeMismatch).toBe(true);
  });

  it("does not expose secret values in public status", () => {
    const status = publicStripeStatus({
      VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
      STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
      STRIPE_STARTER_PRICE_ID: "price_starter123",
      STRIPE_PRO_PRICE_ID: "price_pro123",
    });

    expect(JSON.stringify(status)).not.toContain("sk_test_");
    expect(JSON.stringify(status)).not.toContain("whsec_");
  });

  it("requires server-side Stripe price IDs for both paid plans", () => {
    const status = stripeConfigStatus({
      VITE_STRIPE_PUBLISHABLE_KEY: `pk_test_${"a".repeat(100)}`,
      STRIPE_SECRET_KEY: `sk_test_${"b".repeat(100)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"c".repeat(32)}`,
      STRIPE_STARTER_PRICE_ID: "price_starter123",
    });

    expect(status.configured).toBe(false);
    expect(status.checks.starterPriceId.validPrefix).toBe(true);
    expect(status.checks.proPriceId.present).toBe(false);
  });
});
