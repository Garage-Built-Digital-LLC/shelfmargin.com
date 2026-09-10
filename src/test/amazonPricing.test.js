import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firstSalesRank,
  lookupAmazonPricingByAsin,
  lowestLandedPrice,
  parsePricingOffers,
} from "../lib/amazonPricing.js";

const originalEnv = { ...process.env };

function configureSandbox() {
  process.env = { ...originalEnv };
  process.env.AMAZON_SP_API_MODE = "sandbox";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID = "client-id";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET = "client-secret";
  process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN = "refresh-token";
}

// A representative v0 getItemOffers response Summary.
const USED_OFFERS = {
  payload: {
    ASIN: "B001234567",
    status: "Success",
    ItemCondition: "Used",
    Summary: {
      LowestPrices: [
        { condition: "used", LandedPrice: { Amount: 9.75, CurrencyCode: "USD" } },
        { condition: "used", ListingPrice: { Amount: 6.5 }, Shipping: { Amount: 3.99 } },
        { condition: "new", LandedPrice: { Amount: 24.99 } },
      ],
      NumberOfOffers: [
        { condition: "used", fulfillmentChannel: "Amazon", OfferCount: 4 },
        { condition: "used", fulfillmentChannel: "Merchant", OfferCount: 11 },
        { condition: "new", fulfillmentChannel: "Merchant", OfferCount: 6 },
      ],
      SalesRankings: [
        { ProductCategoryId: "book_display_on_website", Rank: 18452 },
        { ProductCategoryId: "281052", Rank: 12 },
      ],
    },
  },
};

describe("amazon pricing parsers", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("picks the lowest landed price for the requested condition", () => {
    // used has an explicit 9.75 landed and a 6.50+3.99=10.49 computed → 9.75 wins
    expect(lowestLandedPrice(USED_OFFERS.payload.Summary.LowestPrices, "Used")).toBe(9.75);
    expect(lowestLandedPrice(USED_OFFERS.payload.Summary.LowestPrices, "New")).toBe(24.99);
  });

  it("reads the first usable sales rank", () => {
    expect(firstSalesRank(USED_OFFERS.payload.Summary.SalesRankings)).toBe(18452);
    expect(firstSalesRank([{ Rank: 0 }, { Rank: 55 }])).toBe(55);
    expect(firstSalesRank(undefined)).toBeNull();
  });

  it("parses offers into engine-ready shape", () => {
    const parsed = parsePricingOffers(USED_OFFERS, { condition: "Used", mode: "production", marketplaceId: "ATVPDKIKX0DER" });
    expect(parsed).toMatchObject({
      amazonPrice: 9.75,
      amazonBsr: 18452,
      offerCount: 15, // 4 + 11 used offers
      itemCondition: "Used",
      priceSource: "amazon-sp-api",
      asin: "B001234567",
    });
  });

  it("returns null when no offer matches the condition", () => {
    const empty = { payload: { Summary: { LowestPrices: [{ condition: "new", LandedPrice: { Amount: 20 } }] } } };
    expect(parsePricingOffers(empty, { condition: "Used" })).toBeNull();
  });
});

describe("lookupAmazonPricingByAsin", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null (no throw) when Amazon is not configured", async () => {
    process.env = { ...originalEnv };
    delete process.env.AMAZON_SP_API_LWA_CLIENT_ID;
    delete process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID;
    const fetchImpl = vi.fn();
    const result = await lookupAmazonPricingByAsin("B001234567", { fetchImpl });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges a token then reads live used pricing, never leaking creds", async () => {
    configureSandbox();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url) === "https://api.amazon.com/auth/o2/token") {
        return { ok: true, json: async () => ({ access_token: "access-token", token_type: "bearer", expires_in: 3600 }) };
      }
      return { ok: true, json: async () => USED_OFFERS };
    });

    const result = await lookupAmazonPricingByAsin("B001234567", { fetchImpl });
    const pricingCall = fetchImpl.mock.calls[1];

    expect(result).toMatchObject({ amazonPrice: 9.75, amazonBsr: 18452, priceSource: "amazon-sp-api-sandbox" });
    expect(String(pricingCall[0])).toContain("/products/pricing/v0/items/B001234567/offers");
    expect(String(pricingCall[0])).toContain("ItemCondition=Used");
    expect(pricingCall[1].headers["x-amz-access-token"]).toBe("access-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
    expect(JSON.stringify(result)).not.toContain("access-token");
  });

  it("falls back to New when there is no used offer", async () => {
    configureSandbox();
    const newOnly = { payload: { ASIN: "B1", Summary: { LowestPrices: [{ condition: "new", LandedPrice: { Amount: 18.0 } }], SalesRankings: [{ Rank: 900 }] } } };
    const fetchImpl = vi.fn(async (url) => {
      if (String(url) === "https://api.amazon.com/auth/o2/token") {
        return { ok: true, json: async () => ({ access_token: "t", token_type: "bearer", expires_in: 3600 }) };
      }
      return { ok: true, json: async () => newOnly };
    });

    const result = await lookupAmazonPricingByAsin("B1", { fetchImpl });
    // First (Used) call yields nothing → falls through to New = 18.0
    expect(result).toMatchObject({ amazonPrice: 18.0, itemCondition: "New" });
    // token + used + new = 3 calls
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns null (no throw) when the pricing endpoint errors", async () => {
    configureSandbox();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url) === "https://api.amazon.com/auth/o2/token") {
        return { ok: true, json: async () => ({ access_token: "t", token_type: "bearer", expires_in: 3600 }) };
      }
      return { ok: false, status: 429, json: async () => ({ errors: [{ code: "QuotaExceeded" }] }) };
    });

    const result = await lookupAmazonPricingByAsin("B1", { fetchImpl });
    expect(result).toBeNull();
  });
});
