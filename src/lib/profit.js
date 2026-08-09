// Profit-calc engine — the heart of the product. Pure functions, no I/O, fully
// unit-tested. Real Amazon Fees-API numbers can be passed in via `fees` to
// override the flat estimates; nothing here changes when real data arrives.

/**
 * Default, LABELED-AS-ESTIMATE fee assumptions. Books are a media category, so
 * the Amazon variable closing fee is included — omitting it is the classic error
 * that flips a marginal "buy" into a real loss.
 */
export const DEFAULT_FEE_MODEL = {
  amazon: {
    referralRate: 0.15,        // 15% referral on media
    variableClosingFee: 1.8,   // media variable closing fee (per item)
    fbaFulfillment: 4.49,      // flat FBA estimate (swap for Fees API per-ASIN)
    minReferral: 0.3,          // referral fee has a $0.30 floor
  },
  ebay: {
    finalValueRate: 0.1325,    // ~13.25% final value fee
    perOrderFee: 0.3,          // $0.30 per order
    shipping: 4.0,             // flat Media Mail estimate
  },
};

/** Round to cents to avoid float noise in displayed money. */
const cents = (n) => Math.round(n * 100) / 100;

/** Net proceeds if sold on Amazon. */
export function amazonNet(price, costPerBook, feeModel = DEFAULT_FEE_MODEL) {
  if (price == null) return null;
  const f = feeModel.amazon;
  const referral = Math.max(price * f.referralRate, f.minReferral);
  return cents(price - referral - f.variableClosingFee - f.fbaFulfillment - costPerBook);
}

/** Net proceeds if sold on eBay. */
export function ebayNet(price, costPerBook, feeModel = DEFAULT_FEE_MODEL) {
  if (price == null) return null;
  const f = feeModel.ebay;
  const fvf = price * f.finalValueRate + f.perOrderFee;
  return cents(price - fvf - f.shipping - costPerBook);
}

/**
 * Coarse velocity bucket from Amazon Best Sellers Rank in Books. A cheap,
 * credible v1 stand-in for a Keepa-grade history — the metric buyers judge us
 * on. Thresholds are configurable.
 */
export const DEFAULT_VELOCITY_THRESHOLDS = { fast: 250000, medium: 1000000 };
export function velocityBucket(bsr, t = DEFAULT_VELOCITY_THRESHOLDS) {
  if (bsr == null) return 'unknown';
  if (bsr <= t.fast) return 'fast';
  if (bsr <= t.medium) return 'medium';
  return 'slow';
}

/**
 * Full verdict for one book.
 * @param {object} book   { amazonPrice, ebayPrice, amazonBsr, gated }
 * @param {object} settings { costPerBook, buyThreshold, feeModel, velocityThresholds }
 * @returns verdict object with per-platform net, recommendation, status.
 */
export function evaluate(book, settings) {
  const {
    costPerBook = 0,
    buyThreshold = 5,
    feeModel = DEFAULT_FEE_MODEL,
    velocityThresholds = DEFAULT_VELOCITY_THRESHOLDS,
  } = settings || {};

  const aNet = amazonNet(book.amazonPrice ?? null, costPerBook, feeModel);
  const eNet = ebayNet(book.ebayPrice ?? null, costPerBook, feeModel);

  // Recommend whichever platform nets more (ignoring nulls).
  let recommended = null;
  let bestNet = null;
  const candidates = [
    ['amazon', aNet],
    ['ebay', eNet],
  ].filter(([, v]) => v != null);
  if (candidates.length) {
    candidates.sort((x, y) => y[1] - x[1]);
    [recommended, bestNet] = candidates[0];
  }

  const velocity = velocityBucket(book.amazonBsr ?? null, velocityThresholds);

  // Status: gated overrides everything with a "check" warning. Otherwise buy if
  // the best net clears the threshold, else pass.
  let status;
  if (book.gated) status = 'check';
  else if (bestNet == null) status = 'pass'; // no price data => can't justify a buy
  else status = bestNet >= buyThreshold ? 'buy' : 'pass';

  return {
    amazonNet: aNet,
    ebayNet: eNet,
    recommendedPlatform: recommended,
    bestNet,
    velocity,
    status, // 'buy' | 'pass' | 'check'
    gated: !!book.gated,
  };
}
