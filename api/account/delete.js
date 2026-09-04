import { sendJson, methodNotAllowed, handleError } from "../../src/lib/serverless.js";
import { deleteUserAccount } from "../../src/lib/accountLifecycle.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const result = await deleteUserAccount({ authHeader: req.headers.authorization });
    sendJson(res, 200, result);
  } catch (err) { handleError(res, err); }
}
