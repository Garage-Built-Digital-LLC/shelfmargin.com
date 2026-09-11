// Amazon SP-API Product Pricing client.
//
// This is the piece that turns a scan verdict from an ESTIMATE into a LIVE
// call. Given an ASIN (from the Catalog Items lookup), it asks the Product
// Pricing API (v0 getItemOffers) for the current marketplace offers and reads
// two numbers out of the response Summary:
//   - amazonPrice  : the lowest landed price (ListingPrice + Shipping) for the
//                    requested condition — "what this book is selling for".
//   - amazonBsr    : the Best Sellers Rank (SalesRankings), which the profit
//                    engine turns into a velocity bucket.
// Both feed straight into packages/core/profit.js evaluate({ amazonPrice,
// amazonBsr, gated }); nothing downstream changes shape.
//
// Design rules:
//   - Never throw into the scan path. Pricing is best-effort: if it fails, is
//     not configured, or returns no offers, the caller keeps the estimated
//     numbers and labels the verdict as an estimate. A book scan in a store
//     with spotty signal must never hard-fail because pricing was slow.
//   - Pure parsers (parsePricingOffers, lowestLandedPrice, firstSalesRank) are
//     exported and unit-tested against documented SP-API response shapes, since
//     we cannot hit the live endpoint from CI.

import { amazonRuntimeConfig, publicAmazonStatus, requestAmazonAccessToken, retryAfterMs, sleep } from "./amazonConfig.js";

