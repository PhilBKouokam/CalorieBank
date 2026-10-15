import { useSettingsConflict } from '@/lib/drafts/use-settings-conflict';
import { SettingsConflictNotice } from '@/components/caloriebank/SettingsConflictNotice';
import { useEditorDraft } from '@/lib/drafts/use-editor-draft';
import { KeyboardSafeScrollView } from '@/components/caloriebank/KeyboardSafeScrollView';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyBankTargetInput } from '@/components/caloriebank/DailyBankTargetInput';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchProtectedTarget, saveProtectedTarget } from '@/lib/api/settings-concurrency';

export default function DailyBankTargetScreen() {
  const draft = useEditorDraft('daily-bank-target', '0', 'settings');
  const conflict = useSettingsConflict(draft, fetchProtectedTarget);
  const value = draft.value, setValue = draft.update;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const savingRef = useRef(false);
  async function load() {
    setMessage(null);
    try { const snapshot = await fetchProtectedTarget(); if (!draft.hydrate(String(snapshot.value.calories), snapshot.revision)) conflict.show(snapshot); setLoaded(true); }
    catch { setMessage('We couldn’t load your target. Please try again.'); }
  }
  // Fetch once per route mount; never reload in response to an unsaved keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  async function save() {
    if (savingRef.current || conflict.latest) return;
    if (!value || Number(value) > 2000) { setMessage('Choose an amount from 0 to 2,000 kcal.'); return; }
    if (!draft.beginSave()) return;
    savingRef.current = true; setSaving(true); setMessage(null);
    try {
      await saveProtectedTarget(Number(value), draft.revision);
      if (!draft.isCurrent()) return;
      draft.endSave(); draft.clear('saved');
      await load(); setMessage('Daily Bank Target saved.'); }
    catch (error) { if (!(await conflict.handle(error))) setMessage('We couldn’t save your target. Please try again.'); }
    finally { draft.endSave(); savingRef.current = false; setSaving(false); }
  }
  return <SafeAreaView edges={['bottom']} style={styles.screen}>
    <KeyboardSafeScrollView contentContainerStyle={styles.container}>
      {conflict.latest ? <SettingsConflictNotice latest={`${conflict.latest.value.calories} kcal`} onReview={conflict.review} /> : null}
      {loaded ? <DailyBankTargetInput selectionProps={draft.selection('calories')} value={value} onChange={(next) => { setValue(next); setMessage(null); }} disabled={saving} /> : !message ? <ActivityIndicator /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving || Boolean(conflict.latest)} onPress={() => void (loaded ? save() : load())} style={styles.button}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : loaded ? 'Save target' : 'Try again'}</Text>
      </Pressable>
    </KeyboardSafeScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  message: { color: colors.text, fontSize: typography.body },
  button: { minHeight: 48, padding: spacing.md, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
});
