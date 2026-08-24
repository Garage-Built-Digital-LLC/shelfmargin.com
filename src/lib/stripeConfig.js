const secretPrefixes = {
  publishable: ["pk_test_", "pk_live_"],
  secret: ["sk_test_", "sk_live_", "rk_test_", "rk_live_"],
  webhook: ["whsec_"],
};

function valueFor(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function hasPrefix(value, prefixes) {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function modeFromKey(value) {
  if (value.includes("_live_")) return "live";
  if (value.includes("_test_")) return "test";
  return "unknown";
}

export function stripeConfigStatus(env = process.env) {
  const publishableKey = valueFor(env, "VITE_STRIPE_PUBLISHABLE_KEY");
  const secretKey = valueFor(env, "STRIPE_SECRET_KEY");
  const webhookSecret = valueFor(env, "STRIPE_WEBHOOK_SECRET");
  const publishableMode = modeFromKey(publishableKey);
  const secretMode = modeFromKey(secretKey);

  const checks = {
    publishableKey: {
      present: Boolean(publishableKey),
      validPrefix: hasPrefix(publishableKey, secretPrefixes.publishable),
      mode: publishableMode,
    },
    secretKey: {
      present: Boolean(secretKey),
      validPrefix: hasPrefix(secretKey, secretPrefixes.secret),
      mode: secretMode,
    },
    webhookSecret: {
      present: Boolean(webhookSecret),
      validPrefix: hasPrefix(webhookSecret, secretPrefixes.webhook),
      // Stripe webhook signing secrets are normally much longer than the prefix.
      likelyComplete: webhookSecret.length >= 20,
    },
  };

  const modeMismatch = checks.publishableKey.present
    && checks.secretKey.present
    && publishableMode !== "unknown"
    && secretMode !== "unknown"
    && publishableMode !== secretMode;

  return {
    configured: Object.values(checks).every((check) => check.present && check.validPrefix)
      && checks.webhookSecret.likelyComplete
      && !modeMismatch,
    mode: modeMismatch ? "mixed" : (secretMode !== "unknown" ? secretMode : publishableMode),
    modeMismatch,
    checks,
  };
}

export function publicStripeStatus(env = process.env) {
  const status = stripeConfigStatus(env);
  return {
    configured: status.configured,
    mode: status.mode,
    modeMismatch: status.modeMismatch,
    publishableKey: status.checks.publishableKey,
    secretKey: {
      present: status.checks.secretKey.present,
      validPrefix: status.checks.secretKey.validPrefix,
      mode: status.checks.secretKey.mode,
    },
    webhookSecret: status.checks.webhookSecret,
  };
}
