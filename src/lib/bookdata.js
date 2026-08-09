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

const KNOWN = {
  "9780143127550": { title: "The Goldfinch", author: "Donna Tartt", amazonPrice: 11.4, ebayPrice: 9.75 },
  "9780062315007": { title: "The Alchemist", author: "Paulo Coelho", amazonPrice: 8.9, ebayPrice: 7.2 },
  "9780307474278": { title: "The Da Vinci Code", author: "Dan Brown", amazonPrice: 4.25, ebayPrice: 6.1 },
  "9780679783268": { title: "Pride and Prejudice", author: "Jane Austen", amazonPrice: 6.5, ebayPrice: 5.4 },
  "9780451524935": { title: "1984", author: "George Orwell", amazonPrice: 7.8, ebayPrice: 6.3 },
  "9780316769488": { title: "The Catcher in the Rye", author: "J.D. Salinger", amazonPrice: 9.15, ebayPrice: 7.9 },
  "9780061120084": { title: "To Kill a Mockingbird", author: "Harper Lee", amazonPrice: 10.2, ebayPrice: 8.4 },
  "9780743273565": { title: "The Great Gatsby", author: "F. Scott Fitzgerald", amazonPrice: 5.6, ebayPrice: 7.15 },
  "9780544003415": { title: "The Lord of the Rings", author: "J.R.R. Tolkien", amazonPrice: 18.5, ebayPrice: 15.9 },
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
    ebayPrice: 3 + (seed % 1400) / 100,
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

export function calcNet(price, platform, cost) {
  if (price == null) return null;
  if (platform === "amazon") return price - price * 0.15 - 4.49 - cost;
  return price - (price * 0.1325 + 0.3) - 4.0 - cost;
}

// Build a full UI entry from an ISBN + CORE data (from the provider or a DB row).
// `extra` carries persisted state: count, queued, condition, listPrice, restricted, dbId.
export function buildEntry(isbn, core, cost, id, extra = {}) {
  const amazonNet = calcNet(core.amazonPrice, "amazon", cost);
  const ebayNet = calcNet(core.ebayPrice, "ebay", cost);
  const winner = ebayNet == null || amazonNet >= ebayNet ? "amazon" : "ebay";
  const history = rankHistory(isbn);
  const restricted = extra.restricted ?? isRestricted(isbn);
  return {
    id,
    isbn,
    title: core.title,
    author: core.author,
    amazonPrice: core.amazonPrice,
    ebayPrice: core.ebayPrice,
    source: core.source,
    catalogSource: core.catalogSource,
    priceSource: core.priceSource,
    amazonNet,
    ebayNet,
    winner,
    count: extra.count ?? 1,
    queued: extra.queued ?? false,
    listPrice: extra.listPrice,
    condition: extra.condition,
    at: extra.at ?? Date.now(),
    history,
    velocity: velocityInfo(history),
    category: categoryInfo(isbn),
    offers: offerCount(isbn),
    priceHist: priceHistory(isbn, core.amazonPrice),
    offersList: generateOffers(isbn, core.amazonPrice, offerCount(isbn)),
    restricted,
  };
}
