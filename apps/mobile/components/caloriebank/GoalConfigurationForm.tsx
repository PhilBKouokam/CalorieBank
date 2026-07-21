import {
  estimatedWeightRateOptions,
  getGoalModeLabel,
  goalConfigurationInputSchema,
  type AdjustmentSource,
  type GoalConfigurationInput,
  type GoalConfigurationResponse,
  type GoalMode,
} from '@caloriebank/schemas';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchGoalConfiguration, saveGoalConfiguration } from '@/lib/api/client';

const goalOptions: { value: GoalMode; label: string; description: string }[] = [
  { value: 'cut', label: 'Cut', description: 'Save below adjusted expenditure.' },
  { value: 'maintain', label: 'Maintain', description: 'Use a zero adjustment.' },
  { value: 'bulk', label: 'Bulk', description: 'Spend above adjusted expenditure.' },
];

const sourceOptions: { value: AdjustmentSource; label: string }[] = [
  { value: 'manual_calories', label: 'Daily calories' },
  { value: 'estimated_weight_rate', label: 'Estimated pounds per week' },
];

type FormStatus = 'loading' | 'idle' | 'saving' | 'success' | 'error';

type GoalConfigurationFormProps = {
  mode: 'onboarding' | 'settings';
  onSaved: (configuration: GoalConfigurationResponse) => void;
};

function defaultManualText(goalMode: GoalMode) {
  if (goalMode === 'bulk') return '300';
  return '500';
}

function defaultEstimatedOption(goalMode: GoalMode) {
  return estimatedWeightRateOptions[goalMode][0];
}

