// The data-provider contract. Everything upstream (UI, profit engine) depends
// ONLY on this shape. The mock provider implements it today; the real SP-API +
// eBay provider implements the same shape later. Swapping is one import change.
//
// lookup(isbn13) -> Promise<BookData | null>
//   BookData = {
//     isbn: string,          // normalized ISBN-13
//     title: string,
//     author: string,
//     amazonPrice: number|null,  // current competitive/buy-box price
//     ebayPrice: number|null,    // see note: sold-median preferred, active fallback
//     amazonBsr: number|null,    // Best Sellers Rank in Books (velocity input)
//     gated: boolean,            // restricted/gated category heads-up
//     source: string,            // 'mock' | 'live' — for telemetry/UI labeling
//     ebayPriceBasis: string,    // 'sold-median' | 'active-median' — honesty label
//   }
// Returning null means "no match found" (phantom-scan / non-book).

export {}; // types-only module
