import { TodayActivityCards, canStickTodayActivityHeader } from '@/components/caloriebank/TodayStepsCard';
import { compactGlassCard } from '@/constants/card-surface';
import { FrostedView, FrostedPressable, FrostedScreen as SafeAreaView } from '@/components/caloriebank/FrostedSurface';
import {fetchEatingBudget,eatingBudgetEnabled} from '@/lib/api/eating-budget';
import {selectEatingBudget,selectProjectedEatingBudget,eatingBudgetReason} from '@/lib/today/eating-budget-guidance';
import { walkingPlanVisible } from '@/lib/today/walking-plan-visibility';
import { KeyboardSafeScrollView } from '@/components/caloriebank/KeyboardSafeScrollView';
import { WalkingEatingCard } from '@/components/caloriebank/WalkingEatingCard';
import { usePlanningClock } from '@/lib/today/use-planning-clock';
import { projectedBurnGuidance } from '@/lib/today/projected-burn-guidance';
import {
  type EatingBudgetResponse,
  type BankSummaryResponse,
  type GoalConfigurationResponse,
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
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  fetchBankSummary,
  fetchDashboardPreferences,
  fetchGoalConfiguration,
  fetchOnboardingStatus,
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
  formatWorkoutCalorieLines,
  hasLatestCompletedContribution,
  hasUsableBankSummary,
  completedContributionSentence,
} from '@/lib/today/presentation';
import { intakeAdjustmentDescription, getConsumerSourceName } from '@/lib/providers/presentation';

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

