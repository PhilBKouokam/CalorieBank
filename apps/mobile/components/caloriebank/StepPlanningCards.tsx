import { calculateBurnToStepPlan, calculateStepToBurnPlan, suggestNextStepTarget, walkingTimeFromPace, walkingMidnightFeasibility } from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import { useState } from 'react';
import { usePlanningClock } from '@/lib/today/use-planning-clock';
import { StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
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

function DeadlineNotice({ steps, today, now }: { steps: number; today: TodayResponse; now: Date }) {
  const result = walkingMidnightFeasibility({ remainingSteps: steps, stepsPerMinute: today.steps.walkingPace?.stepsPerMinute ?? null,
    localDate: today.date, timezone: today.timezone, now });
  return result === 'insufficient_time' ? <Text accessibilityLiveRegion="polite" style={styles.detail}>At your estimated pace, these steps won’t fit before midnight.</Text> : null;
}

export function StepPlanningCards({ today }: { today: TodayResponse }) {
  const { fontScale } = useWindowDimensions();
  const { now, expired: coverageExpired } = usePlanningClock(today.restOfDayProjection);
  const inputStyle = [styles.input, { width: 132 * Math.max(1, fontScale) }];
  // Old servers expose a nearest-10 value: its lower bound is safe for targets.
  const displayedBaseline = today.restOfDayProjection.projectedProviderBurnCalories;
  const baseline = today.restOfDayProjection.unroundedProjectedProviderBurnCalories
    ?? (displayedBaseline === null ? null : Math.max(0, displayedBaseline - 5));
  const [burn, setBurn] = useState(String(baseline === null ? 0 : Math.ceil((baseline * today.burned.adjustmentFactor + 1) / 500) * 500));
  const [steps, setSteps] = useState(String(today.steps.count === null ? 0 : suggestNextStepTarget(today.steps.count)));
  const ready = !coverageExpired && today.steps.status === 'ready' && today.burned.status === 'ready'
    && today.steps.planningSnapshotReady !== false
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
        {!inverse.alreadyOnTrack ? <Text style={styles.remainingSteps}>{inverse.remainingSteps.toLocaleString()} steps remaining</Text> : null}
        <WalkingTime steps={inverse.remainingSteps} pace={today.steps.walkingPace} />
        <DeadlineNotice steps={inverse.remainingSteps} today={today} now={now} />
      </View> : <Text style={styles.detail}>{coverageExpired || today.restOfDayProjection.coverageStatus === 'uncertain' ? 'Waiting for newer activity data.' : today.steps.planningSnapshotReady === false ? 'Refresh your activity data to update this estimate.' : 'This estimate needs recent step and calorie-burn data.'}</Text>}
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
          <Text style={styles.actualBurn}>{forward.projectedProviderBurnCalories.toLocaleString()} × {today.burned.adjustmentFactor} = <Text style={styles.actualBurnResult}>{forward.projectedAdjustedBurnCalories.toLocaleString()} kcal</Text></Text>
        </View>
        <Text style={styles.remainingSteps}>About {forward.additionalSteps.toLocaleString()} more steps</Text>
        <WalkingTime steps={forward.additionalSteps} pace={today.steps.walkingPace} />
        <DeadlineNotice steps={forward.additionalSteps} today={today} now={now} />
      </View> : <Text style={styles.detail}>{coverageExpired || today.restOfDayProjection.coverageStatus === 'uncertain' ? 'Waiting for newer activity data.' : today.steps.planningSnapshotReady === false ? 'Refresh your activity data to update this estimate.' : 'This estimate needs recent step and calorie-burn data.'}</Text>}
    </View>
  </>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  result: { color: colors.primaryDark, fontSize: 26, fontWeight: '800', marginTop: spacing.sm },
  detail: { color: colors.textMuted, fontSize: typography.body },
  supporting: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  remainingSteps: { color: colors.text, fontSize: 20, fontWeight: '700' },
  timePlan: { gap: spacing.xs, marginVertical: spacing.sm },
  time: { color: colors.primaryDark, fontSize: 21, fontWeight: '700' },
  sessions: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  results: { gap: spacing.md },
  burnGroup: { gap: spacing.sm },
  burnValue: { color: colors.text, fontSize: 21, fontWeight: '700' },
  actualBurn: { color: colors.text, fontSize: 21, fontWeight: '800' },
  actualBurnResult: { color: colors.primaryDark, fontSize: 21, fontWeight: '800' },
  inputRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  unit: { color: colors.text, fontSize: typography.body },
  input: { width: 132, maxWidth: '100%', minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, color: colors.text, fontSize: typography.heading, fontWeight: '700' },
});
