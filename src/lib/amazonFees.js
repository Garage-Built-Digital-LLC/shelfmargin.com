// Amazon SP-API Product Fees client.
//
// Given an ASIN and the price it would sell for, this asks the Product Fees
// API (getMyFeesEstimateForASIN) for Amazon's ACTUAL fee total — referral +
// variable closing + fulfillment — so the net profit stops relying on the flat
// fee model in packages/core/profit.js (15% referral, $1.80 closing, $4.49 FBA)
// and uses real per-ASIN numbers.
//
// Same contract as amazonPricing.js: pure tested parser, best-effort caller
// (returns null on any error/timeout/misconfig, never throws into the scan).
//
// Fulfillment assumption: IsAmazonFulfilled defaults to true (FBA), matching
// the existing fee model. A future FBM path can pass isAmazonFulfilled:false.

import { amazonRuntimeConfig, publicAmazonStatus, requestAmazonAccessToken } from "./amazonConfig.js";

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

function feeAmount(detail) {
  // Prefer FinalFee (what the seller actually pays after any promotions);
  // fall back to FeeAmount.
  return num(detail?.FinalFee?.Amount) ?? num(detail?.FeeAmount?.Amount);
}

/**
 * Parse a getMyFeesEstimateForASIN response into a fee breakdown, or null when
 * the estimate did not succeed / carried no total.
 */
export function parseFeesEstimate(json) {
  const result = json?.payload?.FeesEstimateResult || json?.FeesEstimateResult || {};
  if (result.Status && String(result.Status).toLowerCase() !== "success") return null;

  const estimate = result.FeesEstimate || {};
  const total = round2(num(estimate.TotalFeesEstimate?.Amount));
  if (total == null) return null;

  const details = Array.isArray(estimate.FeeDetailList) ? estimate.FeeDetailList : [];
  const byType = {};
  for (const d of details) {
    const type = String(d?.FeeType || "");
    const amt = feeAmount(d);
    if (type && amt != null) byType[type] = amt;
  }

  // FBA fulfillment appears under a few names across categories.
  const fulfillment = byType.FBAFees ?? byType.FulfillmentFees ?? byType.FBAPerUnitFulfillmentFee ?? null;

  return {
    totalFees: total,
    referralFee: byType.ReferralFee ?? null,
    variableClosingFee: byType.VariableClosingFee ?? null,
    fulfillmentFee: fulfillment,
    feeSource: "amazon-fees-api",
  };
}

/**
 * Best-effort per-ASIN fee estimate for a given listing price.
 * @param {string} asin
 * @param {number} price   listing price to estimate fees against
 * @param {object} opts    { fetchImpl, timeoutMs, isAmazonFulfilled, accessToken }
 * @returns {Promise<null | { totalFees, referralFee, variableClosingFee, fulfillmentFee, feeSource }>}
 */
export async function lookupAmazonFeesEstimate(asin, price, {
  fetchImpl = fetch,
  timeoutMs = 3500,
  isAmazonFulfilled = true,
  accessToken: sharedToken = null,
} = {}) {
  if (!asin || price == null) return null;
  if (!publicAmazonStatus().configured) return null;

  const timedFetch = (url, options) => fetchWithTimeout(fetchImpl, url, options, timeoutMs);

  let accessToken = sharedToken;
  if (!accessToken) {
    try {
      ({ accessToken } = await requestAmazonAccessToken({ fetchImpl: timedFetch }));
    } catch {
      return null;
    }
  }

  const config = amazonRuntimeConfig();
  const bodyObj = {
    FeesEstimateRequest: {
      MarketplaceId: config.marketplaceId,
      IsAmazonFulfilled: isAmazonFulfilled,
      Identifier: `sm-${asin}-${Date.now()}`,
      PriceToEstimateFees: {
        ListingPrice: { CurrencyCode: "USD", Amount: price },
      },
    },
  };

  try {
    const response = await timedFetch(`${config.endpoint}/products/fees/v0/items/${encodeURIComponent(asin)}/feesEstimate`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-amz-access-token": accessToken,
      },
      body: JSON.stringify(bodyObj),
    });
    if (!response.ok) return null;
    const json = await response.json().catch(() => null);
    if (!json) return null;
    return parseFeesEstimate(json);
  } catch {
    return null;
  }
}
