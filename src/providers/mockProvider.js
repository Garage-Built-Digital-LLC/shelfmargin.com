// Mock data provider — seeded with real ISBNs covering every verdict path so we
// can build and demo the whole loop without standing in a thrift store or
// waiting on API approvals. Implements the same contract the live provider will.

import { normalizeToIsbn13 } from '../../packages/core/isbn.js';

// Seed set: a clear BUY, a clear PASS, a GATED "check", and (anything else) a
// NOT-FOUND.
const SEED = {
  // Clear BUY — priced well, sells fast, healthy margin on both channels.
  '9780306406157': {
    title: 'The C Programming Language', author: 'Kernighan & Ritchie',
    amazonPrice: 34.99, amazonBsr: 42000, gated: false,
  },
  // Clear PASS — cheap, slow-moving, margin below threshold.
  '9780743273565': {
    title: 'The Great Gatsby', author: 'F. Scott Fitzgerald',
    amazonPrice: 7.25, amazonBsr: 3200000, gated: false,
  },
  // GATED — profitable but in a restricted category => "check".
  '9781591847786': {
    title: 'Zero to One', author: 'Peter Thiel',
    amazonPrice: 22.0, amazonBsr: 15000, gated: true,
  },
  // Clear BUY — higher-priced, healthy Amazon margin.
  '9780132350884': {
    title: 'Clean Code', author: 'Robert C. Martin',
    amazonPrice: 41.5, amazonBsr: 60000, gated: false,
  },
};

// Simulate real-world in-store latency so the UI's timeout/loading states get
// exercised during development. Configurable/zeroable for tests.
export function createMockProvider({ latencyMs = 350 } = {}) {
  return {
    name: 'mock',
    async lookup(rawIsbn) {
      const isbn = normalizeToIsbn13(rawIsbn);
      if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
      if (!isbn) return null; // invalid / non-book barcode
      const hit = SEED[isbn];
      if (!hit) return null;  // valid ISBN but not in catalog => not found
      return {
        isbn,
        ...hit,
        source: 'mock',
      };
    },
  };
}

export const SEED_ISBNS = Object.keys(SEED);
