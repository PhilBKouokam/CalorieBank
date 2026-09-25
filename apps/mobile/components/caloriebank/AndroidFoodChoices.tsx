import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { nativeIntake } from '@/lib/native-health';
import type { NativeFoodSource } from '@/lib/native-health/intake';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

const trackers = [
  { id: 'com.cronometer.android.gold', name: 'Cronometer' },
  { id: 'com.myfitnesspal.android', name: 'MyFitnessPal' },
  { id: 'com.fitnow.loseit', name: 'Lose It!' },
  { id: 'com.sbs.diet', name: 'MacroFactor' },
] as const;

/** Shared consumer chooser; only exact observed writers can become authoritative. */
export function AndroidFoodChoices({ onSelected, onBusyChange, disabled = false }: { disabled?: boolean; onSelected: () => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);
  const [sources, setSources] = useState<NativeFoodSource[]>([]);
  const [message, setMessage] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const current = useRef(true);
  const locked = useRef(false);
  const reportBusy = useRef(onBusyChange);
  reportBusy.current = onBusyChange;
  function changeBusy(value: boolean) { locked.current = value; setBusy(value); reportBusy.current(value); }
  useEffect(() => { current.current = true; return () => { current.current = false; nativeIntake.cancel(); reportBusy.current(false); }; }, []);
  async function select(source: NativeFoodSource) {
    const result = await nativeIntake.select(source.source);
    if (!current.current) return;
    if (result === 'ready' || result === 'empty') await onSelected();
    else setMessage(result === 'access_required' ? 'Allow CalorieBank to read nutrition in Health Connect, then check again.' : 'Your food source could not be saved. Try again.');
  }
  async function choose(id: string | null) {
    if (locked.current || disabled) return;
    changeBusy(true); setRequested(id); setMessage(''); setSources([]); setNeedsSetup(false);
    try {
      const discovered = await nativeIntake.discover(true);
      if (!current.current) return;
      if (['unavailable', 'unsupported_version', 'setup_required'].includes(discovered.access.state)) {
        setNeedsSetup(discovered.access.state === 'setup_required');
        setMessage('Health Connect needs to be available on this phone. You can choose FatSecret instead.');
      } else if (!discovered.access.granted.includes('nutrition')) {
        setMessage('Allow CalorieBank to read nutrition in Health Connect, then check again.');
      } else if (discovered.queryState === 'failed') {
        setMessage('We couldn’t check your food data. Try again.');
      } else if (id) {
        const source = discovered.sources.find((item) => item.source.id === id);
        if (source) await select(source);
        else {
          const name = trackers.find((item) => item.id === id)!.name;
          setMessage(`No ${name} calories were found in Health Connect yet. Make sure ${name} is sharing nutrition with Health Connect, then check again.`);
        }
      } else {
        setSources(discovered.sources);
        if (!discovered.sources.length) setMessage('No food data was found in Health Connect yet. Open your tracker and enable nutrition sharing, then check again.');
      }
    } catch { if (current.current) setMessage('We couldn’t check your food data. Try again.'); }
    finally { if (current.current) changeBusy(false); }
  }
  return <View style={styles.list}>
    {trackers.map((tracker) => <Pressable key={tracker.id} accessibilityLabel={`Choose ${tracker.name}`} accessibilityRole="button" disabled={busy || disabled} onPress={() => void choose(tracker.id)} style={styles.option}>
      <Text style={styles.name}>{tracker.name}</Text><Text style={styles.detail}>via Health Connect</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={() => void choose(null)} style={styles.option}>
      <Text style={styles.name}>Another app using Health Connect</Text><Text style={styles.detail}>Choose another app that shares your calories with Health Connect.</Text>
    </Pressable>
    {sources.map((source, index) => <Pressable key={source.source.id} accessibilityRole="button" disabled={busy || disabled} style={styles.option} onPress={() => {
      if (locked.current || disabled) return;
      changeBusy(true);
      void select(source).catch(() => { if (current.current) setMessage('Your food source could not be saved. Try again.'); }).finally(() => { if (current.current) changeBusy(false); });
    }}><Text style={styles.name}>{source.displayName === 'Food tracker' ? `Food tracker ${index + 1}` : source.displayName}</Text><Text style={styles.detail}>via Health Connect</Text></Pressable>)}
    {busy ? <ActivityIndicator accessibilityLabel="Checking food connection" color={colors.primary} /> : null}
    {message ? <View style={styles.list}><Text accessibilityLiveRegion="polite" style={styles.detail}>{message}</Text>
      {needsSetup ? <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={() => {
        void nativeIntake.openSettings().then((opened) => { if (current.current && !opened) setMessage('Health Connect could not open. Try again.'); }).catch(() => { if (current.current) setMessage('Health Connect could not open. Try again.'); });
      }} style={styles.option}><Text style={styles.name}>Set up Health Connect</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={() => void choose(requested)} style={styles.option}><Text style={styles.name}>Check again</Text></Pressable>
      {requested === 'com.cronometer.android.gold' ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://cronometer.com/blog/health-connect/')} style={styles.option}><Text style={styles.name}>How to connect Cronometer</Text></Pressable> : null}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ list: { gap: spacing.md }, option: { backgroundColor: colors.surface, borderRadius: radii.md, borderColor: colors.border, borderWidth: 1, padding: spacing.md, minHeight: 72, gap: spacing.sm }, name: { color: colors.text, fontWeight: '800', fontSize: typography.subheading }, detail: { color: colors.textMuted, fontSize: 16, lineHeight: 23 } });
