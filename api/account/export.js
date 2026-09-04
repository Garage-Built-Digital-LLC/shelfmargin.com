import { sendJson, methodNotAllowed, handleError } from "../../src/lib/serverless.js";
import { exportUserData } from "../../src/lib/accountLifecycle.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  try {
    const result = await exportUserData({ authHeader: req.headers.authorization });
    sendJson(res, 200, result);
  } catch (err) { handleError(res, err); }
}
