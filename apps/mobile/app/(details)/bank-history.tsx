import { FrostedView } from '@/components/caloriebank/FrostedSurface';
import { trackerChoices } from '@/lib/native-health/tracker-choices';
import { sourceLabel } from '@/lib/native-health/copy';
import type {
  BankHistoryDayDetailResponse,
  BankHistoryMissingDay,
  BankHistoryRange,
  BankHistoryResponse,
  HistoricalSourceOptionsResponse,
} from '@caloriebank/schemas';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { compactGlassCard } from '@/constants/card-surface';
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
import { historyPeriods, historyDateLabel, historyChart, movePeriod } from '@/lib/history/periods';
import { historicalSourceChangeMessage } from '@/lib/history/source-change-errors';
import { refreshNativeHealthForCurrentAccount } from '@/lib/native-health';
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
  if (value > 0) return 'Banked';
  if (value < 0) return 'Enjoyed';
  return 'No change';
}

function goalAdjustmentText(day: BankHistoryDayDetailResponse) {
  if (day.goalMode === 'maintain') return 'Maintenance';
  const label = day.goalMode === 'cut' ? 'Deficit' : 'Surplus';
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

function DetailRow({ label, value, tone }: {
  label: string;
  value: string;
  tone?: 'burned' | 'eaten';
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, tone === 'burned' && styles.burnedText, tone === 'eaten' && styles.eatenText]}>{label}</Text>
      <Text style={[styles.detailValue, tone === 'burned' && styles.burnedText, tone === 'eaten' && styles.eatenText]}>
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
    tasks.push(refreshNativeHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 }));
  }
  await Promise.all(tasks);
}

