import { dailyBankTargetInputSchema } from '@caloriebank/schemas';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DailyBankTargetInput } from './DailyBankTargetInput';
import { saveDailyBankTarget } from '@/lib/api/client';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

export function DailyBankTargetForm({ initialCalories, onSaved }: { initialCalories: number; onSaved: () => void }) {
  const [value, setValue] = useState(String(initialCalories));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  async function save() {
    if (locked.current) return;
    const parsed = dailyBankTargetInputSchema.safeParse({ calories: value.trim() ? Number(value) : NaN });
    if (!parsed.success) { setError('Choose an amount from 0 to 2,000 kcal.'); return; }
    locked.current = true; setSaving(true); setError(null);
    try { await saveDailyBankTarget(parsed.data.calories); onSaved(); }
    catch { setError('We couldn’t save your target. Please try again.'); }
    finally { locked.current = false; setSaving(false); }
  }
  return <View style={styles.form}>
    <DailyBankTargetInput value={value} onChange={(next) => { setValue(next); setError(null); }} disabled={saving} />
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={styles.button}>
      <Text style={styles.label}>{saving ? 'Saving…' : 'Continue'}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: typography.body },
  button: { minHeight: 48, padding: spacing.md, backgroundColor: colors.primary, borderRadius: radii.sm, alignItems: 'center' },
  label: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
});
