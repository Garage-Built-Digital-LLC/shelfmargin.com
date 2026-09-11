import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupAmazonFeesEstimate, parseFeesEstimate } from "../lib/amazonFees.js";
import { calcNetFromFees } from "../lib/bookdata.js";

const originalEnv = { ...process.env };

function configureSandbox() {
  process.env = { ...originalEnv };
  process.env.AMAZON_SP_API_MODE = "sandbox";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID = "client-id";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET = "client-secret";
  process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN = "refresh-token";
}

const FEES_OK = {
  payload: {
    FeesEstimateResult: {
      Status: "Success",
      FeesEstimate: {
        TotalFeesEstimate: { CurrencyCode: "USD", Amount: 5.06 },
        FeeDetailList: [
          { FeeType: "ReferralFee", FeeAmount: { Amount: 1.5 }, FinalFee: { Amount: 1.5 } },
          { FeeType: "VariableClosingFee", FeeAmount: { Amount: 1.8 }, FinalFee: { Amount: 1.8 } },
          { FeeType: "FBAFees", FeeAmount: { Amount: 1.76 }, FinalFee: { Amount: 1.76 } },
        ],
      },
    },
  },
};

describe("parseFeesEstimate", () => {
  it("extracts the total and the fee breakdown", () => {
    expect(parseFeesEstimate(FEES_OK)).toEqual({
      totalFees: 5.06,
      referralFee: 1.5,
      variableClosingFee: 1.8,
      fulfillmentFee: 1.76,
      feeSource: "amazon-fees-api",
    });
  });

  it("returns null on a non-success status", () => {
    expect(parseFeesEstimate({ payload: { FeesEstimateResult: { Status: "ClientError" } } })).toBeNull();
  });

  it("returns null when there is no total", () => {
    expect(parseFeesEstimate({ payload: { FeesEstimateResult: { FeesEstimate: {} } } })).toBeNull();
  });
});

describe("calcNetFromFees", () => {
  it("is price minus real fees minus cost", () => {
    // $12 list, $5.06 fees, $1 cost => 5.94
    expect(calcNetFromFees(12, 5.06, 1)).toBe(5.94);
  });
  it("returns null without a fee total", () => {
    expect(calcNetFromFees(12, null, 1)).toBeNull();
  });
});

describe("lookupAmazonFeesEstimate", () => {
  afterEach(() => { process.env = { ...originalEnv }; });

  it("returns null (no throw) when not configured", async () => {
    process.env = { ...originalEnv };
    const fetchImpl = vi.fn();
    expect(await lookupAmazonFeesEstimate("B1", 12, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs a fees estimate with a shared token and parses the total", async () => {
    configureSandbox();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => FEES_OK }));
    const result = await lookupAmazonFeesEstimate("B00V5DG6IQ", 12.5, { fetchImpl, accessToken: "shared-token" });

    expect(result).toMatchObject({ totalFees: 5.06, feeSource: "amazon-fees-api" });
    // shared token => no separate token exchange call, exactly one POST
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/products/fees/v0/items/B00V5DG6IQ/feesEstimate");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-amz-access-token"]).toBe("shared-token");
    const body = JSON.parse(opts.body);
    expect(body.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.Amount).toBe(12.5);
    expect(body.FeesEstimateRequest.IsAmazonFulfilled).toBe(true);
  });

  it("returns null (no throw) when the endpoint errors", async () => {
    configureSandbox();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    expect(await lookupAmazonFeesEstimate("B1", 12, { fetchImpl, accessToken: "t" })).toBeNull();
  });

  it("sends IsAmazonFulfilled=false for FBM (merchant-fulfilled)", async () => {
    configureSandbox();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => FEES_OK }));
    await lookupAmazonFeesEstimate("B00V5DG6IQ", 12.5, { fetchImpl, accessToken: "t", isAmazonFulfilled: false });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.FeesEstimateRequest.IsAmazonFulfilled).toBe(false);
  });
});
