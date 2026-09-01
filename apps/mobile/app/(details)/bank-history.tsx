import type {
  BankHistoryDayDetailResponse,
  BankHistoryMissingDay,
  BankHistoryRange,
  BankHistoryResponse,
  HistoricalSourceOptionsResponse,
} from '@caloriebank/schemas';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  ApiHttpError,
  changeHistoricalSource,
  fetchBankHistory,
  fetchBankHistoryDay,
  fetchHistoricalSourceOptions,
  fetchProviderSelection,
  syncFatSecret,
  syncFitbit,
} from '@/lib/api/client';
import { historicalSourceChangeMessage } from '@/lib/history/source-change-errors';
import { refreshAppleHealthForCurrentAccount } from '@/lib/healthkit/healthkit-connection';
import { getConsumerSourceName } from '@/lib/providers/presentation';

const ranges: { label: string; value: BankHistoryRange }[] = [
  { label: 'D', value: 'D' },
  { label: 'W', value: 'W' },
  { label: 'M', value: 'M' },
  { label: '3M', value: '3M' },
  { label: 'Y', value: 'Y' },
  { label: 'All', value: 'ALL' },
];

function formatCalories(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()} kcal`;
}

function formatBankBalance(value: number) {
  return `${value.toLocaleString()} kcal`;
}

function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function contributionVerb(value: number) {
  if (value > 0) return 'Deposited';
  if (value < 0) return 'Enjoyed';
  return 'No change';
}

function goalAdjustmentText(day: BankHistoryDayDetailResponse) {
  if (day.goalMode === 'maintain') return 'Maintain weight';
  const label = day.goalMode === 'cut' ? 'Lose weight' : 'Gain weight';
  return `${label} · ${day.goalAdjustmentCalories.toLocaleString()} kcal`;
}

function contributionEquation(day: BankHistoryDayDetailResponse) {
  const adjusted = day.adjustedExpenditure.toLocaleString();
  const eaten = day.importedCalorieIntake.toLocaleString();
  const result = formatCalories(day.dailyBankChange);

  if (day.goalMode === 'cut') {
    return `${adjusted} − ${day.goalAdjustmentCalories.toLocaleString()} − ${eaten} = ${result}`;
  }
  if (day.goalMode === 'bulk') {
    return `${adjusted} + ${day.goalAdjustmentCalories.toLocaleString()} − ${eaten} = ${result}`;
  }
  return `${adjusted} − ${eaten} = ${result}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

async function refreshHistoricalSources() {
  const selection = await fetchProviderSelection();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const tasks: Promise<unknown>[] = [];
  if (selection.expenditure.authoritativeProvider === 'google_health_fitbit') {
    tasks.push(syncFitbit(timezone, true, true));
  }
  if (selection.intake.authoritativeProvider === 'fatsecret') {
    tasks.push(syncFatSecret(timezone, true, true));
  }
  if (
    selection.expenditure.authoritativeProvider === 'apple_health'
    || selection.intake.authoritativeProvider === 'apple_health'
  ) {
    tasks.push(refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 }));
  }
  await Promise.all(tasks);
}

