import { useSettingsConflict } from '@/lib/drafts/use-settings-conflict';
import { SettingsConflictNotice } from '@/components/caloriebank/SettingsConflictNotice';
import { useEditorDraft } from '@/lib/drafts/use-editor-draft';
import { plannedTreatInputSchema, type PlannedTreatGetResponse } from '@caloriebank/schemas';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchProtectedTreat, saveProtectedTreat, deleteProtectedTreat } from '@/lib/api/settings-concurrency';

type FormStatus = 'loading' | 'idle' | 'saving' | 'deleting' | 'success' | 'error' | 'load_error';

function isActivePlannedTreat(
  plannedTreat: PlannedTreatGetResponse | null,
): plannedTreat is Exclude<PlannedTreatGetResponse, { status: 'no_plan' }> {
  return plannedTreat !== null && plannedTreat.status !== 'no_plan';
}

export default function PlannedTreatScreen() {
  const router = useRouter();
  const [existingTreat, setExistingTreat] = useState<PlannedTreatGetResponse | null>(null);
  const draft = useEditorDraft('banking-goal', { name: '', requiredCalories: '' });
  const conflict = useSettingsConflict(draft, fetchProtectedTreat);
  const { name, requiredCalories } = draft.value;
  const setName = (name: string) => draft.update(v => ({ ...v, name }));
  const setRequiredCalories = (requiredCalories: string) => draft.update(v => ({ ...v, requiredCalories }));
  const [status, setStatus] = useState<FormStatus>('loading');
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadTreat() {
      setStatus('loading');
      setMessage('');

      try {
        const snapshot = await fetchProtectedTreat();
        const plannedTreat = snapshot.value;
        if (!isMounted) return;

        setExistingTreat(plannedTreat);

        if (!draft.hydrate(isActivePlannedTreat(plannedTreat)
          ? { name: plannedTreat.name, requiredCalories: String(plannedTreat.requiredCalories) }
          : { name: '', requiredCalories: '' }, snapshot.revision)) {
          conflict.show(snapshot); setStatus('idle'); return;
        }

        setStatus('idle');
      } catch {
        if (!isMounted) return;
        setStatus('load_error');
        setMessage('Couldn’t load your Banking Goal. Check your internet connection and try again.');
      }
    }

    void loadTreat();

    return () => {
      isMounted = false;
    };
  // A route mount/retry owns this fetch; editing a draft must not reload saved values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  async function handleSave() {
    if (conflict.latest) return;
    setMessage('');

    const parsedInput = plannedTreatInputSchema.safeParse({
      name,
      requiredCalories: Number(requiredCalories),
      targetDate: isActivePlannedTreat(existingTreat) ? existingTreat.targetDate : null,
    });

    if (!parsedInput.success) {
      setStatus('error');
      setMessage('Enter a name and a whole-number calorie amount for your plan.');
      return;
    }

    if (!draft.beginSave()) return;
    setStatus('saving');

    try {
      await saveProtectedTreat(parsedInput.data, draft.revision);

      draft.clear('saved');
      setStatus('success');
      setMessage('Banking Goal saved.');
      setTimeout(() => { if (draft.isCurrent()) router.replace('/today'); }, 400);
    } catch (error) {
      if (await conflict.handle(error)) { setStatus('idle'); return; }
      setStatus('error');
      setMessage('Your Banking Goal could not be saved. Try again later.');
    } finally { draft.endSave(); }
  }

  async function handleDelete() {
    if (conflict.latest || !draft.beginSave()) return;
    setStatus('deleting');
    setMessage('');

    try {
      await deleteProtectedTreat(draft.revision);
      draft.clear('saved');
      setStatus('success');
      setMessage('Banking Goal removed.');
      setTimeout(() => { if (draft.isCurrent()) router.replace('/today'); }, 400);
    } catch (error) {
      if (await conflict.handle(error)) { setStatus('idle'); return; }
      setStatus('error');
      setMessage('Your Banking Goal could not be removed. Try again later.');
    } finally { draft.endSave(); }
  }

  const activeTreat = isActivePlannedTreat(existingTreat) ? existingTreat : null;
  const isBusy = status === 'saving' || status === 'deleting';

  return (
    <PlaceholderScreen
      eyebrow="Banking Goal"
      title={activeTreat ? 'Edit your plan' : 'Choose something to save for'}
      description="Name one food, meal, or event. CalorieBank compares it with your real Available Bank without spending it automatically."
      keyboardAware
    >
        {status === 'loading' ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.help}>Loading your plan.</Text>
          </View>
        ) : status === 'load_error' ? (
          <View style={styles.form}>
            <Text accessibilityRole="alert" style={styles.error}>{message}</Text>
            <Pressable accessibilityRole="button" onPress={() => setLoadAttempt((attempt) => attempt + 1)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            {conflict.latest ? <SettingsConflictNotice latest={conflict.latest.value.status === 'no_plan' ? 'No Banking Goal' : `${conflict.latest.value.name}, ${conflict.latest.value.requiredCalories} kcal${conflict.latest.value.targetDate ? `, ${conflict.latest.value.targetDate}` : ''}`} onReview={() => { setExistingTreat(conflict.latest!.value); conflict.review(); }} /> : null}
            {activeTreat ? (
              <View style={styles.progressPanel}>
                <Text style={styles.progressLabel}>
                  {activeTreat.status === 'ready' ? 'Ready' : `${activeTreat.progressPercent}% ready`}
                </Text>
                <Text style={styles.help}>
                  {activeTreat.status === 'ready'
                    ? 'Your Available Bank has reached this goal. Saving this plan does not change your bank.'
                    : `${activeTreat.remainingCalories.toLocaleString()} kcal to go.`}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Treat name</Text>
            <TextInput underlineColorAndroid="transparent"
              accessibilityLabel="Banking Goal name"
              autoCapitalize="sentences"
              onChangeText={setName}
              placeholder="Cookies and milk"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              {...draft.selection('name')} value={name}
            />

            <Text style={styles.label}>Required calories</Text>
            <TextInput underlineColorAndroid="transparent"
              accessibilityLabel="Required calories"
              keyboardType="number-pad"
              onChangeText={setRequiredCalories}
              placeholder="1500"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              {...draft.selection('calories')} value={requiredCalories}
            />

            <Text style={styles.help}>
              Reaching a Banking Goal means it is ready. Your connected calorie tracker still records what you eat.
            </Text>

            {message ? (
              <Text style={status === 'error' ? styles.error : styles.success}>{message}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isBusy || Boolean(conflict.latest)}
              onPress={() => void handleSave()}
              style={[styles.primaryButton, isBusy && styles.disabledButton]}
            >
              {status === 'saving' ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Banking Goal</Text>
              )}
            </Pressable>

            {activeTreat ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy || Boolean(conflict.latest)}
                onPress={() => void handleDelete()}
                style={[styles.secondaryButton, isBusy && styles.disabledButton]}
              >
                {status === 'deleting' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Remove Banking Goal</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  loadingPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  progressPanel: {
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  progressLabel: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
  },
  help: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '700',
  },
  success: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.65,
  },
});
