import { sendJson, methodNotAllowed, handleError } from "../../src/lib/serverless.js";
import { testAmazonConnection } from "../../src/lib/amazonConfig.js";
import { verifyAdminUser } from "../../src/lib/adminAuth.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const result = await testAmazonConnection({ authHeader: req.headers.authorization, verifyAdmin: verifyAdminUser });
    sendJson(res, 200, result);
  } catch (err) { handleError(res, err); }
}
