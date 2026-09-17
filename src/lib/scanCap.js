import {
  FREE_LIFETIME_SCAN_CAP,
  isScanCapError,
  scanCapClientError,
} from "./billing.js";
import { bearerToken, verifySupabaseUser } from "./stripeCheckout.js";

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

export { isScanCapError };

export function throwScanCapError(details = {}) {
  throw scanCapClientError(details);
}

export async function consumeLifetimeScan({
  isbn,
  authHeader,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const token = bearerToken(authHeader);
  if (!token) {
    return { enforced: false, allowed: true, demo: true };
  }

  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const anonKey = envValue(env, "VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    const err = new Error("Scan limits cannot be verified.");
    err.status = 503;
    err.code = "scan_cap_unconfigured";
    throw err;
  }

  await verifySupabaseUser(token, env, fetchImpl);

  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_trial_scan`, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_isbn: isbn }),
  });

  if (!res.ok) {
    const err = new Error("Scan limit check failed.");
    err.status = 502;
    err.code = "scan_cap_check_failed";
    throw err;
  }

  const body = await res.json().catch(() => null);
  if (!body || body.allowed !== true) {
    throw scanCapClientError(body || {});
  }

  return {
    enforced: true,
    allowed: true,
    paid: Boolean(body.paid),
    used: Number(body.used) || 0,
    remaining: body.remaining == null ? null : Number(body.remaining),
    cap: Number(body.cap) || FREE_LIFETIME_SCAN_CAP,
  };
}
