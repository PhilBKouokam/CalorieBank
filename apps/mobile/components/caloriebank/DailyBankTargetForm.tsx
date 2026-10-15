import { useSettingsConflict } from '@/lib/drafts/use-settings-conflict';
import { SettingsConflictNotice } from '@/components/caloriebank/SettingsConflictNotice';
import { useEditorDraft } from '@/lib/drafts/use-editor-draft';
import { dailyBankTargetInputSchema } from '@caloriebank/schemas';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { DailyBankTargetInput } from './DailyBankTargetInput';
import { fetchProtectedTarget, saveProtectedTarget } from '@/lib/api/settings-concurrency';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

export function DailyBankTargetForm({ initialCalories, onSaved }: { initialCalories: number; onSaved: () => void }) {
  const draft = useEditorDraft('daily-bank-target', String(initialCalories), 'onboarding');
  const conflict = useSettingsConflict(draft, fetchProtectedTarget);
  useEffect(() => { void fetchProtectedTarget().then(snapshot => {
    if (!draft.hydrate(String(snapshot.value.calories), snapshot.revision)) conflict.show(snapshot);
  }).catch(() => setError('We couldn’t load your target. Go back and try again.'));
  // Each mount loads one committed baseline; typing must never replace it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const value = draft.value, setValue = draft.update;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  async function save() {
    if (locked.current || conflict.latest) return;
    const parsed = dailyBankTargetInputSchema.safeParse({ calories: value.trim() ? Number(value) : NaN });
    if (!parsed.success) { setError('Choose an amount from 0 to 2,000 kcal.'); return; }
    if (!draft.beginSave()) return;
    locked.current = true; setSaving(true); setError(null);
    try {
      await saveProtectedTarget(parsed.data.calories, draft.revision); draft.clear('saved'); if (draft.isCurrent()) onSaved();
    }
    catch (error) { if (!(await conflict.handle(error))) setError('We couldn’t save your target. Please try again.'); }
    finally { draft.endSave(); locked.current = false; setSaving(false); }
  }
  return <View style={styles.form}>
    {conflict.latest ? <SettingsConflictNotice latest={`${conflict.latest.value.calories} kcal`} onReview={conflict.review} /> : null}
    <DailyBankTargetInput selectionProps={draft.selection('calories')} value={value} onChange={(next) => { setValue(next); setError(null); }} disabled={saving} />
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving || Boolean(conflict.latest)} onPress={() => void save()} style={styles.button}>
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
