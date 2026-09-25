import {
  formatGoalAdjustmentMagnitude,
  getGoalModeLabel,
  type BankSummaryResponse,
  type GoalConfigurationResponse,
  type PlannedTreatGetResponse,
  type TodayResponse,
  type DashboardPreferencesResponse,
  type ProviderSelectionResponse,
  type OnboardingStatusResponse,
} from '@caloriebank/schemas';
import { Ionicons } from '@expo/vector-icons';
import { currentDateSnapshot } from '@/lib/today/current-date';
import { subscribeToLocalDateChange } from '@/lib/today/local-date-change';
import { Link, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  fetchBankSummary,
  fetchDashboardPreferences,
  fetchGoalConfiguration,
  fetchOnboardingStatus,
  fetchPlannedTreat,
  fetchProviderSelection,
  fetchToday,
  getApiBaseUrl,
} from '@/lib/api/client';
import { isAccountLifecycleRunning, runAccountLifecycle, subscribeToAccountLifecycle, subscribeToAccountLifecycleActivity } from '@/lib/lifecycle/account-lifecycle';
import { CompletedContribution } from '@/components/caloriebank/CompletedContribution';
import {
  emptyTodayDetail,
  emptyTodayValue,
  firstRunTodayEmptyState,
  needsConnectionRecovery,
  formatStepContributions,
  formatWorkoutCalorieLines,
  hasLatestCompletedContribution,
  hasUsableBankSummary,
  completedContributionSentence,
} from '@/lib/today/presentation';
import { getConsumerSourceName } from '@/lib/providers/presentation';

function formatBankBalance(value: number) {
  return `${value.toLocaleString()} kcal`;
}

