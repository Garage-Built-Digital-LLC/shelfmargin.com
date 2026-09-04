import {
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "../providers/liveProvider.js";
import { publicAmazonStatus } from "./amazonConfig.js";
import { lookupAmazonCatalogByIsbn } from "./amazonCatalog.js";

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`catalog source failed: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupCatalog(isbn, { timeoutMs = 6500, amazonFallbackTimeoutMs = 2500 } = {}) {
  if (publicAmazonStatus().configured) {
    try {
      const amazonHit = await lookupAmazonCatalogByIsbn(isbn, {
        timeoutMs: Math.min(timeoutMs, amazonFallbackTimeoutMs),
      });
      if (amazonHit?.title) return amazonHit;
    } catch {
      // Fall back to public catalog metadata. Scan results must stay usable even
      // when Amazon sandbox or production data is temporarily unavailable.
    }
  }

  const booksParams = new URLSearchParams({ bibkeys: `ISBN:${isbn}`, format: "json", jscmd: "data" });
  const books = await fetchJson(`https://openlibrary.org/api/books?${booksParams}`, timeoutMs);
  const booksHit = parseOpenLibraryBooks(isbn, books);
  if (booksHit?.title) return { ...booksHit, source: "openlibrary" };

  const searchParams = new URLSearchParams({ isbn, fields: "title,author_name,isbn" });
  const search = await fetchJson(`https://openlibrary.org/search.json?${searchParams}`, timeoutMs);
  const searchHit = parseOpenLibrarySearch(search);
  if (searchHit?.title) return { ...searchHit, source: "openlibrary-search" };

  const googleParams = new URLSearchParams({ q: `isbn:${isbn}`, projection: "lite" });
  const google = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${googleParams}`, timeoutMs);
  const googleHit = parseGoogleBooks(google);
  if (googleHit?.title) return { ...googleHit, source: "google-books" };

  return null;
}
