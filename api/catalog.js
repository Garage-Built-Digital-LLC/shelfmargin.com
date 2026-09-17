import { sendJson, methodNotAllowed, handleError } from "../src/lib/serverless.js";
import { normalizeToIsbn13 } from "../packages/core/isbn.js";
import { lookupCatalog } from "../src/lib/catalogLookup.js";
import { consumeLifetimeScan } from "../src/lib/scanCap.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  try {
    const isbn = normalizeToIsbn13(req.query?.isbn);
    if (!isbn) return sendJson(res, 400, { error: "valid ISBN required" });
    const fulfillment = String(req.query?.fulfillment || "").toLowerCase() === "fbm" ? "fbm" : "fba";
    const hit = await lookupCatalog(isbn, { timeoutMs: 6500, amazonFallbackTimeoutMs: 2500, fulfillment });
    if (!hit) return sendJson(res, 404, { error: "catalog match not found" });
    const scanCap = await consumeLifetimeScan({
      isbn,
      authHeader: req.headers?.authorization,
    });
    sendJson(res, 200, { isbn, ...hit, scanCap });
  } catch (err) { handleError(res, err); }
}
