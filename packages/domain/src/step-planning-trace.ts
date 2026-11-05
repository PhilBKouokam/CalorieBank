import { calculateBurnToStepPlan, calculateStepToBurnPlan } from './index';

type PlannerInput = Parameters<typeof calculateStepToBurnPlan>[0];
export type StepPlanningReference = {
  version: string;
  kind: 'reported_reference' | 'verified_shared_cutoff';
  rawObservedProviderKcal: number | null;
  referenceAt: string | null;
  walkingEnergyBasis?: 'matched_quiet_background_replacement';
  baselineKind: 'rest_only' | 'low_activity_total' | 'ordinary_proxy';
};
export type UncoveredWalkingBridge = {
  referenceVersion: string;
  stepsAtReference: number;
  walkingSteps: number;
  incidentalSteps: number;
};

/** Versioned replay boundary. A shared sync-session or retrieval time is not a
 * shared calorie/step cutoff. Callers must establish that evidence separately.
 * The baseline already includes incurred expenditure; never add past steps again.
 * Incremental kcal/step is above the selected baseline (rest or ordinary), not gross.
 */
export function prepareStepPlanningSnapshot(input: Omit<PlannerInput, 'targetSteps'> & {
  reference: StepPlanningReference;
  bridge?: UncoveredWalkingBridge;
}) {
  const { reference, bridge, ...planner } = input;
  let bridgedWalkingKcal = 0;
  if (bridge) {
    if (reference.kind !== 'verified_shared_cutoff' || bridge.referenceVersion !== reference.version ||
      ![bridge.stepsAtReference, bridge.walkingSteps, bridge.incidentalSteps].every(v => Number.isSafeInteger(v) && v >= 0) ||
      bridge.stepsAtReference + bridge.walkingSteps + bridge.incidentalSteps !== planner.currentSteps) return null;
    bridgedWalkingKcal = bridge.walkingSteps * planner.providerCaloriesPerStep;
    if (!Number.isFinite(bridgedWalkingKcal) || bridgedWalkingKcal < 0) return null;
  }
  // A stateless bridge is recomputed, never accumulated. Once provider calories
  // catch up, the caller supplies the new reference/baseline and clears covered credit.
  return {
    plannerInput: { ...planner, projectedProviderBurnAtRest: planner.projectedProviderBurnAtRest + bridgedWalkingKcal },
    trace: {
      version: 1 as const, referenceVersion: reference.version, referenceKind: reference.kind,
      rawObservedProviderKcal: reference.rawObservedProviderKcal, referenceAt: reference.referenceAt,
      baselineKind: reference.baselineKind,
      energyCompatibility: reference.walkingEnergyBasis ?? (reference.baselineKind === 'low_activity_total' ? 'legacy_active_above_basal_vs_empirical_total' as const
        : reference.baselineKind === 'ordinary_proxy' ? 'matched_background_replacement' as const : 'rest_model_assumption' as const),
      rawBaselineBeforeBridge: planner.projectedProviderBurnAtRest,
      rawWalkingKcalPerAdditionalStepUsed: planner.providerCaloriesPerStep,
      currentSteps: planner.currentSteps, stepsAtReference: bridge?.stepsAtReference ?? null,
      bridgedWalkingSteps: bridge?.walkingSteps ?? 0, incidentalStepsAfterReference: bridge?.incidentalSteps ?? null,
      bridgedWalkingKcal, adjustmentFactor: planner.adjustmentFactor,
      currentStepAlignment: bridge ? 'verified_partition' as const : 'not_established' as const,
    },
  };
}

export function traceBurnToStepPlan(input: NonNullable<ReturnType<typeof prepareStepPlanningSnapshot>>, targetActualBurnCalories: number) {
  const plan = calculateBurnToStepPlan({ ...input.plannerInput, targetActualBurnCalories });
  return { plan, trace: {
    ...input.trace, targetMeaning: 'adjusted_end_of_day_total_burn' as const,
    targetAdjustedKcal: targetActualBurnCalories,
    targetRawProviderKcal: targetActualBurnCalories / input.plannerInput.adjustmentFactor,
    rawProjectedProviderKcalBeforeFurtherWalking: input.plannerInput.projectedProviderBurnAtRest,
    stepTargetMeaning: input.trace.baselineKind === 'ordinary_proxy'
      ? 'extra_deliberate_walking_above_ordinary' as const
      : input.trace.baselineKind === 'low_activity_total' ? 'total_steps_with_low_activity_future' as const
        : 'total_steps_with_rest_only_future' as const,
    totalDailyStepTarget: input.trace.baselineKind !== 'ordinary_proxy' ? plan.totalDailyStepsNeeded : null,
    remainingAdditionalSteps: plan.remainingSteps,
    // Arithmetic sensitivities, not confidence bounds or guarantees.
    stepsPerAdditionalRawBaselineKcal: -1 / input.plannerInput.providerCaloriesPerStep,
    stepsPerAdditionalAdjustedTargetKcal: 1 / (input.plannerInput.adjustmentFactor * input.plannerInput.providerCaloriesPerStep),
  } };
}
