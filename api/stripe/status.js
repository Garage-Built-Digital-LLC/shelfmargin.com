import { sendJson, methodNotAllowed } from "../../src/lib/serverless.js";
import { publicStripeStatus } from "../../src/lib/stripeConfig.js";
export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  sendJson(res, 200, publicStripeStatus());
}
