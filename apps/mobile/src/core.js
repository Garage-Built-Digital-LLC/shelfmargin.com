// Single bridge to the shared @shelfmargin/core logic (../../../packages/core).
// Web and iOS import the SAME code here, so buy/check/pass can never drift.
export { normalizeToIsbn13, cleanScan } from '../../../packages/core/isbn.js';
export {
  evaluate,
  amazonNet,
  ebayNet,
  velocityBucket,
  DEFAULT_FEE_MODEL,
  DEFAULT_VELOCITY_THRESHOLDS,
} from '../../../packages/core/profit.js';