/** Conditions we try, in order, when the caller asks for used-book economics. */
const USED_CONDITION_ORDER = ["Used", "New"];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetchImpl(url, { ...options, signal: controller?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Landed price = what a buyer actually pays (item + shipping). Prefer the
 * explicit LandedPrice the API gives; otherwise sum ListingPrice + Shipping.
 */
function landedFromPrice(price) {
  if (!price) return null;
  const landed = num(price.LandedPrice?.Amount);
  if (landed != null) return landed;
  const listing = num(price.ListingPrice?.Amount);
  if (listing == null) return null;
  const shipping = num(price.Shipping?.Amount) || 0;
  return listing + shipping;
}

/**
 * From a Summary.LowestPrices array, return the lowest landed price whose
 * condition matches (case-insensitive). Amazon condition strings vary
 * ("Used", "used", "UsedLikeNew"…) so we match on prefix.
 */
export function lowestLandedPrice(lowestPrices, condition) {
  if (!Array.isArray(lowestPrices)) return null;
  const want = String(condition || "").toLowerCase();
  let best = null;
  for (const entry of lowestPrices) {
    const cond = String(entry?.condition || entry?.Condition || "").toLowerCase();
    if (want && !cond.startsWith(want)) continue;
    const landed = landedFromPrice(entry);
    if (landed == null) continue;
    if (best == null || landed < best) best = landed;
  }
  return round2(best);
}

/**
 * First usable Best Sellers Rank from Summary.SalesRankings. The top-level
 * catalog rank ("Books") is what our velocity thresholds assume, and it is
 * normally the first entry.
 */
export function firstSalesRank(salesRankings) {
  if (!Array.isArray(salesRankings)) return null;
  for (const entry of salesRankings) {
    const rank = num(entry?.Rank);
    if (rank != null && rank > 0) return rank;
  }
  return null;
}

/**
 * Total offer count across the requested condition, from Summary.NumberOfOffers.
 * A high number of offers is a useful oversupply signal for the UI later.
 */
function offerCountForCondition(numberOfOffers, condition) {
  if (!Array.isArray(numberOfOffers)) return null;
  const want = String(condition || "").toLowerCase();
  let total = 0;
  let matched = false;
  for (const entry of numberOfOffers) {
    const cond = String(entry?.condition || entry?.Condition || "").toLowerCase();
    if (want && !cond.startsWith(want)) continue;
    const count = num(entry?.OfferCount);
    if (count != null) {
      total += count;
      matched = true;
    }
  }
  return matched ? total : null;
}

/**
 * Parse a v0 getItemOffers response into the shape the profit engine wants.
 * Returns null when there is no usable price for the requested condition.
 *
 * @param {object} json      the raw SP-API response ({ payload: {...} })
 * @param {object} opts      { condition, mode, marketplaceId }
 */
export function parsePricingOffers(json, { condition = "Used", mode = "sandbox", marketplaceId = "" } = {}) {
  const payload = json?.payload || json || {};
  const summary = payload.Summary || {};

  const amazonPrice = lowestLandedPrice(summary.LowestPrices, condition);
  if (amazonPrice == null) return null;

  const amazonBsr = firstSalesRank(summary.SalesRankings);
  const offerCount = offerCountForCondition(summary.NumberOfOffers, condition);

  return {
    amazonPrice,
    amazonBsr,
    offerCount,
    itemCondition: condition,
    asin: payload.ASIN || null,
    priceSource: mode === "production" ? "amazon-sp-api" : "amazon-sp-api-sandbox",
    amazonMode: mode,
    marketplaceId,
  };
}

async function requestOffersForCondition({ asin, condition, accessToken, config, timedFetch, sleepFn = sleep, retryDelayMs = 600 }) {
  const params = new URLSearchParams({
    MarketplaceId: config.marketplaceId,
    ItemCondition: condition,
  });
  const url = `${config.endpoint}/products/pricing/v0/items/${encodeURIComponent(asin)}/offers?${params}`;
  const headers = { accept: "application/json", "x-amz-access-token": accessToken };

  let response = await timedFetch(url, { headers });
  // Pricing is throttled (~0.5 req/s). One short backoff retry on 429/503 turns
  // a transient throttle into a live result instead of a silent estimate.
  if ((response.status === 429 || response.status === 503)) {
    await sleepFn(retryAfterMs(response, retryDelayMs));
    response = await timedFetch(url, { headers });
  }
  if (!response.ok) return null; // 404/other → let the caller fall back to estimate
  const json = await response.json().catch(() => null);
  if (!json) return null;
  return parsePricingOffers(json, { condition, mode: config.mode, marketplaceId: config.marketplaceId });
}

/**
 * Look up live Amazon pricing + rank for an ASIN. Best-effort: returns null on
 * any problem rather than throwing, so the scan path is never broken by it.
 *
 * @param {string} asin
 * @param {object} opts { fetchImpl, timeoutMs, conditions }
 * @returns {Promise<null | { amazonPrice, amazonBsr, offerCount, itemCondition, priceSource, ... }>}
 */
export async function lookupAmazonPricingByAsin(asin, {
  fetchImpl = fetch,
  timeoutMs = 3500,
  conditions = USED_CONDITION_ORDER,
  accessToken: sharedToken = null,
  sleepFn = sleep,
  retryDelayMs = 600,
} = {}) {
  if (!asin) return null;
  if (!publicAmazonStatus().configured) return null;

  const timedFetch = (url, options) => fetchWithTimeout(fetchImpl, url, options, timeoutMs);

  // Reuse a caller-provided token (one exchange per scan) when available.
  let accessToken = sharedToken;
  if (!accessToken) {
    try {
      ({ accessToken } = await requestAmazonAccessToken({ fetchImpl: timedFetch }));
    } catch {
      return null;
    }
  }

  const config = amazonRuntimeConfig();

  // Used-book resellers care about the used price first; fall back to New only
  // when no used offer exists (a brand-new title, say). One extra call at most.
  for (const condition of conditions) {
    try {
      const hit = await requestOffersForCondition({ asin, condition, accessToken, config, timedFetch, sleepFn, retryDelayMs });
      if (hit?.amazonPrice != null) return hit;
    } catch {
      // try next condition, then give up to the estimate
    }
  }

  return null;
}
