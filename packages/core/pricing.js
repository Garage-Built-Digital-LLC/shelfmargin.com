export const PRICING_STATUS = {
  beta: "beta",
  planned: "planned",
  future: "future",
};

export const PRICING_PLANS = [
  {
    id: "free-beta",
    name: "Free",
    priceLabel: "$0",
    cadence: "100 books lifetime",
    status: PRICING_STATUS.beta,
    audience: "New accounts scanning their first 100 books.",
    summary: "100 lifetime scans per account, then Starter or Pro is required to keep scanning.",
    features: [
      "100 lifetime book scans",
      "Save scan history",
      "Build a buy list",
      "Export CSV",
      "Add notes before buying",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$15/mo",
    cadence: "monthly",
    status: PRICING_STATUS.planned,
    audience: "Solo book resellers who source regularly.",
    summary: "Keep scanning after the 100-book free lifetime cap.",
    features: [
      "Everything in Free",
      "Account scan history",
      "Saved buy lists",
      "Field-test exports",
      "Basic live-data checks when connected",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$29/mo",
    cadence: "monthly",
    status: PRICING_STATUS.planned,
    audience: "Higher-volume resellers who need faster decisions while sourcing.",
    summary: "Higher-volume scanning after the 100-book free lifetime cap.",
    features: [
      "Everything in Starter",
      "Advanced live-data checks",
      "Faster sourcing workflow tools",
      "Apple Watch alerts when the iOS app is ready",
      "Priority workflow feedback during beta",
    ],
  },
];

export const PAID_FEATURES = [
  {
    id: "apple-watch-alerts",
    name: "Apple Watch alerts",
    planId: "pro",
    status: PRICING_STATUS.future,
    summary: "A future paid feature that shows buy, check, or pass results on Apple Watch after iPhone scanning is reliable.",
  },
  {
    id: "live-amazon-checks",
    name: "Live Amazon checks",
    planId: "starter",
    status: PRICING_STATUS.planned,
    summary: "Paid plans should only launch after live Amazon checks are useful enough to justify payment.",
  },
];

export function pricingPlanById(planId) {
  return PRICING_PLANS.find((plan) => plan.id === planId) || null;
}

export function paidFeatureById(featureId) {
  return PAID_FEATURES.find((feature) => feature.id === featureId) || null;
}
