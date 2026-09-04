import { bearerToken, verifySupabaseUser } from "./stripeCheckout.js";

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function supabaseRestUrl(env, path) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/$/, "")}${path}`;
}

export async function verifyAdminUser({ authHeader, env = process.env, fetchImpl = fetch } = {}) {
  const token = bearerToken(authHeader);
  if (!token) {
    const err = new Error("Sign in as admin.");
    err.status = 401;
    throw err;
  }

  const anonKey = envValue(env, "VITE_SUPABASE_ANON_KEY");
  const profileUrl = supabaseRestUrl(
    env,
    `/rest/v1/profiles?select=role&user_id=eq.${encodeURIComponent((await verifySupabaseUser(token, env, fetchImpl)).id)}&limit=1`,
  );

  if (!profileUrl || !anonKey) {
    const err = new Error("Supabase Auth is not configured.");
    err.status = 503;
    throw err;
  }

  const res = await fetchImpl(profileUrl, {
    headers: {
      accept: "application/json",
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = new Error("Admin role could not be verified.");
    err.status = 403;
    throw err;
  }

  const rows = await res.json().catch(() => []);
  const role = Array.isArray(rows) ? rows[0]?.role : rows?.role;
  if (role !== "admin") {
    const err = new Error("Admin access required.");
    err.status = 403;
    throw err;
  }

  return { role };
}
