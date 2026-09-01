import {
  calculateBurnToStepPlan,
  calculateAdjustedRestCaloriesPerHour,
  calculateRestOfDayBurnProjection,
  calculateStepToBurnPlan,
  calculateStepWhatIfProjection,
  estimateRestingBurnFromDailyBasal,
  estimateRestingBurnFromLowActivityHours,
  getLocalDateUtcBounds,
  getRemainingLocalDayMinutes,
  selectRestingBurnLookback,
  suggestNextStepTarget,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

describe('A2 progressive detail projections', () => {
  describe('A2.2 step and burn planning', () => {
    it.each([
      [1_000, 5_000],
      [3_000, 10_000],
      [8_000, 15_000],
      [14_000, 20_000],
      [31_611, 35_000],
    ])('suggests %i steps above the current count as %i', (current, expected) => {
      expect(suggestNextStepTarget(current)).toBe(expected);
    });

    it.each([
      [35_000, 3_389, 4_350, 3_480],
      [31_611, 0, 4_000, 3_200],
      [30_000, 0, 4_000, 3_200],
    ])('projects a %i-step target from additional steps only', (
      targetSteps,
      expectedAdditionalSteps,
      expectedProviderBurn,
      expectedAdjustedBurn,
    ) => {
      expect(calculateStepToBurnPlan({
        currentSteps: 31_611,
        targetSteps,
        providerCaloriesPerStep: 0.10325,
        projectedProviderBurnAtRest: 4_000,
        adjustmentFactor: 0.8,
      })).toMatchObject({
        additionalSteps: expectedAdditionalSteps,
        projectedProviderBurnCalories: expectedProviderBurn,
        projectedAdjustedBurnCalories: expectedAdjustedBurn,
      });
    });

    it('inverts the same provider-level model and rounds steps to the nearest 100', () => {
      expect(calculateBurnToStepPlan({
        currentSteps: 31_611,
        targetActualBurnCalories: 3_600,
        providerCaloriesPerStep: 0.078,
        projectedProviderBurnAtRest: 4_000,
        adjustmentFactor: 0.8,
      })).toEqual({
        alreadyOnTrack: false,
        requiredProviderBurnCalories: 4_500,
        additionalProviderCaloriesNeeded: 500,
        totalDailyStepsNeeded: 38_000,
        remainingSteps: 6_400,
      });
    });

    it('converts a 3,000 actual-kcal target to 3,750 provider kcal before solving steps', () => {
      expect(calculateBurnToStepPlan({
        currentSteps: 8_367,
        targetActualBurnCalories: 3_000,
        providerCaloriesPerStep: 0.079,
        projectedProviderBurnAtRest: 3_000,
        adjustmentFactor: 0.8,
      })).toMatchObject({
        requiredProviderBurnCalories: 3_750,
        additionalProviderCaloriesNeeded: 750,
        totalDailyStepsNeeded: 17_900,
        remainingSteps: 9_500,
      });
    });

    it.each([3_200, 3_100])('never returns negative steps for a %i actual-kcal target already covered', (target) => {
      expect(calculateBurnToStepPlan({
        currentSteps: 31_611,
        targetActualBurnCalories: target,
        providerCaloriesPerStep: 0.078,
        projectedProviderBurnAtRest: 4_000,
        adjustmentFactor: 0.8,
      })).toMatchObject({
        alreadyOnTrack: true,
        totalDailyStepsNeeded: 31_611,
        remainingSteps: 0,
      });
    });

    it('keeps both planning directions pure and leaves account state isolated', () => {
      const userA = Object.freeze({ availableBankCalories: 2_851, ledgerTransactions: 4 });
      const userB = Object.freeze({ availableBankCalories: 0, ledgerTransactions: 0 });
      calculateStepToBurnPlan({
        currentSteps: 10_000,
        targetSteps: 20_000,
        providerCaloriesPerStep: 0.08,
        projectedProviderBurnAtRest: 3_000,
        adjustmentFactor: 0.8,
      });
      calculateBurnToStepPlan({
        currentSteps: 10_000,
        targetActualBurnCalories: 3_200,
        providerCaloriesPerStep: 0.08,
        projectedProviderBurnAtRest: 3_000,
        adjustmentFactor: 0.8,
      });
      expect(userA).toEqual({ availableBankCalories: 2_851, ledgerTransactions: 4 });
      expect(userB).toEqual({ availableBankCalories: 0, ledgerTransactions: 0 });
    });
  });

  it('derives provider and adjusted personal rates without using daily total burn', () => {
    const result = calculateStepWhatIfProjection({
      currentSteps: 10_000,
      hypotheticalSteps: 20_000,
      providerCaloriesPerStep: 0.105,
      adjustedBurnSoFarCalories: 2_435,
      adjustmentFactor: 0.8,
    });

    expect(result).toEqual({
      providerCaloriesPer1000Steps: 105,
      adjustedCaloriesPer1000Steps: 84,
      currentAdjustedStepContributionCalories: 840,
      nonStepAdjustedBurnBaselineCalories: 1_600,
      hypotheticalAdjustedStepContributionCalories: 1_680,
      predictedAdjustedTotalBurnCalories: 3_280,
    });
  });

  it.each([
    [5_000, 2_020],
    [10_000, 2_440],
    [15_000, 2_860],
    [20_000, 3_280],
    [30_000, 4_120],
  ])('replaces current steps with a %i-step scenario', (hypotheticalSteps, expectedTotal) => {
    const result = calculateStepWhatIfProjection({
      currentSteps: 10_000,
      hypotheticalSteps,
      providerCaloriesPerStep: 0.105,
      adjustedBurnSoFarCalories: 2_435,
      adjustmentFactor: 0.8,
    });

    expect(result.predictedAdjustedTotalBurnCalories).toBe(expectedTotal);
    expect(result.nonStepAdjustedBurnBaselineCalories).toBe(1_600);
  });

  it('rejects a missing or invalid personal walking rate rather than inventing a projection', () => {
    expect(() => calculateStepWhatIfProjection({
      currentSteps: 10_000,
      hypotheticalSteps: 20_000,
      providerCaloriesPerStep: 0,
      adjustedBurnSoFarCalories: 2_435,
      adjustmentFactor: 0.8,
    })).toThrow('providerCaloriesPerStep');
  });

  it('weights personalized resting energy by actual local-day duration', () => {
    const rate = calculateAdjustedRestCaloriesPerHour([
      { localDate: '2026-03-08', timezone: 'America/Chicago', basalEnergyCalories: 1_840 },
      { localDate: '2026-11-01', timezone: 'America/Chicago', basalEnergyCalories: 2_000 },
    ], 0.8);

    expect(rate).toBe(64);
    expect(getLocalDateUtcBounds('2026-03-08', 'America/Chicago').end.getTime()
      - getLocalDateUtcBounds('2026-03-08', 'America/Chicago').start.getTime())
      .toBe(23 * 3_600_000);
    expect(getLocalDateUtcBounds('2026-11-01', 'America/Chicago').end.getTime()
      - getLocalDateUtcBounds('2026-11-01', 'America/Chicago').start.getTime())
      .toBe(25 * 3_600_000);
  });

  it('uses explicit completed-day basal history from before signup', () => {
    expect(estimateRestingBurnFromDailyBasal([
      { localDate: '2026-08-01', timezone: 'America/Chicago', basalEnergyCalories: 1_776 },
      { localDate: '2026-08-02', timezone: 'America/Chicago', basalEnergyCalories: 1_800 },
    ])).toMatchObject({ providerKcalPerHour: 74.5, observationCount: 2 });
  });

  it('uses the median of low-step non-workout hours so active periods and outliers do not dominate', () => {
    const observedAt = (hour: number) => new Date(`2026-08-20T${String(hour).padStart(2, '0')}:00:00.000Z`);
    const estimate = estimateRestingBurnFromLowActivityHours([
      { calories: 69, steps: 0, overlapsWorkout: false, observedAt: observedAt(1) },
      { calories: 73, steps: 12, overlapsWorkout: false, observedAt: observedAt(2) },
      { calories: 76, steps: 50, overlapsWorkout: false, observedAt: observedAt(3) },
      { calories: 500, steps: 0, overlapsWorkout: false, observedAt: observedAt(4) },
      { calories: 95, steps: 900, overlapsWorkout: false, observedAt: observedAt(5) },
      { calories: 80, steps: 0, overlapsWorkout: true, observedAt: observedAt(6) },
    ]);
    expect(estimate).toMatchObject({ providerKcalPerHour: 74.5, observationCount: 4 });
  });

  it('returns no resting model when no defensible historical evidence exists', () => {
    expect(estimateRestingBurnFromDailyBasal([])).toBeNull();
    expect(estimateRestingBurnFromLowActivityHours([
      { calories: 90, steps: 2_000, overlapsWorkout: false, observedAt: new Date() },
    ])).toBeNull();
  });

  it('uses several credible pre-signup observations from the first 14-day window', () => {
    const observations = [69, 73, 76].map((calories, index) => ({
      calories,
      steps: index * 10,
      overlapsWorkout: false,
      observedAt: new Date(`2026-08-${String(3 + index).padStart(2, '0')}T02:00:00.000Z`),
    }));
    expect(selectRestingBurnLookback([{ days: 14, observations }])).toMatchObject({
      lookbackDays: 14,
      providerKcalPerHour: 73,
      observationCount: 3,
    });
  });

  it.each([30, 90])('falls back to the %i-day pre-signup window when recent evidence is sparse', (days) => {
    const sparse = [{
      calories: 70,
      steps: 0,
      overlapsWorkout: false,
      observedAt: new Date('2026-08-20T02:00:00.000Z'),
    }];
    const enough = [70, 72, 74].map((calories, index) => ({
      calories,
      steps: 0,
      overlapsWorkout: false,
      observedAt: new Date(`2026-07-${String(10 + index).padStart(2, '0')}T02:00:00.000Z`),
    }));
    const windows = days === 30
      ? [{ days: 14, observations: sparse }, { days: 30, observations: enough }]
      : [
          { days: 14, observations: sparse },
          { days: 30, observations: sparse },
          { days: 90, observations: enough },
        ];
    expect(selectRestingBurnLookback(windows)).toMatchObject({
      lookbackDays: days,
      providerKcalPerHour: 72,
    });
  });

  it('keeps active and workout hours out of fallback evidence', () => {
    expect(selectRestingBurnLookback([{ days: 90, observations: [
      { calories: 70, steps: 0, overlapsWorkout: false, observedAt: new Date('2026-08-01T01:00:00Z') },
      { calories: 71, steps: 10, overlapsWorkout: false, observedAt: new Date('2026-08-01T02:00:00Z') },
      { calories: 72, steps: 20, overlapsWorkout: false, observedAt: new Date('2026-08-01T03:00:00Z') },
      { calories: 300, steps: 2_000, overlapsWorkout: false, observedAt: new Date('2026-08-01T04:00:00Z') },
      { calories: 250, steps: 0, overlapsWorkout: true, observedAt: new Date('2026-08-01T05:00:00Z') },
    ] }])).toMatchObject({ providerKcalPerHour: 71, observationCount: 3 });
  });

  it('uses the user local day for remaining time and never extends past midnight', () => {
    expect(getRemainingLocalDayMinutes(
      '2026-08-24',
      'America/Chicago',
      new Date('2026-08-25T00:30:00.000Z'),
    )).toBe(270);
    expect(getRemainingLocalDayMinutes(
      '2026-08-24',
      'America/Chicago',
      new Date('2026-08-25T06:00:00.000Z'),
    )).toBe(0);
  });

  it('projects only future adjusted resting burn onto burn already observed', () => {
    expect(calculateRestOfDayBurnProjection({
      providerBurnSoFarCalories: 3_044,
      providerRestCaloriesPerHour: 78,
      remainingMinutes: 450,
      adjustmentFactor: 0.8,
    })).toEqual({
      projectedProviderBurnCalories: 3_630,
      projectedAdjustedBurnCalories: 2_900,
    });
  });

  it('projects the established-account 79 kcal/hour example without changing the formula', () => {
    expect(calculateRestOfDayBurnProjection({
      providerBurnSoFarCalories: 3_204,
      providerRestCaloriesPerHour: 79.246776,
      remainingMinutes: 450,
      adjustmentFactor: 0.8,
    })).toEqual({
      projectedProviderBurnCalories: 3_800,
      projectedAdjustedBurnCalories: 3_040,
    });
  });

  it.each([
    [60, 3_120, 2_500],
    [390, 3_550, 2_840],
    [1, 3_050, 2_440],
  ])('projects raw provider burn first with %i minutes remaining', (
    remainingMinutes,
    projectedProviderBurnCalories,
    projectedAdjustedBurnCalories,
  ) => {
    expect(calculateRestOfDayBurnProjection({
      providerBurnSoFarCalories: 3_044,
      providerRestCaloriesPerHour: 78,
      remainingMinutes,
      adjustmentFactor: 0.8,
    })).toEqual({ projectedProviderBurnCalories, projectedAdjustedBurnCalories });
  });

  it('does not create accounting records because projections are pure calculations', () => {
    const before = Object.freeze({ ledgerTransactions: 4, availableBankCalories: 2_851 });
    calculateStepWhatIfProjection({
      currentSteps: 10_000,
      hypotheticalSteps: 20_000,
      providerCaloriesPerStep: 0.105,
      adjustedBurnSoFarCalories: 2_435,
      adjustmentFactor: 0.8,
    });
    calculateRestOfDayBurnProjection({
      providerBurnSoFarCalories: 3_044,
      providerRestCaloriesPerHour: 78,
      remainingMinutes: 450,
      adjustmentFactor: 0.8,
    });
    expect(before).toEqual({ ledgerTransactions: 4, availableBankCalories: 2_851 });
  });
});
