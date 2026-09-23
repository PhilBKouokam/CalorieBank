import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ManualIntakeState } from '@caloriebank/schemas';
import { ApiHttpError, saveManualIntake } from '@/lib/api/client';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

/** The parent loads a fresh account/date/revision before opening this editor. */
export function ManualEstimateEditor({ state, mode, onSaved, onCancel }: {
  state: ManualIntakeState; mode: 'select' | 'usual' | 'today'; onSaved: () => void; onCancel: () => void;
}) {
  const [text, setText] = useState(String(mode === 'today' ? state.estimate?.value.calories ?? '' : state.estimate?.usualCalories ?? ''));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(reset = false) {
    if (locked.current) return;
    const calories = /^\d+$/.test(text.trim()) ? Number(text) : NaN;
    if (!reset && (!Number.isSafeInteger(calories) || calories < (mode === 'today' ? 0 : 1) || calories > 100000)) {
      setError(mode === 'today' ? 'Enter a whole number from 0 to 100,000.' : 'Enter a whole number from 1 to 100,000.'); return;
    }
    locked.current = true; setSaving(true); setError('');
    try {
      const common = { expectedRevision: state.revision, localDate: state.localDate };
      await saveManualIntake(reset ? { operation: 'reset', ...common }
        : mode === 'select' ? { operation: 'select', calories, expectedRevision: state.revision, selectionRevision: state.selectionRevision }
        : { operation: mode, calories, ...common });
      if (alive.current) onSaved();
    } catch (failure) {
      if (alive.current) setError(failure instanceof ApiHttpError && failure.kind === 'update_required' ? failure.message
        : failure instanceof ApiHttpError && failure.kind === 'conflict' ? 'Your day or estimate changed. Close this editor and try again.'
        : 'Couldn’t save your update. Try again.');
    } finally { locked.current = false; if (alive.current) setSaving(false); }
  }
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{mode === 'today' ? 'Calories eaten today' : 'About how many calories do you usually eat in a day?'}</Text>
      <Text style={styles.detail}>{mode === 'today' ? 'Your best estimate for the whole day.' : 'We’ll use this as your daily estimate. Change today’s amount whenever you eat more or less.'}</Text>
      <TextInput accessibilityLabel={mode === 'today' ? 'Calories eaten today, kilocalories' : 'Usual daily estimate, kilocalories'} keyboardType="number-pad" selectTextOnFocus value={text} onChangeText={setText} editable={!saving} style={styles.input} />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} style={styles.save} onPress={() => void save()}><Text style={styles.saveText}>{saving ? 'Saving…' : mode === 'select' ? 'Use my estimate' : 'Save'}</Text></Pressable>
      {mode === 'today' && state.estimate?.overridden ? <Pressable accessibilityRole="button" disabled={saving} style={styles.action} onPress={() => void save(true)}><Text style={styles.link}>Use my usual estimate</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={saving} style={styles.action} onPress={onCancel}><Text style={styles.link}>Cancel</Text></Pressable>
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: typography.heading, fontWeight: '700', color: colors.text },
  detail: { fontSize: typography.body, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: 24, color: colors.text, minHeight: 52 },
  save: { minHeight: 48, backgroundColor: colors.primary, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center' },
  saveText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  action: { minHeight: 48, padding: spacing.md, alignItems: 'center' }, link: { color: colors.primary, fontSize: typography.body, fontWeight: '600' },
  error: { color: colors.danger, fontSize: typography.body },
});
