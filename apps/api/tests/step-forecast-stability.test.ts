import { describe, expect, it } from 'vitest';
import { calculateBurnToStepPlan, calculateRestOfDayBurnProjection, walkingTimeFromPace } from '@caloriebank/domain';
import { calculatePersonalizedStepEstimate } from '../src/modules/today/steps-intelligence';

const forecast = (steps: number, baseline: number, coefficient = .05) => calculateBurnToStepPlan({
  currentSteps: steps, targetActualBurnCalories: 4000, providerCaloriesPerStep: coefficient,
  projectedProviderBurnAtRest: baseline, adjustmentFactor: .8,
});
describe('evidence-driven step forecast stability', () => {
  it('reproduces a 3000-step change without changing the user target', () => {
    expect(forecast(10000, 3935).totalDailyStepsNeeded).toBe(31300);
    expect(forecast(13000, 3935).totalDailyStepsNeeded).toBe(34300);
    // New steps paired with old burn fabricate a moving finish line.
    expect(forecast(13000, 4085).totalDailyStepsNeeded).toBe(31300);
  });
  it('shows the separate clock-only defect and its maximum fresh-cache effect', () => {
    const atObservation = calculateRestOfDayBurnProjection({ providerBurnSoFarCalories: 2000, providerRestCaloriesPerHour: 80, remainingMinutes: 900, adjustmentFactor: .8 });
    const laterRead = calculateRestOfDayBurnProjection({ providerBurnSoFarCalories: 2000, providerRestCaloriesPerHour: 80, remainingMinutes: 870, adjustmentFactor: .8 });
    expect(atObservation.projectedProviderBurnCalories - laterRead.projectedProviderBurnCalories).toBe(40);
    expect(forecast(10000, laterRead.projectedProviderBurnCalories).totalDailyStepsNeeded - forecast(10000, atObservation.projectedProviderBurnCalories).totalDailyStepsNeeded).toBe(800);
    expect(forecast(10000, atObservation.projectedProviderBurnCalories)).toEqual(forecast(10000, atObservation.projectedProviderBurnCalories));
  });
  it.each([
    { hour: 8, steps: 2000, burn: 2260, expected: 31200 },
    { hour: 11, steps: 5000, burn: 2650, expected: 31200 },
    { hour: 15, steps: 12000, burn: 3320, expected: 31200 },
    { hour: 20, steps: 16000, burn: 4420, expected: 21200 },
  ])('explains the full-day trajectory at $hour:00', ({ hour, steps, burn, expected }) => {
    const rest = calculateRestOfDayBurnProjection({ providerBurnSoFarCalories: burn, providerRestCaloriesPerHour: 80, remainingMinutes: (24 - hour) * 60, adjustmentFactor: .8 });
    const result = forecast(steps, rest.projectedProviderBurnCalories);
    expect(result.totalDailyStepsNeeded).toBe(expected);
    expect(result.remainingSteps).toBe(expected - steps);
    const time = walkingTimeFromPace(result.remainingSteps, 100, 3)!;
    expect(time.totalMinutes).toBe(result.remainingSteps / 100);
    expect(time.sessionCount).toBe(Math.ceil(time.totalMinutes / 25));
    expect(time.minutesPerSession).toBeLessThanOrEqual(25);
  });
  it('keeps small changes small and does not hide material non-step exercise', () => {
    expect(forecast(10000, 3940).totalDailyStepsNeeded - forecast(10000, 3935).totalDailyStepsNeeded).toBe(-100);
    expect(forecast(10000, 4435).totalDailyStepsNeeded - forecast(10000, 3935).totalDailyStepsNeeded).toBe(-10000);
  });
  it('uses workout evidence, never daily total burn divided by steps', () => {
    const sample = { startedAt: new Date('2026-09-11'), activityType: 'walking' as const, totalSteps: 10000, totalEnergyBurned: 500 };
    expect(calculatePersonalizedStepEstimate(1000, []).caloriesPerStep).toBeNull();
    expect(calculatePersonalizedStepEstimate(1000, [sample]).caloriesPerStep).toBe(.05);
    expect(calculatePersonalizedStepEstimate(20000, [sample, { ...sample, activityType: 'other', totalEnergyBurned: 900 }]).caloriesPerStep).toBe(.05);
    expect(calculatePersonalizedStepEstimate(20000, Array.from({ length: 5 }, () => sample)).caloriesPerStep).toBe(.05);
  });
  it.each([10001, 12679, 22751])('keeps rounded total, exact remaining difference and time consistent at %s steps', (steps) => {
    const result = forecast(steps, 3935);
    expect(result.totalDailyStepsNeeded % 100).toBe(0);
    expect(result.totalDailyStepsNeeded - steps).toBe(result.remainingSteps);
    expect(walkingTimeFromPace(result.remainingSteps, 100, 3)!.totalMinutes).toBe(result.remainingSteps / 100);
  });
});
