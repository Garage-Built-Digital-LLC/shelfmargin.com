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

export const STRIPE_PRICE_RULES = {
  [BILLING_PLANS.starter]: {
    lookupKey: STRIPE_PRICE_LOOKUP_KEYS.starter,
    currency: "usd",
    unitAmount: 1500,
  },
  [BILLING_PLANS.pro]: {
    lookupKey: STRIPE_PRICE_LOOKUP_KEYS.pro,
    currency: "usd",
    unitAmount: 2900,
  },
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

export const FREE_LIFETIME_SCAN_CAP = 100;
export const SCAN_CAP_CODE = "scan_cap_reached";
export const SCAN_CAP_MESSAGE = "Free scan limit reached. Subscribe to Starter or Pro to keep scanning.";
export const SCAN_CAP_UPGRADE_PATH = "/pricing";

export function normalizeLifetimeScanCount(value) {
  const used = Number(value);
  return Number.isFinite(used) && used > 0 ? Math.trunc(used) : 0;
}

export function scanCapState({ account = null, used = 0, isbnAlreadyCounted = false } = {}) {
  const counted = normalizeLifetimeScanCount(used);
  const paid = hasPaidAccess(account);
  const remaining = paid ? null : Math.max(0, FREE_LIFETIME_SCAN_CAP - counted);
  const blocked = !paid && !isbnAlreadyCounted && counted >= FREE_LIFETIME_SCAN_CAP;
  return {
    paid,
    cap: FREE_LIFETIME_SCAN_CAP,
    used: counted,
    remaining,
    blocked,
    code: blocked ? SCAN_CAP_CODE : null,
  };
}

export function canRecordLifetimeScan(input = {}) {
  return !scanCapState(input).blocked;
}

export function isScanCapError(error) {
  if (!error) return false;
  if (error.code === SCAN_CAP_CODE || error.status === 402) return true;
  const text = `${error.message || ""} ${error.hint || ""} ${error.details || ""}`;
  return (error.code === "P0001" && /scan_cap_reached/i.test(text))
    || /scan_cap_reached/i.test(String(error.message || ""));
}

export function scanCapClientError(details = {}) {
  const err = new Error(SCAN_CAP_MESSAGE);
  err.status = 402;
  err.code = SCAN_CAP_CODE;
  err.remaining = 0;
  err.used = Number.isFinite(details.used) ? details.used : FREE_LIFETIME_SCAN_CAP;
  err.cap = Number.isFinite(details.cap) ? details.cap : FREE_LIFETIME_SCAN_CAP;
  err.upgradePath = SCAN_CAP_UPGRADE_PATH;
  return err;
}

export function billingPlanLabel(plan) {
  if (plan === BILLING_PLANS.starter) return "Starter";
  if (plan === BILLING_PLANS.pro) return "Pro";
  if (plan === BILLING_PLANS.freeBeta) return "Free";
  return "Unknown plan";
}

export function billingStatusLabel(status) {
  const labels = {
    [BILLING_STATUSES.freeBeta]: "Free",
    [BILLING_STATUSES.trialing]: "Trialing",
    [BILLING_STATUSES.active]: "Active",
    [BILLING_STATUSES.pastDue]: "Past due",
    [BILLING_STATUSES.canceled]: "Canceled",
    [BILLING_STATUSES.unpaid]: "Unpaid",
    [BILLING_STATUSES.incomplete]: "Incomplete",
    [BILLING_STATUSES.incompleteExpired]: "Incomplete expired",
    [BILLING_STATUSES.paused]: "Paused",
  };
  return labels[status] || "Unknown status";
}
