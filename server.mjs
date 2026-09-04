import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeToIsbn13 } from "./packages/core/isbn.js";
import { lookupCatalog } from "./src/lib/catalogLookup.js";
import Stripe from "stripe";
import { createCheckoutSession, readJsonBody, STRIPE_API_VERSION } from "./src/lib/stripeCheckout.js";
import { createPortalSession } from "./src/lib/stripePortal.js";
import { publicStripeStatus } from "./src/lib/stripeConfig.js";
import { handleStripeWebhook, readRawBody } from "./src/lib/stripeWebhook.js";
import { publicAmazonStatus, testAmazonConnection } from "./src/lib/amazonConfig.js";
import { lookupAmazonCatalogByIsbn } from "./src/lib/amazonCatalog.js";
import { verifyAdminUser } from "./src/lib/adminAuth.js";
import { exportUserData, deleteUserAccount } from "./src/lib/accountLifecycle.js";
import { log, reportServerError } from "./src/lib/logger.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "dist");
const port = Number(process.env.PORT || 4173);
const catalogTimeoutMs = Number(process.env.CATALOG_TIMEOUT_MS || 6500);
const amazonCatalogFallbackTimeoutMs = Number(process.env.AMAZON_CATALOG_FALLBACK_TIMEOUT_MS || 2500);
const catalogRateLimitWindowMs = Number(process.env.CATALOG_RATE_LIMIT_WINDOW_MS || 60_000);
const catalogRateLimitMax = Number(process.env.CATALOG_RATE_LIMIT_MAX || 60);
const sensitiveRateLimitWindowMs = Number(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || 60_000);
const sensitiveRateLimitMax = Number(process.env.SENSITIVE_RATE_LIMIT_MAX || 20);
const rateBuckets = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openlibrary.org https://www.googleapis.com",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

function responseHeaders(headers = {}) {
  return { ...securityHeaders, ...headers };
}


