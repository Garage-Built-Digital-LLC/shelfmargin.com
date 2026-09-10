import {
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "../providers/liveProvider.js";
import { publicAmazonStatus } from "./amazonConfig.js";
import { lookupAmazonCatalogByIsbn } from "./amazonCatalog.js";
import { lookupAmazonPricingByAsin } from "./amazonPricing.js";

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

/**
 * Enrich an Amazon catalog hit (title/author/ASIN) with LIVE pricing + rank
 * when we can get it. Best-effort: on any failure we return the catalog hit
 * unchanged, and the frontend keeps its estimated economics. When pricing
 * succeeds we attach amazonPrice/amazonBsr/offerCount and set priceSource to
 * the live source so the UI can badge the verdict as live rather than estimate.
 */
async function withLivePricing(amazonHit, { timeoutMs = 3500 } = {}) {
  if (!amazonHit?.asin) return amazonHit;
  let pricing = null;
  try {
    pricing = await lookupAmazonPricingByAsin(amazonHit.asin, { timeoutMs });
  } catch {
    pricing = null;
  }
  if (!pricing || pricing.amazonPrice == null) {
    // No live price. Still surface a catalog-derived BSR if we parsed one, so
    // velocity is real even when pricing is unavailable.
    return amazonHit.catalogBsr != null
      ? { ...amazonHit, amazonBsr: amazonHit.catalogBsr }
      : amazonHit;
  }
  return {
    ...amazonHit,
    amazonPrice: pricing.amazonPrice,
    amazonBsr: pricing.amazonBsr ?? amazonHit.catalogBsr ?? null,
    offerCount: pricing.offerCount ?? null,
    itemCondition: pricing.itemCondition,
    priceSource: pricing.priceSource, // "amazon-sp-api" | "amazon-sp-api-sandbox"
  };
}

export async function lookupCatalog(isbn, { timeoutMs = 6500, amazonFallbackTimeoutMs = 2500, pricingTimeoutMs = 3500 } = {}) {
  if (publicAmazonStatus().configured) {
    try {
      const amazonHit = await lookupAmazonCatalogByIsbn(isbn, {
        timeoutMs: Math.min(timeoutMs, amazonFallbackTimeoutMs),
      });
      if (amazonHit?.title) {
        return await withLivePricing(amazonHit, { timeoutMs: pricingTimeoutMs });
      }
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
