import type { TodayResponse } from '@caloriebank/schemas';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchToday } from '@/lib/api/client';
import { getConsumerSourceName } from '@/lib/providers/presentation';

export default function TodayBurnDetailScreen() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((value) => {
        if (__DEV__) {
          console.info('[CalorieBank Today Detail] mobile_today_detail_received', {
            restingRatePresent: value.restOfDayProjection.providerKcalPerHour !== null,
            projectedProviderBurnPresent:
              value.restOfDayProjection.projectedProviderBurnCalories !== null,
            projectedEstimatedActualBurnPresent:
              value.restOfDayProjection.projectedAdjustedBurnCalories !== null,
          });
        }
        setToday(value);
      })
      .catch(() => setFailed(true));
  }, []);

  const burnSource = getConsumerSourceName(today?.burned.source);
  const intakeSource = getConsumerSourceName(today?.eaten.source);
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Today so far</Text>
        {!today && !failed ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? <Text style={styles.unavailable}>Today’s values could not load.</Text> : null}
        {today ? (
          <>
            <View style={styles.card}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Burned</Text>
                <Text style={styles.metricValue}>
                  {today.burned.adjusted === null ? 'Unavailable' : `${today.burned.adjusted.toLocaleString()} kcal`}
                </Text>
                <Text style={styles.detail}>
                  {today.burned.raw === null
                    ? `${burnSource} burn unavailable`
                    : `${today.burned.raw.toLocaleString()} reported by ${burnSource} × ${Math.round(today.burned.adjustmentFactor * 100)}%`}
                </Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Eaten</Text>
                <Text style={styles.metricValue}>
                  {today.eaten.calories === null ? 'Unavailable' : `${today.eaten.calories.toLocaleString()} kcal`}
                </Text>
                <Text style={styles.detail}>Imported from {intakeSource}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>If you rested for the rest of today</Text>
            <View style={styles.card}>
              {today.restOfDayProjection.status === 'ready' &&
              today.restOfDayProjection.projectedProviderBurnCalories !== null &&
              today.restOfDayProjection.projectedAdjustedBurnCalories !== null &&
              today.restOfDayProjection.providerKcalPerHour !== null ? (
                <>
                  <MetricRow
                    label={`Projected Total Daily ${burnSource} burn`}
                    value={`~${today.restOfDayProjection.projectedProviderBurnCalories.toLocaleString()} kcal`}
                  />
                  <MetricRow
                    label="Estimated Total Daily Actual Burn"
                    value={`${today.restOfDayProjection.projectedProviderBurnCalories.toLocaleString()} × ${today.burned.adjustmentFactor} = ${today.restOfDayProjection.projectedAdjustedBurnCalories.toLocaleString()} kcal`}
                  />
                </>
              ) : (
                <Text style={styles.unavailable}>
                  {today.restOfDayProjection.status === 'stale'
                    ? 'Refresh your burn data to update this estimate.'
                    : 'Estimate will appear as your watch collects more data.'}
                </Text>
              )}
            </View>

            {today.restOfDayProjection.providerKcalPerHour !== null &&
            today.restOfDayProjection.adjustedKcalPerHour !== null ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>At rest, you burn</Text>
                <MetricRow
                  label={`${burnSource} reported`}
                  value={`~${Math.round(today.restOfDayProjection.providerKcalPerHour).toLocaleString()} kcal/hour`}
                />
                <MetricRow
                  label="Estimated actual"
                  value={`${Math.round(today.restOfDayProjection.providerKcalPerHour).toLocaleString()} × ${today.burned.adjustmentFactor} = ~${Math.round(today.restOfDayProjection.adjustedKcalPerHour).toLocaleString()} kcal/hour`}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text selectable style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800', marginTop: spacing.sm },
  card: { gap: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.lg },
  cardTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  metricBlock: { gap: spacing.xs },
  metricLabel: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rowValue: { color: colors.text, fontSize: typography.subheading, fontWeight: '800', lineHeight: 26 },
  detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  unavailable: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
});
