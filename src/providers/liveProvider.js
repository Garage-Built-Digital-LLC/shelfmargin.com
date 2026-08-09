// Live catalog provider.
//
// This intentionally does not claim live marketplace pricing. It pulls real
// ISBN metadata from public book APIs, then keeps resale prices/rank/velocity as
// estimates until Amazon SP-API, eBay, or another marketplace source is wired
// through a server-side endpoint.

import { normalizeToIsbn13 } from "../lib/isbn.js";
import { lookupCore } from "../lib/bookdata.js";

const LOCAL_CATALOG_URL = "/api/catalog";
const OPEN_LIBRARY_BOOKS_URL = "https://openlibrary.org/api/books";
const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

function cleanText(value) {
  return String(value || "").trim();
}

function estimatedCore(isbn) {
  const core = lookupCore(isbn);
  return {
    ...core,
    source: "estimated",
    priceSource: "estimated",
  };
}

function mergeWithEstimatedPricing(isbn, metadata, source) {
  const estimate = estimatedCore(isbn);
  return {
    ...estimate,
    title: cleanText(metadata.title) || estimate.title,
    author: cleanText(metadata.author) || estimate.author,
    source,
    catalogSource: source,
    priceSource: "estimated",
  };
}

async function fetchJson(fetchImpl, url, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller?.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
    return res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function parseOpenLibraryBooks(isbn, json) {
  const hit = json?.[`ISBN:${isbn}`];
  if (!hit) return null;
  return {
    title: hit.title,
    author: Array.isArray(hit.authors)
      ? hit.authors.map((author) => author?.name).filter(Boolean).join(", ")
      : "",
  };
}

export function parseOpenLibrarySearch(json) {
  const hit = json?.docs?.[0];
  if (!hit) return null;
  return {
    title: hit.title,
    author: Array.isArray(hit.author_name) ? hit.author_name.join(", ") : "",
  };
}

export function parseGoogleBooks(json) {
  const info = json?.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: [info.title, info.subtitle].filter(Boolean).join(": "),
    author: Array.isArray(info.authors) ? info.authors.join(", ") : "",
  };
}

export function parseCatalogEndpoint(json) {
  if (!json?.title) return null;
  return {
    title: json.title,
    author: json.author,
    source: json.source,
  };
}

async function lookupCatalogEndpoint(isbn, fetchImpl, endpoint, timeoutMs) {
  const params = new URLSearchParams({ isbn });
  const json = await fetchJson(fetchImpl, `${endpoint}?${params}`, timeoutMs);
  return parseCatalogEndpoint(json);
}

async function lookupOpenLibraryBooks(isbn, fetchImpl, timeoutMs) {
  const params = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: "json",
    jscmd: "data",
  });
  const json = await fetchJson(fetchImpl, `${OPEN_LIBRARY_BOOKS_URL}?${params}`, timeoutMs);
  return parseOpenLibraryBooks(isbn, json);
}

async function lookupOpenLibrarySearch(isbn, fetchImpl, timeoutMs) {
  const params = new URLSearchParams({
    isbn,
    fields: "title,author_name,isbn",
  });
  const json = await fetchJson(fetchImpl, `${OPEN_LIBRARY_SEARCH_URL}?${params}`, timeoutMs);
  return parseOpenLibrarySearch(json);
}

async function lookupGoogleBooks(isbn, fetchImpl, timeoutMs) {
  const params = new URLSearchParams({
    q: `isbn:${isbn}`,
    projection: "lite",
  });
  const json = await fetchJson(fetchImpl, `${GOOGLE_BOOKS_URL}?${params}`, timeoutMs);
  return parseGoogleBooks(json);
}

export function createLiveProvider({ endpoint = LOCAL_CATALOG_URL, fetchImpl = fetch, timeoutMs = 6500 } = {}) {
  return {
    name: "live-catalog",
    async lookup(rawIsbn) {
      const isbn = normalizeToIsbn13(rawIsbn);
      if (!isbn) return null;

      const lookups = [
        [null, (nextIsbn, nextFetch) => lookupCatalogEndpoint(nextIsbn, nextFetch, endpoint, timeoutMs)],
        ["openlibrary", lookupOpenLibraryBooks],
        ["openlibrary-search", lookupOpenLibrarySearch],
        ["google-books", lookupGoogleBooks],
      ];

      for (const [source, lookup] of lookups) {
        try {
          const metadata = await lookup(isbn, fetchImpl, timeoutMs);
          if (metadata?.title) return mergeWithEstimatedPricing(isbn, metadata, source || metadata.source || "live-catalog");
        } catch (err) {
          // Try the next catalog source. The UI still gets an estimated fallback
          // rather than failing the scan in a store with spotty signal.
        }
      }

      return estimatedCore(isbn);
    },
  };
}
