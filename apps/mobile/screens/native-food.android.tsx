import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeIntake } from '../lib/native-health';
import type { NativeFoodSource, NativeIntakeResult } from '../lib/native-health/intake';
import type { NativeAccess } from '../lib/native-health/evidence';
import { fetchProviderSelection } from '../lib/api/client';
import { colors, spacing } from '../constants/caloriebank-theme';

const resultCopy: Record<NativeIntakeResult, string> = {
  ready: 'Your food tracker is connected.', empty: 'Your tracker is connected. No calorie data was found for the recent dates.',
  access_required: 'Allow food access in Health Connect to refresh your tracker.',
  retry_required: 'Your food data could not be used yet. Refresh your tracker and try again.', skipped: 'Your source changed. Check your selection and try again.',
};
export default function NativeFood() {
  const router = useRouter();
  const [sources, setSources] = useState<NativeFoodSource[]>([]);
  const [access, setAccess] = useState<NativeAccess | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const load = useCallback(async (request = false) => {
    const run = ++generation.current;
    setBusy(true); setMessage('');
    try {
      const result = await nativeIntake.discover(request);
      const providers = await fetchProviderSelection();
      if (run !== generation.current) return;
      setAccess(result.access); setSources(result.sources);
      setSelected(providers.intake.authoritativeProvider === 'health_connect' ? providers.intake.nativeIntakeSource?.id ?? null : null);
      if (result.queryState === 'failed') setMessage('Your food data could not load. Try again.');
      else if (result.access.granted.includes('nutrition') && !result.sources.length) setMessage('No food trackers were found. Open your tracker and check that it shares calories with Health Connect.');
    } catch { if (run === generation.current) setMessage('Your food data could not load. Try again.'); }
    finally { if (run === generation.current) setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
      else { generation.current++; nativeIntake.cancel(); }
    });
    return () => { generation.current++; listener.remove(); nativeIntake.cancel(); };
  }, [load]));
  async function choose(source: NativeFoodSource) {
    if (busy) return;
    const run = generation.current;
    setBusy(true); setMessage('');
    try {
      const result = await nativeIntake.select(source.source);
      const providers = await fetchProviderSelection();
      if (run !== generation.current) return;
      setMessage(resultCopy[result]);
      setSelected(providers.intake.authoritativeProvider === 'health_connect' ? providers.intake.nativeIntakeSource?.id ?? null : null);
    } catch { if (run === generation.current) setMessage('Your food source could not be saved. Try again.'); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function refresh() {
    if (busy) return;
    const run = generation.current;
    setBusy(true);
    try { const result = await nativeIntake.refresh(); if (run === generation.current) setMessage(resultCopy[result]); }
    catch { if (run === generation.current) setMessage('Your food tracker could not refresh. Try again.'); }
    finally { if (run === generation.current) setBusy(false); }
  }
  return <SafeAreaView edges={['bottom']} style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Choose your food tracker</Text>
    <Text>CalorieBank uses calories eaten from one tracker through Health Connect.</Text>
    {access && !access.granted.includes('nutrition') ? <Text>{access.state === 'setup_required' ? 'Set up Health Connect to share your food data.' : access.state === 'unavailable' || access.state === 'unsupported_version' ? 'Health Connect is not available on this phone. You can connect FatSecret directly instead.' : 'Allow CalorieBank to read your food data in Health Connect.'}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void load(true)}><Text style={styles.action}>{access?.granted.includes('nutrition') ? 'Find food trackers' : 'Allow food access'}</Text></Pressable>
    {sources.map((item) => <Pressable key={item.source.id} accessibilityRole="button" accessibilityState={{ selected: selected === item.source.id }} disabled={busy} style={styles.button} onPress={() => void choose(item)}>
      <Text style={styles.action}>{item.displayName}{selected === item.source.id ? ' · Selected' : ''}</Text>
      {item.displayName === 'Food tracker' ? <Text>{item.source.id}</Text> : null}
    </Pressable>)}
    {selected ? <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void refresh()}><Text style={styles.action}>Refresh selected tracker</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void nativeIntake.openSettings().then((opened) => { if (!opened) setMessage('Health Connect settings could not open.'); })}><Text style={styles.action}>Open Health Connect settings</Text></Pressable>
    <Text accessibilityLiveRegion="polite">{busy ? 'Checking your food data…' : message}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.back()}><Text style={styles.action}>Done</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md }, title: { fontSize: 24, fontWeight: '700', color: colors.text }, button: { minHeight: 48, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 8 }, action: { color: colors.primary, fontWeight: '600' } });
