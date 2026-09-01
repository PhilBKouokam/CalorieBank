import {
  calculateBurnToStepPlan,
  calculateStepToBurnPlan,
  suggestNextStepTarget,
} from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchToday } from '@/lib/api/client';
import { getConsumerSourceName } from '@/lib/providers/presentation';
import { formatContributionPercentage } from '@/lib/today/presentation';

function estimateStatus(today: TodayResponse) {
  if (today.steps.status === 'stale') return 'Your step data is out of date.';
  if (today.steps.status === 'syncing') return 'Your step source is refreshing.';
  if (today.steps.status === 'not_connected') return 'Connect an activity source to see steps.';
  if (today.steps.count === null) return 'Step data is unavailable today.';
  return 'A walking calorie estimate is unavailable for this source.';
}

export default function StepsDetailScreen() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [stepTargetInput, setStepTargetInput] = useState('');
  const [burnTargetInput, setBurnTargetInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const forwardCardY = useRef(0);
  const inverseCardY = useRef(0);

  useEffect(() => {
    fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((value) => {
        setToday(value);
        if (value.steps.count !== null) {
          setStepTargetInput(String(suggestNextStepTarget(value.steps.count)));
        }
        if (value.restOfDayProjection.projectedProviderBurnCalories !== null) {
          const adjustedBaseline = value.restOfDayProjection.projectedProviderBurnCalories *
            value.burned.adjustmentFactor;
          setBurnTargetInput(String(Math.ceil((adjustedBaseline + 1) / 500) * 500));
        }
      })
      .catch(() => setFailed(true));
  }, []);

  const stepTarget = Number(stepTargetInput) || 0;
  const burnTarget = Number(burnTargetInput) || 0;
  const forwardPlan = useMemo(() => {
    if (
      !today ||
      today.steps.status !== 'ready' ||
      today.burned.status !== 'ready' ||
      today.steps.count === null ||
      today.steps.caloriesPerStep === null ||
      today.restOfDayProjection.status !== 'ready' ||
      today.restOfDayProjection.projectedProviderBurnCalories === null
    ) return null;
    return calculateStepToBurnPlan({
      currentSteps: today.steps.count,
      targetSteps: stepTarget,
      providerCaloriesPerStep: today.steps.caloriesPerStep,
      projectedProviderBurnAtRest:
        today.restOfDayProjection.projectedProviderBurnCalories,
      adjustmentFactor: today.burned.adjustmentFactor,
    });
  }, [stepTarget, today]);

  const inversePlan = useMemo(() => {
    if (
      !today ||
      today.steps.status !== 'ready' ||
      today.burned.status !== 'ready' ||
      today.steps.count === null ||
      today.steps.caloriesPerStep === null ||
      today.restOfDayProjection.status !== 'ready' ||
      today.restOfDayProjection.projectedProviderBurnCalories === null
    ) return null;
    return calculateBurnToStepPlan({
      currentSteps: today.steps.count,
      targetActualBurnCalories: burnTarget,
      providerCaloriesPerStep: today.steps.caloriesPerStep,
      projectedProviderBurnAtRest:
        today.restOfDayProjection.projectedProviderBurnCalories,
      adjustmentFactor: today.burned.adjustmentFactor,
    });
  }, [burnTarget, today]);

  const stepSource = getConsumerSourceName(today?.steps.source);
  const burnSource = getConsumerSourceName(today?.burned.source);
  const providerContribution = today?.steps.estimatedContributionCalories ?? null;
  const actualContribution = today?.steps.currentAdjustedContributionCalories ?? null;
  const currentProviderBurn = today?.burned.raw ?? null;
  const currentAdjustedBurn = today?.burned.adjusted ?? null;
  const providerContributionReady = providerContribution !== null && currentProviderBurn !== null;
  const actualContributionReady = actualContribution !== null && currentAdjustedBurn !== null;
  const revealCard = (y: number) => {
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 250);
  };
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.container}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
        {!today && !failed ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? <Text style={styles.unavailable}>Steps could not load.</Text> : null}
        {today ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Steps today</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>
                {today.steps.count === null ? 'Unavailable' : today.steps.count.toLocaleString()}
              </Text>
              {providerContributionReady || actualContributionReady ? (
                <>
                  {providerContributionReady ? (
                    <ContributionBlock
                      contribution={providerContribution}
                      context={`out of your ${currentProviderBurn.toLocaleString()} kcal ${burnSource} burn`}
                      total={currentProviderBurn}
                    />
                  ) : null}
                  {actualContributionReady ? (
                    <ContributionBlock
                      contribution={actualContribution}
                      context={`out of your ${currentAdjustedBurn.toLocaleString()} kcal estimated actual burn`}
                      total={currentAdjustedBurn}
                    />
                  ) : null}
                </>
              ) : (
                <Text style={styles.unavailable}>Walking calorie estimate unavailable</Text>
              )}
              <Text style={styles.source}>{stepSource}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your walking rate</Text>
              <MetricRow
                label={`${stepSource} reported`}
                value={today.steps.providerReportedCaloriesPer1000Steps === null
                  ? 'Unavailable'
                  : `~${today.steps.providerReportedCaloriesPer1000Steps.toLocaleString()} kcal / 1,000 steps`}
              />
              <MetricRow
                label="Estimated actual"
                value={today.steps.providerReportedCaloriesPer1000Steps === null ||
                  today.steps.adjustedCaloriesPer1000Steps === null
                  ? 'Unavailable'
                  : `${today.steps.providerReportedCaloriesPer1000Steps.toLocaleString()} × ${today.burned.adjustmentFactor} = ${today.steps.adjustedCaloriesPer1000Steps.toLocaleString()} kcal / 1,000 steps`}
              />
            </View>

            <View
              onLayout={(event) => { inverseCardY.current = event.nativeEvent.layout.y; }}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>If I want to burn…</Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Desired estimated actual calories burned today"
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setBurnTargetInput(value.replace(/\D/g, ''))}
                  onFocus={() => revealCard(inverseCardY.current)}
                  selectTextOnFocus
                  style={styles.input}
                  value={burnTargetInput}
                />
                <Text style={styles.inputUnit}>calories</Text>
              </View>
              {inversePlan ? (
                <View accessibilityLiveRegion="polite" style={styles.results}>
                  <Text style={styles.providerEquivalent}>
                    ~{inversePlan.requiredProviderBurnCalories.toLocaleString()} {burnSource} calories
                  </Text>
                  {inversePlan.alreadyOnTrack ? (
                    <Text style={styles.onTrack}>
                      You’re already on track to reach this without extra steps.
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.metricLabel}>I’d need about</Text>
                      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.primaryResult}>
                        {inversePlan.totalDailyStepsNeeded.toLocaleString()} total steps
                      </Text>
                      <Text style={styles.supportingResult}>
                        {inversePlan.remainingSteps.toLocaleString()} steps remaining
                      </Text>
                    </>
                  )}
                </View>
              ) : <Text style={styles.unavailable}>{estimateStatus(today)}</Text>}
            </View>

            <View
              onLayout={(event) => { forwardCardY.current = event.nativeEvent.layout.y; }}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>If I walk…</Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Target total steps today"
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setStepTargetInput(value.replace(/\D/g, ''))}
                  onFocus={() => revealCard(forwardCardY.current)}
                  selectTextOnFocus
                  style={styles.input}
                  value={stepTargetInput}
                />
                <Text style={styles.inputUnit}>steps</Text>
              </View>
              {forwardPlan ? (
                <View accessibilityLiveRegion="polite" style={styles.results}>
                  <MetricRow
                    label={`Projected Total Daily ${burnSource} burn`}
                    value={`~${forwardPlan.projectedProviderBurnCalories.toLocaleString()} kcal`}
                  />
                  <MetricRow
                    label="Estimated Total Daily Actual Burn"
                    value={`${forwardPlan.projectedProviderBurnCalories.toLocaleString()} × ${today.burned.adjustmentFactor} = ${forwardPlan.projectedAdjustedBurnCalories.toLocaleString()} kcal`}
                  />
                  {forwardPlan.additionalSteps > 0 ? (
                    <Text style={styles.supportingResult}>
                      About {forwardPlan.additionalSteps.toLocaleString()} more steps
                    </Text>
                  ) : null}
                </View>
              ) : <Text style={styles.unavailable}>{estimateStatus(today)}</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text selectable style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ContributionBlock({
  contribution,
  context,
  total,
}: {
  contribution: number;
  context: string;
  total: number;
}) {
  const percentage = formatContributionPercentage(contribution, total);
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricValue}>
        Contributed ~{contribution.toLocaleString()} kcal{percentage === null ? '' : ` (${percentage}%)`}
      </Text>
      <Text style={styles.metricLabel}>{context}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  heroValue: { color: colors.text, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  card: { gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.lg },
  cardTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  metricRow: { gap: spacing.xs },
  metricLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: typography.body, fontWeight: '700', lineHeight: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { minHeight: 48, minWidth: 120, flexShrink: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text, fontSize: typography.heading, fontWeight: '800', paddingHorizontal: spacing.md, fontVariant: ['tabular-nums'] },
  inputUnit: { color: colors.textMuted, fontSize: typography.body },
  results: { gap: spacing.md, paddingTop: spacing.xs },
  primaryResult: { color: colors.primaryDark, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  supportingResult: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  onTrack: { color: colors.text, fontSize: typography.body, fontWeight: '700', lineHeight: 24 },
  providerEquivalent: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' },
  unavailable: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  source: { color: colors.textMuted, fontSize: typography.caption },
});
