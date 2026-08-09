import { describe, it, expect } from 'vitest';
import {
  amazonNet, ebayNet, evaluate, velocityBucket, DEFAULT_FEE_MODEL,
} from '../lib/profit.js';
import {
  normalizeToIsbn13, isbn10To13, cleanScan, isValidIsbn10, isValidIsbn13,
} from '../lib/isbn.js';

describe('amazonNet', () => {
  it('subtracts referral, closing, FBA, and cost', () => {
    // price 20: referral 3.00, closing 1.80, fba 4.49, cost 1 => 9.71
    expect(amazonNet(20, 1)).toBe(9.71);
  });
  it('applies the $0.30 minimum referral on cheap books', () => {
    // price 1: referral max(0.15, 0.30)=0.30, closing 1.80, fba 4.49, cost 0
    expect(amazonNet(1, 0)).toBe(1 - 0.3 - 1.8 - 4.49);
  });
  it('returns null when no price', () => {
    expect(amazonNet(null, 1)).toBeNull();
  });
});

describe('ebayNet', () => {
  it('subtracts fvf, per-order, shipping, cost', () => {
    // price 20: fvf 2.65+0.30=2.95, shipping 4.00, cost 1 => 12.05
    expect(ebayNet(20, 1)).toBe(12.05);
  });
});

describe('velocityBucket', () => {
  it('buckets by BSR', () => {
    expect(velocityBucket(1000)).toBe('fast');
    expect(velocityBucket(500000)).toBe('medium');
    expect(velocityBucket(5000000)).toBe('slow');
    expect(velocityBucket(null)).toBe('unknown');
  });
});

describe('evaluate', () => {
  const settings = { costPerBook: 1, buyThreshold: 5 };

  it('recommends the higher-net platform', () => {
    const v = evaluate({ amazonPrice: 20, ebayPrice: 20, amazonBsr: 1000 }, settings);
    // eBay nets 12.05 vs Amazon 9.71 here
    expect(v.recommendedPlatform).toBe('ebay');
    expect(v.status).toBe('buy');
    expect(v.velocity).toBe('fast');
  });

  it('flags pass when best net is below threshold', () => {
    const v = evaluate({ amazonPrice: 7, ebayPrice: 6, amazonBsr: 3000000 }, settings);
    expect(v.status).toBe('pass');
    expect(v.velocity).toBe('slow');
  });

  it('gated overrides to check even when profitable', () => {
    const v = evaluate({ amazonPrice: 50, ebayPrice: 40, amazonBsr: 500, gated: true }, settings);
    expect(v.status).toBe('check');
    expect(v.gated).toBe(true);
  });

  it('passes when there is no price data at all', () => {
    const v = evaluate({ amazonPrice: null, ebayPrice: null }, settings);
    expect(v.status).toBe('pass');
    expect(v.recommendedPlatform).toBeNull();
  });

  it('handles single-channel data (amazon only)', () => {
    const v = evaluate({ amazonPrice: 30, ebayPrice: null, amazonBsr: 1000 }, settings);
    expect(v.recommendedPlatform).toBe('amazon');
    expect(v.ebayNet).toBeNull();
  });
});

describe('isbn utils', () => {
  it('validates isbn-13 and isbn-10', () => {
    expect(isValidIsbn13('9780306406157')).toBe(true);
    expect(isValidIsbn10('0306406152')).toBe(true);
  });
  it('converts isbn-10 to isbn-13', () => {
    expect(isbn10To13('0306406152')).toBe('9780306406157');
  });
  it('normalizes isbn-10 input to isbn-13', () => {
    expect(normalizeToIsbn13('0-306-40615-2')).toBe('9780306406157');
  });
  it('strips a 5-digit price add-on', () => {
    expect(cleanScan('978030640615751595')).toBe('9780306406157');
  });
  it('returns null for a non-book / invalid barcode', () => {
    expect(normalizeToIsbn13('012345678905')).toBeNull();
  });
});
