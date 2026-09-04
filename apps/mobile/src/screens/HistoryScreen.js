import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { fetchScans, fetchScanVerifications, upsertScanVerification } from '../scansRepo';

const DECISION_COLOR = { buy: '#16a34a', check: '#d97706', pass: '#dc2626' };
const REAL_DECISIONS = ['buy', 'pass', 'watch'];

export default function HistoryScreen() {
  const [scans, setScans] = useState([]);
  const [verifs, setVerifs] = useState({}); // scan_id -> verification
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(null); // scan being checked

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, v] = await Promise.all([fetchScans(200), fetchScanVerifications()]);
      setScans(s);
      const map = {};
      for (const row of v) map[row.scan_id] = row;
      setVerifs(map);
    } catch (_) {} finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.head}>Buy list &amp; history</Text>
      <Text style={styles.sub}>Synced with the web app · tap a book to record a real check</Text>
      <FlatList
        data={scans}
        keyExtractor={(s) => String(s.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>No saved scans yet. Scan a book and tap Save.</Text>}
        renderItem={({ item }) => {
          const v = verifs[item.id];
          return (
            <TouchableOpacity style={styles.row} onPress={() => setActive(item)} activeOpacity={0.7}>
              <Text style={[styles.tag, { color: DECISION_COLOR[item.status] || '#0f172a' }]}>
                {String(item.status || '').toUpperCase()}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title || item.isbn}</Text>
                <Text style={styles.meta}>
                  ISBN {item.isbn}{item.velocity ? ` · ${item.velocity}` : ''}
                  {v?.real_decision ? `  ·  ✓ checked: ${v.real_decision}` : ''}
                </Text>
              </View>
              <Text style={styles.net}>{item.amazon_net != null ? `$${Number(item.amazon_net).toFixed(2)}` : ''}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <BookCheckModal
        scan={active}
        existing={active ? verifs[active.id] : null}
        onClose={() => setActive(null)}
        onSaved={() => { setActive(null); load(); }}
      />
    </View>
  );
}

function BookCheckModal({ scan, existing, onClose, onSaved }) {
  const [decision, setDecision] = useState('');
  const [price, setPrice] = useState('');
  const [rank, setRank] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDecision(existing?.real_decision || '');
    setPrice(existing?.amazon_actual_price != null ? String(existing.amazon_actual_price) : '');
    setRank(existing?.amazon_actual_rank != null ? String(existing.amazon_actual_rank) : '');
    setNotes(existing?.notes || '');
  }, [scan, existing]);

  if (!scan) return null;

  async function save() {
    setSaving(true);
    try {
      const patch = {
        actual_source_checked: 'amazon',
        real_decision: decision || '',
        amazon_actual_price: price ? Number(price) : null,
        amazon_actual_rank: rank ? parseInt(rank, 10) : null,
        notes: notes || '',
      };
      await upsertScanVerification(scan.id, patch);
      onSaved();
    } catch (e) {
      Alert.alert('Save failed', String(e?.message || e));
    } finally { setSaving(false); }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.sheet}>
          <ScrollView>
            <Text style={styles.sheetTitle} numberOfLines={2}>{scan.title || scan.isbn}</Text>
            <Text style={styles.sheetSub}>
              App said {String(scan.status || '').toUpperCase()}
              {scan.amazon_net != null ? ` (est $${Number(scan.amazon_net).toFixed(2)})` : ''} · record the real check
            </Text>

            <Text style={styles.label}>Real decision</Text>
            <View style={styles.chips}>
              {REAL_DECISIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, decision === d && styles.chipOn]}
                  onPress={() => setDecision(decision === d ? '' : d)}
                >
                  <Text style={[styles.chipText, decision === d && styles.chipTextOn]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Actual Amazon price ($)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 18.99" placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Actual Amazon rank (BSR)</Text>
            <TextInput style={styles.input} value={rank} onChangeText={setRank} keyboardType="number-pad" placeholder="e.g. 240000" placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} multiline placeholder="Condition, gated, seller count..." placeholderTextColor="#9ca3af" />

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save check</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingTop: 64, paddingHorizontal: 20 },
  head: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 16 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tag: { width: 56, fontSize: 12, fontWeight: '800' },
  title: { fontSize: 15, color: '#0f172a', fontWeight: '600' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  net: { fontSize: 14, color: '#334155', marginLeft: 8, fontWeight: '600' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '88%' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sheetSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#334155', fontWeight: '600', textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  notes: { height: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: '#64748b', fontSize: 14 },
});
