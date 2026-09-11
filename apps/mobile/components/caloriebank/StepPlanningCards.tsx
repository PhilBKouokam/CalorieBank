import { calculateBurnToStepPlan, calculateStepToBurnPlan, suggestNextStepTarget, walkingTimeFromPace } from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { getConsumerSourceName } from '@/lib/providers/presentation';

export function WalkingTime({ steps, pace }: { steps: number; pace: TodayResponse['steps']['walkingPace'] }) {
  const estimate = pace ? walkingTimeFromPace(steps, pace.stepsPerMinute, pace.sampleCount) : null;
  if (!estimate) return null;
  const minutes = Math.max(1, Math.round(estimate.totalMinutes));
  return <View style={styles.timePlan}>
    <Text style={styles.time}>About {minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`}</Text>
    <Text accessibilityLabel={`${estimate.sessionCount} ${estimate.sessionCount === 1 ? 'walk' : 'walks'} of approximately ${estimate.minutesPerSession} minutes each.`} style={styles.sessions}>{estimate.sessionCount} × ~{estimate.minutesPerSession} min {estimate.sessionCount === 1 ? 'walk' : 'walks'}</Text>
  </View>;
}

export function StepPlanningCards({ today }: { today: TodayResponse }) {
  const { fontScale } = useWindowDimensions();
  const inputStyle = [styles.input, { width: 132 * Math.max(1, fontScale) }];
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
      <View style={styles.inputRow}><TextInput accessibilityLabel="Desired estimated actual calories burned today" keyboardType="number-pad" maxLength={6} selectTextOnFocus
        value={burn} onChangeText={(v) => setBurn(v.replace(/\D/g, ''))} style={inputStyle} />
      <Text style={styles.unit}>calories</Text></View>
      {inverse ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <Text accessibilityLabel={`Approximately ${inverse.requiredProviderBurnCalories.toLocaleString()} ${getConsumerSourceName(today.burned.source)} calories`} style={styles.supporting}>~{inverse.requiredProviderBurnCalories.toLocaleString()} {getConsumerSourceName(today.burned.source)} calories</Text>
        {!inverse.alreadyOnTrack ? <Text style={styles.supporting}>I’d need about</Text> : null}
        <Text style={styles.result}>{inverse.alreadyOnTrack ? 'You’re already on track without extra steps.' : `${inverse.totalDailyStepsNeeded.toLocaleString()} total steps`}</Text>
        {!inverse.alreadyOnTrack ? <Text style={styles.supporting}>{inverse.remainingSteps.toLocaleString()} steps remaining</Text> : null}
        <WalkingTime steps={inverse.remainingSteps} pace={today.steps.walkingPace} />
      </View> : <Text style={styles.detail}>This estimate needs recent step and calorie-burn data.</Text>}
    </View>
    <View style={styles.card}>
      <Text style={styles.title}>If I walk…</Text>
      <View style={styles.inputRow}><TextInput accessibilityLabel="Target total steps today" keyboardType="number-pad" maxLength={6} selectTextOnFocus
        value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} style={inputStyle} />
      <Text style={styles.unit}>steps</Text></View>
      {forward ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <View style={styles.burnGroup}>
          <Text style={styles.supporting}>Projected Total Daily {getConsumerSourceName(today.burned.source)} burn</Text>
          <Text accessibilityLabel={`Approximately ${forward.projectedProviderBurnCalories.toLocaleString()} kilocalories`} style={styles.burnValue}>~{forward.projectedProviderBurnCalories.toLocaleString()} kcal</Text>
        </View>
        <View style={styles.burnGroup}>
          <Text style={styles.supporting}>Estimated Total Daily Actual Burn</Text>
          <Text style={styles.actualBurn}>{forward.projectedProviderBurnCalories.toLocaleString()} × {today.burned.adjustmentFactor} = {forward.projectedAdjustedBurnCalories.toLocaleString()} kcal</Text>
        </View>
        <Text style={styles.supporting}>About {forward.additionalSteps.toLocaleString()} more steps</Text>
        <WalkingTime steps={forward.additionalSteps} pace={today.steps.walkingPace} />
      </View> : <Text style={styles.detail}>This estimate needs recent step and calorie-burn data.</Text>}
    </View>
  </>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  result: { color: colors.primaryDark, fontSize: 26, fontWeight: '800', marginTop: spacing.sm },
  detail: { color: colors.textMuted, fontSize: typography.body },
  supporting: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  timePlan: { gap: spacing.xs, marginVertical: spacing.sm },
  time: { color: colors.primaryDark, fontSize: 21, fontWeight: '700' },
  sessions: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  results: { gap: spacing.md },
  burnGroup: { gap: spacing.sm },
  burnValue: { color: colors.text, fontSize: 21, fontWeight: '700' },
  actualBurn: { color: colors.text, fontSize: 21, fontWeight: '800' },
  inputRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  unit: { color: colors.text, fontSize: typography.body },
  input: { width: 132, maxWidth: '100%', minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, color: colors.text, fontSize: typography.heading, fontWeight: '700' },
});
