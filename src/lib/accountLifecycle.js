import { bearerToken, verifySupabaseUser } from "./stripeCheckout.js";

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function supabaseRestBase(env) {
  const supabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const anonKey = envValue(env, "VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    const err = new Error("Supabase Auth is not configured.");
    err.status = 503;
    err.code = "supabase_not_configured";
    throw err;
  }
  return { base: supabaseUrl.replace(/\/$/, ""), anonKey };
}

// Tables the export walks. Each is fetched with the caller's OWN bearer token so
// RLS scopes every row to the authenticated user -- no service role involved.
const EXPORT_TABLES = ["profiles", "scans", "scan_verifications", "billing_accounts"];

async function fetchOwnedRows(base, anonKey, token, table, fetchImpl) {
  const res = await fetchImpl(`${base}/rest/v1/${table}?select=*`, {
    headers: {
      accept: "application/json",
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = new Error(`Could not export ${table}.`);
    err.status = 502;
    throw err;
  }
  return res.json().catch(() => []);
}

export async function exportUserData({ authHeader, env = process.env, fetchImpl = fetch } = {}) {
  const token = bearerToken(authHeader);
  if (!token) {
    const err = new Error("Sign in to export your data.");
    err.status = 401;
    throw err;
  }

  const { base, anonKey } = supabaseRestBase(env);
  const user = await verifySupabaseUser(token, env, fetchImpl);

  const data = {};
  for (const table of EXPORT_TABLES) {
    data[table] = await fetchOwnedRows(base, anonKey, token, table, fetchImpl);
  }

  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email || null, created_at: user.created_at || null },
    data,
  };
}

export async function deleteUserAccount({ authHeader, env = process.env, fetchImpl = fetch } = {}) {
  const token = bearerToken(authHeader);
  if (!token) {
    const err = new Error("Sign in to delete your account.");
    err.status = 401;
    throw err;
  }

  const { base, anonKey } = supabaseRestBase(env);
  // Verify the token is a real, current user before we act on it.
  await verifySupabaseUser(token, env, fetchImpl);

  // The security-definer RPC deletes only auth.uid(); we forward the user's own
  // token, so no service role key is required for account deletion.
  const res = await fetchImpl(`${base}/rest/v1/rpc/delete_own_account`, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });

  if (!res.ok) {
    const err = new Error("Account deletion failed.");
    err.status = 502;
    throw err;
  }

  return { deleted: true };
}
