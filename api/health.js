import { sendJson, methodNotAllowed } from "../src/lib/serverless.js";
export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  sendJson(res, 200, { ok: true, time: new Date().toISOString() });
}
