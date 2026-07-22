import {
  formatGoalAdjustmentMagnitude,
  getGoalModeLabel,
  type BankSummaryResponse,
  type GoalConfigurationResponse,
  type PlannedTreatGetResponse,
  type TodayResponse,
  type IngestionSyncTrigger,
  type DashboardPreferencesResponse,
} from '@caloriebank/schemas';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  fetchBankSummary,
  fetchDashboardPreferences,
  fetchGoalConfiguration,
  fetchPlannedTreat,
  fetchToday,
  getApiBaseUrl,
} from '@/lib/api/client';
import {
  getAppleHealthConnectionStatus,
  syncAppleHealthToday,
  type AppleHealthConnectionStatus,
} from '@/lib/healthkit/healthkit-connection';

let hasStartedRollingSyncThisLaunch = false;

function formatCalories(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()} kcal`;
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
  if (!summary?.latestFinalizedDate) return 'Latest finalized';

  const [year, month, day] = summary.latestFinalizedDate.split('-').map(Number);
  if (!year || !month || !day) return 'Latest finalized';

  const latest = new Date(year, month - 1, day);
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  return latest.getTime() === yesterday.getTime() ? 'Yesterday' : 'Latest finalized';
}

function latestResultDetail(value: number | null | undefined) {
  if (value === null || value === undefined) return 'No completed result yet';
  if (value > 0) return 'Added to your bank';
  if (value < 0) return 'Withdrawn from your bank';
  return 'No change to your bank';
}

function latestContributionStatus(summary: BankSummaryResponse | null) {
  if (!summary?.latestContributionStatus) return null;
  if (summary.latestContributionStatus === 'locked') return 'Locked';
  if (!summary.latestLocksAt) return 'Provisional';

  return `Provisional · Locks ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(summary.latestLocksAt))}`;
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
  const [bankSummary, setBankSummary] = useState<BankSummaryResponse | null>(null);
  const [bankStatus, setBankStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [goalConfiguration, setGoalConfiguration] = useState<GoalConfigurationResponse | null>(null);
  const [configurationStatus, setConfigurationStatus] =
    useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [plannedTreat, setPlannedTreat] = useState<PlannedTreatGetResponse | null>(null);
  const [plannedTreatStatus, setPlannedTreatStatus] =
    useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [todayStatus, setTodayStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [healthConnectionStatus, setHealthConnectionStatus] =
    useState<AppleHealthConnectionStatus>('not_connected');
  const [healthSyncDetail, setHealthSyncDetail] = useState<string | null>(null);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  const [dashboardPreferences, setDashboardPreferences] =
    useState<DashboardPreferencesResponse | null>(null);

  const refreshHealthAwareness = useCallback(async (
    force: boolean,
    trigger: IngestionSyncTrigger,
  ) => {
    const connectionStatus = await getAppleHealthConnectionStatus();
    setHealthConnectionStatus(connectionStatus);

    if (connectionStatus !== 'connected') return;

    try {
      setRefreshingHealth(force);
      const outcome = await syncAppleHealthToday({ force, trigger });
      const anyCategoryFound =
        outcome.expenditureFound ||
        outcome.intakeFound ||
        outcome.stepsFound ||
        outcome.workoutCount > 0;
      setHealthSyncDetail(
        !anyCategoryFound
          ? 'No matching Health data was found today.'
          : !outcome.intakeFound
            ? 'No calorie intake was found in Apple Health today.'
            : !outcome.expenditureFound
              ? 'No calorie burn data was found in Apple Health today.'
            : null,
      );
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const refreshedToday = await fetchToday(timezone);
      setToday(refreshedToday);
      setTodayStatus(
        refreshedToday.burned.adjusted === null && refreshedToday.eaten.calories === null
          ? 'unavailable'
          : 'ready',
      );
    } catch {
      setTodayStatus('error');
      setHealthConnectionStatus('needs_attention');
      setHealthSyncDetail('Apple Health could not refresh. Try again.');
    } finally {
      setRefreshingHealth(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadToday() {
        const apiBaseUrl = getApiBaseUrl();

        if (!apiBaseUrl) {
          setConfigurationStatus('error');
          setBankStatus('error');
          setPlannedTreatStatus('error');
          setTodayStatus('error');
          return;
        }

        setBankStatus('loading');
        setConfigurationStatus('loading');
        setPlannedTreatStatus('loading');
        setTodayStatus('loading');

        const [configurationResult, bankSummaryResult, plannedTreatResult, todayResult, preferencesResult] = await Promise.allSettled([
          fetchGoalConfiguration(),
          fetchBankSummary(),
          fetchPlannedTreat(),
          fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
          fetchDashboardPreferences(),
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

        if (bankSummaryResult.status === 'fulfilled') {
          setBankSummary(bankSummaryResult.value);
          setBankStatus(bankSummaryResult.value.finalizedDayCount > 0 ? 'ready' : 'empty');
        } else {
          setBankSummary(null);
          setBankStatus('error');
        }

        if (plannedTreatResult.status === 'fulfilled') {
          setPlannedTreat(plannedTreatResult.value);
          setPlannedTreatStatus(plannedTreatResult.value.status === 'no_plan' ? 'empty' : 'ready');
        } else {
          setPlannedTreat(null);
          setPlannedTreatStatus('error');
        }

        if (todayResult.status === 'fulfilled') {
          setToday(todayResult.value);
          setTodayStatus(
            todayResult.value.burned.adjusted === null && todayResult.value.eaten.calories === null
              ? 'unavailable'
              : 'ready',
          );
        } else {
          setToday(null);
          setTodayStatus('error');
        }

        if (preferencesResult.status === 'fulfilled') {
          setDashboardPreferences(preferencesResult.value);
        }
      }

      void loadToday();
      const syncTrigger: IngestionSyncTrigger = hasStartedRollingSyncThisLaunch
        ? 'screen_focus'
        : 'app_launch';
      hasStartedRollingSyncThisLaunch = true;
      void refreshHealthAwareness(false, syncTrigger);

      return () => {
        isMounted = false;
      };
    }, [refreshHealthAwareness]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshHealthAwareness(false, 'app_foreground');
    });
    return () => subscription.remove();
  }, [refreshHealthAwareness]);

  const hasFinalizedDays = bankSummary && bankSummary.finalizedDayCount > 0;
  const bankValue =
    bankStatus === 'loading'
      ? 'Loading...'
      : hasFinalizedDays
        ? formatCalories(bankSummary.availableBankCalories)
        : bankStatus === 'error'
          ? 'Unavailable'
          : 'Not calculated';
  const throughText = hasFinalizedDays
    ? `Through ${formatDisplayDate(bankSummary.latestFinalizedDate)}`
    : bankStatus === 'error'
      ? 'Try again later'
      : 'No completed days yet';
  const latestChangeValue =
    bankStatus === 'loading'
      ? 'Loading...'
      : hasFinalizedDays && bankSummary.latestDailyBankChange !== null
        ? formatCalories(bankSummary.latestDailyBankChange)
        : bankStatus === 'error'
          ? 'Unavailable'
          : 'Not calculated';
  const latestAdjustmentText =
    bankSummary &&
    bankSummary.latestCorrectionCount > 0 &&
    bankSummary.latestOriginalDailyBankChange !== null
      ? `Adjusted from ${formatCalories(bankSummary.latestOriginalDailyBankChange)}`
      : null;
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
      ? 'Planned Treat, loading'
      : activePlannedTreat
        ? `Planned Treat, ${activePlannedTreat.name}, ${activePlannedTreat.progressPercent} percent ready`
        : plannedTreatStatus === 'error'
          ? 'Planned Treat, unavailable'
          : 'Planned Treat, nothing planned yet';
  const burnedValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : today?.burned.adjusted !== null && today?.burned.adjusted !== undefined
        ? `${today.burned.adjusted.toLocaleString()} kcal`
        : healthConnectionStatus === 'connected'
          ? 'No data found'
          : 'Not connected';
  const eatenValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : today?.eaten.calories !== null && today?.eaten.calories !== undefined
        ? `${today.eaten.calories.toLocaleString()} kcal`
        : healthConnectionStatus === 'connected'
          ? 'No intake found'
          : 'Not connected';
  const burnedDetail =
    today?.burned.raw !== null && today?.burned.raw !== undefined && today.burned.source
      ? `${today.burned.raw.toLocaleString()} from ${today.burned.source} × ${formatPercent(today.burned.adjustmentFactor)}`
      : healthConnectionStatus === 'connected'
        ? 'Waiting for calorie burn data from Apple Health'
        : 'Connect Apple Health to show calories burned';
  const eatenDetail = today?.eaten.source
    ? `Imported from ${today.eaten.source}`
    : healthConnectionStatus === 'connected'
      ? 'No calorie intake was found in Apple Health today'
      : 'Connect Apple Health to show calories eaten';
  const visibleCards = dashboardPreferences ?? {
    showLatestFinalizedContribution: true,
    showTodaySoFar: true,
    showPlannedTreat: true,
    showSteps: true,
    showWorkouts: true,
    showCurrentGoal: true,
    updatedAt: new Date(0).toISOString(),
  };
  const stepsValue =
    todayStatus === 'loading'
      ? 'Loading...'
      : today?.steps.count === null || today?.steps.count === undefined
        ? healthConnectionStatus === 'connected'
          ? 'No step data found'
          : 'Not connected'
        : today.steps.count.toLocaleString();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshingHealth}
            tintColor={colors.primary}
            onRefresh={() => void refreshHealthAwareness(true, 'manual_refresh')}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.mark}>
            <Text style={styles.markText}>CB</Text>
          </View>
          <Text style={styles.wordmark}>CalorieBank</Text>
        </View>

        <Link href="/bank-history" asChild>
          <Pressable
            accessibilityHint="Opens Bank History."
            accessibilityLabel={`Available Bank, ${bankValue}, ${throughText}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroCard, pressed && styles.pressedCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Available Bank</Text>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.bankValue}>
              {bankValue}
            </Text>
            <Text style={styles.supportingText}>{throughText}</Text>
            {bankStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          </Pressable>
        </Link>

        {visibleCards.showLatestFinalizedContribution ? (
          <Link href="/bank-history" asChild>
            <Pressable
              accessibilityHint="Opens Bank History."
              accessibilityLabel={`${latestResultLabel(bankSummary)}, ${latestChangeValue}`}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressedCard]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>
                  {latestResultLabel(bankSummary) === 'Yesterday'
                    ? "Yesterday's contribution"
                    : 'Latest finalized contribution'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[
                  styles.secondaryValue,
                  hasFinalizedDays &&
                  bankSummary.latestDailyBankChange !== null &&
                  bankSummary.latestDailyBankChange < 0
                    ? styles.negativeValue
                    : styles.positiveValue,
                ]}
              >
                {latestChangeValue}
              </Text>
              <Text style={styles.supportingText}>
                {latestResultDetail(hasFinalizedDays ? bankSummary.latestDailyBankChange : null)}
              </Text>
              {latestContributionStatus(bankSummary) ? (
                <Text style={styles.statusText}>{latestContributionStatus(bankSummary)}</Text>
              ) : null}
              {latestAdjustmentText ? (
                <Text style={styles.supportingText}>{latestAdjustmentText}</Text>
              ) : null}
            </Pressable>
          </Link>
        ) : null}

        {visibleCards.showTodaySoFar ? <View style={styles.secondaryCard}>
          <Text style={styles.cardLabel}>Today so far</Text>
          {todayStatus === 'loading' ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.supportingText}>Loading live values.</Text>
            </View>
          ) : todayStatus === 'error' ? (
            <>
              <Text style={styles.secondaryValue}>Unavailable</Text>
              <Text style={styles.supportingText}>{healthSyncDetail ?? 'Today’s values could not refresh.'}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refreshHealthAwareness(true, 'manual_refresh')}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressedCard]}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.todayMetrics}>
                <View style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Burned</Text>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
                    {burnedValue}
                  </Text>
                  <Text style={styles.metricDetail}>{burnedDetail}</Text>
                </View>
                <View style={styles.todayMetric}>
                  <Text style={styles.metricLabel}>Eaten</Text>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
                    {eatenValue}
                  </Text>
                  <Text style={styles.metricDetail}>{eatenDetail}</Text>
                </View>
              </View>
              <Text style={styles.supportingText}>{formatRelativeSyncTime(latestSyncTime(today))}</Text>
              {healthConnectionStatus !== 'connected' ? (
                <Link href="/integrations" asChild>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressedCard]}
                  >
                    <Text style={styles.retryButtonText}>Connect Apple Health</Text>
                  </Pressable>
                </Link>
              ) : null}
              {healthSyncDetail ? <Text style={styles.supportingText}>{healthSyncDetail}</Text> : null}
            </>
          )}
        </View> : null}

        {visibleCards.showPlannedTreat ? (
          <Link href="/planned-treat" asChild>
            <Pressable
              accessibilityHint="Opens Planned Treat setup."
              accessibilityLabel={plannedTreatAccessibility}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryCard,
                styles.plannedTreatCard,
                pressed && styles.pressedCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>Planned Treat</Text>
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
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.treatName}>
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
                  <Text style={styles.treatName}>Nothing planned yet</Text>
                  <Text style={styles.supportingText}>Choose something worth saving for</Text>
                </>
              )}
            </Pressable>
          </Link>
        ) : null}

        {visibleCards.showSteps ? (
          <View style={styles.secondaryCard}>
            <Text style={styles.cardLabel}>Steps today</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryValue}>
              {stepsValue}
            </Text>
            <Text style={styles.supportingText}>
              {formatRelativeSyncTime(today?.steps.lastSyncedAt)}
            </Text>
          </View>
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
                    <Text style={styles.workoutName}>{workout.displayName}</Text>
                    <Text style={styles.supportingText}>
                      {workout.durationMinutes} min
                      {workout.totalEnergyBurned === null
                        ? ''
                        : ` · ${workout.totalEnergyBurned.toLocaleString()} kcal`}
                    </Text>
                  </View>
                ))}
                <Text style={styles.supportingText}>
                  Workout calories are already included in your burned total.
                </Text>
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

        {visibleCards.showCurrentGoal ? <Link href="/goal-settings" asChild>
          <Pressable
            accessibilityHint="Opens Goal Settings."
            accessibilityLabel={`Current goal, ${currentGoalValue}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressedCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Current goal</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryValue}>
              {currentGoalValue}
            </Text>
            <Text style={styles.supportingText}>{formatGoalDetail(goalConfiguration)}</Text>
          </Pressable>
        </Link> : null}
      </ScrollView>
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
    textAlign: 'center',
  },
  secondaryValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  positiveValue: {
    color: colors.primaryDark,
  },
  negativeValue: {
    color: colors.danger,
  },
  supportingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  statusText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
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
