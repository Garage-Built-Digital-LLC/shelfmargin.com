// Book data + mock enrichment.
// The CORE lookup (title/author/prices) is what the live provider will eventually
// return; the derived fields (rank history, velocity, offers, score) are mock
// enrichment seeded deterministically from the ISBN so a reload reproduces the
// same visuals. When real data lands, buildEntry() takes real `core` and the
// derived charts get labeled "estimated" until we add Keepa/accumulation.

export const CONDITIONS = ["Like New", "Very Good", "Good", "Acceptable"];

// Map the display condition <-> the DB-stored value.
export function conditionToDb(c) {
  if (c === "Like New") return "new";
  if (c === "Acceptable") return "used-acceptable";
  return "used-good"; // Very Good / Good
}
export function velocityToDb(tier) {
  return tier === "Fast" ? "fast" : tier === "Moderate" ? "medium" : tier === "Slow" ? "slow" : "unknown";
}

// Demo catalog — chosen to tell the true reseller story: technical books,
// professional references, and evergreen nonfiction hold used value (clear BUYs),
// while mass-market bestsellers and common kids' books are oversupplied penny
// books (PASS). Prices are representative used Amazon prices for the demo only.
// Order matters: index 0 is the featured/queued demo row; slice(0,5) drives the
// tap-to-try chips, slice(0,6) seeds the demo ledger.
const KNOWN = {
  "9781449373320": { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", amazonPrice: 34.5 },
  "9780143127741": { title: "The Body Keeps the Score", author: "Bessel van der Kolk", amazonPrice: 13.8 },
  "9780735211292": { title: "Atomic Habits", author: "James Clear", amazonPrice: 10.2 },
  "9780984782857": { title: "Cracking the Coding Interview", author: "Gayle Laakmann McDowell", amazonPrice: 28.0 },
  "9780399226908": { title: "The Very Hungry Caterpillar", author: "Eric Carle", amazonPrice: 5.4 },
  "9780062316097": { title: "Sapiens", author: "Yuval Noah Harari", amazonPrice: 14.4 },
  "9780135957059": { title: "The Pragmatic Programmer", author: "David Thomas, Andrew Hunt", amazonPrice: 32.0 },
  "9780399590504": { title: "Educated", author: "Tara Westover", amazonPrice: 12.6 },
  "9780735219090": { title: "Where the Crawdads Sing", author: "Delia Owens", amazonPrice: 6.2 },
};
export const DEMO_ISBNS = Object.keys(KNOWN);

export function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return h;
}

// CORE lookup — the shape the live provider will return.
export function lookupCore(isbn) {
  if (KNOWN[isbn]) return { ...KNOWN[isbn] };
  const seed = hashSeed(isbn || "0");
  return {
    title: "UNIDENTIFIED TITLE",
    author: "—",
    amazonPrice: 4 + (seed % 1800) / 100,
  };
}

// pseudo rank history — stand-in for Keepa-style historical BSR
export function rankHistory(isbn) {
  const seed = hashSeed(isbn);
  const base = 800 + (seed % 400000);
  const points = [];
  let rank = base;
  for (let i = 0; i < 12; i++) {
    const drift = ((seed + i * 37) % 21) - 10;
    rank = Math.max(50, Math.round(rank * (1 + drift / 100)));
    points.push(rank);
  }
  return points;
}

const CATEGORIES = ["Literary Fiction", "Classics", "Contemporary Fiction", "Historical Fiction"];
export function categoryInfo(isbn) {
  const seed = hashSeed(isbn + "cat");
  const name = CATEGORIES[seed % CATEGORIES.length];
  const rank = 20 + (seed % 900);
  return { name, rank };
}

export function offerCount(isbn) {
  const seed = hashSeed(isbn + "offers");
  return 1 + (seed % 24);
}

export function priceHistory(isbn, currentPrice) {
  const seed = hashSeed(isbn + "price");
  const points = [];
  let price = currentPrice * (1 + ((seed % 30) - 15) / 100);
  for (let i = 0; i < 12; i++) {
    const drift = ((seed + i * 53) % 17) - 8;
    price = Math.max(1, price * (1 + drift / 100));
    points.push(Number(price.toFixed(2)));
  }
  points[points.length - 1] = currentPrice;
  return points;
}

const FULFILL = ["FBA", "FBA", "FBM"];
const SELLER_NAMES = ["BookNook Co", "PageTurner Media", "ThriftLit", "Reader's Attic", "Southbound Books", "Quill & Co", "MediaHarbor", "StackHouse"];

