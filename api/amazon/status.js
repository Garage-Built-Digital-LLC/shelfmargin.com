import { sendJson, methodNotAllowed } from "../../src/lib/serverless.js";
import { publicAmazonStatus } from "../../src/lib/amazonConfig.js";
export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  sendJson(res, 200, publicAmazonStatus());
}
