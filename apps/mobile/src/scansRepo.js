import { supabase } from './supabase';

// All queries are RLS-scoped to the signed-in user, so the same rows appear in
// the web app. Mirrors the web src/lib/scansRepo.js operations the app needs.

// Non-crypto UUID v4 — used only as an idempotency key for scans.id so an
// offline-retry can't create a duplicate row (upsert on conflict id).
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getProfile() {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

// Idempotent save: row carries a client-generated id, so retrying a queued
// save updates the same row instead of inserting a duplicate.
export async function saveScan(row) {
  const { data, error } = await supabase
    .from('scans')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchScans(limit = 25) {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Build a full scans-row snapshot from a core evaluate() verdict + BookData.
// Column set matches the scans table exactly (see docs/IOS_APP_BUILD_SPEC.md).
export function buildScanRow({ isbn, book, verdict, settings, userId, condition }) {
  return {
    id: uuidv4(),
    user_id: userId,
    isbn,
    title: book.title || null,
    author: book.author || null,
    condition: condition || 'used-good',
    cost_per_book: settings.costPerBook,
    amazon_price: book.amazonPrice ?? null,
    ebay_price: book.ebayPrice ?? null,
    amazon_bsr: book.amazonBsr ?? null,
    amazon_net: verdict.amazonNet != null ? Number(verdict.amazonNet.toFixed(2)) : null,
    ebay_net: verdict.ebayNet != null ? Number(verdict.ebayNet.toFixed(2)) : null,
    recommended_platform: verdict.recommendedPlatform, // 'amazon' | 'ebay' | null
    velocity: verdict.velocity, // 'fast'|'medium'|'slow'|'unknown'
    status: verdict.status, // 'buy'|'pass'|'check'
    restricted: !!verdict.gated,
    copy_count: 1,
    lifecycle_status: 'scouted',
  };
}

// Update the caller's profile. RLS + column GRANTs restrict writable columns to
// cost_per_book / buy_threshold / default_condition / sound_enabled.
export async function updateProfile(patch) {
  const uid = (await supabase.auth.getUser()).data?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: uid, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

// Book-check verifications (scan_verifications, PK = scan_id).
export async function fetchScanVerifications() {
  const { data, error } = await supabase.from('scan_verifications').select('*');
  if (error) throw error;
  return data || [];
}

export async function upsertScanVerification(scanId, patch) {
  const uid = (await supabase.auth.getUser()).data?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('scan_verifications')
    .upsert({ scan_id: scanId, user_id: uid, ...patch }, { onConflict: 'scan_id' });
  if (error) throw error;
}
