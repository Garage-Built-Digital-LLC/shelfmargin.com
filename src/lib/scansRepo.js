// All Supabase reads/writes for scans + the user's profile. RLS guarantees a
// user only ever sees/writes their own rows, so we never filter by user_id on
// reads — the policies do it. Inserts must carry user_id to pass the check.

import { supabase } from "./supabase.js";

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ---- profile -------------------------------------------------------------
export async function getProfile() {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data; // may be null momentarily right after signup before the trigger runs
}

export async function updateProfile(patch) {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

// ---- scans ---------------------------------------------------------------
export async function fetchScans() {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertScan(row) {
  const { data, error } = await supabase.from("scans").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateScan(id, patch) {
  const { error } = await supabase.from("scans").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAllScans() {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("scans").delete().eq("user_id", userId);
  if (error) throw error;
}

// ---- book-check verifications ------------------------------------------
export async function fetchScanVerifications() {
  const { data, error } = await supabase
    .from("scan_verifications")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

const nullableNumberFields = [
  "amazon_actual_price",
  "amazon_actual_rank",
  "ebay_sold_comp",
  "actual_shipping",
  "actual_fees",
  "actual_net",
];

function normalizeVerificationPatch(patch) {
  const next = { ...patch };
  nullableNumberFields.forEach((field) => {
    if (next[field] === "") next[field] = null;
  });
  return next;
}

export async function upsertScanVerification(scanId, patch) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in.");
  const row = normalizeVerificationPatch({
    ...patch,
    scan_id: scanId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  });
  const { data, error } = await supabase
    .from("scan_verifications")
    .upsert(row, { onConflict: "scan_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