export default function BankHistoryScreen() {
  const { width, fontScale } = useWindowDimensions();
  const [dayListWidth, setDayListWidth] = useState<number | null>(null);
  // Reserve readable columns rather than squeezing date/status around a scaled amount.
  const stackDayRows = ((dayListWidth ?? width - 32) - 34) / fontScale < 250;
  const [periodAnchor, setPeriodAnchor] = useState<string | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const detailRequest = useRef(0);
  const focusOwner = useRef(0);
  const historyRequest = useRef(0);
  const pickerRequest = useRef(0);
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
      const focus = ++focusOwner.current;
      const request = ++detailRequest.current;
      const historyRead = ++historyRequest.current;
      pickerRequest.current++;
      setSourcePickerRole(null);
      setSourceOptions(null);
      setSelectedDay(null);

      async function loadHistory() {
        setStatus('loading');
        setDetailStatus('idle');

        try {
          let nextHistory = await fetchBankHistory('ALL');
          if (
            !automaticGapRecoveryAttempted.current
            && nextHistory.missingDays.some((day) => day.canRetry)
          ) {
            automaticGapRecoveryAttempted.current = true;
            await refreshHistoricalSources().catch(() => undefined);
            nextHistory = await fetchBankHistory('ALL').catch(() => nextHistory);
          }
          if (!isMounted || historyRead !== historyRequest.current) return;

          setHistory(nextHistory);
          setPeriodAnchor(anchor => anchor ?? [...nextHistory.days, ...nextHistory.missingDays].map(day => day.logDate).sort().at(-1) ?? null);

          if (nextHistory.days.length === 0 && nextHistory.missingDays.length === 0) {
            setSelectedLogDate(null);
            setSelectedDay(null);
            setStatus('empty');
            return;
          }

          const nextSelectedLogDate = (selectedRange === 'D' || selectedRange === 'W') ? nextHistory.days[0]?.logDate ?? null : null;
          setSelectedDay(null);
          setSourceOptions(null);
          setSelectedLogDate(nextSelectedLogDate);
          setStatus('ready');

          if (nextSelectedLogDate) {
            setDetailStatus('loading');
            const [detail, sources] = await Promise.all([
              fetchBankHistoryDay(nextSelectedLogDate),
              fetchHistoricalSourceOptions(nextSelectedLogDate),
            ]);
            if (!isMounted || request !== detailRequest.current) return;
            setSelectedDay(detail);
            setSourceOptions(sources);
            setDetailStatus('ready');
          }
        } catch {
          if (!isMounted || request !== detailRequest.current) return;
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
        if (focusOwner.current === focus) focusOwner.current++;
        detailRequest.current++;
        historyRequest.current++;
        pickerRequest.current++;
      };
    // retryAttempt intentionally reruns the focused request without changing the selected range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [retryAttempt, selectedRange]),
  );

  async function handleSelectDay(logDate: string) {
    const request = ++detailRequest.current;
    closeSourcePicker();
    setSelectedDay(null);
    setSourceOptions(null);
    setSelectedLogDate(logDate);
    setDetailStatus('loading');

    try {
      const [detail, sources] = await Promise.all([
        fetchBankHistoryDay(logDate),
        fetchHistoricalSourceOptions(logDate),
      ]);
      if (request !== detailRequest.current) return;
      setSelectedDay(detail);
      setSourceOptions(sources);
      setDetailStatus('ready');
    } catch {
      if (request !== detailRequest.current) return;
      setSelectedDay(null);
      setDetailStatus('error');
    }
  }

  async function handleSourceChange(optionId: string) {
    if (!selectedLogDate || !sourcePickerRole || !sourceOptions || detailStatus !== 'ready'
      || selectedDay?.logDate !== selectedLogDate || sourceMutationStatus === 'saving') return;
    const selection = detailRequest.current;
    const picker = pickerRequest.current;
    const focus = focusOwner.current;
    const ownsPicker = () => selection === detailRequest.current && picker === pickerRequest.current && focus === focusOwner.current;
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
      if (ownsPicker()) {
        setSelectedDay(result.day);
        setSourceOptions(result.sources);
        setSourcePickerRole(null);
        setSourceMutationStatus('idle');
      }
      // Closing the sheet does not cancel a server write. Refresh its accounting
      // result without applying the old day's detail to a newer selection.
      if (focus !== focusOwner.current) return;
      const refresh = ++historyRequest.current;
      const updatedHistory = await fetchBankHistory('ALL').catch(() => null);
      if (updatedHistory && focus === focusOwner.current && refresh === historyRequest.current) setHistory(updatedHistory);
    } catch (error) {
      if (!ownsPicker()) return;
      setSourceMutationStatus('error');
      setSourceMutationMessage(sourceLabel(historicalSourceChangeMessage(
        error instanceof ApiHttpError ? error.code : null,
        selectedOption?.label ?? 'That source',
      )));
    }
  }

  function closeSourcePicker() {
    pickerRequest.current++;
    setSourcePickerRole(null);
    setSourceMutationStatus('idle');
    setSourceMutationMessage(null);
  }

  function openSourcePicker(role: 'expenditure' | 'intake') {
    if (detailStatus !== 'ready' || selectedDay?.logDate !== selectedLogDate) return;
    pickerRequest.current++;
    setSourceMutationStatus('idle');
    setSourceMutationMessage(null);
    setSourcePickerRole(role);
  }

  async function retryMissingDay() {
    await refreshHistoricalSources();
    setRetryAttempt((attempt) => attempt + 1);
  }

  function showMissingDay(day: BankHistoryMissingDay) {
    const actions = day.canRetry && (!day.recoveryDevice || day.recoveryDevice === Platform.OS)
      ? [
          { text: 'Cancel', style: 'cancel' as const },
          {
            text: 'Try again',
            onPress: () => void retryMissingDay().catch(() => {
              Alert.alert('Couldn’t refresh this day', 'Couldn’t get fresh data. Please try again when you’re connected.');
            }),
          },
        ]
      : [{ text: 'OK' }];
    Alert.alert(formatDate(day.logDate), day.recoveryMessage ?? day.message, actions);
  }

  const hasCompletedDays = Boolean(history && history.days.length > 0);
  const hasInitializedBank = history?.openingBankStatus === 'initialized';
  const bankValue = hasInitializedBank && history
    ? formatBankBalance(history.availableBankCalories)
    : 'Not calculated';
  const throughText = hasCompletedDays && history
    ? `Through ${formatDate(history.endDate ?? '')}`
    : 'Waiting for a complete day';

  const period = history && periodAnchor ? historyPeriods(history, selectedRange, periodAnchor) : null;
  const chart = history && periodAnchor ? historyChart(history, selectedRange, periodAnchor) : [];
  const chartMaximum = Math.max(1, ...chart.map(point => Math.abs(point.total ?? 0)));
  const latestDate = history ? [...history.days, ...history.missingDays].map(day => day.logDate).sort().at(-1) : undefined;
  const earliestDate = history ? [...history.days, ...history.missingDays].map(day => day.logDate).sort()[0] : undefined;
  const visibleItems = period?.grouped
    ? period.buckets.find(bucket => bucket.id === expandedPeriod)?.items ?? []
    : period?.visible ?? [];
  const periodTotal = period?.visible.reduce((sum, item) => sum + (item.kind === 'calculated' ? item.day.dailyBankChange : 0), 0) ?? 0;
  const calculatedCount = period?.visible.filter(item => item.kind === 'calculated').length ?? 0;
  function changePeriod(direction: number) {
    if (!periodAnchor) return;
    detailRequest.current++;
    closeSourcePicker();
    setSourceOptions(null);
    setPeriodAnchor(movePeriod(selectedRange, periodAnchor, direction));
    setExpandedPeriod(null); setSelectedLogDate(null); setSelectedDay(null); setDetailStatus('idle');
  }

  return (
    <PlaceholderScreen
      showBrand={false}
      bareContent
      eyebrow=""
      title="History"
      description=""
    >
      <FrostedView style={styles.hero}>
        <View style={styles.heroHeading}>
          <Text style={styles.heroLabel}>Available Bank</Text>
          <Ionicons accessibilityElementsHidden importantForAccessibility="no" name="wallet-outline" size={22} color="#246B5B" />
        </View>
        <Text style={[styles.heroValue, !hasInitializedBank && styles.heroUnavailable]}>{bankValue}</Text>
        <Text style={styles.heroDetail}>{throughText}</Text>
      </FrostedView>

      {history && history.recoveryCalories > 0 ? (
        <FrostedView accessibilityRole="summary" style={styles.recoverySummary}>
          <Text style={styles.sectionTitle}>Recovery</Text>
          <Text style={styles.recoveryValue}>
            {history.recoveryCalories.toLocaleString()} kcal to recover
          </Text>
          <Text style={styles.mutedText}>New deposits will restore your bank first.</Text>
        </FrostedView>
      ) : null}

      <View style={styles.rangeRow} accessibilityLabel="History range">
        {ranges.map((range) => {
          const selected = selectedRange === range.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={range.value}
              onPress={() => { detailRequest.current++; closeSourcePicker(); setSourceOptions(null); setExpandedPeriod(null); setSelectedDay(null); setSelectedLogDate(null); setSelectedRange(range.value); }}
              style={[styles.rangeButton, selected && styles.selectedRangeButton]}
            >
              <Text style={[styles.rangeText, selected && styles.selectedRangeText]}>{range.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {period && status === 'ready' ? (
        <FrostedView style={styles.periodPanel}>
          <View style={styles.periodHeading}>
            <Text style={[styles.sectionTitle, { flex: 1 }]}>{period.title}</Text>
            {selectedRange !== 'ALL' ? <View style={styles.periodNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous period" accessibilityState={{ disabled: !earliestDate || period.start <= earliestDate }} disabled={!earliestDate || period.start <= earliestDate} onPress={() => changePeriod(-1)} style={styles.periodArrow}>
                <Ionicons name="chevron-back" size={20} color={!earliestDate || period.start <= earliestDate ? '#A7B2AE' : colors.primary} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next period" accessibilityState={{ disabled: !latestDate || period.end >= latestDate }} disabled={!latestDate || period.end >= latestDate} onPress={() => changePeriod(1)} style={styles.periodArrow}>
                <Ionicons name="chevron-forward" size={20} color={!latestDate || period.end >= latestDate ? '#A7B2AE' : colors.primary} />
              </Pressable>
            </View> : null}
          </View>
          <Text style={[styles.changeText, periodTotal < 0 && styles.enjoyedText]}>{calculatedCount ? formatCalories(periodTotal) : 'Not calculated'}</Text>
          <Text style={styles.mutedText}>Net bank change{period.visible.some(item => item.kind === 'missing') ? ' · Incomplete' : ''}</Text>
          {chart.length ? <>
            <View style={styles.periodChart} accessibilityLabel="Signed bank changes; positive above zero, negative below">
              {chart.map((point, index) => {
                const height = point.total === null ? 0 : Math.abs(point.total) / chartMaximum * 60;
                const tickStride = Math.max(1, Math.ceil(44 * fontScale * chart.length / Math.max(180, width - 72)));
                const showLabel = selectedRange === 'M' ? index % Math.max(7, tickStride) === 0
                  : selectedRange === '3M' ? index === 0 || (point.label !== chart[index - 1]?.label && index >= tickStride)
                    : index % tickStride === 0;
                return <View key={point.id} style={styles.chartColumn} accessibilityLabel={`${point.id}, ${point.total === null ? 'Not calculated' : formatCalories(point.total)}`}>
                  <View style={styles.chartTrack}>
                    {point.total !== null && point.total >= 0 ? <View style={[styles.chartBar, { height: Math.max(2, height), backgroundColor: '#176C65' }]} /> : null}
                  </View>
                  <View style={styles.chartNegativeTrack}>
                    {point.total !== null && point.total < 0 ? <View style={[styles.chartBar, { height, backgroundColor: '#70558D' }]} /> : null}
                  </View>
                  <Text style={styles.chartLabel}>{showLabel ? point.label : ''}</Text>
                </View>;
              })}
            </View>
            <Text style={styles.chartLegend}>Banked + · Enjoyed −</Text>
          </> : null}
        </FrostedView>
      ) : null}

      <View style={styles.timelinePanel}>
        <Text style={styles.sectionTitle}>{period?.grouped ? selectedRange === 'Y' || selectedRange === 'ALL' ? 'Months' : 'Weeks' : 'Completed days'}</Text>
        <FrostedView style={styles.dayList} onLayout={event => setDayListWidth(event.nativeEvent.layout.width)}>
        {status === 'loading' ? <View style={styles.listState}><ActivityIndicator accessibilityLabel="Loading completed days" color={colors.primary} /></View> : null}
        {status === 'error' ? (
          <View style={[styles.listState, styles.errorState]}>
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
          <View style={styles.listState}>
            <Text style={styles.bodyText}>No completed days yet.</Text>
            <Text style={styles.mutedText}>Your history will appear after CalorieBank receives a complete day of burn and food data.</Text>
          </View>
        ) : null}
        {status === 'ready' && period?.grouped ? period.buckets.map(bucket => (
          <Pressable key={bucket.id} accessibilityRole="button" accessibilityLabel={`${bucket.label}, ${bucket.total === null ? 'Not calculated' : formatCalories(bucket.total)}`} accessibilityState={{ expanded: expandedPeriod === bucket.id }} accessibilityHint="Shows the days included in this total." onPress={() => { detailRequest.current++; closeSourcePicker(); setSourceOptions(null); setExpandedPeriod(expandedPeriod === bucket.id ? null : bucket.id); setSelectedDay(null); setSelectedLogDate(null); setDetailStatus('idle'); }} style={({ pressed }) => [styles.dayRow, stackDayRows && styles.stackedDayRow, expandedPeriod === bucket.id && styles.selectedDayRow, pressed && styles.pressedRow]}>
            <View style={styles.dayIdentity}>
              <Text style={styles.dayDate}>{bucket.label}</Text>
              <Text style={styles.mutedText}>{bucket.items.filter(item => item.kind === 'calculated').length} completed days{bucket.missingCount ? ` · ${bucket.missingCount} missing` : ''}</Text>
            </View>
            <Text style={[styles.dayChange, (bucket.total ?? 0) < 0 && styles.enjoyedText]}>{bucket.total === null ? 'Not calculated' : formatCalories(bucket.total)}</Text>
            <Ionicons name={expandedPeriod === bucket.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
          </Pressable>
        )) : null}
        {status === 'ready' && period?.visible.length === 0 ? <View style={styles.listState}><Text style={styles.mutedText}>No completed days in this period.</Text></View> : null}
        {status === 'ready' && expandedPeriod ? <Text style={styles.expandedHeading}>{period?.buckets.find(bucket => bucket.id === expandedPeriod)?.label} · Days</Text> : null}
        {status === 'ready'
          ? visibleItems.map((item) => {
              if (item.kind === 'missing') {
                return (
                  <Pressable
                    accessibilityHint={item.day.canRetry ? 'Shows why this day is missing and offers retry.' : 'Shows why this day is missing.'}
                    accessibilityLabel={`${item.day.logDate}, ${item.day.message}`}
                    accessibilityRole="button"
                    key={item.day.logDate}
                    onPress={() => showMissingDay(item.day)}
                    style={({ pressed }) => [styles.dayRow, stackDayRows && styles.stackedDayRow, pressed && styles.pressedRow]}
                  >
                    <View style={[styles.dayIdentity, stackDayRows && styles.stackedDayIdentity]}>
                      <Text style={styles.dayDate}>{historyDateLabel(item.day.logDate, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                      <Text style={styles.missingDayText}>{item.day.message}</Text>
                    </View>
                    <Ionicons style={stackDayRows ? styles.stackedDayIndicator : undefined} accessibilityElementsHidden importantForAccessibility="no" name="information-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                );
              }
              const day = item.day;
              const selected = selectedLogDate === day.logDate;
              return (
                <Pressable
                  accessibilityHint="Loads bank details for this completed day."
                  accessibilityLabel={`${day.logDate}, ${contributionVerb(day.dailyBankChange)}, ${formatCalories(day.dailyBankChange)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={day.logDate}
                  onPress={() => void handleSelectDay(day.logDate)}
                  style={({ pressed }) => [styles.dayRow, stackDayRows && styles.stackedDayRow, selected && styles.selectedDayRow, pressed && styles.pressedRow]}
                >
                  <View style={[styles.dayIdentity, stackDayRows && styles.stackedDayIdentity]}>
                    <Text style={styles.dayDate}>{historyDateLabel(day.logDate, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    <Text style={[styles.dayOutcome, day.dailyBankChange < 0 && styles.enjoyedText]}>{contributionVerb(day.dailyBankChange)}</Text>
                  </View>
                  <View style={[styles.dayAmount, stackDayRows && styles.stackedDayAmount]}>
                    <Text style={[styles.dayChange, stackDayRows && styles.stackedDayChange, day.dailyBankChange < 0 && styles.enjoyedText, day.dailyBankChange === 0 && styles.neutralText]}>
                      {formatCalories(day.dailyBankChange)}
                    </Text>
                  </View>
                  <Ionicons style={stackDayRows ? styles.stackedDayIndicator : undefined} accessibilityElementsHidden importantForAccessibility="no" name="chevron-forward" size={16} color={selected ? '#176C65' : '#7D8987'} />
                </Pressable>
              );
            })
          : null}
        </FrostedView>
      </View>

      {selectedLogDate && visibleItems.some(item => item.day.logDate === selectedLogDate) ? <FrostedView style={styles.breakdownPanel}>
        <Text style={styles.sectionTitle}>Day details</Text>
        {detailStatus === 'idle' ? <Text style={styles.mutedText}>Select a completed day.</Text> : null}
        {detailStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {detailStatus === 'error' ? <Text style={styles.errorText}>That day detail is unavailable.</Text> : null}
        {detailStatus === 'ready' && selectedDay ? (
          <>
            <Text style={styles.dayTitle}>{formatDate(selectedDay.logDate)}</Text>
            <Text style={[styles.changeText, selectedDay.dailyBankChange < 0 && styles.enjoyedText, selectedDay.dailyBankChange === 0 && styles.neutralText]}>
              {contributionVerb(selectedDay.dailyBankChange)} {Math.abs(selectedDay.dailyBankChange).toLocaleString()} kcal
            </Text>
            {selectedDay.status === 'provisional' ? (
              <Text style={styles.mutedText}>May still update as your source syncs.</Text>
            ) : null}

            <View style={styles.breakdownRows}>
              <DetailRow
                tone="burned"
                label={`${sourceOptions?.expenditure.selected.label
                  ?? getConsumerSourceName(selectedDay.versions.at(-1)?.expenditureProvider)} burn`}
                value={`${selectedDay.importedTotalDailyExpenditure.toLocaleString()} kcal`}
              />
              <DetailRow
                tone="burned"
                label="Estimated actual burn"
                value={`× ${Number(selectedDay.expenditureAdjustmentRate.toFixed(2))} = ${selectedDay.adjustedExpenditure.toLocaleString()} kcal`}
              />
              <DetailRow label="Goal" value={goalAdjustmentText(selectedDay)} />
              <View style={styles.eatenRow}>
                <View style={styles.eatenValue}><DetailRow label="Eaten" tone="eaten" value={`${selectedDay.importedCalorieIntake.toLocaleString()} kcal`} /></View>

              </View>
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
                    <Text style={[styles.mutedText, styles.sourceLabel]}>
                      Calories burned · {sourceLabel(sourceOptions?.expenditure.selected.label
                        ?? getConsumerSourceName(selectedDay.versions.at(-1)!.expenditureProvider))}
                    </Text>
                    {sourceOptions?.expenditure.canChange ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Change calories burned source" onPress={() => openSourcePicker('expenditure')} style={styles.changeSourceButton}>
                        <Text style={styles.changeSourceText}>Change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.sourceRow}>
                    <Text style={[styles.mutedText, styles.sourceLabel]}>
                      Calories eaten · {sourceLabel(sourceOptions?.intake.selected.label
                        ?? selectedDay.versions.at(-1)!.intakeSourceDisplayName
                        ?? getConsumerSourceName(selectedDay.versions.at(-1)!.intakeProvider))}
                    </Text>
                    {sourceOptions?.intake.canChange && trackerChoices(sourceOptions.intake.options.filter((option) => option.id !== sourceOptions.intake.selected.id), sourceOptions.intake.selected).length > 1 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Change calories eaten source" onPress={() => openSourcePicker('intake')} style={styles.changeSourceButton}>
                        <Text style={styles.changeSourceText}>Change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </>
        ) : null}
      </FrostedView> : null}

      <Modal
        animationType="fade"
        onRequestClose={closeSourcePicker}
        transparent
        visible={sourcePickerRole !== null}
      >
        <Pressable accessibilityRole="button" onPress={closeSourcePicker} style={styles.modalBackdrop}>
          <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.sourceSheet}>
            <Text style={styles.sourceSheetTitle}>
              {sourcePickerRole === 'expenditure' ? 'Calories burned' : 'Calories eaten'}
            </Text>
            {sourcePickerRole ? sourceOptions && trackerChoices(sourceOptions[sourcePickerRole].options.filter((option) => option.id !== sourceOptions[sourcePickerRole].selected.id), sourceOptions[sourcePickerRole].selected).map((option) => {
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
                  <Text style={styles.sourceOptionText}>{sourceLabel(option.label)}</Text>
                  {sourceMutationStatus === 'saving' && !selected ? <ActivityIndicator color={colors.primary} /> : null}
                </Pressable>
              );
            }) : null}
            {sourceMutationStatus === 'error' && sourceMutationMessage
              ? <Text style={styles.errorText}>{sourceMutationMessage}</Text>
              : null}
            <Pressable accessibilityRole="button" onPress={closeSourcePicker} style={styles.cancelButton}>
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
    ...compactGlassCard,
    gap: 10,
    borderColor: '#DCEBE3',
    backgroundColor: '#EDF6F1',
    padding: 22,
  },
  heroHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroLabel: {
    flex: 1,
    color: '#246B5B',
    fontSize: typography.body,
    fontWeight: '600',
  },
  heroValue: {
    color: '#17483C',
    fontSize: 36,
    letterSpacing: -1,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  heroUnavailable: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  heroDetail: {
    color: '#61776E',
    fontSize: 14,
    lineHeight: 20,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    backgroundColor: '#E7ECEB',
    padding: 4,
  },
  recoverySummary: {
    ...compactGlassCard,
    gap: spacing.sm,
    padding: 18,
  },
  recoveryValue: {
    color: '#56636C',
    fontSize: 22,
    fontWeight: '700',
  },
  rangeButton: {
    minHeight: 44,
    minWidth: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: spacing.sm,
  },
  selectedRangeButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#254B40',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rangeText: {
    color: '#616D6B',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedRangeText: {
    color: '#176C65',
    fontWeight: '800',
  },
  periodPanel: { ...compactGlassCard, padding: 20, gap: 12 },
  periodHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodNavigation: { flexDirection: 'row' },
  periodArrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  periodChart: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingTop: 8 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  chartTrack: { height: 60, justifyContent: 'flex-end', width: '100%', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#B9C9C2' },
  chartNegativeTrack: { height: 60, width: '100%', alignItems: 'center' },
  chartLegend: { color: colors.textMuted, fontSize: 12 },
  chartBar: { width: '75%', maxWidth: 24, borderRadius: 6 },
  chartLabel: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 6, width: 44 },
  expandedHeading: { padding: 16, color: colors.primary, fontWeight: '700' },
  timelinePanel: {
    gap: 12,
  },
  dayList: {
    ...compactGlassCard,
    padding: 0,
    overflow: 'hidden',
  },
  listState: {
    gap: spacing.sm,
    padding: 20,
  },
  dayRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEEC',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  stackedDayRow: { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingRight: 38 },
  stackedDayIndicator: { position: 'absolute', right: 16, top: 18 },
  stackedDayIdentity: { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  stackedDayAmount: { alignItems: 'flex-start', width: '100%' },
  stackedDayChange: { textAlign: 'left' },
  selectedDayRow: {
    borderLeftColor: '#176C65',
    backgroundColor: '#EAF4F1',
  },
  pressedRow: {
    backgroundColor: '#E0EDE9',
  },
  dayIdentity: {
    flex: 1,
    gap: 5,
  },
  dayDate: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  dayOutcome: {
    color: '#64736F',
    fontSize: typography.caption,
    lineHeight: 18,
  },
  dayAmount: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  dayChange: {
    color: '#176C65',
    fontSize: typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  enjoyedText: {
    color: '#70558D',
  },
  neutralText: {
    color: '#626D69',
  },
  burnedText: {
    color: '#A45B1F',
  },
  eatenText: {
    color: '#345FAD',
  },
  missingDayText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  breakdownPanel: {
    ...compactGlassCard,
    gap: 12,
    padding: 20,
  },
  sectionTitle: {
    color: '#465650',
    fontSize: typography.body,
    fontWeight: '700',
  },
  dayTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  changeText: {
    color: '#176C65',
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  breakdownRows: {
    gap: 14,
    paddingVertical: spacing.sm,
  },
  detailNotes: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#E1E8E5',
    paddingTop: spacing.md,
  },
  sourceRow: {
    minHeight: 44,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sourceLabel: {
    flex: 1,
  },
  changeSourceButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeSourceText: {
    color: '#176C65',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: spacing.md,
  },
  sourceSheet: {
    ...compactGlassCard,
    gap: spacing.sm,
    backgroundColor: '#F7F9F8',
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
  eatenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eatenValue: { flex: 1 },
  editButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF2FB', borderRadius: 12 },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailLabel: {
    flexBasis: '48%',
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
  },
  compactMath: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
    backgroundColor: '#F0F4F2',
    borderRadius: 12,
    padding: 12,
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
