import { sendJson, methodNotAllowed, handleError } from "../../src/lib/serverless.js";
import { normalizeToIsbn13 } from "../../packages/core/isbn.js";
import { lookupAmazonCatalogByIsbn } from "../../src/lib/amazonCatalog.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  try {
    const isbn = normalizeToIsbn13(req.query?.isbn);
    if (!isbn) return sendJson(res, 400, { error: "valid ISBN required" });
    const hit = await lookupAmazonCatalogByIsbn(isbn, { timeoutMs: 6500 });
    if (!hit) return sendJson(res, 404, { error: "Amazon catalog match not found" });
    sendJson(res, 200, { isbn, ...hit });
  } catch (err) { handleError(res, err); }
}
