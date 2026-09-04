import Stripe from "stripe";
import { sendJson, handleError } from "../../src/lib/serverless.js";
import { handleStripeWebhook, readRawBody } from "../../src/lib/stripeWebhook.js";
import { STRIPE_API_VERSION } from "../../src/lib/stripeCheckout.js";
// Stripe signature verification needs the exact raw bytes, so disable Vercel's parser.
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "method not allowed" })); return; }
  try {
    const rawBody = await readRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", { apiVersion: STRIPE_API_VERSION });
    const result = await handleStripeWebhook({ rawBody, signature: req.headers["stripe-signature"], stripeClient: stripe });
    sendJson(res, 200, result);
  } catch (err) { handleError(res, err); }
}
