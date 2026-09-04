import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  SHELFMARGIN_RLS_USER_A_EMAIL="test-a@your-domain.com" \\
  SHELFMARGIN_RLS_USER_A_PASSWORD="..." \\
  SHELFMARGIN_RLS_USER_B_EMAIL="test-b@your-domain.com" \\
  SHELFMARGIN_RLS_USER_B_PASSWORD="..." \\
  npm run security:rls:hosted

The command signs in with two confirmed Supabase Auth accounts using the public
anon key, creates one temporary scan as User A, verifies User B cannot read or
mutate User A data, verifies sensitive profile/billing writes are blocked, and
then removes the temporary scan rows.`);
  process.exit(0);
}

function localEnvValue(name) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(new RegExp(`^${name}=(.+)$`, "m"));
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function requiredEnv(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function publicClient(url, anonKey, accessToken = "") {
  return createClient(url, anonKey, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
  if (!data.session?.access_token || !data.user?.id) {
    throw new Error(`${label} sign-in did not return a usable session.`);
  }
  return { accessToken: data.session.access_token, userId: data.user.id };
}

async function cleanup(client, scanId) {
  await client.from("scan_verifications").delete().eq("scan_id", scanId);
  await client.from("scans").delete().eq("id", scanId);
}

function record(checks, name, passed, detail = "") {
  checks.push({ name, passed, detail });
}

const url = requiredEnv("VITE_SUPABASE_URL", localEnvValue("VITE_SUPABASE_URL"));
const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY", localEnvValue("VITE_SUPABASE_ANON_KEY"));
const emailA = requiredEnv("SHELFMARGIN_RLS_USER_A_EMAIL");
const passwordA = requiredEnv("SHELFMARGIN_RLS_USER_A_PASSWORD");
const emailB = requiredEnv("SHELFMARGIN_RLS_USER_B_EMAIL");
const passwordB = requiredEnv("SHELFMARGIN_RLS_USER_B_PASSWORD");

const bootstrap = publicClient(url, anonKey);
const accountA = await signIn(bootstrap, emailA, passwordA, "User A");
const accountB = await signIn(bootstrap, emailB, passwordB, "User B");
const userA = publicClient(url, anonKey, accountA.accessToken);
const userB = publicClient(url, anonKey, accountB.accessToken);
const scanId = randomUUID();
const checks = [];

try {
  let res = await userA
    .from("profiles")
    .update({ cost_per_book: 2.25 })
    .eq("user_id", accountA.userId)
    .select("user_id");
  record(
    checks,
    "User A can update a safe profile column",
    !res.error && res.data?.length === 1,
    res.error?.message || `rows=${res.data?.length || 0}`,
  );

  res = await userA.from("profiles").update({ role: "admin" }).eq("user_id", accountA.userId).select("user_id");
  record(checks, "User A cannot self-promote profile role", Boolean(res.error), res.error?.message || "unexpected success");

  res = await userA
    .from("profiles")
    .update({ subscription_status: "active" })
    .eq("user_id", accountA.userId)
    .select("user_id");
  record(checks, "User A cannot change subscription status", Boolean(res.error), res.error?.message || "unexpected success");

  res = await userA
    .from("profiles")
    .update({ trial_scans_used: 0 })
    .eq("user_id", accountA.userId)
    .select("user_id");
  record(checks, "User A cannot reset trial scan counter", Boolean(res.error), res.error?.message || "unexpected success");

  res = await userA
    .from("scans")
    .insert({
      id: scanId,
      user_id: accountA.userId,
      isbn: "9780132350884",
      title: "Hosted RLS verification row",
      condition: "used-good",
      status: "buy",
    })
    .select("id");
  record(checks, "User A can insert own scan", !res.error && res.data?.length === 1, res.error?.message || `rows=${res.data?.length || 0}`);

  res = await userB.from("scans").select("id").eq("id", scanId);
  record(checks, "User B cannot read User A scan", !res.error && res.data?.length === 0, res.error?.message || `rows=${res.data?.length || 0}`);

  res = await userB.from("scans").update({ lifecycle_status: "purchased" }).eq("id", scanId).select("id");
  record(checks, "User B cannot update User A scan", !res.error && res.data?.length === 0, res.error?.message || `rows=${res.data?.length || 0}`);

  res = await userA
    .from("scan_verifications")
    .insert({
      scan_id: scanId,
      user_id: accountA.userId,
      actual_source_checked: "amazon",
      real_decision: "buy",
    })
    .select("scan_id");
  record(
    checks,
    "User A can insert verification for own scan",
    !res.error && res.data?.length === 1,
    res.error?.message || `rows=${res.data?.length || 0}`,
  );

  res = await userB
    .from("scan_verifications")
    .upsert(
      {
        scan_id: scanId,
        user_id: accountB.userId,
        actual_source_checked: "amazon",
        real_decision: "buy",
      },
      { onConflict: "scan_id" },
    )
    .select("scan_id");
  record(
    checks,
    "User B cannot attach verification to User A scan",
    Boolean(res.error),
    res.error?.message || "unexpected success",
  );

  res = await userB.from("billing_accounts").select("user_id").eq("user_id", accountA.userId);
  record(checks, "User B cannot read User A billing row", !res.error && res.data?.length === 0, res.error?.message || `rows=${res.data?.length || 0}`);

  res = await userA.from("billing_accounts").update({ plan: "pro" }).eq("user_id", accountA.userId).select("user_id");
  record(checks, "User A cannot update billing row from browser", Boolean(res.error), res.error?.message || "unexpected success");
} finally {
  await cleanup(userA, scanId);
}

const failed = checks.filter((check) => !check.passed);
console.log(JSON.stringify({
  passed: failed.length === 0,
  userA: accountA.userId,
  userB: accountB.userId,
  checks,
}, null, 2));

if (failed.length) process.exit(1);