export function GoalConfigurationForm({ mode, onSaved }: GoalConfigurationFormProps) {
  const [goalMode, setGoalMode] = useState<GoalMode>('maintain');
  const [adjustmentSource, setAdjustmentSource] = useState<AdjustmentSource>('manual_calories');
  const [manualAdjustmentText, setManualAdjustmentText] = useState('500');
  const [selectedWeeklyRate, setSelectedWeeklyRate] = useState<number | null>(null);
  const [status, setStatus] = useState<FormStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const estimatedOptions = useMemo(() => estimatedWeightRateOptions[goalMode], [goalMode]);
  const usesAdjustment = goalMode !== 'maintain';

  useEffect(() => {
    let isMounted = true;

    async function loadExistingConfiguration() {
      setStatus('loading');
      setErrorMessage('');

      try {
        const configuration = await fetchGoalConfiguration();
        if (!isMounted) return;

        if (configuration) {
          setGoalMode(configuration.goalMode);
          setAdjustmentSource(configuration.adjustmentSource);
          setManualAdjustmentText(String(Math.abs(configuration.dailyEnergyAdjustment)));
          setSelectedWeeklyRate(configuration.desiredWeeklyWeightChange);
        }

        setStatus('idle');
      } catch (error) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load setup.');
      }
    }

    void loadExistingConfiguration();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleGoalModeChange(nextGoalMode: GoalMode) {
    setGoalMode(nextGoalMode);
    setErrorMessage('');

    if (nextGoalMode === 'maintain') {
      setAdjustmentSource('manual_calories');
      setSelectedWeeklyRate(null);
      return;
    }

    setManualAdjustmentText(defaultManualText(nextGoalMode));
    setSelectedWeeklyRate(defaultEstimatedOption(nextGoalMode)?.desiredWeeklyWeightChange ?? null);
  }

  function buildInput(): GoalConfigurationInput | null {
    if (goalMode === 'maintain') {
      return {
        goalMode,
        dailyEnergyAdjustment: 0,
        adjustmentSource: 'manual_calories',
      };
    }

    if (adjustmentSource === 'estimated_weight_rate') {
      const selectedOption = estimatedOptions.find(
        (option) => option.desiredWeeklyWeightChange === selectedWeeklyRate,
      );

      if (!selectedOption) {
        setErrorMessage('Choose an estimated weekly rate.');
        return null;
      }

      return {
        goalMode,
        dailyEnergyAdjustment: selectedOption.dailyEnergyAdjustment,
        adjustmentSource,
        desiredWeeklyWeightChange: selectedOption.desiredWeeklyWeightChange,
      };
    }

    const displayedAdjustment = Number(manualAdjustmentText);

    if (!Number.isInteger(displayedAdjustment) || displayedAdjustment <= 0 || displayedAdjustment > 2_000) {
      setErrorMessage('Enter a whole-number adjustment between 1 and 2,000 calories.');
      return null;
    }

    return {
      goalMode,
      dailyEnergyAdjustment: goalMode === 'cut' ? -displayedAdjustment : displayedAdjustment,
      adjustmentSource,
    };
  }

  async function handleSave() {
    setErrorMessage('');
    const input = buildInput();
    if (!input) {
      setStatus('error');
      return;
    }

    const parsedInput = goalConfigurationInputSchema.safeParse(input);
    if (!parsedInput.success) {
      setStatus('error');
      setErrorMessage('Choose a valid goal adjustment before continuing.');
      return;
    }

    setStatus('saving');

    try {
      const configuration = await saveGoalConfiguration(parsedInput.data);
      setStatus('success');
      setTimeout(() => onSaved(configuration), mode === 'settings' ? 500 : 0);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save your goal configuration.');
    }
  }

  if (status === 'loading') {
    return (
      <View style={styles.loadingPanel}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.help}>Loading your saved goal configuration.</Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Goal mode</Text>
      <View style={styles.optionColumn}>
        {goalOptions.map((option) => {
          const selected = goalMode === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => handleGoalModeChange(option.value)}
              style={[styles.option, selected && styles.selectedOption]}
            >
              <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{option.label}</Text>
              <Text style={[styles.optionDetail, selected && styles.selectedOptionText]}>
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {usesAdjustment ? (
        <>
          <Text style={styles.label}>Configure {goalMode === 'cut' ? 'deficit' : 'surplus'}</Text>
          <View style={styles.optionRow}>
            {sourceOptions.map((option) => {
              const selected = adjustmentSource === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => setAdjustmentSource(option.value)}
                  style={[styles.compactOption, selected && styles.selectedOption]}
                >
                  <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {adjustmentSource === 'manual_calories' ? (
            <>
              <Text style={styles.label}>Daily {goalMode === 'cut' ? 'deficit' : 'surplus'} calories</Text>
              <TextInput
                accessibilityLabel={`Daily ${goalMode === 'cut' ? 'deficit' : 'surplus'} calories`}
                keyboardType="number-pad"
                onChangeText={setManualAdjustmentText}
                placeholder={defaultManualText(goalMode)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={manualAdjustmentText}
              />
              <Text style={styles.help}>
                Enter the positive number you want to {goalMode === 'cut' ? 'save below' : 'spend above'} adjusted
                expenditure. CalorieBank stores cut values as negative adjustments.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Estimated weekly {goalMode === 'cut' ? 'loss' : 'gain'}</Text>
              <View style={styles.optionColumn}>
                {estimatedOptions.map((option) => {
                  const selected = selectedWeeklyRate === option.desiredWeeklyWeightChange;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={`${goalMode}-${option.desiredWeeklyWeightChange}`}
                      onPress={() => setSelectedWeeklyRate(option.desiredWeeklyWeightChange)}
                      style={[styles.option, selected && styles.selectedOption]}
                    >
                      <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
                        {option.desiredWeeklyWeightChange.toFixed(1)} lb/week
                      </Text>
                      <Text style={[styles.optionDetail, selected && styles.selectedOptionText]}>
                        {option.dailyEnergyAdjustment > 0 ? '+' : ''}
                        {option.dailyEnergyAdjustment} kcal/day
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.help}>
                These conversions are planning estimates, not guaranteed weight-change outcomes.
              </Text>
            </>
          )}
        </>
      ) : (
        <View style={styles.maintenancePanel}>
          <Text style={styles.label}>Maintenance adjustment: 0</Text>
          <Text style={styles.help}>
            Maintain uses adjusted imported expenditure with no deficit or surplus. You do not enter a calorie target
            for maintenance.
          </Text>
        </View>
      )}

      {status === 'success' ? (
        <Text style={styles.success}>
          {mode === 'settings' ? 'Goal settings saved. Returning to Today.' : 'Goal configuration saved.'}
        </Text>
      ) : null}

      {status === 'error' && errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={status === 'saving'}
        onPress={() => void handleSave()}
        style={[styles.saveButton, status === 'saving' && styles.disabledButton]}
      >
        {status === 'saving' ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.saveButtonText}>Save {getGoalModeLabel(goalMode)} Configuration</Text>
        )}
      </Pressable>
    </View>
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
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  optionColumn: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  compactOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  optionDetail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  selectedOptionText: {
    color: colors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: typography.heading,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  help: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  maintenancePanel: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  success: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    padding: spacing.md,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
