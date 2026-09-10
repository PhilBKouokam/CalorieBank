import { calculateBurnToStepPlan, calculateStepToBurnPlan, suggestNextStepTarget, walkingTimeFromPace } from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { getConsumerSourceName } from '@/lib/providers/presentation';

export function WalkingTime({ steps, pace }: { steps: number; pace: TodayResponse['steps']['walkingPace'] }) {
  const estimate = pace ? walkingTimeFromPace(steps, pace.stepsPerMinute, pace.sampleCount) : null;
  if (!estimate) return null;
  const minutes = Math.max(1, Math.round(estimate.totalMinutes));
  return <View style={styles.results}>
    <Text style={styles.detail}>About {minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`}</Text>
    <Text style={styles.detail}>{estimate.sessionCount === 1 ? `One ${estimate.minutesPerSession}-minute walk` : `${estimate.sessionCount} × about ${estimate.minutesPerSession}-minute walks`}</Text>
  </View>;
}

export function StepPlanningCards({ today }: { today: TodayResponse }) {
  const baseline = today.restOfDayProjection.projectedProviderBurnCalories;
  const [burn, setBurn] = useState(String(baseline === null ? 0 : Math.ceil((baseline * today.burned.adjustmentFactor + 1) / 500) * 500));
  const [steps, setSteps] = useState(String(today.steps.count === null ? 0 : suggestNextStepTarget(today.steps.count)));
  const ready = today.steps.status === 'ready' && today.burned.status === 'ready'
    && today.restOfDayProjection.status === 'ready' && baseline !== null
    && today.steps.count !== null && today.steps.caloriesPerStep !== null;
  const shared = ready ? { currentSteps: today.steps.count!, providerCaloriesPerStep: today.steps.caloriesPerStep!,
    projectedProviderBurnAtRest: baseline!, adjustmentFactor: today.burned.adjustmentFactor } : null;
  const inverse = shared ? calculateBurnToStepPlan({ ...shared, targetActualBurnCalories: Number(burn) || 0 }) : null;
  const forward = shared ? calculateStepToBurnPlan({ ...shared, targetSteps: Number(steps) || 0 }) : null;
  return <>
    <View style={styles.card}>
      <Text style={styles.title}>If I want to burn…</Text>
      <TextInput accessibilityLabel="Desired estimated actual calories burned today" keyboardType="number-pad" maxLength={6}
        value={burn} onChangeText={(v) => setBurn(v.replace(/\D/g, ''))} style={styles.input} />
      <Text style={styles.detail}>kcal today</Text>
      {inverse ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <Text style={styles.result}>{inverse.alreadyOnTrack ? 'You’re already on track without extra steps.' : `About ${inverse.remainingSteps.toLocaleString()} more steps`}</Text>
        {!inverse.alreadyOnTrack ? <Text style={styles.detail}>{inverse.totalDailyStepsNeeded.toLocaleString()} total steps today</Text> : null}
        <Text style={styles.detail}>About {inverse.requiredProviderBurnCalories.toLocaleString()} kcal reported by {getConsumerSourceName(today.burned.source)}</Text>
        <WalkingTime steps={inverse.remainingSteps} pace={today.steps.walkingPace} />
      </View> : <Text style={styles.detail}>This estimate needs recent step and calorie-burn data.</Text>}
    </View>
    <View style={styles.card}>
      <Text style={styles.title}>If I walk…</Text>
      <TextInput accessibilityLabel="Target total steps today" keyboardType="number-pad" maxLength={6}
        value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} style={styles.input} />
      <Text style={styles.detail}>total steps today</Text>
      {forward ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <Text style={styles.result}>About {forward.additionalSteps.toLocaleString()} more steps</Text>
        <Text style={styles.detail}>Estimated total burn: {forward.projectedAdjustedBurnCalories.toLocaleString()} kcal</Text>
        <Text style={styles.detail}>{forward.projectedProviderBurnCalories.toLocaleString()} reported estimate × {today.burned.adjustmentFactor}</Text>
        <WalkingTime steps={forward.additionalSteps} pace={today.steps.walkingPace} />
      </View> : <Text style={styles.detail}>This estimate needs recent step and calorie-burn data.</Text>}
    </View>
  </>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  result: { color: colors.primaryDark, fontSize: typography.subheading, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: typography.body },
  results: { gap: spacing.xs },
  input: { minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, color: colors.text, fontSize: typography.heading },
});
