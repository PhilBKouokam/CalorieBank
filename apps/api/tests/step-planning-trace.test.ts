import { describe, expect, it } from 'vitest';
import { calibrateNetStepRate, prepareStepPlanningSnapshot, traceBurnToStepPlan } from '@caloriebank/domain';
const base = { currentSteps: 9000, projectedProviderBurnAtRest: 2000,
  providerCaloriesPerStep: 0.035833333333333335, adjustmentFactor: 0.8,
  reference: { version: 'synthetic-reference-1', kind: 'verified_shared_cutoff' as const,
    rawObservedProviderKcal: 1100, referenceAt: '2026-10-30T12:00:00Z', baselineKind: 'ordinary_proxy' as const } };
const plan = (input: Omit<Parameters<typeof prepareStepPlanningSnapshot>[0], 'bridge'>, bridge?: {referenceVersion:string;stepsAtReference:number;walkingSteps:number;incidentalSteps:number}) =>
  traceBurnToStepPlan(prepareStepPlanningSnapshot({ ...input, ...(bridge ? { bridge } : {}) })!, 2000);
describe('versioned step target replay at the real planner boundary', () => {
  it('distinguishes total target from remaining: three thousand fewer remaining can be expected', () => {
    const first = plan(base);
    const next = plan({ ...base, currentSteps: 12000 }, { referenceVersion: base.reference.version, stepsAtReference: 9000, walkingSteps: 3000, incidentalSteps: 0 });
    expect(first.plan).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 14000 });
    expect(next.plan).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 11000 });
    expect(next.trace.totalDailyStepTarget).toBeNull();
    expect(next.trace.stepTargetMeaning).toBe('extra_deliberate_walking_above_ordinary');
    expect(next.trace.targetMeaning).toBe('adjusted_end_of_day_total_burn');
    expect(next.trace.targetRawProviderKcal).toBe(2500);
  });
  it('keeps the total fixed while remaining falls from twenty to seventeen thousand in the supplied synthetic walk', () => {
    const grossWalkPerMinute = 6.6, basalPerMinute = 1.2, ordinaryPerMinute = 1.6, pace = 100;
    const netAboveRest = (grossWalkPerMinute - basalPerMinute) / pace;
    const incrementalAboveOrdinary = netAboveRest - (ordinaryPerMinute - basalPerMinute) / pace;
    expect(netAboveRest).toBeCloseTo(0.054);
    expect(incrementalAboveOrdinary).toBeCloseTo(0.05);
    const before = { ...base, currentSteps: 5000, projectedProviderBurnAtRest: 3232 + 768, providerCaloriesPerStep: incrementalAboveOrdinary };
    const first = traceBurnToStepPlan(prepareStepPlanningSnapshot(before)!, 4000);
    expect(first.plan).toMatchObject({ totalDailyStepsNeeded: 25000, remainingSteps: 20000 });
    const after = { ...before, currentSteps: 8000, projectedProviderBurnAtRest: 3232 + 30 * grossWalkPerMinute + 768 - 30 * ordinaryPerMinute,
      reference: { ...base.reference, version: 'synthetic-after-walk', rawObservedProviderKcal: 3430 } };
    const next = traceBurnToStepPlan(prepareStepPlanningSnapshot(after)!, 4000);
    expect(next.plan).toMatchObject({ totalDailyStepsNeeded: 25000, remainingSteps: 17000 });
    expect(next.trace.targetRawProviderKcal).toBe(5000);
  });
  it('bridges only confirmed uncovered walking and replaces it once on calorie catch-up', () => {
    const bridge = { referenceVersion: base.reference.version, stepsAtReference: 9000, walkingSteps: 1000, incidentalSteps: 0 };
    const walked = plan({ ...base, currentSteps: 10000 }, bridge);
    expect(walked.plan).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 13000 });
    expect(plan({ ...base, currentSteps: 10000 }, bridge)).toEqual(walked);
    const caught = plan({ ...base, currentSteps: 10000, projectedProviderBurnAtRest: 2000 + 1000 * base.providerCaloriesPerStep,
      reference: { ...base.reference, version: 'synthetic-reference-2' } });
    expect(caught.plan).toEqual(walked.plan);
    expect(caught.trace.bridgedWalkingKcal).toBe(0);
  });
  it('does not credit incidental steps or promote a reported reference to a shared cutoff', () => {
    const incidental = plan({ ...base, currentSteps: 10000 }, { referenceVersion: base.reference.version, stepsAtReference: 9000, walkingSteps: 0, incidentalSteps: 1000 });
    expect(incidental.plan.remainingSteps).toBe(14000);
    expect(incidental.trace.bridgedWalkingKcal).toBe(0);
    expect(prepareStepPlanningSnapshot({ ...base, reference: { ...base.reference, kind: 'reported_reference' },
      bridge: { referenceVersion: base.reference.version, stepsAtReference: 9000, walkingSteps: 1000, incidentalSteps: 0 } })).toBeNull();
    expect(prepareStepPlanningSnapshot({ ...base, bridge: { referenceVersion: 'stale', stepsAtReference: 9000, walkingSteps: 0, incidentalSteps: 0 } })).toBeNull();
  });
  it('shows why subtracting rest again from already-active calories makes an overestimate worse', () => {
    const start = new Date('2026-10-29T12:00:00Z'), end = new Date('2026-10-29T13:00:00Z');
    const calibrated = calibrateNetStepRate({ provider: 'synthetic', activityType: 'walking', now: new Date('2026-10-30T12:00:00Z'), samples: [{
      id: 'walk', provider: 'synthetic', activityType: 'walking', steps: { count: 6000, start, end },
      energy: { calories: 300, start, end, basis: 'active_above_rest' }, restingEnergy: { calories: 60, start, end },
    }] });
    expect(calibrated?.caloriesPerStep).toBe(0.05);
    const input = { ...base, currentSteps: 4000, projectedProviderBurnAtRest: 1720, providerCaloriesPerStep: 0.05 };
    expect(plan(input).plan.remainingSteps).toBe(15600);
    expect(plan({ ...input, providerCaloriesPerStep: (300 - 60) / 6000 }).plan.remainingSteps).toBe(19500);
    // A later legitimate coefficient revision alone can lower the target.
    expect(plan({ ...input, providerCaloriesPerStep: 0.06 }).plan.remainingSteps).toBe(13000);
  });
  it('compares rest and ordinary hypotheses on identical synthetic inputs without claiming causation', () => {
    const rest = plan({ ...base, reference: { ...base.reference, baselineKind: 'rest_only' }, currentSteps: 4000, projectedProviderBurnAtRest: 1000 + 60 * 12, providerCaloriesPerStep: 0.05 });
    const ordinary = plan({ ...base, currentSteps: 4000, projectedProviderBurnAtRest: 1000 + 90 * 12,
      providerCaloriesPerStep: 0.05 - (90 - 60) / 6000 });
    expect(rest.plan.remainingSteps).toBe(15600);
    expect(ordinary.plan.remainingSteps).toBe(9400);
    expect(ordinary.trace.stepsPerAdditionalRawBaselineKcal).toBeCloseTo(-1 / 0.045);
    expect(ordinary.trace.stepsPerAdditionalAdjustedTargetKcal).toBeCloseTo(1 / (0.8 * 0.045));
  });
});


it('rounds genuine extra fractions conservatively while ignoring only machine boundary noise', () => {
  const exact = plan({ ...base, currentSteps: 5000, projectedProviderBurnAtRest: 1500, providerCaloriesPerStep: 0.05 });
  const actualFraction = plan({ ...base, currentSteps: 5000, projectedProviderBurnAtRest: 1499.9999, providerCaloriesPerStep: 0.05 });
  expect(exact.plan.totalDailyStepsNeeded).toBe(25000);
  expect(actualFraction.plan.totalDailyStepsNeeded).toBe(25100);
});


it('labels an empirical low-activity total separately from a rest-only physiological assumption', () => {
  const result = plan({ ...base, reference: { ...base.reference, baselineKind: 'low_activity_total' } });
  expect(result.trace.stepTargetMeaning).toBe('total_steps_with_low_activity_future');
  expect(result.trace.energyCompatibility).toBe('legacy_active_above_basal_vs_empirical_total');
  expect(result.trace.totalDailyStepTarget).toBe(result.plan.totalDailyStepsNeeded);
});