export function generateOffers(isbn, currentPrice, count) {
  const seed = hashSeed(isbn + "offerlist");
  const n = Math.min(count, 8);
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = seed + i * 97;
    const priceVariance = ((s % 40) - 10) / 100;
    const price = Number((currentPrice * (1 + priceVariance)).toFixed(2));
    list.push({
      seller: SELLER_NAMES[s % SELLER_NAMES.length],
      price: Math.max(0.99, price),
      fulfillment: FULFILL[s % FULFILL.length],
      condition: CONDITIONS[s % CONDITIONS.length],
      rating: 85 + (s % 15),
    });
  }
  list.sort((a, b) => a.price - b.price);
  return list;
}

export function isRestricted(isbn) {
  const seed = hashSeed(isbn + "restricted");
  return seed % 100 < 15;
}

export function sourcingScore(bestNet, threshold, velocity, offers) {
  const profitPts = Math.min(2, threshold > 0 ? bestNet / threshold : 1) * 20;
  const velocityPts = velocity.tier === "Fast" ? 40 : velocity.tier === "Moderate" ? 25 : 10;
  const competitionPts = offers <= 5 ? 20 : offers <= 15 ? 10 : 0;
  const total = Math.max(0, Math.round(profitPts + velocityPts + competitionPts));
  const band = total >= 70 ? "Strong" : total >= 40 ? "Moderate" : "Weak";
  return { total, band };
}

export function velocityInfo(history) {
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const firstHalf = history.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  const secondHalf = history.slice(6).reduce((a, b) => a + b, 0) / 6;
  const improving = secondHalf < firstHalf * 0.9;
  const worsening = secondHalf > firstHalf * 1.1;
  const trend = improving ? "up" : worsening ? "down" : "flat";
  let tier = "Slow";
  if (avg < 50000) tier = "Fast";
  else if (avg < 300000) tier = "Moderate";
  return { avg, trend, tier, current: history[history.length - 1] };
}

// Velocity tier from a single LIVE Best Sellers Rank (no history yet). Same
// thresholds as velocityInfo so the label reads consistently. Trend is "flat"
// because a one-shot rank has no direction — we don't fake a history for it.
export function velocityFromBsr(bsr) {
  let tier = "Slow";
  if (bsr < 50000) tier = "Fast";
  else if (bsr < 300000) tier = "Moderate";
  return { avg: bsr, trend: "flat", tier, current: bsr, live: true };
}

// Amazon net proceeds — matches the fee model in profit.js, including the
// $1.80 media variable closing fee and the $0.30 minimum referral. Leaving the
// closing fee out is the classic error that turns a "$2 profit" into a loss.
export function calcNet(price, cost) {
  if (price == null) return null;
  const referral = Math.max(price * 0.15, 0.3);
  return Math.round((price - referral - 1.8 - 4.49 - cost) * 100) / 100;
}

// Net when Amazon's REAL total fees are known (Product Fees API): net is simply
// price minus the actual fee total minus your cost. Used in preference to the
// flat calcNet estimate whenever a live fee total is present.
export function calcNetFromFees(price, totalFees, cost) {
  if (price == null || totalFees == null) return null;
  return Math.round((price - totalFees - cost) * 100) / 100;
}

// Build a full UI entry from an ISBN + CORE data (from the provider or a DB row).
// `extra` carries persisted state: count, queued, condition, listPrice, restricted, dbId.
export function buildEntry(isbn, core, cost, id, extra = {}) {
  // Real fees (Product Fees API) win over the flat estimate when present.
  const amazonNet = core.amazonFees != null
    ? calcNetFromFees(core.amazonPrice, core.amazonFees, cost)
    : calcNet(core.amazonPrice, cost);
  const winner = "amazon";
  const history = rankHistory(isbn);
  const restricted = extra.restricted ?? isRestricted(isbn);
  const hasLiveBsr = core.amazonBsr != null;
  const hasLiveOffers = core.offerCount != null;
  return {
    id,
    isbn,
    title: core.title,
    author: core.author,
    amazonPrice: core.amazonPrice,
    amazonBsr: core.amazonBsr ?? null,
    amazonFees: core.amazonFees ?? null,
    feeSource: core.feeSource ?? null,
    source: core.source,
    catalogSource: core.catalogSource,
    priceSource: core.priceSource,
    itemCondition: core.itemCondition,
    asin: core.asin,
    amazonMode: core.amazonMode,
    marketplaceId: core.marketplaceId,
    amazonNet,
    winner,
    count: extra.count ?? 1,
    queued: extra.queued ?? false,
    listPrice: extra.listPrice,
    condition: extra.condition,
    at: extra.at ?? Date.now(),
    history,
    // Prefer a real BSR for the velocity label when SP-API supplied one;
    // otherwise keep the synthetic-history estimate.
    velocity: hasLiveBsr ? velocityFromBsr(core.amazonBsr) : velocityInfo(history),
    category: categoryInfo(isbn),
    offers: hasLiveOffers ? core.offerCount : offerCount(isbn),
    priceHist: priceHistory(isbn, core.amazonPrice),
    offersList: generateOffers(isbn, core.amazonPrice, offerCount(isbn)),
    restricted,
  };
}
