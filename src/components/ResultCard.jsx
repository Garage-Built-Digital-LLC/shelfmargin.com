import React from 'react';

const money = (n) => (n == null ? '—' : `$${n.toFixed(2)}`);
const VEL_LABEL = { fast: 'Sells fast', medium: 'Sells medium', slow: 'Sells slow', unknown: 'Velocity n/a' };

export default function ResultCard({ entry }) {
  const { book, verdict, copyCount } = entry;
  const status = verdict.status; // buy | pass | check
  return (
    <div className={`card card--${status}`}>
      <div className="card__top">
        <span className={`pill pill--${status}`}>{status.toUpperCase()}</span>
        {copyCount > 1 && <span className="pill pill--dup">×{copyCount}</span>}
        <span className={`vel vel--${verdict.velocity}`}>{VEL_LABEL[verdict.velocity]}</span>
      </div>

      <div className="card__title">{book.title}</div>
      <div className="card__author">{book.author}</div>

      <div className="card__nets">
        <div className={`net ${verdict.recommendedPlatform === 'amazon' ? 'net--win' : ''}`}>
          <div className="net__label">Amazon net</div>
          <div className="net__val">{money(verdict.amazonNet)}</div>
        </div>
        <div className={`net ${verdict.recommendedPlatform === 'ebay' ? 'net--win' : ''}`}>
          <div className="net__label">
            eBay net
            {book.ebayPriceBasis === 'active-median' && <span className="net__note"> *active</span>}
          </div>
          <div className="net__val">{money(verdict.ebayNet)}</div>
        </div>
      </div>

      {verdict.recommendedPlatform && status === 'buy' && (
        <div className="card__rec">List on <b>{verdict.recommendedPlatform}</b> · {money(verdict.bestNet)} net</div>
      )}
      {status === 'check' && (
        <div className="card__warn">Possibly gated/restricted — verify in Seller Central before buying.</div>
      )}
      <div className="card__isbn">{book.isbn} · est. fees</div>
    </div>
  );
}
