export const PRICING_STATUS = {
  beta: "beta",
  planned: "planned",
  future: "future",
};

export const PRICING_PLANS = [
  {
    id: "free-beta",
    name: "Free beta",
    priceLabel: "$0",
    cadence: "during beta",
    status: PRICING_STATUS.beta,
    audience: "Early testers scanning real books.",
    summary: "Use Shelf Margin while we prove real scanning trips, buy lists, and exports.",
    features: [
      "Scan books",
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
    cadence: "planned",
    status: PRICING_STATUS.planned,
    audience: "Solo book resellers who source regularly.",
    summary: "The first paid plan after the workflow proves real sourcing value.",
    features: [
      "Everything in free beta",
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
    cadence: "planned after live data",
    status: PRICING_STATUS.planned,
    audience: "Higher-volume resellers who need faster decisions while sourcing.",
    summary: "Adds higher-value workflow helpers after marketplace data is useful.",
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
    id: "live-marketplace-checks",
    name: "Live marketplace checks",
    planId: "starter",
    status: PRICING_STATUS.planned,
    summary: "Paid plans should only launch after live marketplace checks are useful enough to justify payment.",
  },
];

export function pricingPlanById(planId) {
  return PRICING_PLANS.find((plan) => plan.id === planId) || null;
}

export function paidFeatureById(featureId) {
  return PAID_FEATURES.find((feature) => feature.id === featureId) || null;
}
