// The data-provider contract. Everything upstream (UI, profit engine) depends
// ONLY on this shape. The mock provider implements it today; the real SP-API
// provider implements the Amazon-first shape later. Swapping is one import change.
//
// lookup(isbn13) -> Promise<BookData | null>
//   BookData = {
//     isbn: string,          // normalized ISBN-13
//     title: string,
//     author: string,
//     amazonPrice: number|null,  // estimated until Amazon pricing is wired
//     amazonBsr: number|null,    // estimated until sales-rank data is wired
//     gated: boolean,            // restricted/gated category heads-up
//     source: string,            // 'mock' | 'estimated' | 'amazon-sp-api-*'
//     catalogSource: string,     // where title/author/ASIN came from
//     priceSource: string,       // 'estimated' until pricing endpoint is wired
//   }
// Returning null means "no match found" (phantom-scan / non-book).

export {}; // types-only module
