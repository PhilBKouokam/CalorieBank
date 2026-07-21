import { plannedTreatInputSchema, type PlannedTreatGetResponse } from '@caloriebank/schemas';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  createOrReplacePlannedTreat,
  deletePlannedTreat,
  fetchPlannedTreat,
  updatePlannedTreat,
} from '@/lib/api/client';

type FormStatus = 'loading' | 'idle' | 'saving' | 'deleting' | 'success' | 'error';

function isActivePlannedTreat(
  plannedTreat: PlannedTreatGetResponse | null,
): plannedTreat is Exclude<PlannedTreatGetResponse, { status: 'no_plan' }> {
  return plannedTreat !== null && plannedTreat.status !== 'no_plan';
}

export default function PlannedTreatScreen() {
  const router = useRouter();
  const [existingTreat, setExistingTreat] = useState<PlannedTreatGetResponse | null>(null);
  const [name, setName] = useState('');
  const [requiredCalories, setRequiredCalories] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<FormStatus>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadTreat() {
      setStatus('loading');
      setMessage('');

      try {
        const plannedTreat = await fetchPlannedTreat();
        if (!isMounted) return;

        setExistingTreat(plannedTreat);

        if (isActivePlannedTreat(plannedTreat)) {
          setName(plannedTreat.name);
          setRequiredCalories(String(plannedTreat.requiredCalories));
          setTargetDate(plannedTreat.targetDate ?? '');
        }

        setStatus('idle');
      } catch {
        if (!isMounted) return;
        setStatus('error');
        setMessage('Your Planned Treat could not be loaded. Try again later.');
      }
    }

    void loadTreat();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave() {
    setMessage('');

    const parsedInput = plannedTreatInputSchema.safeParse({
      name,
      requiredCalories: Number(requiredCalories),
      targetDate: targetDate.trim().length > 0 ? targetDate.trim() : null,
    });

    if (!parsedInput.success) {
      setStatus('error');
      setMessage('Enter a name and a whole-number calorie amount for your plan.');
      return;
    }

    setStatus('saving');

    try {
      if (isActivePlannedTreat(existingTreat)) {
        await updatePlannedTreat(parsedInput.data);
      } else {
        await createOrReplacePlannedTreat(parsedInput.data);
      }

      setStatus('success');
      setMessage('Planned Treat saved.');
      setTimeout(() => router.replace('/today'), 400);
    } catch {
      setStatus('error');
      setMessage('Your Planned Treat could not be saved. Try again later.');
    }
  }

  async function handleDelete() {
    setStatus('deleting');
    setMessage('');

    try {
      await deletePlannedTreat();
      setStatus('success');
      setMessage('Planned Treat removed.');
      setTimeout(() => router.replace('/today'), 400);
    } catch {
      setStatus('error');
      setMessage('Your Planned Treat could not be removed. Try again later.');
    }
  }

  const activeTreat = isActivePlannedTreat(existingTreat) ? existingTreat : null;
  const isBusy = status === 'saving' || status === 'deleting';

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlaceholderScreen
        eyebrow="Planned Treat"
        title={activeTreat ? 'Edit your plan' : 'Choose something to save for'}
        description="Name one food, meal, or event. CalorieBank compares it with your real Available Bank without spending it automatically."
      >
        {status === 'loading' ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.help}>Loading your plan.</Text>
          </View>
        ) : (
          <View style={styles.form}>
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
            <TextInput
              accessibilityLabel="Planned Treat name"
              autoCapitalize="sentences"
              onChangeText={setName}
              placeholder="Cookies and milk"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={name}
            />

            <Text style={styles.label}>Required calories</Text>
            <TextInput
              accessibilityLabel="Required calories"
              keyboardType="number-pad"
              onChangeText={setRequiredCalories}
              placeholder="1500"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={requiredCalories}
            />

            <Text style={styles.label}>Target date optional</Text>
            <TextInput
              accessibilityLabel="Optional target date"
              autoCapitalize="none"
              onChangeText={setTargetDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={targetDate}
            />
            <Text style={styles.help}>
              Reaching a Planned Treat means it is ready. Your connected calorie tracker still records what you eat.
            </Text>

            {message ? (
              <Text style={status === 'error' ? styles.error : styles.success}>{message}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void handleSave()}
              style={[styles.primaryButton, isBusy && styles.disabledButton]}
            >
              {status === 'saving' ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Planned Treat</Text>
              )}
            </Pressable>

            {activeTreat ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => void handleDelete()}
                style={[styles.secondaryButton, isBusy && styles.disabledButton]}
              >
                {status === 'deleting' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Remove Planned Treat</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </PlaceholderScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
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
