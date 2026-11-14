import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adjustedIntakeCalories,
  calculateBurnToStepPlan,
  calculateProjectedEatingBudget,
  calculateStepToBurnPlan,
  estimateWalkingTime,
  resolveForecastCoverage,
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  walkingTimeFromPace,
  type WalkingTimeSample,
} from '../src/index';

test('projected eating budget uses the already-adjusted burn once', () => {
  assert.deepEqual(
    calculateProjectedEatingBudget({
      projectedAdjustedBurnCalories: 3000,
      signedGoalAdjustmentCalories: -500,
      dailyBankTargetCalories: 300,
    }),
    { status: 'ready', totalCalories: 2200, projectedAdjustedBurnCalories: 3000 },
  );
  assert.equal(
    calculateProjectedEatingBudget({
      projectedAdjustedBurnCalories: 100,
      signedGoalAdjustmentCalories: -500,
      dailyBankTargetCalories: 300,
    }).status,
    'non_positive',
  );
  assert.equal(
    calculateProjectedEatingBudget({
      projectedAdjustedBurnCalories: Number.NaN,
      signedGoalAdjustmentCalories: 0,
      dailyBankTargetCalories: 0,
    }).status,
    'unavailable',
  );
});

test('intake adjustment replaces or adds, and a missing base is not treated as zero', () => {
  assert.equal(adjustedIntakeCalories(900, null), 900);
  assert.equal(adjustedIntakeCalories(900, { mode: 'add', calories: 150 }), 1050);
  assert.equal(adjustedIntakeCalories(900, { mode: 'replace', calories: 0 }), 0);
  assert.equal(adjustedIntakeCalories(null, { mode: 'add', calories: 150 }), null);
  assert.throws(() => adjustedIntakeCalories(900, { mode: 'add', calories: -1 }));
});

test('step plans round provider burn to tens and stay on track when rest already covers the target', () => {
  const forward = calculateStepToBurnPlan({
    currentSteps: 8000,
    targetSteps: 10000,
    providerCaloriesPerStep: 0.05,
    projectedProviderBurnAtRest: 3000,
    adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  });
  assert.equal(forward.additionalSteps, 2000);
  assert.equal(forward.additionalProviderCalories, 100);
  assert.equal(forward.projectedProviderBurnCalories, 3100);
  assert.equal(forward.projectedAdjustedBurnCalories, 2480);

  const inverse = calculateBurnToStepPlan({
    currentSteps: 8000,
    targetActualBurnCalories: 2000,
    providerCaloriesPerStep: 0.05,
    projectedProviderBurnAtRest: 3000,
    adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  });
  assert.equal(inverse.alreadyOnTrack, true);
  assert.equal(inverse.remainingSteps, 0);
  assert.equal(inverse.totalDailyStepsNeeded, 8000);
});

test('walking time uses the median recent pace and refuses a single sample', () => {
  const now = new Date('2026-10-18T17:00:00.000Z');
  const sample = (id: string, startedAt: string, steps: number, durationMinutes: number): WalkingTimeSample => ({
    id,
    provider: 'apple_health',
    activityType: 'walking',
    startedAt: new Date(startedAt),
    durationMinutes,
    steps,
  });
  const estimate = estimateWalkingTime(
    3000,
    [
      sample('a', '2026-10-18T15:00:00.000Z', 2000, 20),
      sample('b', '2026-10-17T15:00:00.000Z', 3000, 30),
      sample('c', '2026-10-16T15:00:00.000Z', 4000, 20),
    ],
    { provider: 'apple_health', now },
  );
  assert.ok(estimate);
  assert.equal(estimate.sampleCount, 3);
  assert.equal(estimate.stepsPerMinute, 100);
  assert.equal(estimate.totalMinutes, 30);
  assert.equal(estimate.sessionCount, 2);
  assert.equal(
    estimateWalkingTime(3000, [sample('only', '2026-10-18T15:00:00.000Z', 2000, 20)], {
      provider: 'apple_health',
      now,
    }),
    null,
  );
  assert.equal(walkingTimeFromPace(3000, 9, 2), null);
});

test('forecast coverage is retained only when the expenditure totals are unchanged', () => {
  const retrievedAt = new Date('2026-10-18T17:00:00.000Z');
  const coverageAt = new Date('2026-10-18T16:30:00.000Z');
  const base = {
    provider: 'apple_health',
    localDate: '2026-10-18',
    timezone: 'America/Chicago',
    rawTotalDailyExpenditure: 2400,
    activeEnergyCalories: 400,
    basalEnergyCalories: 2000,
  };
  assert.equal(
    resolveForecastCoverage({ ...base, forecastCoverageAt: coverageAt }, base, retrievedAt)?.toISOString(),
    coverageAt.toISOString(),
  );
  assert.equal(
    resolveForecastCoverage(
      { ...base, forecastCoverageAt: coverageAt },
      { ...base, rawTotalDailyExpenditure: 2500 },
      retrievedAt,
    ),
    null,
  );
  assert.equal(
    resolveForecastCoverage(null, { ...base, forecastCoverageAt: coverageAt }, retrievedAt)?.toISOString(),
    coverageAt.toISOString(),
  );
});
