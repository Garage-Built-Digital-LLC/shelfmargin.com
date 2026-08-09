// The data-provider seam. The Ledger calls lookupBook(isbn) and never cares
// whether the data is sample or live catalog metadata.

import { normalizeToIsbn13 } from "../lib/isbn.js";
import { lookupCore } from "../lib/bookdata.js";
import { createLiveProvider } from "./liveProvider.js";

const USE_LIVE = import.meta.env.VITE_USE_LIVE === "true";
const liveProvider = createLiveProvider();

export const LOOKUP_STATUS = USE_LIVE
  ? {
      mode: "live-catalog",
      label: "Live catalog lookup",
      detail: "Titles/authors come from public book APIs. Prices and ranks are still estimates.",
    }
  : {
      mode: "sample",
      label: "Sample catalog",
      detail: "Titles, prices, ranks, and verdicts are generated for testing.",
    };

// Returns CORE book data: { isbn, title, author, amazonPrice, ebayPrice } or null.
export async function lookupBook(rawIsbn) {
  const isbn = normalizeToIsbn13(rawIsbn);
  if (!isbn) return null; // invalid / non-book barcode

  if (USE_LIVE) {
    return liveProvider.lookup(isbn);
  }

  // Mock: small latency so loading states get exercised.
  await new Promise((r) => setTimeout(r, 120));
  return { isbn, ...lookupCore(isbn), source: "sample", priceSource: "estimated" };
}
