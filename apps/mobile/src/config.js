import Constants from 'expo-constants';

// Public runtime config (safe to ship; RLS gates the anon key).
const RAW_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || '';

// Dev convenience: when API base is unset or a localhost placeholder, derive the
// dev machine's LAN IP from Expo's host so the app can reach a locally-run
// `node server.mjs` (port 4173) in Expo Go without hardcoding an IP. In a real
// build, set EXPO_PUBLIC_API_BASE_URL to the deployed HTTPS API and this is a no-op.
function resolveApiBase(raw) {
  const isPlaceholder = !raw || raw.includes('localhost') || raw.includes('127.0.0.1');
  if (!isPlaceholder) return raw;
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const host = String(hostUri).split(':')[0];
  return host ? `http://${host}:4173` : raw;
}

export const API_BASE_URL = resolveApiBase(RAW_API_BASE);
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
