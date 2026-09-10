import { StepPlanningCards } from '@/components/caloriebank/StepPlanningCards';
import type { TodayResponse } from '@caloriebank/schemas';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchToday } from '@/lib/api/client';
import { getConsumerSourceName } from '@/lib/providers/presentation';
import { formatContributionPercentage } from '@/lib/today/presentation';

export default function StepsDetailScreen() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((value) => {
        setToday(value);

      })
      .catch(() => setFailed(true));
  }, []);

  const stepSource = getConsumerSourceName(today?.steps.source);
  const burnSource = getConsumerSourceName(today?.burned.source);
  const providerContribution = today?.steps.estimatedContributionCalories ?? null;
  const actualContribution = today?.steps.currentAdjustedContributionCalories ?? null;
  const currentProviderBurn = today?.burned.raw ?? null;
  const currentAdjustedBurn = today?.burned.adjusted ?? null;
  const providerContributionReady = providerContribution !== null && currentProviderBurn !== null;
  const actualContributionReady = actualContribution !== null && currentAdjustedBurn !== null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.container}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
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

            <StepPlanningCards today={today} />
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
