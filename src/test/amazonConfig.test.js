import { afterEach, describe, expect, it, vi } from "vitest";
import { publicAmazonStatus, requestAmazonAccessToken, testAmazonConnection } from "../lib/amazonConfig.js";

const originalEnv = { ...process.env };

function resetAmazonEnv() {
  process.env = { ...originalEnv };
  delete process.env.AMAZON_SP_API_MODE;
  delete process.env.AMAZON_SP_API_ENDPOINT;
  delete process.env.AMAZON_SP_API_MARKETPLACE_ID;
  delete process.env.AMAZON_SP_API_LWA_CLIENT_ID;
  delete process.env.AMAZON_SP_API_LWA_CLIENT_SECRET;
  delete process.env.AMAZON_SP_API_REFRESH_TOKEN;
  delete process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID;
  delete process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET;
  delete process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN;
}

describe("amazon SP-API config", () => {
  afterEach(() => {
    resetAmazonEnv();
  });

  it("reports missing config without exposing secrets", () => {
    resetAmazonEnv();

    const status = publicAmazonStatus();

    expect(status.configured).toBe(false);
    expect(status.mode).toBe("sandbox");
    expect(status.endpointHost).toBe("sandbox.sellingpartnerapi-na.amazon.com");
    expect(status.pieces.lwaClientSecret).toBe(false);
    expect(JSON.stringify(status)).not.toContain("Atzr|");
  });

  it("reports complete config by presence only", () => {
    process.env.AMAZON_SP_API_MODE = "production";
    process.env.AMAZON_SP_API_LWA_CLIENT_ID = "amzn1.application-oa2-client.real";
    process.env.AMAZON_SP_API_LWA_CLIENT_SECRET = "secret-value";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "Atzr|refresh-value";

    const text = JSON.stringify(publicAmazonStatus());

    expect(JSON.parse(text)).toMatchObject({
      configured: true,
      mode: "production",
      endpointHost: "sellingpartnerapi-na.amazon.com",
      marketplaceId: "ATVPDKIKX0DER",
    });
    expect(text).not.toContain("secret-value");
    expect(text).not.toContain("refresh-value");
  });

  it("uses sandbox-specific credentials while in sandbox mode", () => {
    process.env.AMAZON_SP_API_MODE = "sandbox";
    process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID = "amzn1.application-oa2-client.sandbox";
    process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET = "sandbox-secret";
    process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN = "Atzr|sandbox-refresh";

    const text = JSON.stringify(publicAmazonStatus());

    expect(JSON.parse(text)).toMatchObject({
      configured: true,
      mode: "sandbox",
      endpointHost: "sandbox.sellingpartnerapi-na.amazon.com",
      marketplaceId: "ATVPDKIKX0DER",
    });
    expect(text).not.toContain("sandbox-secret");
    expect(text).not.toContain("sandbox-refresh");
  });

  it("does not use sandbox-specific credentials in production mode", () => {
    process.env.AMAZON_SP_API_MODE = "production";
    process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID = "amzn1.application-oa2-client.sandbox";
    process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET = "sandbox-secret";
    process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN = "Atzr|sandbox-refresh";

    const status = publicAmazonStatus();

    expect(status.configured).toBe(false);
    expect(status.mode).toBe("production");
    expect(status.pieces.lwaClientId).toBe(false);
    expect(status.pieces.lwaClientSecret).toBe(false);
    expect(status.pieces.refreshToken).toBe(false);
  });

  it("exchanges refresh token for a temporary access token server-side", async () => {
    process.env.AMAZON_SP_API_LWA_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_LWA_CLIENT_SECRET = "client-secret";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "refresh-token";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "access-token", token_type: "bearer", expires_in: 3600 }),
    }));

    const token = await requestAmazonAccessToken({ fetchImpl });

    expect(token).toEqual({ accessToken: "access-token", tokenType: "bearer", expiresIn: 3600 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.amazon.com/auth/o2/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(String(fetchImpl.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
  });

  it("tests the Amazon connection without returning the access token", async () => {
    process.env.AMAZON_SP_API_LWA_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_LWA_CLIENT_SECRET = "client-secret";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "refresh-token";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "access-token", token_type: "bearer", expires_in: 3600 }),
    }));
    const verifyAdmin = vi.fn(async () => ({ role: "admin" }));

    const result = await testAmazonConnection({ authHeader: "Bearer user-token", verifyAdmin, fetchImpl });
    const text = JSON.stringify(result);

    expect(result.connected).toBe(true);
    expect(result.tokenType).toBe("bearer");
    expect(result.expiresIn).toBe(3600);
    expect(text).not.toContain("access-token");
    expect(text).not.toContain("refresh-token");
    expect(text).not.toContain("client-secret");
    expect(verifyAdmin).toHaveBeenCalledWith({ authHeader: "Bearer user-token", fetchImpl });
  });
});
