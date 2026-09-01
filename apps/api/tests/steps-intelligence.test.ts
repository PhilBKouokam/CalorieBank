import { describe, expect, it } from 'vitest';

import {
  calculatePersonalizedStepEstimate,
  shouldShowStepsByDefault,
  type WalkingCalibrationSample,
} from '../src/modules/today/steps-intelligence';

function sample(
  day: number,
  totalSteps: number,
  totalEnergyBurned: number,
  activityType: WalkingCalibrationSample['activityType'] = 'walking',
): WalkingCalibrationSample {
  return {
    startedAt: new Date(`2026-08-${String(day).padStart(2, '0')}T12:00:00.000Z`),
    activityType,
    totalSteps,
    totalEnergyBurned,
  };
}

describe('Steps Intelligence', () => {
  it('produces a personalized estimate from one valid walk workout', () => {
    expect(calculatePersonalizedStepEstimate(23_010, [sample(20, 2_300, 148)])).toMatchObject({
      estimatedContributionCalories: 1_480,
      calibrationWorkoutCount: 1,
      calibrationTotalSteps: 2_300,
      calibrationTotalCalories: 148,
      estimationStatus: 'ready',
    });
  });

  it('uses a pooled weighted ratio for two or more workouts', () => {
    const estimate = calculatePersonalizedStepEstimate(23_010, [
      sample(18, 2_300, 148), sample(19, 3_100, 190), sample(20, 1_800, 116),
    ]);
    expect(estimate).toMatchObject({
      estimatedContributionCalories: 1_450,
      calibrationWorkoutCount: 3,
      calibrationTotalSteps: 7_200,
      calibrationTotalCalories: 454,
      estimatedCaloriesPer1000Steps: 63,
    });
    expect(estimate.caloriesPerStep).toBeCloseTo(454 / 7_200);
  });

  it('uses only the latest five valid workouts', () => {
    const estimate = calculatePersonalizedStepEstimate(10_000, [
      sample(15, 1_000, 500), sample(16, 1_000, 100), sample(17, 1_000, 100),
      sample(18, 1_000, 100), sample(19, 1_000, 100), sample(20, 1_000, 100),
    ]);
    expect(estimate).toMatchObject({
      calibrationWorkoutCount: 5,
      calibrationTotalSteps: 5_000,
      calibrationTotalCalories: 500,
      estimatedContributionCalories: 1_000,
    });
  });

  it('accepts running but excludes unrelated, zero-step, and zero-calorie workouts', () => {
    const estimate = calculatePersonalizedStepEstimate(10_000, [
      sample(16, 2_000, 120, 'running'), sample(17, 4_000, 400, 'other'),
      sample(18, 0, 200), sample(19, 2_000, 0),
    ]);
    expect(estimate).toMatchObject({
      calibrationWorkoutCount: 1,
      calibrationTotalSteps: 2_000,
      calibrationTotalCalories: 120,
      estimatedContributionCalories: 600,
    });
  });

  it('distinguishes missing steps, zero steps, and no calibration', () => {
    const calibration = [sample(20, 2_000, 100)];
    expect(calculatePersonalizedStepEstimate(null, calibration).estimationStatus).toBe('unavailable');
    expect(calculatePersonalizedStepEstimate(0, calibration)).toMatchObject({
      estimationStatus: 'ready',
      estimatedContributionCalories: 0,
    });
    expect(calculatePersonalizedStepEstimate(10_000, [])).toMatchObject({
      estimationStatus: 'unavailable', estimatedContributionCalories: null,
      calibrationWorkoutCount: 0,
    });
  });

  it('does not use total daily expenditure or divide total burn by steps', () => {
    const estimate = calculatePersonalizedStepEstimate(10_000, [sample(20, 2_000, 100)]);
    expect(estimate.estimatedContributionCalories).toBe(500);
    expect(estimate.estimatedContributionCalories).not.toBe(3_900);
  });

  it('retains the separate initial visibility threshold', () => {
    expect(shouldShowStepsByDefault([12_000, 14_000, 11_000])).toBe(true);
    expect(shouldShowStepsByDefault([7_000, 9_000, 8_000])).toBe(false);
    expect(shouldShowStepsByDefault([15_000, 16_000])).toBe(false);
  });
});