function sendJson(res, status, data) {
  res.writeHead(status, responseHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  }));
  res.end(JSON.stringify(data));
}

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function allowRateLimitedRequest(req, bucketName, maxRequests, windowMs) {
  const now = Date.now();
  const key = `${bucketName}:${clientKey(req)}`;
  const existing = rateBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= maxRequests) return false;
  existing.count += 1;

  if (rateBuckets.size > 1_000) {
    for (const [bucketKey, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }

  return true;
}

function sendRateLimit(res, windowMs) {
  res.writeHead(429, responseHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "retry-after": String(Math.ceil(windowMs / 1000)),
  }));
  res.end(JSON.stringify({ error: "rate limit exceeded" }));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rawPath = decodeURIComponent(url.pathname);
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const requested = safePath === "/" ? "/index.html" : safePath;
  const parts = requested.split("/").filter(Boolean);

  if (parts.some((part) => part.startsWith("."))) {
    res.writeHead(404, responseHeaders({ "content-type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const filePath = join(distDir, requested);

  if (!filePath.startsWith(`${distDir}/`) && filePath !== distDir) {
    res.writeHead(403, responseHeaders({ "content-type": "text/plain; charset=utf-8" }));
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, responseHeaders({ "content-type": type, "cache-control": "no-cache" }));
    res.end(body);
  } catch (err) {
    const body = await readFile(join(distDir, "index.html"));
    res.writeHead(200, responseHeaders({
      "content-type": contentTypes[".html"],
      "cache-control": "no-cache",
    }));
    res.end(body);
  }
}

export function createShelfMarginServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true, time: new Date().toISOString() });
        return;
      }

      if (url.pathname === "/api/catalog") {
        if (!allowRateLimitedRequest(req, "catalog", catalogRateLimitMax, catalogRateLimitWindowMs)) {
          sendRateLimit(res, catalogRateLimitWindowMs);
          return;
        }

        const isbn = normalizeToIsbn13(url.searchParams.get("isbn"));
        if (!isbn) {
          sendJson(res, 400, { error: "valid ISBN required" });
          return;
        }

        const hit = await lookupCatalog(isbn, { timeoutMs: catalogTimeoutMs, amazonFallbackTimeoutMs: amazonCatalogFallbackTimeoutMs });
        if (!hit) {
          sendJson(res, 404, { error: "catalog match not found" });
          return;
        }
        sendJson(res, 200, { isbn, ...hit });
        return;
      }

      if (url.pathname === "/api/stripe/status") {
        sendJson(res, 200, publicStripeStatus());
        return;
      }

      if (url.pathname === "/api/amazon/status") {
        sendJson(res, 200, publicAmazonStatus());
        return;
      }

      if (url.pathname === "/api/amazon/test" && req.method === "POST") {
        if (!allowRateLimitedRequest(req, "amazon-test", sensitiveRateLimitMax, sensitiveRateLimitWindowMs)) {
          sendRateLimit(res, sensitiveRateLimitWindowMs);
          return;
        }

        const result = await testAmazonConnection({
          authHeader: req.headers.authorization,
          verifyAdmin: verifyAdminUser,
        });
        sendJson(res, 200, result);
        return;
      }

      if (url.pathname === "/api/amazon/catalog") {
        if (!allowRateLimitedRequest(req, "amazon-catalog", catalogRateLimitMax, catalogRateLimitWindowMs)) {
          sendRateLimit(res, catalogRateLimitWindowMs);
          return;
        }

        const isbn = normalizeToIsbn13(url.searchParams.get("isbn"));
        if (!isbn) {
          sendJson(res, 400, { error: "valid ISBN required" });
          return;
        }

        const hit = await lookupAmazonCatalogByIsbn(isbn, { timeoutMs: catalogTimeoutMs });
        if (!hit) {
          sendJson(res, 404, { error: "Amazon catalog match not found" });
          return;
        }
        sendJson(res, 200, { isbn, ...hit });
        return;
      }

      if (url.pathname === "/api/stripe/checkout" && req.method === "POST") {
        if (!allowRateLimitedRequest(req, "stripe-checkout", sensitiveRateLimitMax, sensitiveRateLimitWindowMs)) {
          sendRateLimit(res, sensitiveRateLimitWindowMs);
          return;
        }

        const body = await readJsonBody(req);
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
          apiVersion: STRIPE_API_VERSION,
        });
        const session = await createCheckoutSession({
          planId: body.planId,
          authHeader: req.headers.authorization,
          stripeClient: stripe,
        });
        sendJson(res, 200, session);
        return;
      }

      if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
        const rawBody = await readRawBody(req);
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
          apiVersion: STRIPE_API_VERSION,
        });
        const result = await handleStripeWebhook({
          rawBody,
          signature: req.headers["stripe-signature"],
          stripeClient: stripe,
        });
        sendJson(res, 200, result);
        return;
      }

      if (url.pathname === "/api/stripe/portal" && req.method === "POST") {
        if (!allowRateLimitedRequest(req, "stripe-portal", sensitiveRateLimitMax, sensitiveRateLimitWindowMs)) {
          sendRateLimit(res, sensitiveRateLimitWindowMs);
          return;
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
          apiVersion: STRIPE_API_VERSION,
        });
        const session = await createPortalSession({
          authHeader: req.headers.authorization,
          stripeClient: stripe,
        });
        sendJson(res, 200, session);
        return;
      }

      if (url.pathname === "/api/account/export" && req.method === "GET") {
        if (!allowRateLimitedRequest(req, "account-export", sensitiveRateLimitMax, sensitiveRateLimitWindowMs)) {
          sendRateLimit(res, sensitiveRateLimitWindowMs);
          return;
        }

        const result = await exportUserData({ authHeader: req.headers.authorization });
        sendJson(res, 200, result);
        return;
      }

      if (url.pathname === "/api/account/delete" && req.method === "POST") {
        if (!allowRateLimitedRequest(req, "account-delete", sensitiveRateLimitMax, sensitiveRateLimitWindowMs)) {
          sendRateLimit(res, sensitiveRateLimitWindowMs);
          return;
        }

        const result = await deleteUserAccount({ authHeader: req.headers.authorization });
        sendJson(res, 200, result);
        return;
      }

      await serveStatic(req, res);
    } catch (err) {
      if (err.status) {
        // Deliberate, client-safe error. Log at warn for visibility, not alerting.
        log("warn", "request_error", { path: req.url, method: req.method, status: err.status, code: err.code });
        sendJson(res, err.status, {
          error: err.message,
          code: err.code,
          amazonStatus: err.amazonStatus,
          amazonError: err.amazonError,
        });
      } else {
        // Unexpected error: report it (structured log + optional forwarder) and
        // never leak internal integration state to the client.
        await reportServerError(err, { path: req.url, method: req.method });
        sendJson(res, 500, { error: "server error" });
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createShelfMarginServer().listen(port, "0.0.0.0", () => {
    console.log(`ShelfMargin preview listening on ${port}`);
  });
}
