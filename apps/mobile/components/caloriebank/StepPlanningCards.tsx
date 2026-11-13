import { compactGlassCard } from '@/constants/card-surface';
import { FrostedView } from '@/components/caloriebank/FrostedSurface';
import { selectQuietWalkingForecast } from '@/lib/today/quiet-walking-forecast';
import { prepareStepPlanningSnapshot, traceBurnToStepPlan, calculateStepToBurnPlan, suggestNextStepTarget, walkingTimeFromPace, walkingMidnightFeasibility } from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import { useEditorDraft } from '@/lib/drafts/use-editor-draft';
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

function DeadlineNotice({ steps, today, now, pace }: {
  steps: number; today: TodayResponse; now: Date; pace: TodayResponse['steps']['walkingPace'];
}) {
  const result = walkingMidnightFeasibility({ remainingSteps: steps, stepsPerMinute: pace?.stepsPerMinute ?? null,
    localDate: today.date, timezone: today.timezone, now });
  return result === 'insufficient_time' ? <Text accessibilityLiveRegion="polite" style={styles.detail}>At your estimated pace, these steps won’t fit before midnight.</Text> : null;
}

export function StepPlanningCards({ today, inverseOnly = false, guidanceAllowed = true, pending = false }: { today: TodayResponse; inverseOnly?: boolean; guidanceAllowed?: boolean; pending?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const ordinaryProjection = today.steps.ordinaryProjection;
  const quietProjection = today.steps.quietWalkingForecast;
  const { now, expired: coverageExpired } = usePlanningClock(today.restOfDayProjection, ordinaryProjection?.expiresAt ?? (quietProjection?.status === 'ready' ? quietProjection.expiresAt : undefined));
  // Startup/older cached snapshots may not yet contain planning data.
  const quiet = today.restOfDayProjection ? selectQuietWalkingForecast(today, now) : null;
  const needsQuiet = !ordinaryProjection && today.restOfDayProjection?.evidenceType === 'historical_low_activity_hours';
  const ordinary = ordinaryProjection && now.getTime() < Date.parse(ordinaryProjection.expiresAt) ? ordinaryProjection : undefined;
  // Expiry is not evidence for changing the forecast model. Keep the supplied
  // model unavailable until refresh instead of silently substituting rest-only.
  const ordinaryExpired = Boolean(ordinaryProjection && !ordinary);
  const inputStyle = [styles.input, { width: 132 * Math.max(1, fontScale) }];
  // Old servers expose a nearest-10 value: its lower bound is safe for targets.
  const displayedBaseline = today.restOfDayProjection?.projectedProviderBurnCalories ?? null;
  const restBaseline = today.restOfDayProjection?.unroundedProjectedProviderBurnCalories
    ?? (displayedBaseline === null ? null : Math.max(0, displayedBaseline - 5));
  const baseline = ordinary?.rawProjectedBurnBeforeWalking ?? restBaseline;
  const caloriesPerStep = ordinary?.rawIncrementalKcalPerStep ?? (needsQuiet ? quiet?.rawIncrementalKcalPerStep ?? null : today.steps.caloriesPerStep);
  const pace = ordinary
    ? { stepsPerMinute: ordinary.stepsPerMinute, sampleCount: ordinary.walkingSampleCount }
    : needsQuiet && quiet ? { stepsPerMinute: quiet.stepsPerMinute, sampleCount: quiet.walkingSampleCount } : today.steps.walkingPace;
  const basis = ordinary?.basis === 'recorded_sessions_proxy'
    ? 'Based on recent low-activity hours. Sleep and awake time are not separated. Some exercise may be included.'
    : ordinary ? 'Based on recent burn outside exercise.'
      : today.restOfDayProjection?.evidenceType === 'historical_low_activity_hours' ? 'Based on recent low-activity hours.' : 'Rest-only estimate.';
  const draft = useEditorDraft('step-planning', {
    burn: String(baseline === null ? 0 : Math.ceil((baseline * today.burned.adjustmentFactor + 1) / 500) * 500),
    steps: String(today.steps.count == null ? 0 : ordinaryProjection
      ? suggestNextStepTarget(today.steps.count) - today.steps.count : suggestNextStepTarget(today.steps.count)),
  }, JSON.stringify([today.date, today.timezone, today.burned.source, today.steps.source, ordinaryProjection ? 'extra-walking' : 'total-steps']));
  const { burn, steps } = draft.value;
  const setBurn = (burn: string) => draft.update(v => ({ ...v, burn }));
  const setSteps = (steps: string) => draft.update(v => ({ ...v, steps }));
  const ready = Boolean(today.restOfDayProjection) && guidanceAllowed && !pending && today.steps.status === 'ready' && today.burned.status === 'ready'
    && today.steps.planningSnapshotReady !== false
    && !ordinaryExpired
    && (!needsQuiet || quiet !== null)
    && (ordinary || (!coverageExpired && today.restOfDayProjection?.status === 'ready'))
    && baseline !== null && Number.isFinite(baseline) && today.steps.count != null && caloriesPerStep != null;
  const shared = ready ? { currentSteps: today.steps.count!, providerCaloriesPerStep: caloriesPerStep!,
    projectedProviderBurnAtRest: baseline!, adjustmentFactor: today.burned.adjustmentFactor } : null;
  const snapshot = shared ? prepareStepPlanningSnapshot({ ...shared, reference: {
    version: JSON.stringify([today.date, today.timezone, today.burned.source,
      today.restOfDayProjection?.planningAnchorAt, today.burned.raw, baseline, caloriesPerStep]),
    kind: 'reported_reference', rawObservedProviderKcal: today.burned.raw ?? null,
    referenceAt: today.restOfDayProjection?.planningAnchorAt ?? today.restOfDayProjection?.coverageAt ?? null,
    walkingEnergyBasis: needsQuiet && quiet ? 'matched_quiet_background_replacement' : undefined,
    baselineKind: ordinary ? 'ordinary_proxy'
      : today.restOfDayProjection?.evidenceType === 'historical_low_activity_hours' ? 'low_activity_total' : 'rest_only',
  } }) : null;
  // The wire has no verified current-step partition: do not invent uncovered walking.
  const inverse = snapshot ? traceBurnToStepPlan(snapshot, Number(burn) || 0).plan : null;
  const forward = snapshot ? calculateStepToBurnPlan({ ...snapshot.plannerInput, targetSteps: ordinary ? snapshot.plannerInput.currentSteps + (Number(steps) || 0) : Number(steps) || 0 }) : null;
  return <>
    <FrostedView style={styles.card}>
      <Text style={styles.title}>If I want to burn…</Text>
      <View style={styles.inputRow}><TextInput accessibilityLabel="Desired estimated actual calories burned today" keyboardType="number-pad" maxLength={6} selectTextOnFocus editable={guidanceAllowed && !pending}
        {...draft.selection('burn')} value={burn} onChangeText={(v) => setBurn(v.replace(/\D/g, ''))} style={inputStyle} />
      <Text style={styles.unit}>calories</Text></View>
      {inverse ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <Text accessibilityLabel={`Approximately ${inverse.requiredProviderBurnCalories.toLocaleString()} ${getConsumerSourceName(today.burned.source)} calories`} style={styles.supporting}>~{inverse.requiredProviderBurnCalories.toLocaleString()} {getConsumerSourceName(today.burned.source)} calories</Text>
        {!inverse.alreadyOnTrack ? <Text style={styles.supporting}>I’d need about</Text> : null}
        <Text style={styles.result}>{inverse.alreadyOnTrack ? 'You’re already on track without extra steps.' : ordinary ? `${inverse.remainingSteps.toLocaleString()} extra walking steps` : `${inverse.totalDailyStepsNeeded.toLocaleString()} total steps`}</Text>
        {!inverse.alreadyOnTrack ? <Text style={styles.remainingSteps}>{inverse.remainingSteps.toLocaleString()} {ordinary ? 'extra walking steps remaining' : 'steps remaining'}</Text> : null}
        <WalkingTime steps={inverse.remainingSteps} pace={pace} />
        <DeadlineNotice steps={inverse.remainingSteps} today={today} now={now} pace={pace} />
        <Text style={styles.detail}>{basis}</Text>
      </View> : <Text style={styles.detail}>{pending ? 'Updating your activity data…' : !guidanceAllowed ? 'Refresh your activity data to update this estimate.' : ordinaryExpired || coverageExpired || today.restOfDayProjection?.coverageStatus === 'uncertain' ? 'Waiting for newer activity data.' : today.steps.planningSnapshotReady === false ? 'Refresh your activity data to update this estimate.' : 'This estimate needs recent step and calorie-burn data.'}</Text>}
    </FrostedView>
    {!inverseOnly ? <FrostedView style={styles.card}>
      <Text style={styles.title}>If I walk…</Text>
      <View style={styles.inputRow}><TextInput accessibilityLabel={ordinaryProjection ? 'Planned extra walking steps beyond usual activity' : 'Target total steps today'} keyboardType="number-pad" maxLength={6} selectTextOnFocus editable={guidanceAllowed && !pending}
        {...draft.selection('steps')} value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} style={inputStyle} />
      <Text style={styles.unit}>{ordinaryProjection ? 'extra walking steps' : 'steps'}</Text></View>
      {forward ? <View accessibilityLiveRegion="polite" style={styles.results}>
        <View style={styles.burnGroup}>
          <Text style={styles.supporting}>Projected Total Daily {getConsumerSourceName(today.burned.source)} burn</Text>
          <Text accessibilityLabel={`Approximately ${forward.projectedProviderBurnCalories.toLocaleString()} kilocalories`} style={styles.burnValue}>~{forward.projectedProviderBurnCalories.toLocaleString()} kcal</Text>
        </View>
        <View style={styles.burnGroup}>
          <Text style={styles.supporting}>Estimated Total Daily Actual Burn</Text>
          <Text style={styles.actualBurn}>{forward.projectedProviderBurnCalories.toLocaleString()} × {today.burned.adjustmentFactor} = <Text style={styles.actualBurnResult}>{forward.projectedAdjustedBurnCalories.toLocaleString()} kcal</Text></Text>
        </View>
        <Text style={styles.remainingSteps}>About {forward.additionalSteps.toLocaleString()} {ordinary ? 'extra walking steps beyond usual activity' : 'more steps'}</Text>
        <WalkingTime steps={forward.additionalSteps} pace={pace} />
        <DeadlineNotice steps={forward.additionalSteps} today={today} now={now} pace={pace} />
      </View> : <Text style={styles.detail}>{pending ? 'Updating your activity data…' : !guidanceAllowed ? 'Refresh your activity data to update this estimate.' : ordinaryExpired || coverageExpired || today.restOfDayProjection?.coverageStatus === 'uncertain' ? 'Waiting for newer activity data.' : today.steps.planningSnapshotReady === false ? 'Refresh your activity data to update this estimate.' : 'This estimate needs recent step and calorie-burn data.'}</Text>}
    </FrostedView> : null}
  </>;
}
const styles = StyleSheet.create({
card: { ...compactGlassCard, padding: 18, gap: 16 },
title: { color: '#B54708', fontSize: typography.subheading, fontWeight: '700' },
result: { color: '#176E61', fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
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
input: { width: 132, maxWidth: '100%', minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, color: '#B54708', fontSize: typography.heading, fontWeight: '700' }
});
