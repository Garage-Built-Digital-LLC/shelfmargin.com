import Stripe from "stripe";
import { sendJson, methodNotAllowed, handleError } from "../../src/lib/serverless.js";
import { createPortalSession } from "../../src/lib/stripePortal.js";
import { STRIPE_API_VERSION } from "../../src/lib/stripeCheckout.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", { apiVersion: STRIPE_API_VERSION });
    const session = await createPortalSession({ authHeader: req.headers.authorization, stripeClient: stripe });
    sendJson(res, 200, session);
  } catch (err) { handleError(res, err); }
}