export default function BankHistoryScreen() {
  const [selectedRange, setSelectedRange] = useState<BankHistoryRange>('W');
  const [history, setHistory] = useState<BankHistoryResponse | null>(null);
  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<BankHistoryDayDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading');
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [sourceOptions, setSourceOptions] = useState<HistoricalSourceOptionsResponse | null>(null);
  const [sourcePickerRole, setSourcePickerRole] = useState<'expenditure' | 'intake' | null>(null);
  const [sourceMutationStatus, setSourceMutationStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [sourceMutationMessage, setSourceMutationMessage] = useState<string | null>(null);
  const automaticGapRecoveryAttempted = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadHistory() {
        setStatus('loading');
        setDetailStatus('idle');

        try {
          let nextHistory = await fetchBankHistory(selectedRange);
          if (
            !automaticGapRecoveryAttempted.current
            && nextHistory.missingDays.some((day) => day.canRetry)
          ) {
            automaticGapRecoveryAttempted.current = true;
            await refreshHistoricalSources().catch(() => undefined);
            nextHistory = await fetchBankHistory(selectedRange).catch(() => nextHistory);
          }
          if (!isMounted) return;

          setHistory(nextHistory);

          if (nextHistory.days.length === 0 && nextHistory.missingDays.length === 0) {
            setSelectedLogDate(null);
            setSelectedDay(null);
            setStatus('empty');
            return;
          }

          const nextSelectedLogDate = nextHistory.days[0]?.logDate ?? null;
          setSelectedLogDate(nextSelectedLogDate);
          setStatus('ready');

          if (nextSelectedLogDate) {
            setDetailStatus('loading');
            const [detail, sources] = await Promise.all([
              fetchBankHistoryDay(nextSelectedLogDate),
              fetchHistoricalSourceOptions(nextSelectedLogDate),
            ]);
            if (!isMounted) return;
            setSelectedDay(detail);
            setSourceOptions(sources);
            setDetailStatus('ready');
          }
        } catch {
          if (!isMounted) return;
          setHistory(null);
          setSelectedLogDate(null);
          setSelectedDay(null);
          setStatus('error');
          setDetailStatus('error');
        }
      }

      void loadHistory();

      return () => {
        isMounted = false;
      };
    // retryAttempt intentionally reruns the focused request without changing the selected range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [retryAttempt, selectedRange]),
  );

  async function handleSelectDay(logDate: string) {
    setSelectedLogDate(logDate);
    setDetailStatus('loading');

    try {
      const [detail, sources] = await Promise.all([
        fetchBankHistoryDay(logDate),
        fetchHistoricalSourceOptions(logDate),
      ]);
      setSelectedDay(detail);
      setSourceOptions(sources);
      setDetailStatus('ready');
    } catch {
      setSelectedDay(null);
      setDetailStatus('error');
    }
  }

  async function handleSourceChange(optionId: string) {
    if (!selectedLogDate || !sourcePickerRole || !sourceOptions) return;
    setSourceMutationStatus('saving');
    setSourceMutationMessage(null);
    const selectedOption = sourceOptions[sourcePickerRole].options.find((option) => option.id === optionId);
    try {
      const roleState = sourceOptions[sourcePickerRole];
      const result = await changeHistoricalSource(selectedLogDate, sourcePickerRole, {
        optionId,
        expectedRevision: roleState.revision,
        idempotencyKey: Crypto.randomUUID(),
      });
      setSelectedDay(result.day);
      setSourceOptions(result.sources);
      setSourcePickerRole(null);
      setSourceMutationStatus('idle');
      setHistory(await fetchBankHistory(selectedRange).catch(() => history));
    } catch (error) {
      setSourceMutationStatus('error');
      setSourceMutationMessage(historicalSourceChangeMessage(
        error instanceof ApiHttpError ? error.code : null,
        selectedOption?.label ?? 'That source',
      ));
    }
  }

  function openSourcePicker(role: 'expenditure' | 'intake') {
    setSourceMutationStatus('idle');
    setSourceMutationMessage(null);
    setSourcePickerRole(role);
  }

  async function retryMissingDay() {
    await refreshHistoricalSources();
    setRetryAttempt((attempt) => attempt + 1);
  }

  function showMissingDay(day: BankHistoryMissingDay) {
    const actions = day.canRetry
      ? [
          { text: 'Cancel', style: 'cancel' as const },
          {
            text: 'Try again',
            onPress: () => void retryMissingDay().catch(() => {
              Alert.alert('Couldn’t refresh this day', 'Check your health connections and try again.');
            }),
          },
        ]
      : [{ text: 'OK' }];
    Alert.alert(formatDate(day.logDate), day.message, actions);
  }

  const hasCompletedDays = Boolean(history && history.days.length > 0);
  const hasInitializedBank = history?.openingBankStatus === 'initialized';
  const bankValue = hasInitializedBank && history
    ? formatBankBalance(history.availableBankCalories)
    : 'Not calculated';
  const throughText = hasCompletedDays && history
    ? `Through ${formatDate(history.endDate ?? '')}`
    : 'Waiting for a complete day';

  return (
    <PlaceholderScreen
      eyebrow="History"
      title="Available Bank"
      description="See how completed days changed your bank."
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Available Bank</Text>
        <Text style={styles.heroValue}>{bankValue}</Text>
        <Text style={styles.heroDetail}>{throughText}</Text>
      </View>

      {history && history.recoveryCalories > 0 ? (
        <View accessibilityRole="summary" style={styles.recoverySummary}>
          <Text style={styles.sectionTitle}>Recovery</Text>
          <Text style={styles.recoveryValue}>
            {history.recoveryCalories.toLocaleString()} kcal to recover
          </Text>
          <Text style={styles.mutedText}>New deposits will restore your bank first.</Text>
        </View>
      ) : null}

      <View style={styles.rangeRow} accessibilityLabel="History range">
        {ranges.map((range) => {
          const selected = selectedRange === range.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={range.value}
              onPress={() => setSelectedRange(range.value)}
              style={[styles.rangeButton, selected && styles.selectedRangeButton]}
            >
              <Text style={[styles.rangeText, selected && styles.selectedRangeText]}>{range.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timelinePanel}>
        <Text style={styles.sectionTitle}>Completed days</Text>
        {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {status === 'error' ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Bank history is unavailable.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryAttempt((attempt) => attempt + 1)}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {status === 'empty' ? (
          <>
            <Text style={styles.bodyText}>No completed days yet.</Text>
            <Text style={styles.mutedText}>Your history will appear after CalorieBank receives a complete day of burn and food data.</Text>
          </>
        ) : null}
        {status === 'ready'
          ? [
              ...(history?.days.map((day) => ({ kind: 'calculated' as const, day })) ?? []),
              ...(history?.missingDays.map((day) => ({ kind: 'missing' as const, day })) ?? []),
            ].sort((a, b) => b.day.logDate.localeCompare(a.day.logDate)).map((item) => {
              if (item.kind === 'missing') {
                return (
                  <Pressable
                    accessibilityHint={item.day.canRetry ? 'Shows why this day is missing and offers retry.' : 'Shows why this day is missing.'}
                    accessibilityLabel={`${item.day.logDate}, ${item.day.message}`}
                    accessibilityRole="button"
                    key={item.day.logDate}
                    onPress={() => showMissingDay(item.day)}
                    style={styles.dayRow}
                  >
                    <Text style={styles.dayDate}>{formatDate(item.day.logDate)}</Text>
                    <Text style={styles.missingDayText}>{item.day.message}</Text>
                  </Pressable>
                );
              }
              const day = item.day;
              const selected = selectedLogDate === day.logDate;
              return (
                <Pressable
                  accessibilityHint="Loads bank details for this completed day."
                  accessibilityLabel={`${day.logDate}, ${formatCalories(day.dailyBankChange)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={day.logDate}
                  onPress={() => void handleSelectDay(day.logDate)}
                  style={[styles.dayRow, selected && styles.selectedDayRow]}
                >
                  <Text style={styles.dayDate}>{formatDate(day.logDate)}</Text>
                  <View style={styles.dayAmount}>
                    <Text style={styles.dayChange}>
                      {formatCalories(day.dailyBankChange)}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          : null}
      </View>

      <View style={styles.breakdownPanel}>
        <Text style={styles.sectionTitle}>Day details</Text>
        {detailStatus === 'idle' ? <Text style={styles.mutedText}>Select a completed day.</Text> : null}
        {detailStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {detailStatus === 'error' ? <Text style={styles.errorText}>That day detail is unavailable.</Text> : null}
        {detailStatus === 'ready' && selectedDay ? (
          <>
            <Text style={styles.dayTitle}>{formatDate(selectedDay.logDate)}</Text>
            <Text style={styles.changeText}>
              {contributionVerb(selectedDay.dailyBankChange)} {Math.abs(selectedDay.dailyBankChange).toLocaleString()} kcal
            </Text>

            <View style={styles.breakdownRows}>
              <DetailRow
                label={`${sourceOptions?.expenditure.selected.label
                  ?? getConsumerSourceName(selectedDay.versions.at(-1)?.expenditureProvider)} burn`}
                value={`${selectedDay.importedTotalDailyExpenditure.toLocaleString()} kcal`}
              />
              <DetailRow
                label="Estimated actual burn"
                value={`× ${Number(selectedDay.expenditureAdjustmentRate.toFixed(2))} = ${selectedDay.adjustedExpenditure.toLocaleString()} kcal`}
              />
              <DetailRow label="Goal" value={goalAdjustmentText(selectedDay)} />
              <DetailRow label="Eaten" value={`${selectedDay.importedCalorieIntake.toLocaleString()} kcal`} />
            </View>

            <Text style={styles.compactMath}>{contributionEquation(selectedDay)}</Text>

            <View style={styles.detailNotes}>
              {selectedDay.provenance === 'opening' ? (
                <Text style={styles.mutedText}>Included in your starting bank.</Text>
              ) : null}
              {selectedDay.provenance === 'opening' && selectedDay.startingBalanceFloorApplied ? (
                <Text style={styles.mutedText}>Your starting balance cannot begin below zero.</Text>
              ) : null}
              {selectedDay.versions.at(-1) ? (
                <>
                  <View style={styles.sourceRow}>
                    <Text style={styles.mutedText}>
                      Calories burned · {sourceOptions?.expenditure.selected.label
                        ?? getConsumerSourceName(selectedDay.versions.at(-1)!.expenditureProvider)}
                    </Text>
                    {sourceOptions?.expenditure.canChange ? (
                      <Pressable accessibilityRole="button" onPress={() => openSourcePicker('expenditure')}>
                        <Text style={styles.changeSourceText}>Change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.sourceRow}>
                    <Text style={styles.mutedText}>
                      Calories eaten · {sourceOptions?.intake.selected.label
                        ?? selectedDay.versions.at(-1)!.intakeSourceDisplayName
                        ?? getConsumerSourceName(selectedDay.versions.at(-1)!.intakeProvider)}
                    </Text>
                    {sourceOptions?.intake.canChange ? (
                      <Pressable accessibilityRole="button" onPress={() => openSourcePicker('intake')}>
                        <Text style={styles.changeSourceText}>Change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setSourcePickerRole(null)}
        transparent
        visible={sourcePickerRole !== null}
      >
        <Pressable accessibilityRole="button" onPress={() => setSourcePickerRole(null)} style={styles.modalBackdrop}>
          <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.sourceSheet}>
            <Text style={styles.sourceSheetTitle}>
              {sourcePickerRole === 'expenditure' ? 'Calories burned' : 'Calories eaten'}
            </Text>
            {sourcePickerRole ? sourceOptions?.[sourcePickerRole].options.map((option) => {
              const selected = option.id === sourceOptions[sourcePickerRole].selected.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: selected || sourceMutationStatus === 'saving' }}
                  disabled={selected || sourceMutationStatus === 'saving'}
                  key={option.id}
                  onPress={() => void handleSourceChange(option.id)}
                  style={styles.sourceOption}
                >
                  <Text style={styles.sourceOptionMark}>{selected ? '✓' : ''}</Text>
                  <Text style={styles.sourceOptionText}>{option.label}</Text>
                  {sourceMutationStatus === 'saving' && !selected ? <ActivityIndicator color={colors.primary} /> : null}
                </Pressable>
              );
            }) : null}
            {sourceMutationStatus === 'error' && sourceMutationMessage
              ? <Text style={styles.errorText}>{sourceMutationMessage}</Text>
              : null}
            <Pressable accessibilityRole="button" onPress={() => setSourcePickerRole(null)} style={styles.cancelButton}>
              <Text style={styles.changeSourceText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  heroValue: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
  },
  heroDetail: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recoverySummary: {
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recoveryValue: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  rangeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  selectedRangeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  rangeText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  selectedRangeText: {
    color: colors.surface,
  },
  timelinePanel: {
    gap: spacing.sm,
  },
  dayRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedDayRow: {
    borderColor: colors.primary,
  },
  dayDate: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  dayAmount: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  dayChange: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  missingDayText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.caption,
    marginLeft: spacing.md,
    textAlign: 'right',
  },
  breakdownPanel: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  dayTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  changeText: {
    color: colors.primaryDark,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  breakdownRows: {
    gap: spacing.xs,
  },
  detailNotes: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  sourceRow: {
    minHeight: 44,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  changeSourceText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: spacing.md,
  },
  sourceSheet: {
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  sourceSheetTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  sourceOption: {
    minHeight: 52,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sourceOptionMark: {
    width: 24,
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sourceOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailLabel: {
    flexBasis: '48%',
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'left',
  },
  compactMath: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  bodyText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  errorState: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  retryButtonPressed: {
    opacity: 0.72,
  },
  retryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
