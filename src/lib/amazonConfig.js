const AMAZON_LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const AMAZON_SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com";
const AMAZON_PRODUCTION_ENDPOINT = "https://sellingpartnerapi-na.amazon.com";

function trim(value) {
  return String(value || "").trim();
}

/** Await ms milliseconds. Injectable in tests to avoid real waiting. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay to wait before retrying a throttled (429/503) SP-API call. Honors the
 * Retry-After header (seconds) when present, capped so a scan never hangs;
 * otherwise uses the caller's fallback.
 */
export function retryAfterMs(response, fallbackMs = 600) {
  try {
    const raw = response?.headers?.get?.("retry-after");
    const secs = Number(raw);
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 2000);
  } catch {
    /* no headers — use fallback */
  }
  return fallbackMs;
}

function amazonEnv() {
  const mode = trim(process.env.AMAZON_SP_API_MODE || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
  const sandboxMode = mode === "sandbox";

  return {
    mode,
    endpoint: trim(process.env.AMAZON_SP_API_ENDPOINT)
      || (mode === "production" ? AMAZON_PRODUCTION_ENDPOINT : AMAZON_SANDBOX_ENDPOINT),
    marketplaceId: trim(process.env.AMAZON_SP_API_MARKETPLACE_ID || "ATVPDKIKX0DER"),
    lwaClientId: trim(process.env.AMAZON_SP_API_LWA_CLIENT_ID)
      || (sandboxMode ? trim(process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID) : ""),
    lwaClientSecret: trim(process.env.AMAZON_SP_API_LWA_CLIENT_SECRET)
      || (sandboxMode ? trim(process.env.AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET) : ""),
    refreshToken: trim(process.env.AMAZON_SP_API_REFRESH_TOKEN)
      || (sandboxMode ? trim(process.env.AMAZON_SP_API_SANDBOX_REFRESH_TOKEN) : ""),
  };
}

export function amazonRuntimeConfig() {
  const env = amazonEnv();
  return {
    mode: env.mode,
    endpoint: env.endpoint,
    marketplaceId: env.marketplaceId,
  };
}

function present(value) {
  return Boolean(trim(value));
}

export function publicAmazonStatus() {
  const env = amazonEnv();
  const pieces = {
    endpoint: present(env.endpoint),
    marketplaceId: present(env.marketplaceId),
    lwaClientId: present(env.lwaClientId),
    lwaClientSecret: present(env.lwaClientSecret),
    refreshToken: present(env.refreshToken),
  };

  return {
    configured: Object.values(pieces).every(Boolean),
    mode: env.mode,
    endpointHost: env.endpoint ? new URL(env.endpoint).host : "",
    marketplaceId: pieces.marketplaceId ? env.marketplaceId : "",
    pieces,
  };
}

export async function requestAmazonAccessToken({ fetchImpl = fetch } = {}) {
  const env = amazonEnv();
  const status = publicAmazonStatus();
  if (!status.configured) {
    const missing = Object.entries(status.pieces)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);
    const err = new Error(`Amazon SP-API is missing: ${missing.join(", ")}`);
    err.status = 503;
    err.code = "amazon_not_configured";
    throw err;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: env.refreshToken,
    client_id: env.lwaClientId,
    client_secret: env.lwaClientSecret,
  });

  const response = await fetchImpl(AMAZON_LWA_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    const err = new Error("Amazon LWA token exchange failed");
    err.status = 502;
    err.code = "amazon_token_failed";
    throw err;
  }

  return {
    accessToken: json.access_token,
    tokenType: json.token_type || "bearer",
    expiresIn: Number(json.expires_in || 0),
  };
}

export async function testAmazonConnection({ authHeader, verifyAdmin, fetchImpl = fetch } = {}) {
  if (verifyAdmin) await verifyAdmin({ authHeader, fetchImpl });

  const token = await requestAmazonAccessToken({ fetchImpl });
  const status = publicAmazonStatus();

  return {
    connected: true,
    mode: status.mode,
    endpointHost: status.endpointHost,
    marketplaceId: status.marketplaceId,
    tokenType: token.tokenType,
    expiresIn: token.expiresIn,
  };
}
