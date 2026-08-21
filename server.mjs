import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeToIsbn13 } from "./src/lib/isbn.js";
import {
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "./src/providers/liveProvider.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "dist");
const port = Number(process.env.PORT || 4173);
const catalogTimeoutMs = Number(process.env.CATALOG_TIMEOUT_MS || 6500);
const catalogRateLimitWindowMs = Number(process.env.CATALOG_RATE_LIMIT_WINDOW_MS || 60_000);
const catalogRateLimitMax = Number(process.env.CATALOG_RATE_LIMIT_MAX || 60);
const catalogRateBuckets = new Map();

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

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), catalogTimeoutMs);
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

async function lookupCatalog(isbn) {
  const booksParams = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: "json",
    jscmd: "data",
  });
  const books = await fetchJson(`https://openlibrary.org/api/books?${booksParams}`);
  const booksHit = parseOpenLibraryBooks(isbn, books);
  if (booksHit?.title) return { ...booksHit, source: "openlibrary" };

  const searchParams = new URLSearchParams({
    isbn,
    fields: "title,author_name,isbn",
  });
  const search = await fetchJson(`https://openlibrary.org/search.json?${searchParams}`);
  const searchHit = parseOpenLibrarySearch(search);
  if (searchHit?.title) return { ...searchHit, source: "openlibrary-search" };

  const googleParams = new URLSearchParams({
    q: `isbn:${isbn}`,
    projection: "lite",
  });
  const google = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${googleParams}`);
  const googleHit = parseGoogleBooks(google);
  if (googleHit?.title) return { ...googleHit, source: "google-books" };

  return null;
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

function allowCatalogRequest(req) {
  const now = Date.now();
  const key = clientKey(req);
  const existing = catalogRateBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    catalogRateBuckets.set(key, { count: 1, resetAt: now + catalogRateLimitWindowMs });
    return true;
  }

  if (existing.count >= catalogRateLimitMax) return false;
  existing.count += 1;

  if (catalogRateBuckets.size > 500) {
    for (const [bucketKey, bucket] of catalogRateBuckets.entries()) {
      if (bucket.resetAt <= now) catalogRateBuckets.delete(bucketKey);
    }
  }

  return true;
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
      if (url.pathname === "/api/catalog") {
        if (!allowCatalogRequest(req)) {
          res.writeHead(429, responseHeaders({
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "retry-after": String(Math.ceil(catalogRateLimitWindowMs / 1000)),
          }));
          res.end(JSON.stringify({ error: "rate limit exceeded" }));
          return;
        }

        const isbn = normalizeToIsbn13(url.searchParams.get("isbn"));
        if (!isbn) {
          sendJson(res, 400, { error: "valid ISBN required" });
          return;
        }

        const hit = await lookupCatalog(isbn);
        if (!hit) {
          sendJson(res, 404, { error: "catalog match not found" });
          return;
        }
        sendJson(res, 200, { isbn, ...hit });
        return;
      }

      await serveStatic(req, res);
    } catch (err) {
      sendJson(res, 500, { error: "server error" });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createShelfMarginServer().listen(port, "0.0.0.0", () => {
    console.log(`ShelfMargin preview listening on ${port}`);
  });
}