export default function TodayScreen() {
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  const [activityHeaderHeight, setActivityHeaderHeight] = useState(0);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    // iOS begins moving the keyboard before didShow; unpin early for focus scrolling.
    const willShow = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    return () => { show.remove(); hide.remove(); willShow.remove(); };
  }, []);
  const pinActivityHeader = canStickTodayActivityHeader(activityHeaderHeight, scrollViewportHeight, keyboardVisible);
  const [bankSummary, setBankSummary] = useState<BankSummaryResponse | null>(null);
  const [bankStatus, setBankStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [, setGoalConfiguration] = useState<GoalConfigurationResponse | null>(null);
  const [, setConfigurationStatus] =
    useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
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
  const [guidanceReadCurrent,setGuidanceReadCurrent]=useState(false);
  const [budget,setBudget]=useState<EatingBudgetResponse|null>(null);
  const budgetClock=usePlanningClock(today?.restOfDayProjection,budget?.budget.status!=='unavailable'?budget?.budget.expiresAt:undefined);

  const [dashboardPreferences, setDashboardPreferences] =
    useState<DashboardPreferencesResponse | null>(null);

  const refreshVisibleReadModels = useCallback(async () => {
    const generation = ++readGeneration.current;
    setGuidanceReadCurrent(false);setBudget(null);
    setTodayStatus((current) => current === 'error' ? 'loading' : current);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [summaryResult, todayResult, providerResult,budgetResult] = await Promise.allSettled([
      fetchBankSummary(),
      fetchToday(timezone),
      fetchProviderSelection(),fetchEatingBudget(timezone),
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
    setBudget(budgetResult.status==='fulfilled'?budgetResult.value:null);
    setGuidanceReadCurrent(todayResult.status==='fulfilled'&&providerResult.status==='fulfilled');
  }, []);

  useEffect(() => subscribeToAccountLifecycleActivity((running) => {
    setFirstRunCheckPending(running);
    if(running){setGuidanceReadCurrent(false);setBudget(null);}
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
      setGuidanceReadCurrent(false);setBudget(null);
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
        setGuidanceReadCurrent(false);setBudget(null);
        const apiBaseUrl = getApiBaseUrl();

        if (!apiBaseUrl) {
          setConfigurationStatus('error');
          setBankStatus('error');
          setTodayStatus('error');
          return;
        }

        setConfigurationStatus('loading');
        setFirstRunCheckPending(isAccountLifecycleRunning());
        const [configurationResult, bankSummaryResult, todayResult, preferencesResult, providerResult, onboardingResult,budgetResult] = await Promise.allSettled([
          fetchGoalConfiguration(),
          fetchBankSummary(),
          fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
          fetchDashboardPreferences(),
          fetchProviderSelection(),
          fetchOnboardingStatus(),fetchEatingBudget(Intl.DateTimeFormat().resolvedOptions().timeZone),
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
        if(generation===readGeneration.current)setBudget(budgetResult.status==='fulfilled'?budgetResult.value:null);
        if(generation===readGeneration.current)setGuidanceReadCurrent(todayResult.status==='fulfilled'&&providerResult.status==='fulfilled');
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
  const eatenDetail = (today ? intakeAdjustmentDescription(today.eaten) : null) ?? (today?.eaten.authoritative?.semanticKind === 'estimated_total_day_intake'
    ? today.eaten.estimateKind === 'today' ? 'Your estimate for today' : 'Your daily estimate'
    : firstRunIntakeState
    ? firstRunIntakeState.detail
    : today?.eaten.source
    ? `Imported from ${getConsumerSourceName(today.eaten.source)}`
    : emptyTodayDetail(today?.eaten.status ?? 'unavailable', providerSelection?.intake.displayName ?? null, 'calories eaten'));
  const visibleCards = dashboardPreferences ?? {
    showLatestFinalizedContribution: true,
    showTodaySoFar: true,
    showPlannedTreat: false,
    showSteps: false,
    showWorkouts: false,
    showCurrentGoal: false,
    updatedAt: new Date(0).toISOString(),
  };
  const {now:guidanceNow}=usePlanningClock(today?.restOfDayProjection);
  const guidanceAllowed=guidanceReadCurrent&&!refreshingHealth&&!firstRunCheckPending&&storedTodayStatus==='ready'&&providerSelection?.expenditure.status==='ready'&&!needsConnectionRecovery(providerSelection);
  const currentBudget=selectEatingBudget(today,budget,budgetClock.now,guidanceAllowed&&eatingBudgetEnabled);
  const projectedBurnAllowed=guidanceReadCurrent&&!refreshingHealth&&!firstRunCheckPending&&storedTodayStatus==='ready'&&providerSelection?.expenditure.status==='ready'&&providerSelection.expenditure.selected!==false;
  const projectedEstimate=selectProjectedEatingBudget(today,budget,budgetClock.now,projectedBurnAllowed&&eatingBudgetEnabled);
  const dailyBudget=projectedEstimate?.status==='ready'?projectedEstimate.totalCalories:budget?.projectedEstimate?null:currentBudget?.budget.status==='ready'?currentBudget.budget.totalCalories:null;
  const projectedBurn=projectedBurnGuidance(today,guidanceNow,projectedBurnAllowed);
  const showWalkingPlan=walkingPlanVisible(dashboardPreferences);
  const walkingGuidanceAllowed=guidanceAllowed&&providerSelection?.activityContext?.status==='ready';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardSafeScrollView
        contentContainerStyle={styles.container}
        stickyHeaderIndices={pinActivityHeader ? [0] : []}
        onLayout={event => setScrollViewportHeight(event.nativeEvent.layout.height)}
        refreshControl={
          <RefreshControl
            refreshing={refreshingHealth}
            tintColor={colors.primary}
            onRefresh={() => void refreshHealthAwareness(true)}
          />
        }
      >
        <View
          testID="today-sticky-activity-header"
          collapsable={false}
          onLayout={event => setActivityHeaderHeight(event.nativeEvent.layout.height)}
          style={styles.activityHeader}
        >
        <TodayActivityCards
          today={today}
          now={guidanceNow}
          restingAllowed={projectedBurnAllowed}
          walkingAllowed={projectedBurnAllowed && providerSelection?.activityContext?.status === 'ready'}
          pending={todayStatus === 'loading' || refreshingHealth}
          refreshFailed={storedTodayStatus === 'error'}
        />
        </View>

          <FrostedPressable
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
        {bankSummary && bankSummary.recoveryCalories > 0 ? (
          <View accessibilityRole="summary" style={styles.recoverySurface}>
            <Text style={styles.recoveryLabel}>Recovery</Text>
            <Text style={styles.recoveryValue}>
              {bankSummary.recoveryCalories.toLocaleString()} kcal to recover
            </Text>
            <Text style={styles.supportingText}>New deposits will restore your bank first.</Text>
          </View>
        ) : null}

          </FrostedPressable>

        {visibleCards.showTodaySoFar ? <FrostedPressable
          accessibilityHint="Opens today's burn details."
          accessibilityLabel={`Today so far. Burned ${burnedValue}. Eaten ${eatenValue}. Projected burn ${projectedBurn===null?'unavailable':`${projectedBurn.toLocaleString()} kilocalories estimated total today`}. Eating budget ${dailyBudget===null?'unavailable':`${dailyBudget.toLocaleString()} kilocalories estimated total today`}.`}
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
                  <View style={styles.metricHeader}><Text style={styles.metricLabel}>Burned</Text></View>
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
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricLabel}>Eaten</Text>
                    {today ? <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit calories eaten. ${today.eaten.calories ?? 0} kilocalories. ${eatenDetail}.`}
                      onPress={(event) => { event.stopPropagation(); router.push('/edit-calories'); }}
                      style={({ pressed }) => [styles.editEstimateButton, pressed && styles.pressedCard]}
                    ><Ionicons name="pencil" size={18} color={colors.primary} /></Pressable> : null}
                  </View>
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.metricValue}>{eatenValue}</Text>
                  <Text style={styles.metricDetail}>{eatenDetail}</Text>
                </View>
              </View>
              <View style={[styles.todayMetrics,fontScale>1.3&&{flexDirection:'column'}]}>
                <Pressable accessibilityRole="button" accessibilityHint="Opens today's burn estimate." onPress={event=>{event.stopPropagation();router.push('/today-burn');}} style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Projected burn</Text>
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.metricValue}>{projectedBurn===null?'Unavailable':`${projectedBurn.toLocaleString()} kcal`}</Text>
                  <Text style={styles.metricDetail}>Estimated total today</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Eating budget and planning" accessibilityHint="Opens your daily eating estimate and a hypothetical walking plan." onPress={event=>{event.stopPropagation();router.push('/eat-planning');}} style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Eating budget</Text>
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.metricValue}>{dailyBudget===null?'Unavailable':`${dailyBudget.toLocaleString()} kcal`}</Text>
                  <Text style={styles.metricDetail}>{dailyBudget===null?eatingBudgetReason(budget?.projectedEstimate?.status==='unavailable'?budget.projectedEstimate.reason:projectedEstimate?.status==='non_positive'?'non_positive_projected_budget':budget?.budget.status==='unavailable'?budget.budget.reason:null):'Estimated total intake today'}</Text>
                </Pressable>
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
        </FrostedPressable> : null}

        {showWalkingPlan ? <WalkingEatingCard budget={currentBudget} today={today} pending={todayStatus==='loading'||refreshingHealth||firstRunCheckPending} guidanceAllowed={walkingGuidanceAllowed} onOpenDetails={()=>router.push('/steps-detail')} /> : null}



        {visibleCards.showWorkouts ? (
          <FrostedView style={styles.secondaryCard}>
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
          </FrostedView>
        ) : null}

      </KeyboardSafeScrollView>
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
    backgroundColor: 'transparent',
  },
container: {
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: spacing.xxl,
    backgroundColor: 'transparent',
  },
header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
mark: {
    flexShrink: 0,
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
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
heroCard: { ...compactGlassCard, backgroundColor: '#EDF6F1', borderColor: '#DCEBE3', padding: 18, gap: 8 },
secondaryCard: { ...compactGlassCard, padding: 18, gap: 16 },
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
    color: '#17483C',
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
bankAmountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs },
bankUnit: { color: '#246B5B', fontSize: typography.subheading, fontWeight: '700' },
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
    fontSize: typography.caption,
    lineHeight: 18,
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
    minWidth: 0,
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
metricDetail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
burnDetailRow: { alignItems: 'flex-start', gap: spacing.xs },
burnDetail: { flexShrink: 1 },
metricHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
editEstimateButton: { width: 44, height: 44, marginVertical: -10, marginRight: -10, justifyContent: 'center', alignItems: 'center' },
whyButton: { width: 44, minHeight: 44, marginVertical: -10, alignItems: 'flex-end', justifyContent: 'center' },
whyButtonText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 22, 0.42)',
    padding: spacing.lg,
  },
whyModal: {
    maxHeight: '90%',
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
activityHeader: {
    // The pills own their material. Keep the shared canvas visible between them.
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: -16,
    marginTop: -8,
    marginBottom: -8,
  },
settingsButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
forecastSurface: { backgroundColor: '#F3F4F8', borderRadius: 16, padding: 14, gap: 12 },
forecastEyebrow: { color: '#616979', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
forecastValue: { fontSize: 21, fontWeight: '700', fontVariant: ['tabular-nums'] }
});
