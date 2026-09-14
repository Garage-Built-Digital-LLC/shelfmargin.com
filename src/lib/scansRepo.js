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

const profileNumberFields = new Set(["cost_per_book", "buy_threshold"]);
const defaultConditions = new Set(["new", "used-good", "used-acceptable"]);

export function normalizeProfilePatch(patch) {
  const next = {};
  if (!patch || typeof patch !== "object") return next;

  profileNumberFields.forEach((field) => {
    if (!(field in patch)) return;
    const value = Number(patch[field]);
    if (Number.isFinite(value) && value >= 0) next[field] = value;
  });

  if (defaultConditions.has(patch.default_condition)) {
    next.default_condition = patch.default_condition;
  }

  if (typeof patch.sound_enabled === "boolean") {
    next.sound_enabled = patch.sound_enabled;
  }

  return next;
}

export async function updateProfile(patch) {
  const userId = await currentUserId();
  if (!userId) return;
  const safePatch = normalizeProfilePatch(patch);
  if (!Object.keys(safePatch).length) return;
  const { error } = await supabase
    .from("profiles")
    .update({ ...safePatch, updated_at: new Date().toISOString() })
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

// ---- places (sourcing locations) -----------------------------------------
// RLS scopes every read/write to the signed-in user; inserts must carry user_id.
const PLACE_KINDS = new Set([
  "thrift", "library-sale", "garage-sale", "estate-sale", "bookstore", "store", "other",
]);

export function normalizePlacePatch(patch) {
  const next = {};
  if (!patch || typeof patch !== "object") return next;
  if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim().slice(0, 120);
  if (PLACE_KINDS.has(patch.kind)) next.kind = patch.kind;
  if ("lat" in patch) next.lat = patch.lat == null || patch.lat === "" ? null : Number(patch.lat);
  if ("lng" in patch) next.lng = patch.lng == null || patch.lng === "" ? null : Number(patch.lng);
  if ("address" in patch) next.address = patch.address == null ? null : String(patch.address).slice(0, 300);
  if (typeof patch.notes === "string") next.notes = patch.notes.slice(0, 1000);
  if (typeof patch.archived === "boolean") next.archived = patch.archived;
  // Drop non-finite coordinates rather than persisting NaN.
  if (next.lat != null && !Number.isFinite(next.lat)) delete next.lat;
  if (next.lng != null && !Number.isFinite(next.lng)) delete next.lng;
  return next;
}

export async function listPlaces() {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPlace(patch) {
  const userId = await currentUserId();
  if (!userId) return null;
  const body = normalizePlacePatch(patch);
  if (!body.name) throw new Error("A place needs a name.");
  const { data, error } = await supabase
    .from("places")
    .insert({ ...body, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlace(id, patch) {
  const body = normalizePlacePatch(patch);
  if (!Object.keys(body).length) return null;
  const { data, error } = await supabase
    .from("places")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archivePlace(id) {
  return updatePlace(id, { archived: true });
}

const scanConditions = new Set(["new", "used-good", "used-acceptable"]);
const lifecycleStatuses = new Set(["scouted", "purchased", "listed", "sold", "shipped"]);

export function normalizeScanPatch(patch) {
  const next = {};
  if (!patch || typeof patch !== "object") return next;

  if ("copy_count" in patch) {
    const value = Number(patch.copy_count);
    if (Number.isInteger(value) && value >= 1 && value <= 999) {
      next.copy_count = value;
    }
  }

  if (scanConditions.has(patch.condition)) {
    next.condition = patch.condition;
  }

  if (lifecycleStatuses.has(patch.lifecycle_status)) {
    next.lifecycle_status = patch.lifecycle_status;
  }

  return next;
}

export async function updateScan(id, patch) {
  const safePatch = normalizeScanPatch(patch);
  if (!Object.keys(safePatch).length) return;
  const { error } = await supabase.from("scans").update(safePatch).eq("id", id);
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

const nullableIntegerFields = new Set(["amazon_actual_rank"]);
const verificationTextFields = new Set(["notes"]);
const verificationEnums = {
  actual_source_checked: new Set(["", "amazon", "ebay", "amazon+ebay"]),
  amazon_eligible: new Set(["", "yes", "no", "restricted"]),
  real_decision: new Set(["", "buy", "pass", "watch"]),
};

export function normalizeVerificationPatch(patch) {
  const next = {};
  if (!patch || typeof patch !== "object") return next;

  Object.entries(verificationEnums).forEach(([field, allowed]) => {
    if (allowed.has(patch[field])) next[field] = patch[field];
  });

  nullableNumberFields.forEach((field) => {
    if (!(field in patch)) return;
    if (patch[field] === "") {
      next[field] = null;
      return;
    }
    const value = Number(patch[field]);
    if (!Number.isFinite(value)) return;
    next[field] = nullableIntegerFields.has(field) ? Math.trunc(value) : value;
  });

  verificationTextFields.forEach((field) => {
    if (typeof patch[field] === "string") next[field] = patch[field].slice(0, 2000);
  });

  return next;
}

export async function upsertScanVerification(scanId, patch) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in.");
  const row = {
    ...normalizeVerificationPatch(patch),
    scan_id: scanId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("scan_verifications")
    .upsert(row, { onConflict: "scan_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
