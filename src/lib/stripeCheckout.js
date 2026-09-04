import { BILLING_PLANS } from "./billing.js";
import { stripeConfigStatus } from "./stripeConfig.js";

export const STRIPE_API_VERSION = "2026-07-29.dahlia";
export const STRIPE_INTEGRATION_IDENTIFIER = "shelfmargin_checkout_qxjrvpzn";

const checkoutPlans = new Set([BILLING_PLANS.starter, BILLING_PLANS.pro]);

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

export function appBaseUrl(env) {
  const configured = envValue(env, "APP_BASE_URL") || "http://localhost:5173";
  try {
    const url = new URL(configured);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:5173";
  }
}

export function priceIdForPlan(planId, env = process.env) {
  if (planId === BILLING_PLANS.starter) return envValue(env, "STRIPE_STARTER_PRICE_ID");
  if (planId === BILLING_PLANS.pro) return envValue(env, "STRIPE_PRO_PRICE_ID");
  return "";
}

export function bearerToken(authHeader = "") {
  const [scheme, token] = String(authHeader).split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

export async function readJsonBody(req, maxBytes = 20_000) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) {
      const err = new Error("request body too large");
      err.status = 413;
      throw err;
    }
  }

  if (!body.trim()) return {};

  try {
    return JSON.parse(body);
  } catch {
    const err = new Error("valid JSON required");
    err.status = 400;
    throw err;
  }
}

export async function verifySupabaseUser(token, env = process.env, fetchImpl = fetch) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const anonKey = envValue(env, "VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    const err = new Error("Supabase Auth is not configured.");
    err.status = 503;
    throw err;
  }

  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      accept: "application/json",
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = new Error("Sign in before starting checkout.");
    err.status = 401;
    throw err;
  }

  const user = await res.json();
  if (!user?.id) {
    const err = new Error("Supabase user could not be verified.");
    err.status = 401;
    throw err;
  }

  return user;
}

export async function createCheckoutSession({
  planId,
  authHeader,
  env = process.env,
  fetchImpl = fetch,
  stripeClient,
}) {
  const status = stripeConfigStatus(env);
  if (!status.configured) {
    const err = new Error("Stripe billing is not fully configured.");
    err.status = 503;
    err.code = "stripe_not_configured";
    throw err;
  }

  if (!checkoutPlans.has(planId)) {
    const err = new Error("Choose Starter or Pro.");
    err.status = 400;
    throw err;
  }

  const token = bearerToken(authHeader);
  if (!token) {
    const err = new Error("Sign in before starting checkout.");
    err.status = 401;
    throw err;
  }

  const user = await verifySupabaseUser(token, env, fetchImpl);
  const priceId = priceIdForPlan(planId, env);
  const baseUrl = appBaseUrl(env);

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      supabase_user_id: user.id,
      shelfmargin_plan: planId,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        shelfmargin_plan: planId,
      },
    },
    success_url: `${baseUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
    integration_identifier: STRIPE_INTEGRATION_IDENTIFIER,
  });

  if (!session?.url) {
    const err = new Error("Stripe did not return a checkout URL.");
    err.status = 502;
    throw err;
  }

  return { url: session.url };
}
