import {
  formatGoalAdjustmentMagnitude,
  getGoalModeLabel,
  type BankSummaryResponse,
  type GoalConfigurationResponse,
  type PlannedTreatGetResponse,
} from '@caloriebank/schemas';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchBankSummary, fetchGoalConfiguration, fetchPlannedTreat, getApiBaseUrl } from '@/lib/api/client';

function formatCalories(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()} kcal`;
}

function formatDisplayDate(dateString: string | null | undefined) {
  if (!dateString) return 'No finalized days yet';

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
  if (value === null || value === undefined) return 'No finalized result yet';
  if (value > 0) return 'Added to your bank';
  if (value < 0) return 'Withdrawn from your bank';
  return 'No change to your bank';
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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadToday() {
        const apiBaseUrl = getApiBaseUrl();

        if (!apiBaseUrl) {
          setConfigurationStatus('error');
          setBankStatus('error');
          setPlannedTreatStatus('error');
          return;
        }

        setBankStatus('loading');
        setConfigurationStatus('loading');
        setPlannedTreatStatus('loading');

        const [configurationResult, bankSummaryResult, plannedTreatResult] = await Promise.allSettled([
          fetchGoalConfiguration(),
          fetchBankSummary(),
          fetchPlannedTreat(),
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
      }

      void loadToday();

      return () => {
        isMounted = false;
      };
    }, []),
  );

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
      : 'No finalized days yet';
  const latestChangeValue =
    bankStatus === 'loading'
      ? 'Loading...'
      : hasFinalizedDays && bankSummary.latestDailyBankChange !== null
        ? formatCalories(bankSummary.latestDailyBankChange)
        : bankStatus === 'error'
          ? 'Unavailable'
          : 'Not calculated';
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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

        <Link href="/planned-treat" asChild>
          <Pressable
            accessibilityHint="Opens Planned Treat setup."
            accessibilityLabel={plannedTreatAccessibility}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryCard, styles.plannedTreatCard, pressed && styles.pressedCard]}
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
                  {activePlannedTreat.status === 'ready' ? <Text style={styles.readyBadge}>Ready</Text> : null}
                </View>
                <Text style={styles.supportingText}>
                  {activePlannedTreat.progressCalories.toLocaleString()} /{' '}
                  {activePlannedTreat.requiredCalories.toLocaleString()} kcal
                </Text>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(activePlannedTreat.progressPercent, 2)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.supportingText}>
                  {activePlannedTreat.status === 'ready'
                    ? 'You have enough banked'
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

        <Link href="/bank-history" asChild>
          <Pressable
            accessibilityHint="Opens Bank History."
            accessibilityLabel={`${latestResultLabel(bankSummary)}, ${latestChangeValue}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressedCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>{latestResultLabel(bankSummary)}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[
                styles.secondaryValue,
                hasFinalizedDays && bankSummary.latestDailyBankChange !== null && bankSummary.latestDailyBankChange < 0
                  ? styles.negativeValue
                  : styles.positiveValue,
              ]}
            >
              {latestChangeValue}
            </Text>
            <Text style={styles.supportingText}>
              {latestResultDetail(hasFinalizedDays ? bankSummary.latestDailyBankChange : null)}
            </Text>
          </Pressable>
        </Link>

        <Link href="/goal-settings" asChild>
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
        </Link>
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
});
