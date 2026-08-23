export const BILLING_PLANS = {
  freeBeta: "free_beta",
  starter: "starter",
  pro: "pro",
};

export const BILLING_STATUSES = {
  freeBeta: "free_beta",
  trialing: "trialing",
  active: "active",
  pastDue: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incompleteExpired: "incomplete_expired",
  paused: "paused",
};

export const STRIPE_PRICE_LOOKUP_KEYS = {
  starter: "shelfmargin_starter_monthly",
  pro: "shelfmargin_pro_monthly",
};

const paidPlans = new Set([BILLING_PLANS.starter, BILLING_PLANS.pro]);
const entitledStatuses = new Set([
  BILLING_STATUSES.freeBeta,
  BILLING_STATUSES.trialing,
  BILLING_STATUSES.active,
]);

export function isKnownBillingPlan(plan) {
  return Object.values(BILLING_PLANS).includes(plan);
}

export function isKnownSubscriptionStatus(status) {
  return Object.values(BILLING_STATUSES).includes(status);
}

export function billingPlanFromLookupKey(lookupKey) {
  if (lookupKey === STRIPE_PRICE_LOOKUP_KEYS.starter) return BILLING_PLANS.starter;
  if (lookupKey === STRIPE_PRICE_LOOKUP_KEYS.pro) return BILLING_PLANS.pro;
  return null;
}

export function hasAppAccess(account) {
  if (!account) return false;
  if (!isKnownBillingPlan(account.plan)) return false;
  if (!isKnownSubscriptionStatus(account.subscription_status)) return false;
  if (account.plan === BILLING_PLANS.freeBeta) {
    return account.subscription_status === BILLING_STATUSES.freeBeta;
  }
  return paidPlans.has(account.plan) && entitledStatuses.has(account.subscription_status);
}

export function hasPaidAccess(account) {
  if (!account) return false;
  if (!paidPlans.has(account.plan)) return false;
  return [BILLING_STATUSES.trialing, BILLING_STATUSES.active].includes(account.subscription_status);
}
