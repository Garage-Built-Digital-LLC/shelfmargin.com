import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveScan } from './scansRepo';

// Offline-tolerant scan saves. Sourcing happens where signal is bad, so a save
// that can't reach the server is queued locally and retried later. Rows carry a
// client id, so retries upsert (never duplicate).
const KEY = 'sm_scan_queue_v1';

async function read() {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch (_) { return []; }
}
async function write(arr) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(arr)); } catch (_) {}
}

export async function queueCount() {
  return (await read()).length;
}

// Try to persist now; if it fails (offline), queue it. Returns 'saved' | 'queued'.
export async function saveOrQueue(row) {
  try { await saveScan(row); return 'saved'; }
  catch (_) { const q = await read(); q.push(row); await write(q); return 'queued'; }
}

// Retry every queued row; keep the ones that still fail. Returns count flushed.
export async function flushQueue() {
  const q = await read();
  if (!q.length) return 0;
  const remaining = [];
  let flushed = 0;
  for (const row of q) {
    try { await saveScan(row); flushed++; }
    catch (_) { remaining.push(row); }
  }
  await write(remaining);
  return flushed;
}
