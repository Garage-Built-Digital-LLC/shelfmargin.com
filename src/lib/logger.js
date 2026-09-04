// Dependency-free structured logging + optional error forwarding.
// Every host (Vercel, Docker, a plain box) captures stdout/stderr, so we emit
// one JSON line per event. If ERROR_WEBHOOK_URL is set, unexpected server errors
// are also POSTed there (Slack/Discord/any collector). Monitoring must never
// break a request, so forwarding is best-effort, time-bounded, and never throws.

function nowIso() {
  return new Date().toISOString();
}

export function serializeError(err) {
  if (!err || typeof err !== "object") return { message: String(err) };
  const out = { message: err.message || "error" };
  if (err.status) out.status = err.status;
  if (err.code) out.code = err.code;
  if (err.stack) out.stack = String(err.stack).split("\n").slice(0, 4).join("\n");
  return out;
}

export function log(level, event, fields = {}, sink = console) {
  const line = JSON.stringify({ ts: nowIso(), level, event, ...fields });
  if (level === "error") sink.error(line);
  else if (level === "warn") (sink.warn || sink.log).call(sink, line);
  else sink.log(line);
  return line;
}

export async function forwardError(payload, env = process.env, fetchImpl = fetch) {
  const url = typeof env?.ERROR_WEBHOOK_URL === "string" ? env.ERROR_WEBHOOK_URL.trim() : "";
  if (!url) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportServerError(err, context = {}, { env = process.env, fetchImpl = fetch, sink = console } = {}) {
  const error = serializeError(err);
  log("error", "server_error", { ...context, error }, sink);
  return forwardError({ ts: nowIso(), event: "server_error", ...context, error }, env, fetchImpl);
}
