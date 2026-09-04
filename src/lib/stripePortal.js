import { appBaseUrl, bearerToken, verifySupabaseUser } from "./stripeCheckout.js";
import { stripeConfigStatus } from "./stripeConfig.js";

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function serviceKey(env) {
  return envValue(env, "SUPABASE_SERVICE_ROLE_KEY") || envValue(env, "SUPABASE_SECRET_KEY");
}

export async function fetchBillingAccount(userId, env = process.env, fetchImpl = fetch) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const key = serviceKey(env);
  if (!supabaseUrl || !key) {
    const err = new Error("Supabase service billing access is not configured.");
    err.status = 503;
    err.code = "supabase_service_not_configured";
    throw err;
  }

  const params = new URLSearchParams({
    select: "stripe_customer_id,plan,subscription_status",
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_accounts?${params}`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const err = new Error("Billing account lookup failed.");
    err.status = 502;
    throw err;
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function createPortalSession({
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

  const token = bearerToken(authHeader);
  if (!token) {
    const err = new Error("Sign in before managing billing.");
    err.status = 401;
    throw err;
  }

  const user = await verifySupabaseUser(token, env, fetchImpl);
  const account = await fetchBillingAccount(user.id, env, fetchImpl);
  if (!account?.stripe_customer_id) {
    const err = new Error("Start a paid plan before managing a subscription.");
    err.status = 409;
    err.code = "no_stripe_customer";
    throw err;
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${appBaseUrl(env)}/pricing`,
  });

  if (!session?.url) {
    const err = new Error("Stripe did not return a billing portal URL.");
    err.status = 502;
    throw err;
  }

  return { url: session.url };
}
