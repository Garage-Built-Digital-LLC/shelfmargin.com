import { API_BASE_URL } from './config';

// Server-side catalog boundary. Returns BookData | null
// (shape in packages/core/types.js). Keeps Amazon creds server-side.
export async function lookupCatalog(isbn13) {
  const url = `${API_BASE_URL}/api/catalog?isbn=${encodeURIComponent(isbn13)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalog lookup failed (${res.status})`);
  return res.json();
}
