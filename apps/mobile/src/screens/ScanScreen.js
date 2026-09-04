import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { normalizeToIsbn13, evaluate, DEFAULT_FEE_MODEL, DEFAULT_VELOCITY_THRESHOLDS } from '../core';
import { lookupCatalog } from '../api';
import { supabase } from '../supabase';
import { getProfile, fetchScans, buildScanRow } from '../scansRepo';
import { saveOrQueue, flushQueue, queueCount } from '../scanQueue';

const DECISION_COLOR = { buy: '#16a34a', check: '#d97706', pass: '#dc2626' };

export default function ScanScreen({ session }) {
  const userId = session?.user?.id ?? null;
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState(null); // 'saved' | 'queued' | null
  const [recent, setRecent] = useState([]);
  const [queued, setQueued] = useState(0);
  const [settings, setSettings] = useState({
    costPerBook: 1.0, buyThreshold: 5.0,
    feeModel: DEFAULT_FEE_MODEL, velocityThresholds: DEFAULT_VELOCITY_THRESHOLDS,
  });
  const lastScan = useRef({ code: '', at: 0 });

  const refreshQueue = useCallback(async () => { try { setQueued(await queueCount()); } catch (_) {} }, []);
  const loadRecent = useCallback(async () => { try { setRecent(await fetchScans(15)); } catch (_) {} }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await getProfile();
        if (p) {
          setSettings((s) => ({
            ...s,
            costPerBook: p.cost_per_book != null ? Number(p.cost_per_book) : s.costPerBook,
            buyThreshold: p.buy_threshold != null ? Number(p.buy_threshold) : s.buyThreshold,
          }));
        }
      } catch (_) {}
      // Try to drain any offline-queued scans, then refresh views.
      try { await flushQueue(); } catch (_) {}
      loadRecent();
      refreshQueue();
    })();
  }, [loadRecent, refreshQueue]);

  const handleIsbn = useCallback(async (raw) => {
    const isbn = normalizeToIsbn13(raw);
    if (!isbn) { setResult({ error: `Not a valid ISBN: ${raw}` }); return; }
    setBusy(true); setResult(null); setSavedState(null);
    try {
      const book = await lookupCatalog(isbn);
      if (!book) {
        setResult({ isbn, error: 'No match found (phantom scan or non-book).' });
      } else {
        const verdict = evaluate(
          { amazonPrice: book.amazonPrice, ebayPrice: book.ebayPrice ?? null, amazonBsr: book.amazonBsr, gated: book.gated },
          settings
        );
        setResult({ isbn, book, verdict });
        try {
          const t = verdict.status === 'buy' ? Haptics.NotificationFeedbackType.Success
            : verdict.status === 'check' ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Error;
          Haptics.notificationAsync(t);
        } catch (_) {}
      }
    } catch (e) {
      setResult({ isbn, error: String(e?.message || e) });
    } finally { setBusy(false); }
  }, [settings]);

  const onBarcode = useCallback(({ data }) => {
    const now = Date.now();
    if (data === lastScan.current.code && now - lastScan.current.at < 2500) return;
    lastScan.current = { code: data, at: now };
    setCameraOn(false);
    handleIsbn(data);
  }, [handleIsbn]);

  async function openCamera() {
    if (!permission?.granted) { const r = await requestPermission(); if (!r.granted) return; }
    setResult(null); setCameraOn(true);
  }

  async function save() {
    if (!result?.book || !result?.verdict || !userId) return;
    setSaving(true);
    try {
      const row = buildScanRow({ isbn: result.isbn, book: result.book, verdict: result.verdict, settings, userId });
      const outcome = await saveOrQueue(row); // 'saved' | 'queued'
      setSavedState(outcome);
      loadRecent();
      refreshQueue();
    } catch (e) {
      setResult((r) => ({ ...r, saveError: String(e?.message || e) }));
    } finally { setSaving(false); }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.brand}>Shelf Margin</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {queued > 0 && (
        <TouchableOpacity onPress={async () => { await flushQueue(); loadRecent(); refreshQueue(); }} style={styles.queuePill}>
          <Text style={styles.queuePillText}>{queued} scan{queued > 1 ? 's' : ''} queued offline · tap to sync</Text>
        </TouchableOpacity>
      )}

      {cameraOn && permission?.granted ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
            onBarcodeScanned={onBarcode}
          />
          <TouchableOpacity style={styles.camClose} onPress={() => setCameraOn(false)}>
            <Text style={styles.camCloseText}>Close camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.scanBtn} onPress={openCamera} activeOpacity={0.85}>
          <Text style={styles.scanBtnText}>📷  Scan a barcode</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.manualInput}
        placeholder="Type or scan an ISBN, then Enter"
        placeholderTextColor="#9ca3af"
        value={manual}
        onChangeText={setManual}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={() => { const v = manual.trim(); if (v) { handleIsbn(v); setManual(''); } }}
      />

      <Text style={styles.settingsNote}>
        cost ${settings.costPerBook.toFixed(2)} · buy if net ≥ ${settings.buyThreshold.toFixed(2)}
      </Text>

      {busy && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}

      {result && !busy && (
        <View style={styles.card}>
          {result.error ? (
            <>
              {result.isbn ? <Text style={styles.cardIsbn}>ISBN {result.isbn}</Text> : null}
              <Text style={styles.cardError}>{result.error}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.decision, { color: DECISION_COLOR[result.verdict.status] || '#0f172a' }]}>
                {result.verdict.status.toUpperCase()}
                {result.verdict.bestNet != null
                  ? `   ${result.verdict.bestNet >= 0 ? '+' : '-'}$${Math.abs(result.verdict.bestNet).toFixed(2)}`
                  : ''}
              </Text>
              <Text style={styles.title}>{result.book.title || 'Unknown title'}</Text>
              {result.book.author ? <Text style={styles.author}>{result.book.author}</Text> : null}
              <Text style={styles.meta}>
                ISBN {result.isbn} · velocity {result.verdict.velocity}
                {result.verdict.recommendedPlatform ? ` · ${result.verdict.recommendedPlatform}` : ''}
              </Text>
              <Text style={styles.estimate}>Estimated data ({result.book.priceSource || result.book.source || 'estimated'})</Text>

              {savedState === 'saved' ? (
                <Text style={styles.savedNote}>✓ Saved to buy list</Text>
              ) : savedState === 'queued' ? (
                <Text style={styles.queuedNote}>✓ Saved offline — will sync when back online</Text>
              ) : (
                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Save to buy list</Text>}
                </TouchableOpacity>
              )}
              {result.saveError ? <Text style={styles.cardError}>{result.saveError}</Text> : null}
            </>
          )}
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.recentWrap}>
          <Text style={styles.recentHead}>Recent (synced with web) · {recent.length}</Text>
          {recent.map((s) => (
            <View key={s.id} style={styles.recentRow}>
              <Text style={[styles.recentTag, { color: DECISION_COLOR[s.status] || '#0f172a' }]}>
                {String(s.status || '').toUpperCase()}
              </Text>
              <Text style={styles.recentTitle} numberOfLines={1}>{s.title || s.isbn}</Text>
              <Text style={styles.recentNet}>{s.amazon_net != null ? `$${Number(s.amazon_net).toFixed(2)}` : ''}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 64, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  signout: { color: '#64748b', fontSize: 14 },
  queuePill: { backgroundColor: '#fef3c7', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  queuePillText: { color: '#92400e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scanBtn: { backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 20, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cameraBox: { height: 280, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  camClose: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.8)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  camCloseText: { color: '#fff', fontSize: 14 },
  manualInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginTop: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  settingsNote: { fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  card: { marginTop: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, backgroundColor: '#fff' },
  decision: { fontSize: 30, fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 10 },
  author: { fontSize: 14, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 13, color: '#64748b', marginTop: 10 },
  estimate: { fontSize: 12, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },
  cardIsbn: { fontSize: 14, color: '#64748b' },
  cardError: { fontSize: 15, color: '#dc2626', marginTop: 6 },
  saveBtn: { marginTop: 16, borderWidth: 1.5, borderColor: '#0f172a', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  savedNote: { marginTop: 16, color: '#16a34a', fontWeight: '700', fontSize: 15 },
  queuedNote: { marginTop: 16, color: '#92400e', fontWeight: '700', fontSize: 14 },
  recentWrap: { marginTop: 28 },
  recentHead: { fontSize: 13, color: '#64748b', fontWeight: '700', marginBottom: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  recentTag: { width: 54, fontSize: 12, fontWeight: '800' },
  recentTitle: { flex: 1, fontSize: 14, color: '#0f172a' },
  recentNet: { fontSize: 13, color: '#64748b', marginLeft: 8 },
});
