// ISBN normalization utilities.
// Book barcodes are usually 13-digit EAN (978/979). Some stock carries 10-digit
// ISBNs, and scanners can append a 5-digit price add-on. Normalize everything to
// ISBN-13 and strip add-ons BEFORE any catalog lookup, or you get phantom
// "not found" results in the store.

/** Strip spaces, hyphens, and a trailing 5-digit price add-on from a raw scan. */
export function cleanScan(raw) {
  if (raw == null) return '';
  let s = String(raw).trim().replace(/[\s-]/g, '');
  // A scanner may fire EAN-13 (13) or EAN-13 + 5-digit add-on (18). Drop add-on.
  if (s.length === 18 && /^\d{18}$/.test(s)) s = s.slice(0, 13);
  return s.toUpperCase();
}

/** ISBN-10 check digit (mod 11, 'X' allowed). */
function isbn10CheckDigit(first9) {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(first9[i]);
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? 'X' : String(c);
}

/** EAN-13 / ISBN-13 check digit. */
function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(first12[i]);
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  return isbn10CheckDigit(s.slice(0, 9)) === s[9];
}

export function isValidIsbn13(s) {
  if (!/^\d{13}$/.test(s)) return false;
  return isbn13CheckDigit(s.slice(0, 12)) === s[12];
}

/** Convert a valid ISBN-10 to ISBN-13. */
export function isbn10To13(s) {
  const core = '978' + s.slice(0, 9);
  return core + isbn13CheckDigit(core);
}

/**
 * Normalize any raw scan/input to a validated ISBN-13, or return null if it
 * isn't a valid book barcode (e.g. a non-book product, a mis-scan).
 */
export function normalizeToIsbn13(raw) {
  const s = cleanScan(raw);
  if (isValidIsbn13(s)) return s;
  if (isValidIsbn10(s)) return isbn10To13(s);
  return null;
}
