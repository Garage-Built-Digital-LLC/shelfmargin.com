import { normalizeToIsbn13 } from "../../packages/core/isbn.js";
import { amazonRuntimeConfig, requestAmazonAccessToken } from "./amazonConfig.js";

function text(value) {
  return String(value || "").trim();
}

function firstText(values) {
  if (Array.isArray(values)) {
    for (const value of values) {
      const nested = text(value?.value || value?.name || value?.displayName);
      if (nested) return nested;
      const direct = typeof value === "object" ? "" : text(value);
      if (direct) return direct;
    }
  }
  return text(values);
}

function authorFromAttributes(attributes = {}) {
  return firstText(attributes.author)
    || firstText(attributes.contributor)
    || firstText(attributes.creator)
    || firstText(attributes.manufacturer)
    || firstText(attributes.brand);
}

/**
 * Overall Best Sellers Rank from Catalog Items salesRanks. The "Books"
 * displayGroup rank is the number our velocity thresholds assume; fall back to
 * the first classification rank when no displayGroup rank is present.
 */
export function bsrFromSalesRanks(salesRanks) {
  if (!Array.isArray(salesRanks)) return null;
  for (const group of salesRanks) {
    const display = Array.isArray(group?.displayGroupRanks) ? group.displayGroupRanks : [];
    for (const entry of display) {
      const rank = Number(entry?.rank);
      if (Number.isFinite(rank) && rank > 0) return rank;
    }
    const classified = Array.isArray(group?.classificationRanks) ? group.classificationRanks : [];
    for (const entry of classified) {
      const rank = Number(entry?.rank);
      if (Number.isFinite(rank) && rank > 0) return rank;
    }
  }
  return null;
}

function sanitizedAmazonError(json) {
  const first = Array.isArray(json?.errors) ? json.errors[0] : null;
  return {
    code: text(first?.code) || null,
    message: text(first?.message) || null,
  };
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

export function parseAmazonCatalogSearch(json, { mode = "sandbox", marketplaceId = "" } = {}) {
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  if (!item?.asin) return null;

  const summary = Array.isArray(item.summaries) ? item.summaries[0] : null;
  const attributes = item.attributes || {};
  const title = text(summary?.itemName)
    || firstText(attributes.item_name)
    || firstText(attributes.title)
    || firstText(attributes.product_title);

  if (!title) return null;

  return {
    asin: item.asin,
    title,
    author: authorFromAttributes(attributes),
    catalogBsr: bsrFromSalesRanks(item.salesRanks),
    source: mode === "production" ? "amazon-sp-api" : "amazon-sp-api-sandbox",
    catalogSource: mode === "production" ? "amazon-sp-api" : "amazon-sp-api-sandbox",
    amazonMode: mode,
    marketplaceId,
  };
}

export async function lookupAmazonCatalogByIsbn(rawIsbn, { fetchImpl = fetch, timeoutMs = 6500 } = {}) {
  const isbn = normalizeToIsbn13(rawIsbn);
  if (!isbn) {
    const err = new Error("valid ISBN required");
    err.status = 400;
    err.code = "invalid_isbn";
    throw err;
  }

  const timedFetch = (url, options) => fetchWithTimeout(fetchImpl, url, options, timeoutMs);
  const { accessToken } = await requestAmazonAccessToken({ fetchImpl: timedFetch });
  const config = amazonRuntimeConfig();
  const params = new URLSearchParams({
    marketplaceIds: config.marketplaceId,
    identifiers: isbn,
    identifiersType: "ISBN",
    includedData: "summaries,attributes,identifiers,images,salesRanks",
    pageSize: "1",
  });
  const response = await timedFetch(`${config.endpoint}/catalog/2022-04-01/items?${params}`, {
    headers: {
      accept: "application/json",
      "x-amz-access-token": accessToken,
    },
  });

  if (response.status === 404) return null;

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error("Amazon catalog lookup failed");
    err.status = 502;
    err.code = "amazon_catalog_failed";
    err.amazonStatus = response.status;
    err.amazonError = sanitizedAmazonError(json);
    throw err;
  }

  return parseAmazonCatalogSearch(json, config);
}
