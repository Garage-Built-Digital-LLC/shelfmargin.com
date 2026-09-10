import {
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "../providers/liveProvider.js";
import { publicAmazonStatus, requestAmazonAccessToken } from "./amazonConfig.js";
import { lookupAmazonCatalogByIsbn } from "./amazonCatalog.js";
import { lookupAmazonPricingByAsin } from "./amazonPricing.js";
import { lookupAmazonFeesEstimate } from "./amazonFees.js";

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

  // One LWA token for both pricing and fees this scan (avoids 2-3 exchanges).
  let accessToken = null;
  try {
    ({ accessToken } = await requestAmazonAccessToken());
  } catch {
    accessToken = null; // libs will each try their own; still best-effort
  }

  let pricing = null;
  try {
    pricing = await lookupAmazonPricingByAsin(amazonHit.asin, { timeoutMs, accessToken });
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

  // Real per-ASIN fees at the live price (best-effort; falls back to the flat
  // fee model in bookdata/profit when absent).
  let fees = null;
  try {
    fees = await lookupAmazonFeesEstimate(amazonHit.asin, pricing.amazonPrice, { timeoutMs, accessToken });
  } catch {
    fees = null;
  }

  return {
    ...amazonHit,
    amazonPrice: pricing.amazonPrice,
    // Prefer the Catalog Items "Books" rank (canonical overall BSR our velocity
    // thresholds assume). Product Pricing often omits SalesRankings, and when
    // present it can be a category-specific rank — so catalog wins, pricing is
    // the fallback.
    amazonBsr: amazonHit.catalogBsr ?? pricing.amazonBsr ?? null,
    offerCount: pricing.offerCount ?? null,
    itemCondition: pricing.itemCondition,
    priceSource: pricing.priceSource, // "amazon-sp-api" | "amazon-sp-api-sandbox"
    amazonFees: fees ? fees.totalFees : null,
    feeBreakdown: fees || null,
    feeSource: fees ? fees.feeSource : null,
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
