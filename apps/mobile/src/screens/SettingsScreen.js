import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../supabase';
import { getProfile, updateProfile } from '../scansRepo';
import { API_BASE_URL } from '../config';

export default function SettingsScreen({ session }) {
  const [cost, setCost] = useState('1.00');
  const [threshold, setThreshold] = useState('5.00');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getProfile();
        if (p) {
          if (p.cost_per_book != null) setCost(String(Number(p.cost_per_book).toFixed(2)));
          if (p.buy_threshold != null) setThreshold(String(Number(p.buy_threshold).toFixed(2)));
        }
      } catch (_) {} finally { setLoaded(true); }
    })();
  }, []);

  async function save() {
    const c = parseFloat(cost);
    const t = parseFloat(threshold);
    if (Number.isNaN(c) || Number.isNaN(t)) { Alert.alert('Invalid', 'Enter valid numbers.'); return; }
    setSaving(true);
    try {
      await updateProfile({ cost_per_book: c, buy_threshold: t });
      Alert.alert('Saved', 'Your sourcing settings were updated.');
    } catch (e) {
      Alert.alert('Save failed', String(e?.message || e));
    } finally { setSaving(false); }
  }

  async function deleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and all your scans. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const token = (await supabase.auth.getSession()).data.session?.access_token;
              const res = await fetch(`${API_BASE_URL}/api/account/delete`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error(`Delete failed (${res.status})`);
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('Delete failed', String(e?.message || e));
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.head}>Settings</Text>
      <Text style={styles.email}>{session?.user?.email || ''}</Text>

      <Text style={styles.label}>Average cost per book ($)</Text>
      <TextInput style={styles.input} value={cost} onChangeText={setCost} keyboardType="decimal-pad" editable={loaded} />

      <Text style={styles.label}>Minimum profit to buy ($)</Text>
      <TextInput style={styles.input} value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" editable={loaded} />
      <Text style={styles.hint}>A book is a BUY when its best net clears this threshold.</Text>

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving || !loaded}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save settings</Text>}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.signout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signoutText}>Sign out</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={deleteAccount} style={{ marginTop: 20 }}>
        <Text style={styles.delete}>Delete account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: '#fff', paddingTop: 64, paddingHorizontal: 24, paddingBottom: 48 },
  head: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  email: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  saveBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 28 },
  signout: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signoutText: { color: '#334155', fontSize: 15, fontWeight: '600' },
  delete: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
});
