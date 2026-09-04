import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupAmazonCatalogByIsbn, parseAmazonCatalogSearch } from "../lib/amazonCatalog.js";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  process.env.AMAZON_SP_API_MODE = "sandbox";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID = "client-id";
  process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET = "client-secret";
  process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN = "refresh-token";
}

describe("amazon catalog lookup", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses Amazon catalog items without exposing credentials", () => {
    const result = parseAmazonCatalogSearch({
      items: [{
        asin: "B001234567",
        summaries: [{ itemName: "Clean Code" }],
        attributes: { author: [{ value: "Robert C. Martin" }] },
      }],
    }, { mode: "sandbox", marketplaceId: "ATVPDKIKX0DER" });

    expect(result).toEqual({
      asin: "B001234567",
      title: "Clean Code",
      author: "Robert C. Martin",
      source: "amazon-sp-api-sandbox",
      catalogSource: "amazon-sp-api-sandbox",
      amazonMode: "sandbox",
      marketplaceId: "ATVPDKIKX0DER",
    });
  });

  it("exchanges a refresh token and searches Amazon catalog by ISBN", async () => {
    resetEnv();
    const fetchImpl = vi.fn(async (url) => {
      if (url === "https://api.amazon.com/auth/o2/token") {
        return {
          ok: true,
          json: async () => ({ access_token: "access-token", token_type: "bearer", expires_in: 3600 }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: [{
            asin: "B001234567",
            summaries: [{ itemName: "Clean Code" }],
            attributes: { author: [{ value: "Robert C. Martin" }] },
          }],
        }),
      };
    });

    const result = await lookupAmazonCatalogByIsbn("9780132350884", { fetchImpl });
    const catalogCall = fetchImpl.mock.calls[1];

    expect(result.title).toBe("Clean Code");
    expect(result.asin).toBe("B001234567");
    expect(String(catalogCall[0])).toContain("/catalog/2022-04-01/items?");
    expect(String(catalogCall[0])).toContain("identifiers=9780132350884");
    expect(catalogCall[1].headers["x-amz-access-token"]).toBe("access-token");
    expect(JSON.stringify(result)).not.toContain("access-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
  });

  it("returns sanitized Amazon errors without token details", async () => {
    resetEnv();
    const fetchImpl = vi.fn(async (url) => {
      if (url === "https://api.amazon.com/auth/o2/token") {
        return {
          ok: true,
          json: async () => ({ access_token: "access-token", token_type: "bearer", expires_in: 3600 }),
        };
      }
      return {
        ok: false,
        status: 400,
        json: async () => ({ errors: [{ code: "InvalidInput", message: "Could not match input arguments" }] }),
      };
    });

    await expect(lookupAmazonCatalogByIsbn("9780132350884", { fetchImpl })).rejects.toMatchObject({
      code: "amazon_catalog_failed",
      amazonStatus: 400,
      amazonError: {
        code: "InvalidInput",
        message: "Could not match input arguments",
      },
    });
  });
});
