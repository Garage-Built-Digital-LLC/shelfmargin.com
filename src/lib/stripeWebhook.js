import {
  BILLING_PLANS,
  BILLING_STATUSES,
  STRIPE_PRICE_RULES,
  billingPlanFromLookupKey,
  isKnownSubscriptionStatus,
} from "./billing.js";
import { stripeConfigStatus } from "./stripeConfig.js";

const WEBHOOK_BODY_LIMIT = 200_000;

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function serviceKey(env) {
  return envValue(env, "SUPABASE_SERVICE_ROLE_KEY") || envValue(env, "SUPABASE_SECRET_KEY");
}

function unixToIso(value) {
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

export async function readRawBody(req, maxBytes = WEBHOOK_BODY_LIMIT) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      const err = new Error("request body too large");
      err.status = 413;
      throw err;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export function stripeWebhookReadiness(env = process.env) {
  const stripe = stripeConfigStatus(env);
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const supabaseServiceKey = serviceKey(env);

  return {
    ready: stripe.configured && Boolean(supabaseUrl && supabaseServiceKey),
    stripeConfigured: stripe.configured,
    supabaseUrl: { present: Boolean(supabaseUrl) },
    supabaseServiceKey: { present: Boolean(supabaseServiceKey) },
  };
}

export function planFromPrice(price = {}, env = process.env) {
  const lookupPlan = billingPlanFromLookupKey(price.lookup_key);
  if (lookupPlan && priceMatchesPlan(price, lookupPlan)) return lookupPlan;
  if (
    price.id
    && price.id === envValue(env, "STRIPE_STARTER_PRICE_ID")
    && priceMatchesPlan(price, BILLING_PLANS.starter)
  ) {
    return BILLING_PLANS.starter;
  }
  if (
    price.id
    && price.id === envValue(env, "STRIPE_PRO_PRICE_ID")
    && priceMatchesPlan(price, BILLING_PLANS.pro)
  ) {
    return BILLING_PLANS.pro;
  }
  return null;
}

export function priceMatchesPlan(price = {}, plan) {
  const rule = STRIPE_PRICE_RULES[plan];
  if (!rule) return false;
  return price.currency === rule.currency && price.unit_amount === rule.unitAmount;
}

export function billingPayloadFromSubscription(subscription, env = process.env) {
  const item = subscription?.items?.data?.[0] || {};
  const price = item.price || subscription?.plan || {};
  const plan = planFromPrice(price, env);
  const status = isKnownSubscriptionStatus(subscription?.status)
    ? subscription.status
    : BILLING_STATUSES.incomplete;
  const userId = subscription?.metadata?.supabase_user_id;

  if (!userId || !plan) return null;

  return {
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    stripe_subscription_id: subscription.id,
    stripe_price_lookup_key: price.lookup_key || null,
    plan,
    subscription_status: status,
    current_period_start: unixToIso(subscription.current_period_start || item.current_period_start),
    current_period_end: unixToIso(subscription.current_period_end || item.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertBillingAccount(payload, env = process.env, fetchImpl = fetch) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const key = serviceKey(env);
  if (!supabaseUrl || !key) {
    const err = new Error("Supabase service billing access is not configured.");
    err.status = 503;
    err.code = "supabase_service_not_configured";
    throw err;
  }

  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_accounts?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = new Error("Billing account update failed.");
    err.status = 502;
    throw err;
  }
}

export async function recordStripeEvent(event, env = process.env, fetchImpl = fetch) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const key = serviceKey(env);
  if (!supabaseUrl || !key) {
    const err = new Error("Supabase service billing access is not configured.");
    err.status = 503;
    err.code = "supabase_service_not_configured";
    throw err;
  }

  if (!event?.id || !event?.type) {
    const err = new Error("Stripe event id and type are required.");
    err.status = 400;
    throw err;
  }

  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/record_stripe_event`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      processed_event_id: event.id,
      processed_event_type: event.type,
    }),
  });

  if (!res.ok) {
    const err = new Error("Stripe event idempotency check failed.");
    err.status = 502;
    throw err;
  }

  const body = await res.json().catch(() => null);
  return body === true;
}

async function subscriptionFromCheckoutSession(session, stripeClient) {
  if (!session?.subscription) return null;
  return stripeClient.subscriptions.retrieve(
    typeof session.subscription === "string" ? session.subscription : session.subscription.id
  );
}

export async function handleStripeWebhook({
  rawBody,
  signature,
  env = process.env,
  stripeClient,
  fetchImpl = fetch,
}) {
  const webhookSecret = envValue(env, "STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret.startsWith("whsec_") || webhookSecret.length < 20) {
    const err = new Error("Stripe webhook signing secret is not configured.");
    err.status = 503;
    err.code = "stripe_webhook_not_configured";
    throw err;
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    const err = new Error("Invalid Stripe webhook signature.");
    err.status = 400;
    throw err;
  }

  const readiness = stripeWebhookReadiness(env);
  if (!readiness.ready) {
    const err = new Error("Billing webhook processing is not fully configured.");
    err.status = 503;
    err.code = "billing_webhook_not_configured";
    throw err;
  }

  const firstSeen = await recordStripeEvent(event, env, fetchImpl);
  if (!firstSeen) return { received: true, processed: false, duplicate: true };

  let subscription = null;
  if (event.type === "checkout.session.completed") {
    subscription = await subscriptionFromCheckoutSession(event.data.object, stripeClient);
  } else if (event.type?.startsWith("customer.subscription.")) {
    subscription = event.data.object;
  }

  const payload = billingPayloadFromSubscription(subscription, env);
  if (!payload) return { received: true, processed: false };

  await upsertBillingAccount(payload, env, fetchImpl);
  return { received: true, processed: true };
}
