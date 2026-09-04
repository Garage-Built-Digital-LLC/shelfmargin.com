// Shared helpers for Vercel serverless functions (api/*). Mirrors the security
// posture of server.mjs so the deployed API behaves the same as local/Docker.
export const SECURITY_HEADERS = {
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

export function applySecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
}

export function sendJson(res, status, data) {
  applySecurityHeaders(res);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export function methodNotAllowed(res, allow) {
  applySecurityHeaders(res);
  res.setHeader("allow", allow);
  res.statusCode = 405;
  res.end(JSON.stringify({ error: "method not allowed" }));
}

// Only surface internal fields for deliberate (err.status) errors; never leak on 500.
export function handleError(res, err) {
  if (err && err.status) {
    sendJson(res, err.status, {
      error: err.message,
      code: err.code,
      amazonStatus: err.amazonStatus,
      amazonError: err.amazonError,
    });
  } else {
    sendJson(res, 500, { error: "server error" });
  }
}