function formatDisplayDate(dateString: string | null | undefined) {
  if (!dateString) return 'No completed days yet';

  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatGoalDetail(configuration: GoalConfigurationResponse | null) {
  if (!configuration) return 'Complete setup to choose your goal.';
  if (configuration.goalMode === 'maintain') return 'No daily adjustment';

  const adjustment = formatGoalAdjustmentMagnitude(configuration);
  const direction = configuration.goalMode === 'cut' ? 'daily deficit' : 'daily surplus';
  return `${adjustment} ${direction}`;
}

function latestResultLabel(summary: BankSummaryResponse | null) {
  if (!summary?.latestCompletedDate) return 'Latest completed';

  const [year, month, day] = summary.latestCompletedDate.split('-').map(Number);
  if (!year || !month || !day) return 'Latest completed';

  const latest = new Date(year, month - 1, day);
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  return latest.getTime() === yesterday.getTime() ? 'Yesterday' : 'Latest completed';
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRelativeSyncTime(value: string | null | undefined) {
  if (!value) return 'Not synced yet';

  const syncedAt = new Date(value).getTime();
  if (!Number.isFinite(syncedAt)) return 'Sync time unavailable';

  const minutes = Math.max(0, Math.round((Date.now() - syncedAt) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes === 1) return 'Updated 1 minute ago';
  if (minutes < 60) return `Updated ${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'Updated 1 hour ago' : `Updated ${hours} hours ago`;
}

function latestSyncTime(today: TodayResponse | null) {
  const times = [today?.burned.lastSyncedAt, today?.eaten.lastSyncedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (times.length === 0) return null;

  return new Date(Math.max(...times)).toISOString();
}

function isActivePlannedTreat(
  plannedTreat: PlannedTreatGetResponse | null,
): plannedTreat is Exclude<PlannedTreatGetResponse, { status: 'no_plan' }> {
  return plannedTreat !== null && plannedTreat.status !== 'no_plan';
}

export default function TodayScreen() {
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  const [bankSummary, setBankSummary] = useState<BankSummaryResponse | null>(null);
  const [bankStatus, setBankStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [goalConfiguration, setGoalConfiguration] = useState<GoalConfigurationResponse | null>(null);
  const [configurationStatus, setConfigurationStatus] =
    useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [plannedTreat, setPlannedTreat] = useState<PlannedTreatGetResponse | null>(null);
  const [plannedTreatStatus, setPlannedTreatStatus] =
    useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [storedToday, setToday] = useState<TodayResponse | null>(null);
  const [storedTodayStatus, setTodayStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const today = currentDateSnapshot(storedToday);
  const todayStatus = storedTodayStatus === 'error'
    ? today ? 'ready' : 'error'
    : storedToday && !today ? 'loading' : storedTodayStatus;
  const [providerSelection, setProviderSelection] = useState<ProviderSelectionResponse | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [firstRunCheckPending, setFirstRunCheckPending] = useState(false);
  const [healthSyncDetail, setHealthSyncDetail] = useState<string | null>(null);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [showWhyEighty, setShowWhyEighty] = useState(false);
  const readGeneration = useRef(0);

  const [dashboardPreferences, setDashboardPreferences] =
    useState<DashboardPreferencesResponse | null>(null);

  const refreshVisibleReadModels = useCallback(async () => {
    const generation = ++readGeneration.current;
    setTodayStatus((current) => current === 'error' ? 'loading' : current);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [summaryResult, todayResult, providerResult] = await Promise.allSettled([
      fetchBankSummary(),
      fetchToday(timezone),
      fetchProviderSelection(),
    ]);
    if (generation !== readGeneration.current) return;
    if (summaryResult.status === 'fulfilled') {
      setBankSummary(summaryResult.value);
      setBankStatus(summaryResult.value.openingBankStatus === 'initialized' ? 'ready' : 'empty');
    }
    if (todayResult.status === 'fulfilled') {
      setToday(todayResult.value);
      setTodayStatus(todayResult.value.burned.adjusted === null && todayResult.value.eaten.calories === null ? 'unavailable' : 'ready');
    } else {
      setTodayStatus('error');
    }
    if (providerResult.status === 'fulfilled') setProviderSelection(providerResult.value);
  }, []);

  useEffect(() => subscribeToAccountLifecycleActivity((running) => {
    setFirstRunCheckPending(running);
    if (running) setHealthSyncDetail(null);
  }), []);

  useEffect(() => subscribeToAccountLifecycle((result) => {
    setHealthSyncDetail(result.detail);
    void Promise.all([refreshVisibleReadModels(), fetchOnboardingStatus().then(setOnboardingStatus).catch(() => null)]);
  }), [refreshVisibleReadModels]);

  useEffect(() => subscribeToLocalDateChange(() => {
    setToday(null);
    setTodayStatus('loading');
    void refreshVisibleReadModels();
  }), [refreshVisibleReadModels]);

  const refreshHealthAwareness = useCallback(async (
    force: boolean,
  ) => {
    try {
      setRefreshingHealth(force);
      setHealthSyncDetail(null);
      const result = await runAccountLifecycle({ force });
      setHealthSyncDetail(result.detail);
      await refreshVisibleReadModels();
    } catch {
      setHealthSyncDetail('Today’s health data could not refresh.');
    } finally {
      setRefreshingHealth(false);
    }
  }, [refreshVisibleReadModels]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadToday() {
        const generation = ++readGeneration.current;
        const apiBaseUrl = getApiBaseUrl();

        if (!apiBaseUrl) {
          setConfigurationStatus('error');
          setBankStatus('error');
          setPlannedTreatStatus('error');
          setTodayStatus('error');
          return;
        }

        setConfigurationStatus('loading');
        setPlannedTreatStatus('loading');
        setFirstRunCheckPending(isAccountLifecycleRunning());
        const [configurationResult, bankSummaryResult, plannedTreatResult, todayResult, preferencesResult, providerResult, onboardingResult] = await Promise.allSettled([
          fetchGoalConfiguration(),
          fetchBankSummary(),
          fetchPlannedTreat(),
          fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
          fetchDashboardPreferences(),
          fetchProviderSelection(),
          fetchOnboardingStatus(),
        ]);
        if (!isMounted) return;

        if (configurationResult.status === 'fulfilled') {
          const savedConfiguration = configurationResult.value;
          setGoalConfiguration(savedConfiguration);
          setConfigurationStatus(savedConfiguration ? 'ready' : 'missing');
        } else {
          setGoalConfiguration(null);
          setConfigurationStatus('error');
        }

        if (generation === readGeneration.current && bankSummaryResult.status === 'fulfilled') {
          setBankSummary(bankSummaryResult.value);
          setBankStatus(
            bankSummaryResult.value.openingBankStatus === 'initialized' ? 'ready' : 'empty',
          );
        } else if (generation === readGeneration.current) {
          setBankStatus((current) => current === 'ready' ? current : 'error');
        }

        if (plannedTreatResult.status === 'fulfilled') {
          setPlannedTreat(plannedTreatResult.value);
          setPlannedTreatStatus(plannedTreatResult.value.status === 'no_plan' ? 'empty' : 'ready');
        } else {
          setPlannedTreat(null);
          setPlannedTreatStatus('error');
        }

        if (generation === readGeneration.current && todayResult.status === 'fulfilled') {
          setToday(todayResult.value);
          setTodayStatus(
            todayResult.value.burned.adjusted === null && todayResult.value.eaten.calories === null
              ? 'unavailable'
              : 'ready',
          );
        } else if (generation === readGeneration.current) {
          setTodayStatus('error');
        }

        if (preferencesResult.status === 'fulfilled') {
          setDashboardPreferences(preferencesResult.value);
        }
        if (generation === readGeneration.current && providerResult.status === 'fulfilled') setProviderSelection(providerResult.value);
        if (onboardingResult.status === 'fulfilled') setOnboardingStatus(onboardingResult.value);

      }

      void loadToday();
      return () => {
        isMounted = false;
      };
    }, []),
  );

  const hasCompletedDays = hasLatestCompletedContribution(bankSummary);
  const hasInitializedBank = hasUsableBankSummary(bankSummary);
  const historyPreparationPending = onboardingStatus?.completed === true &&
    onboardingStatus.preparation.history === 'preparing';
  const firstRunIntakeState = firstRunTodayEmptyState({
    checking: firstRunCheckPending && today?.eaten.calories == null,
    source: providerSelection?.intake.displayName ?? null,
    noun: 'intake',
  });
  const firstRunBurnState = firstRunTodayEmptyState({
    checking: firstRunCheckPending && today?.burned.adjusted == null,
    source: providerSelection?.expenditure.displayName ?? null,
    noun: 'burn data',
  });
  const bankValue =
    hasInitializedBank && bankSummary
      ? formatBankBalance(bankSummary.availableBankCalories)
      : bankStatus === 'loading'
        ? 'Loading...'
        : historyPreparationPending
          ? 'Setting up…'
        : bankStatus === 'error'
          ? 'Unavailable'
          : 'Not calculated';
  const throughText = bankSummary?.latestCompletedDate
    ? `Calculated through ${formatDisplayDate(bankSummary.latestCompletedDate)}`
    : hasInitializedBank
      ? 'Waiting for a complete day'
    : historyPreparationPending
      ? 'Checking recent days…'
    : bankStatus === 'error'
      ? 'Try again later'
      : 'Waiting for a full day of calorie data';
  const latestChangeValue =
    hasCompletedDays && bankSummary && bankSummary.latestDailyBankChange !== null
      ? completedContributionSentence(bankSummary.latestDailyBankChange, latestResultLabel(bankSummary) === 'Yesterday' ? 'yesterday' : `on ${formatDisplayDate(bankSummary.latestCompletedDate!)}`)
      : bankStatus === 'loading'
        ? 'Loading...'
        : historyPreparationPending
          ? 'Checking recent days…'
        : bankStatus === 'error'
          ? 'Unavailable'
          : 'No completed day yet';
  const currentGoalValue =
    configurationStatus === 'loading'
      ? 'Loading...'
      : goalConfiguration
        ? getGoalModeLabel(goalConfiguration.goalMode)
        : configurationStatus === 'error'
          ? 'Unavailable'
          : 'Not set';
  const activePlannedTreat = isActivePlannedTreat(plannedTreat) ? plannedTreat : null;
  const plannedTreatAccessibility =
    plannedTreatStatus === 'loading'
      ? 'Banking Goal, loading'
      : activePlannedTreat
        ? `Banking Goal, ${activePlannedTreat.name}, ${activePlannedTreat.progressPercent} percent ready`
        : plannedTreatStatus === 'error'
          ? 'Banking Goal, unavailable'
          : 'Banking Goal. Example: Crumbl cookies, 5,000 calories. Create a Banking Goal';
  const burnedValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : firstRunBurnState
        ? firstRunBurnState.value
      : today?.burned.adjusted !== null && today?.burned.adjusted !== undefined
        ? `${today.burned.adjusted.toLocaleString()} kcal`
        : emptyTodayValue(today?.burned.status ?? 'unavailable', 'burn data');
  const eatenValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : firstRunIntakeState
        ? firstRunIntakeState.value
      : today?.eaten.calories !== null && today?.eaten.calories !== undefined
        ? `${today.eaten.calories.toLocaleString()} kcal`
        : emptyTodayValue(today?.eaten.status ?? 'unavailable', 'intake');
  const burnedDetail = firstRunBurnState
    ? firstRunBurnState.detail
    : today?.burned.raw !== null && today?.burned.raw !== undefined && today.burned.source
      ? `${today.burned.raw.toLocaleString()} from ${getConsumerSourceName(today.burned.source)} × ${formatPercent(today.burned.adjustmentFactor)}`
      : emptyTodayDetail(today?.burned.status ?? 'unavailable', today?.burned.source ?? providerSelection?.expenditure.displayName ?? null, 'calories burned');
  const eatenDetail = today?.eaten.authoritative?.semanticKind === 'estimated_total_day_intake'
    ? today.eaten.estimateKind === 'today' ? 'Your estimate for today' : 'Your daily estimate'
    : firstRunIntakeState
    ? firstRunIntakeState.detail
    : today?.eaten.source
    ? `Imported from ${getConsumerSourceName(today.eaten.source)}`
    : emptyTodayDetail(today?.eaten.status ?? 'unavailable', providerSelection?.intake.displayName ?? null, 'calories eaten');
  const visibleCards = dashboardPreferences ?? {
    showLatestFinalizedContribution: true,
    showTodaySoFar: true,
    showPlannedTreat: false,
    showSteps: false,
    showWorkouts: false,
    showCurrentGoal: false,
    updatedAt: new Date(0).toISOString(),
  };
  const stepsValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : today?.steps.count === null || today?.steps.count === undefined
        ? emptyTodayValue(today?.steps.status ?? 'unavailable', 'steps')
        : today.steps.count.toLocaleString();
  const stepsEstimate = today?.steps.estimationStatus === 'ready' &&
      today.steps.estimatedContributionCalories !== null &&
      today.steps.currentAdjustedContributionCalories !== null &&
      today.burned.raw !== null &&
      today.burned.adjusted !== null
    ? formatStepContributions({
      providerContributionCalories: today.steps.estimatedContributionCalories,
      actualContributionCalories: today.steps.currentAdjustedContributionCalories,
      providerTotalBurnCalories: today.burned.raw,
      actualTotalBurnCalories: today.burned.adjusted,
      burnSource: today.burned.source,
    })
    : null;
  const stepsEstimateFallback = !stepsEstimate &&
      today?.steps.count !== null && today?.steps.count !== undefined
    ? 'Walking calorie estimate unavailable'
    : null;
  const stepsAccessibility = stepsEstimate
    ? `${stepsEstimate.providerContribution}, ${stepsEstimate.providerContext}. ${stepsEstimate.actualContribution}, ${stepsEstimate.actualContext}`
    : stepsEstimateFallback;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshingHealth}
            tintColor={colors.primary}
            onRefresh={() => void refreshHealthAwareness(true)}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.mark}>
            <Text style={styles.markText}>CB</Text>
          </View>
          <Text style={styles.wordmark}>CalorieBank</Text>
        </View>

          <Pressable
            onPress={() => router.push('/history')}
            accessibilityHint="Opens Bank History."
            accessibilityLabel={`Available Bank, ${bankValue}, ${throughText}${visibleCards.showLatestFinalizedContribution ? `, ${latestChangeValue}` : ''}${bankSummary?.recoveryCalories ? `, Recovery, ${bankSummary.recoveryCalories} calories to recover` : ''}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroCard, pressed && styles.pressedCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Available Bank</Text>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </View>
            {hasInitializedBank && bankSummary ? <View style={styles.bankAmountRow}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.bankValue}>{bankSummary.availableBankCalories.toLocaleString()}</Text>
              <Text style={styles.bankUnit}>kcal</Text>
            </View> : <Text style={styles.bankValue}>{bankValue}</Text>}
            <Text style={styles.supportingText}>{throughText}</Text>
            {visibleCards.showLatestFinalizedContribution ? <CompletedContribution sentence={latestChangeValue} /> : null}
            {bankStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          </Pressable>

        {bankSummary && bankSummary.recoveryCalories > 0 ? (
          <View accessibilityRole="summary" style={styles.recoverySurface}>
            <Text style={styles.recoveryLabel}>Recovery</Text>
            <Text style={styles.recoveryValue}>
              {bankSummary.recoveryCalories.toLocaleString()} kcal to recover
            </Text>
            <Text style={styles.supportingText}>New deposits will restore your bank first.</Text>
          </View>
        ) : null}

        {(
          <Pressable
            accessibilityHint="Opens Banking Goal setup."
            accessibilityLabel={plannedTreatAccessibility}
            accessibilityRole="button"
            onPress={() => router.push('/planned-treat')}
            style={({ pressed }) => [
              styles.secondaryCard,
              styles.plannedTreatCard,
              pressed && styles.pressedCard,
            ]}
          >
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>Banking Goal</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
              {plannedTreatStatus === 'loading' ? (
                <View style={styles.inlineState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.supportingText}>Loading your plan.</Text>
                </View>
              ) : activePlannedTreat ? (
                <>
                  <View style={styles.treatTitleRow}>
                    <Text adjustsFontSizeToFit numberOfLines={3} style={styles.treatName}>
                      {activePlannedTreat.name}
                    </Text>
                    {activePlannedTreat.status === 'ready' ? (
                      <Text style={styles.readyBadge}>Ready</Text>
                    ) : null}
                  </View>
                  <Text style={styles.supportingText}>
                    {activePlannedTreat.progressCalories.toLocaleString()} /{' '}
                    {activePlannedTreat.requiredCalories.toLocaleString()} kcal
                  </Text>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.progressTrack}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(activePlannedTreat.progressPercent, 2)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.supportingText}>
                    {activePlannedTreat.status === 'ready'
                      ? 'Your Available Bank has reached this goal'
                      : `${activePlannedTreat.progressPercent}% ready · ${activePlannedTreat.remainingCalories.toLocaleString()} kcal to go`}
                  </Text>
                </>
              ) : plannedTreatStatus === 'error' ? (
                <>
                  <Text style={styles.secondaryValue}>Unavailable</Text>
                  <Text style={styles.supportingText}>Your plan could not load. Try again later.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.treatName}>Bank for something you love.</Text>
                  <Text accessibilityLabel="Example Banking Goal: Crumbl cookies, 5,000 calories" style={styles.supportingText}>Example: Crumbl cookies · 5,000 kcal</Text>
                  <Text style={styles.retryButtonText}>Create a Banking Goal</Text>
                </>
              )}
          </Pressable>
        )}

        {visibleCards.showTodaySoFar ? <Pressable
          accessibilityHint="Opens today's burn details."
          accessibilityLabel={`Today so far. Burned ${burnedValue}. Eaten ${eatenValue}.`}
          accessibilityRole="button"
          onPress={() => router.push('/today-burn')}
          style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressedCard]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Today so far</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
          {todayStatus === 'loading' ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.supportingText}>Loading today’s data…</Text>
            </View>
          ) : todayStatus === 'error' ? (
            <>
              <Text style={styles.secondaryValue}>Unavailable</Text>
              <Text style={styles.supportingText}>{healthSyncDetail ?? 'Today’s values could not refresh.'}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  void refreshHealthAwareness(true);
                }}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressedCard]}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.todayMetrics, fontScale > 1.3 && { flexDirection: 'column' }]}>
                <View style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Burned</Text>
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.metricValue}>
                    {burnedValue}
                  </Text>
                  <View style={styles.burnDetailRow}>
                    <Text style={[styles.metricDetail, styles.burnDetail]}>{burnedDetail}</Text>
                    <Pressable
                      accessibilityHint="Opens a short explanation without leaving Today."
                      accessibilityLabel="Why does CalorieBank use 80 percent?"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        setShowWhyEighty(true);
                      }}
                      style={({ pressed }) => [styles.whyButton, pressed && styles.pressedCard]}
                    >
                      <Text style={styles.whyButtonText}>Why 80%?</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Eaten</Text>
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.metricValue}>{eatenValue}</Text>
                  <Text style={styles.metricDetail}>{eatenDetail}</Text>
                  {today?.eaten.authoritative?.source === 'manual_estimate' ? <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Calories eaten, ${today.eaten.calories ?? 0} kilocalories, ${eatenDetail.toLowerCase()}. Edit.`}
                    onPress={(event) => { event.stopPropagation(); router.push({ pathname: '/manual-estimate', params: { mode: 'today' } }); }}
                    style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' }}
                  ><Ionicons name="pencil-outline" size={20} color={colors.primary} /></Pressable> : null}
                </View>
              </View>
              <Text style={styles.supportingText}>{formatRelativeSyncTime(latestSyncTime(today))}</Text>
              {!firstRunCheckPending && needsConnectionRecovery(providerSelection) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push('/integrations');
                  }}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressedCard]}
                >
                  <Text style={styles.retryButtonText}>Review Health Connections</Text>
                </Pressable>
              ) : null}
              {!firstRunCheckPending && healthSyncDetail ? <Text style={styles.supportingText}>{healthSyncDetail}</Text> : null}
            </>
          )}
        </Pressable> : null}

        {visibleCards.showCurrentGoal ?
          <Pressable
            onPress={() => router.push('/goal-settings')}
            accessibilityHint="Opens Fitness Goal."
            accessibilityLabel={`Fitness Goal, ${currentGoalValue}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressedCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Fitness Goal</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryValue}>
              {currentGoalValue}
            </Text>
            <Text style={styles.supportingText}>{formatGoalDetail(goalConfiguration)}</Text>
          </Pressable>
        : null}

        {visibleCards.showSteps ? (
          <Pressable
            accessibilityHint="Opens step contribution and what-if details."
            accessibilityLabel={`Steps today, ${stepsValue}${stepsAccessibility ? `. ${stepsAccessibility}` : ''}`}
            accessibilityRole="button"
            onPress={() => router.push('/steps-detail')}
            style={({ pressed }) => [
              styles.secondaryCard,
              pressed && styles.pressedCard,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Steps today</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryValue}>
              {stepsValue}
            </Text>
            {stepsEstimate ? (
              <View style={styles.stepEstimates}>
                <View style={styles.stepEstimateGroup}>
                  <Text style={styles.stepEstimateValue}>{stepsEstimate.providerContribution}</Text>
                  <Text style={styles.stepEstimateLabel}>{stepsEstimate.providerContext}</Text>
                </View>
                <View style={styles.stepEstimateGroup}>
                  <Text style={styles.stepEstimateValue}>{stepsEstimate.actualContribution}</Text>
                  <Text style={styles.stepEstimateLabel}>{stepsEstimate.actualContext}</Text>
                </View>
              </View>
            ) : stepsEstimateFallback ? (
              <Text style={styles.supportingText}>{stepsEstimateFallback}</Text>
            ) : null}
            <Text style={styles.supportingText}>
              {today?.steps.source ? `${getConsumerSourceName(today.steps.source)} · ` : ''}
              {formatRelativeSyncTime(today?.steps.lastSyncedAt)}
            </Text>
          </Pressable>
        ) : null}

        {visibleCards.showWorkouts ? (
          <View style={styles.secondaryCard}>
            <Text style={styles.cardLabel}>Logged workouts</Text>
            {todayStatus === 'loading' ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.supportingText}>Loading workouts.</Text>
              </View>
            ) : today?.workouts.items.length ? (
              <>
                {today.workouts.items.slice(0, 3).map((workout) => (
                  <View key={workout.id} style={styles.workoutRow}>
                    <Text style={styles.workoutName}>
                      {workout.displayName} · {workout.durationMinutes} min
                    </Text>
                    {workout.totalEnergyBurned !== null ? (() => {
                      const lines = formatWorkoutCalorieLines({
                        totalSteps: workout.totalSteps,
                        rawCalories: workout.totalEnergyBurned,
                        adjustmentFactor: today.burned.adjustmentFactor,
                      });
                      return (
                        <>
                          <Text style={styles.supportingText}>{lines.reported}</Text>
                          <Text style={styles.supportingText}>{lines.estimated}</Text>
                        </>
                      );
                    })() : null}
                  </View>
                ))}
                {today.workouts.source ? (
                  <Text style={styles.supportingText}>Imported from {getConsumerSourceName(today.workouts.source)}</Text>
                ) : null}
                {today.workouts.totalCount > 3 ? (
                  <Link href={'/today-workouts' as Href} style={styles.inlineLink}>
                    View all workouts
                  </Link>
                ) : null}
              </>
            ) : (
              <Text style={styles.supportingText}>No workouts logged today</Text>
            )}
          </View>
        ) : null}

      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setShowWhyEighty(false)}
        transparent
        visible={showWhyEighty}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Why 80 percent explanation"
            onPress={() => setShowWhyEighty(false)}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityViewIsModal
            style={styles.whyModal}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Why 80%?</Text>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowWhyEighty(false)}
                style={({ pressed }) => [styles.modalClose, pressed && styles.pressedCard]}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalCopy}>
              CalorieBank’s founder trusted his watch burn during his cut but wasn’t losing weight.
            </Text>
            <Text style={styles.modalCopy}>
              After learning that watches can overestimate calories burned, he started using 80% of
              his watch burn — and started losing weight.
            </Text>
            <Text style={styles.modalCopy}>That’s why CalorieBank uses the 80% rule.</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  markText: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  wordmark: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  heroCard: {
    minHeight: 210,
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  secondaryCard: {
    minHeight: 132,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  recoverySurface: {
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recoveryLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  recoveryValue: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pressedCard: {
    opacity: 0.76,
  },
  retryButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
  },
  retryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  bankValue: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  bankAmountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs },
  bankUnit: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  secondaryValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  contributionValue: {
    color: colors.primaryDark,
    fontSize: 28,
  },
  supportingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  stepEstimates: {
    gap: spacing.md,
  },
  stepEstimateGroup: {
    gap: spacing.xs,
  },
  stepEstimateLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  stepEstimateValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  plannedTreatCard: {
    minHeight: 164,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  treatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  treatName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  readyBadge: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  progressTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  todayMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  todayMetric: {
    flex: 1,
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  burnDetailRow: { alignItems: 'flex-start', gap: spacing.xs },
  burnDetail: { flexShrink: 1 },
  whyButton: { minHeight: 44, justifyContent: 'center' },
  whyButtonText: { color: colors.primaryDark, fontSize: typography.caption, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 22, 0.42)',
    padding: spacing.lg,
  },
  whyModal: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  modalHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitle: { flex: 1, color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  modalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalCopy: { color: colors.text, fontSize: typography.body, lineHeight: 24 },
  workoutRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  workoutName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  inlineLink: {
    minHeight: 44,
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
});
