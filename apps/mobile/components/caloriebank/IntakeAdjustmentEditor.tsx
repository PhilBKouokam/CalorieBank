import { useEditorDraft } from '@/lib/drafts/use-editor-draft';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
import { KeyboardSafeScrollView } from './KeyboardSafeScrollView';
import { ApiHttpError, saveIntakeAdjustment, saveHistoricalIntakeAdjustment } from '@/lib/api/client';
import { colors } from '@/constants/caloriebank-theme';

export function IntakeAdjustmentEditor({ state, onSaved, onCancel, historical = false }: {
  state: IntakeAdjustmentState; historical?: boolean; onSaved: (savedState: IntakeAdjustmentState) => void; onCancel: () => void;
}) {
  const totalLabel = historical ? 'This day’s total' : 'Today’s total';
  const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${state.localDate}T12:00:00Z`));
  const draft = useEditorDraft('calorie-correction', {
    mode: state.adjustment?.mode ?? 'add' as 'add' | 'replace',
    addition: state.adjustment?.mode === 'add' ? String(state.adjustment.calories) : '',
    replacement: String(state.calories ?? ''),
  }, JSON.stringify([historical, state.localDate, state.source, state.selectionRevision]),
  JSON.stringify([state.revision, state.manualRevision]));
  const { mode, addition, replacement } = draft.value;
  const setMode = (mode: 'add' | 'replace') => draft.update(v => ({ ...v, mode }));
  const setAddition = (addition: string) => draft.update(v => ({ ...v, addition }));
  const setReplacement = (replacement: string) => draft.update(v => ({ ...v, replacement }));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const text = mode === 'add' ? addition : replacement;
  const calories = /^\d+$/.test(text.trim()) ? Number(text) : NaN;
  const total = mode === 'replace' ? calories : state.baseCalories === null ? NaN : state.baseCalories + calories;
  async function save(remove = false) {
    if (locked.current) return;
    if (draft.conflict) { setError('Your day, source, or adjustment changed. Cancel and reopen this editor to use the latest values.'); return; }
    if (!remove && (!Number.isSafeInteger(calories) || calories < 0 || calories > 100000)) {
      setError('Enter a whole number from 0 to 100,000.'); return;
    }
    if (!remove && mode === 'add' && state.baseCalories === null) {
      setError(historical ? 'Wait for tracker calories, or replace this day’s total.' : 'Wait for tracker calories, or replace today’s total.'); return;
    }
    if (!draft.beginSave()) return;
    locked.current = true; setSaving(true); setError('');
    try {
      const savedState = await (historical ? saveHistoricalIntakeAdjustment : saveIntakeAdjustment)({ localDate: state.localDate, expectedRevision: state.revision,
        selectionRevision: state.selectionRevision, manualRevision: state.manualRevision,
        mode: remove ? 'none' : mode, calories: remove ? 0 : calories });
      draft.clear('saved');
      if (alive.current && draft.isCurrent()) onSaved(savedState);
    } catch (failure) {
      if (alive.current) setError(failure instanceof ApiHttpError && failure.kind === 'update_required' ? failure.message
        : failure instanceof ApiHttpError && failure.kind === 'conflict' ? 'Your day, source, or adjustment changed. Close this editor and try again.'
        : 'Couldn’t save your update. Try again.');
    } finally { draft.endSave(); locked.current = false; if (alive.current) setSaving(false); }
  }
  return <KeyboardSafeScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{historical ? `Calories eaten · ${dayLabel}` : 'Calories eaten today'}</Text>
    <Text style={styles.detail}>{state.source}{state.baseCalories === null ? ': no calories yet' : `: ${state.baseCalories.toLocaleString()} kcal`}</Text>
    {(['add', 'replace'] as const).map(choice => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mode === choice, disabled: saving }} disabled={saving}
      onPress={() => { setMode(choice); setError(''); }} style={[styles.choice, mode === choice && styles.selected]}>
      <Text style={styles.choiceText}>{mode === choice ? '● ' : '○ '}{choice === 'add' ? 'Add untracked calories' : historical ? 'Replace this day’s total' : 'Replace today’s total'}</Text>
    </Pressable>)}
    <Text style={styles.detail}>{mode === 'add' ? 'Your addition stays on top as your source updates.' : 'This total stays fixed until you remove it.'} {historical ? 'Only for this day. Saving updates its bank contribution.' : 'Only for today.'}</Text>
    <Text style={styles.label}>{mode === 'add' ? 'Untracked calories (kcal)' : `${totalLabel} (kcal)`}</Text>
    <View style={styles.inputFrame}><TextInput accessibilityLabel={mode === 'add' ? 'Untracked calories, kilocalories' : `${totalLabel}, kilocalories`}
      keyboardType="number-pad" underlineColorAndroid="transparent" selectTextOnFocus {...draft.selection(mode)} value={text}
      onChangeText={mode === 'add' ? setAddition : setReplacement} editable={!saving} style={styles.input} /></View>
    {Number.isSafeInteger(total) && total >= 0 ? <Text accessibilityLiveRegion="polite" style={styles.result}>{mode === 'add' ? `${state.baseCalories!.toLocaleString()} + ${calories.toLocaleString()} = ` : `${totalLabel}: `}{total.toLocaleString()} kcal</Text> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} style={styles.save} onPress={() => void save()}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
    {state.adjustment ? <Pressable accessibilityRole="button" disabled={saving} style={styles.action} onPress={() => void save(true)}><Text style={styles.link}>Remove adjustment</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={saving} style={styles.action} onPress={() => { draft.clear(); onCancel(); }}><Text style={styles.link}>Cancel</Text></Pressable>
  </KeyboardSafeScrollView>;
}
const styles = StyleSheet.create({
container: { flex: 1 },
content: { padding: 16, paddingBottom: 48, gap: 20 },
title: { fontSize: 26, fontWeight: '700', color: colors.text },
detail: { lineHeight: 24, fontSize: 16, color: colors.textMuted },
label: { fontSize: 16, fontWeight: '600', color: colors.text },
choice: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
selected: { borderColor: colors.primary, backgroundColor: colors.surface },
choiceText: { fontSize: 17, fontWeight: '600', color: colors.text },
inputFrame: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
input: { padding: 16, minHeight: 52, fontSize: 24, color: colors.text },
result: { fontSize: 20, fontWeight: '700', color: '#245BA6' },
error: { fontSize: 16, color: colors.danger },
save: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
saveText: { fontSize: 18, color: colors.surface, fontWeight: '700' },
action: { minHeight: 48, padding: 14, alignItems: 'center' },
link: { fontSize: 17, color: colors.primary, fontWeight: '600' }
});
