import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyBankTargetInput } from '@/components/caloriebank/DailyBankTargetInput';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchDailyBankTarget, saveDailyBankTarget } from '@/lib/api/client';

export default function DailyBankTargetScreen() {
  const [value, setValue] = useState('0');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const savingRef = useRef(false);
  async function load() {
    setMessage(null);
    try { const target = await fetchDailyBankTarget(); setValue(String(target.calories)); setLoaded(true); }
    catch { setMessage('We couldn’t load your target. Please try again.'); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    if (savingRef.current) return;
    if (!value || Number(value) > 2000) { setMessage('Choose an amount from 0 to 2,000 kcal.'); return; }
    savingRef.current = true; setSaving(true); setMessage(null);
    try { const result = await saveDailyBankTarget(Number(value)); setValue(String(result.calories)); setMessage('Daily Bank Target saved.'); }
    catch { setMessage('We couldn’t save your target. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <SafeAreaView edges={['bottom']} style={styles.screen}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      {loaded ? <DailyBankTargetInput value={value} onChange={(next) => { setValue(next); setMessage(null); }} disabled={saving} /> : !message ? <ActivityIndicator /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void (loaded ? save() : load())} style={styles.button}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : loaded ? 'Save target' : 'Try again'}</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  message: { color: colors.text, fontSize: typography.body },
  button: { minHeight: 48, padding: spacing.md, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
});
