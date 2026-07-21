import type {
  BankHistoryDayDetailResponse,
  BankHistoryRange,
  BankHistoryResponse,
} from '@caloriebank/schemas';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchBankHistory, fetchBankHistoryDay } from '@/lib/api/client';

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

function goalAdjustmentText(day: BankHistoryDayDetailResponse) {
  if (day.goalMode === 'maintain') return 'Maintenance · no adjustment';

  const label = day.goalMode === 'cut' ? 'Cut goal' : 'Bulk goal';
  const sign = day.goalMode === 'cut' ? '-' : '+';
  return `${label} ${sign}${day.goalAdjustmentCalories.toLocaleString()} kcal`;
}

export default function BankHistoryScreen() {
  const [selectedRange, setSelectedRange] = useState<BankHistoryRange>('W');
  const [history, setHistory] = useState<BankHistoryResponse | null>(null);
  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<BankHistoryDayDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading');
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadHistory() {
        setStatus('loading');
        setDetailStatus('idle');

        try {
          const nextHistory = await fetchBankHistory(selectedRange);
          if (!isMounted) return;

          setHistory(nextHistory);

          if (nextHistory.finalizedDays.length === 0) {
            setSelectedLogDate(null);
            setSelectedDay(null);
            setStatus('empty');
            return;
          }

          const nextSelectedLogDate = nextHistory.finalizedDays[0]?.logDate ?? null;
          setSelectedLogDate(nextSelectedLogDate);
          setStatus('ready');

          if (nextSelectedLogDate) {
            setDetailStatus('loading');
            const detail = await fetchBankHistoryDay(nextSelectedLogDate);
            if (!isMounted) return;
            setSelectedDay(detail);
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
    }, [selectedRange]),
  );

  async function handleSelectDay(logDate: string) {
    setSelectedLogDate(logDate);
    setDetailStatus('loading');

    try {
      const detail = await fetchBankHistoryDay(logDate);
      setSelectedDay(detail);
      setDetailStatus('ready');
    } catch {
      setSelectedDay(null);
      setDetailStatus('error');
    }
  }

  const hasFinalizedDays = history && history.finalizedDays.length > 0;
  const bankValue = hasFinalizedDays ? formatCalories(history.availableBankCalories) : 'Not calculated';
  const throughText = hasFinalizedDays ? `Through ${history.endDate}` : 'No finalized days yet';

  return (
    <PlaceholderScreen
      eyebrow="Bank History"
      title="Available Bank"
      description="Your official bank includes finalized days only, through the previous completed day."
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Available Bank</Text>
        <Text style={styles.heroValue}>{bankValue}</Text>
        <Text style={styles.heroDetail}>{throughText}</Text>
      </View>

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
        <Text style={styles.sectionTitle}>Finalized days</Text>
        {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {status === 'error' ? <Text style={styles.errorText}>Bank history is unavailable.</Text> : null}
        {status === 'empty' ? (
          <>
            <Text style={styles.bodyText}>No finalized bank days yet.</Text>
            <Text style={styles.mutedText}>Completed days will appear here after finalization.</Text>
          </>
        ) : null}
        {status === 'ready'
          ? history?.finalizedDays.map((day) => {
              const selected = selectedLogDate === day.logDate;
              return (
                <Pressable
                  accessibilityHint="Loads bank detail for this finalized day."
                  accessibilityLabel={`${day.logDate}, ${formatCalories(day.dailyBankChange)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={day.logDate}
                  onPress={() => void handleSelectDay(day.logDate)}
                  style={[styles.dayRow, selected && styles.selectedDayRow]}
                >
                  <Text style={styles.dayDate}>{day.logDate}</Text>
                  <Text style={[styles.dayChange, day.dailyBankChange < 0 && styles.negativeChange]}>
                    {formatCalories(day.dailyBankChange)}
                  </Text>
                </Pressable>
              );
            })
          : null}
      </View>

      <View style={styles.breakdownPanel}>
        <Text style={styles.sectionTitle}>Selected day</Text>
        {detailStatus === 'idle' ? <Text style={styles.mutedText}>Select a finalized day.</Text> : null}
        {detailStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {detailStatus === 'error' ? <Text style={styles.errorText}>That day detail is unavailable.</Text> : null}
        {detailStatus === 'ready' && selectedDay ? (
          <>
            <Text style={styles.dayTitle}>{selectedDay.logDate}</Text>
            <Text style={[styles.changeText, selectedDay.dailyBankChange < 0 && styles.negativeChange]}>
              Banked {formatCalories(selectedDay.dailyBankChange)}
            </Text>

            <View style={styles.breakdownRows}>
              <Text style={styles.rowText}>
                Calories burned {selectedDay.importedTotalDailyExpenditure.toLocaleString()} kcal
              </Text>
              <Text style={styles.rowText}>
                {Math.round(selectedDay.expenditureAdjustmentRate * 100)}% credited{' '}
                {selectedDay.adjustedExpenditure.toLocaleString()} kcal
              </Text>
              <Text style={styles.rowText}>{goalAdjustmentText(selectedDay)}</Text>
              <Text style={styles.rowText}>
                Calories eaten {selectedDay.importedCalorieIntake.toLocaleString()} kcal
              </Text>
              <Text style={styles.finalRowText}>Banked {formatCalories(selectedDay.dailyBankChange)}</Text>
            </View>

            <Text style={styles.compactMath}>
              {selectedDay.adjustedExpenditure.toLocaleString()} credited{'\n'}
              {selectedDay.goalMode === 'cut'
                ? `- ${selectedDay.goalAdjustmentCalories.toLocaleString()} cut goal`
                : selectedDay.goalMode === 'bulk'
                  ? `+ ${selectedDay.goalAdjustmentCalories.toLocaleString()} bulk goal`
                  : 'maintenance'}
              {'\n'}- {selectedDay.importedCalorieIntake.toLocaleString()} eaten{'\n'}={' '}
              {formatCalories(selectedDay.dailyBankChange)} banked
            </Text>
          </>
        ) : null}
      </View>
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
  dayChange: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  negativeChange: {
    color: colors.danger,
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
  rowText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  finalRowText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 23,
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
});
