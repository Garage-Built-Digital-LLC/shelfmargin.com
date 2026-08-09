import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createMockProvider, SEED_ISBNS } from '../providers/mockProvider.js';
import { evaluate } from '../lib/profit.js';
import { normalizeToIsbn13 } from '../lib/isbn.js';
import { playForStatus, primeAudio } from '../lib/sounds.js';
import ResultCard from './ResultCard.jsx';

// Provider swap point: replace with createLiveProvider() when credentials land.
const provider = createMockProvider();

const LOOKUP_TIMEOUT_MS = 8000; // in-store signal can be bad — never hang.

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export default function App() {
  const [settings, setSettings] = useState({
    costPerBook: 1.0,
    buyThreshold: 5,
    condition: 'used-good',
    soundEnabled: true,
    handsFree: true, // suppress soft keyboard for Bluetooth-scanner use
  });
  const [entries, setEntries] = useState([]); // session scans, newest first
  const [status, setStatus] = useState({ msg: 'Ready — scan or type an ISBN', kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const valueRef = useRef('');

  // Keep the field focused so a Bluetooth scanner (acts as keyboard + Enter)
  // always lands its input here.
  const refocus = useCallback(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  useEffect(() => { refocus(); }, [refocus]);

  const handleScan = useCallback(async (raw) => {
    const isbn = normalizeToIsbn13(raw);
    if (!isbn) {
      setStatus({ msg: `Not a valid book barcode: "${raw}"`, kind: 'error' });
      if (settings.soundEnabled) playForStatus('error');
      return;
    }

    // Duplicate within this session => increment copy count, distinct sound.
    const existingIdx = entries.findIndex((e) => e.book.isbn === isbn);
    if (existingIdx !== -1) {
      setEntries((prev) => {
        const next = [...prev];
        const hit = { ...next[existingIdx], copyCount: next[existingIdx].copyCount + 1 };
        next.splice(existingIdx, 1);
        return [hit, ...next]; // bubble to top
      });
      setStatus({ msg: `Duplicate — another copy of ${isbn}`, kind: 'dup' });
      if (settings.soundEnabled) playForStatus('duplicate');
      return;
    }

    setBusy(true);
    setStatus({ msg: `Looking up ${isbn}…`, kind: 'idle' });
    try {
      const book = await withTimeout(provider.lookup(isbn), LOOKUP_TIMEOUT_MS);
      if (!book) {
        setStatus({ msg: `No catalog match for ${isbn}`, kind: 'error' });
        if (settings.soundEnabled) playForStatus('error');
        return;
      }
      const verdict = evaluate(book, settings);
      setEntries((prev) => [{ book, verdict, copyCount: 1, at: Date.now() }, ...prev]);
      setStatus({ msg: `${verdict.status.toUpperCase()} · ${book.title}`, kind: verdict.status });
      if (settings.soundEnabled) playForStatus(verdict.status);
    } catch (e) {
      setStatus({ msg: e.message === 'timeout' ? 'Lookup timed out — try again' : 'Lookup failed', kind: 'error' });
      if (settings.soundEnabled) playForStatus('error');
    } finally {
      setBusy(false);
      refocus();
    }
  }, [entries, settings, refocus]);

  const onSubmit = (e) => {
    e.preventDefault();
    primeAudio(); // unlock WebAudio on the user gesture
    const v = valueRef.current.trim();
    if (!v) return;
    valueRef.current = '';
    if (inputRef.current) inputRef.current.value = '';
    handleScan(v);
  };

  const buys = entries.filter((e) => e.verdict.status === 'buy').length;
  const totalUnits = entries.reduce((s, e) => s + e.copyCount, 0);

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr__brand">ShelfMargin <span className="hdr__tag">Amazon × eBay</span></div>
        <div className="hdr__stats">
          <span><b>{totalUnits}</b> scanned</span>
          <span className="hdr__buys"><b>{buys}</b> buys</span>
        </div>
      </header>

      <form className="scan" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="scan__input"
          type="text"
          inputMode={settings.handsFree ? 'none' : 'numeric'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Scan or type ISBN, press Enter"
          onChange={(e) => { valueRef.current = e.target.value; }}
          onBlur={refocus}
          aria-label="ISBN input"
        />
        <button className="scan__btn" type="submit" disabled={busy}>
          {busy ? '…' : 'Scan'}
        </button>
      </form>

      <div className={`status status--${status.kind}`}>{status.msg}</div>

      <SettingsBar settings={settings} setSettings={setSettings} />

      <div className="hint">
        Demo ISBNs: {SEED_ISBNS.map((s) => (
          <button key={s} className="hint__isbn" onClick={() => { primeAudio(); handleScan(s); }}>{s}</button>
        ))}
      </div>

      <section className="list">
        {entries.length === 0 && <div className="list__empty">No scans yet this session.</div>}
        {entries.map((e) => <ResultCard key={e.book.isbn} entry={e} />)}
      </section>
    </div>
  );
}

function SettingsBar({ settings, setSettings }) {
  const upd = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <div className="settings">
      <label>Cost/book $
        <input type="number" step="0.5" value={settings.costPerBook}
          onChange={(e) => upd('costPerBook', Number(e.target.value))} />
      </label>
      <label>Min profit $
        <input type="number" step="1" value={settings.buyThreshold}
          onChange={(e) => upd('buyThreshold', Number(e.target.value))} />
      </label>
      <label>Condition
        <select value={settings.condition} onChange={(e) => upd('condition', e.target.value)}>
          <option value="new">New</option>
          <option value="used-good">Used — Good</option>
          <option value="used-acceptable">Used — Acceptable</option>
        </select>
      </label>
      <label className="settings__toggle">
        <input type="checkbox" checked={settings.soundEnabled}
          onChange={(e) => upd('soundEnabled', e.target.checked)} /> Sound
      </label>
    </div>
  );
}
