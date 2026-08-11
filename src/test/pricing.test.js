import { describe, expect, it } from "vitest";
import {
  paidFeatureById,
  pricingPlanById,
  PRICING_PLANS,
  PRICING_STATUS,
} from "../lib/pricing.js";

describe("pricing model", () => {
  it("keeps the starter plan locked at the first planned paid price", () => {
    const starter = pricingPlanById("starter");

    expect(starter.priceLabel).toBe("$15/mo");
    expect(starter.status).toBe(PRICING_STATUS.planned);
    expect(starter.audience).toContain("Solo book resellers");
  });

  it("keeps pro as the future higher-value reseller plan", () => {
    const pro = pricingPlanById("pro");

    expect(pro.priceLabel).toBe("$29/mo");
    expect(pro.features).toContain("Apple Watch alerts when the iOS app is ready");
  });

  it("treats Apple Watch alerts as a future paid Pro feature", () => {
    const feature = paidFeatureById("apple-watch-alerts");

    expect(feature.planId).toBe("pro");
    expect(feature.status).toBe(PRICING_STATUS.future);
    expect(feature.summary).toContain("future paid feature");
  });

  it("does not include a team plan yet", () => {
    expect(PRICING_PLANS.map((plan) => plan.id)).not.toContain("team");
  });
});
