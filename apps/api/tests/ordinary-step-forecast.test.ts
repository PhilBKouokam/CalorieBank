import { describe, expect, it } from 'vitest';
import {
  calculateBurnToStepPlan,
  calculateStepToBurnPlan,
  estimateFiveDayOrdinaryRate,
  getLocalDateUtcBounds,
  qualifyOrdinaryStepForecast,
  walkingMidnightFeasibility,
  type OrdinaryForecastHistory,
  type OrdinaryForecastObservation,
} from '@caloriebank/domain';

import { parseApiEnv } from '../src/env';
import { normalizeGoogleHealthOrdinaryHistory } from '../src/modules/google-health/google-health-ordinary-history';

const hourMs = 3_600_000;
const instant = (time: string) => new Date(`2026-10-30T${time}:00Z`);
const source = { accountId: 'synthetic-one', sourceId: 'synthetic-selected-stream', timezone: 'UTC' };
const localDate = '2026-10-30';
const cutoff = instant('12:00');
const historyFor = (dates: readonly string[], timezone: string): OrdinaryForecastHistory => {
  const bounds = dates.map(date => getLocalDateUtcBounds(date, timezone));
  return {
    ...source, timezone, retrievedAt: new Date(bounds.at(-1)!.end), basis: 'classified_activity',
    exerciseCoverage: { start: bounds[0]!.start, end: bounds.at(-1)!.end },
    exercises: [],
    hours: bounds.flatMap(({ start, end }) => Array.from(
      { length: Math.ceil((end.getTime() - start.getTime()) / hourMs) },
      (_, index) => {
        const from = start.getTime() + index * hourMs;
        const to = Math.min(end.getTime(), from + hourMs);
        return {
          start: new Date(from), end: new Date(to), rawTotalKcal: 75 * (to - from) / hourMs,
          coverage: 'complete' as const, classification: 'ordinary' as const,
        };
      },
    )),
  };
};
const history = historyFor(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'], 'UTC');
const baseline: OrdinaryForecastObservation = {
  ...source, localDate, cutoff, expiresAt: instant('12:30'), coverage: 'verified',
  rawProviderKcal: 1100, stepsAtCutoff: 9000, currentSteps: 9000,
  activityThrough: cutoff, activityCoverage: 'verified', ordinaryStepsAfterCutoff: 0, activity: [],
};
const calibration = {
  ...source, expiresAt: instant('13:00'), energyBasis: 'qualified_basal_plus_active' as const, rawNetWalkingKcalPerStep: 0.04, rawRestKcalPerHour: 50, stepsPerMinute: 100,
};
const input = { ...source, localDate, now: cutoff, history, observation: baseline, calibration };
const walk = (start: string, end: string, steps: number) => ({ kind: 'walking' as const, start: instant(start), end: instant(end), steps });
const walking = [walk('12:00', '12:06', 600), walk('12:06', '12:12', 600)];
const delayed = { ...baseline, currentSteps: 10200, activityThrough: instant('12:12'), activity: walking };

function ready(overrides: Partial<Parameters<typeof qualifyOrdinaryStepForecast>[0]> = {}) {
  const result = qualifyOrdinaryStepForecast({ ...input, ...overrides });
  if (result.status !== 'ready') throw Error(result.reason);
  return result;
}

const plan = (result: ReturnType<typeof ready>) =>
  calculateBurnToStepPlan({ ...result.plannerInput, targetActualBurnCalories: 2000 });

describe('five completed local days of ordinary energy', () => {
  it('weights actual duration, excludes the union of workout and walk/run hours, and never prorates hourly energy', () => {
    const copy = structuredClone(history);
    const hour = copy.hours[23]!;
    const next = copy.hours[24]!;
    copy.exercises = [
      { start: new Date(hour.end.getTime() - 600_000), end: new Date(next.start.getTime() + 600_000) },
      { start: new Date(hour.end.getTime() - 300_000), end: new Date(next.start.getTime() + 900_000) },
    ];
    Object.assign(hour, { rawTotalKcal: 400 });
    Object.assign(next, { rawTotalKcal: 500 });
    Object.assign(copy.hours[30]!, { rawTotalKcal: 800, classification: 'walk_run_or_workout' });
    Object.assign(copy.hours[40]!, { rawTotalKcal: 192 });
    expect(estimateFiveDayOrdinaryRate({ ...input, history: copy })).toMatchObject({
      includedHours: 117, rawKcal: 75 * 117 + 117, rawOrdinaryKcalPerHour: 76, firstDay: '2026-10-25',
    });
  });

  it('reports missing hours without imputing them and withholds invalid or unrepresented days', () => {
    const partial = history.hours.slice(1);
    const duplicate = [...history.hours, history.hours[0]!];
    const unknown = [{ ...history.hours[0]!, classification: 'unknown' as const }, ...history.hours.slice(1)];
    const missingEnergy = [{ ...history.hours[0]!, coverage: 'unknown' as const }, ...history.hours.slice(1)];
    const wrongEnd = [{ ...history.hours[0]!, end: new Date(history.hours[0]!.end.getTime() - 60000) }, ...history.hours.slice(1)];
    for (const hours of [partial, unknown, missingEnergy]) {
      expect(estimateFiveDayOrdinaryRate({ ...input, history: { ...history, hours } })).toMatchObject({
        includedHours: 119, missingHours: 1, rawOrdinaryKcalPerHour: 75,
      });
    }
    for (const hours of [history.hours.slice(24), history.hours.slice(13), history.hours.filter((_, index) => index < 12 || index >= 24), duplicate, wrongEnd]) {
      expect(estimateFiveDayOrdinaryRate({ ...input, history: { ...history, hours } })).toBeNull();
    }
    const sampleAcrossBothHalves = history.hours.filter((_, index) => index >= 24 || index % 2 === 0);
    expect(estimateFiveDayOrdinaryRate({ ...input, history: { ...history, hours: sampleAcrossBothHalves } }))
      .toMatchObject({ includedHours: 108, missingHours: 12, rawOrdinaryKcalPerHour: 75 });
    const incomplete = { ...history, exerciseCoverage: { ...history.exerciseCoverage, end: instant('00:00') } };
    incomplete.exerciseCoverage.end = new Date(incomplete.exerciseCoverage.end.getTime() - 1);
    expect(estimateFiveDayOrdinaryRate({ ...input, history: incomplete })).toBeNull();
  });

  it.each([
    ['2026-03-09', ['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'], 119],
    ['2026-11-02', ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'], 121],
    ['2026-10-05', ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], 119.5],
  ] as const)('weights real elapsed time before %s across DST', (day, dates, expectedHours) => {
    const timezone = expectedHours === 119.5 ? 'Australia/Lord_Howe' : 'America/Chicago';
    const historical = historyFor(dates, timezone);
    expect(estimateFiveDayOrdinaryRate({ ...source, timezone, localDate: day, now: historical.retrievedAt, history: historical }))
      .toMatchObject({ includedHours: expectedHours, rawOrdinaryKcalPerHour: 75 });
  });

  it('withholds prior-day verification and different account, source, timezone or history window', () => {
    for (const historical of [
      { ...history, accountId: 'different' }, { ...history, sourceId: 'different' }, { ...history, timezone: 'America/Chicago' },
      { ...history, retrievedAt: new Date(history.retrievedAt.getTime() - 1) },
      historyFor(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'], 'UTC'),
    ]) {
      expect(qualifyOrdinaryStepForecast({ ...input, history: historical })).toMatchObject({ status: 'unavailable', reason: 'unqualified_history' });
    }
  });
});

describe('Google Health rollup compatibility', () => {
  const rows = history.hours.map(hour => ({ startTime: hour.start.toISOString(), endTime: hour.end.toISOString() }));
  const calories = rows.map(row => ({ ...row, totalCalories: { kcalSum: 75 } }));
  const steps = rows.map((row, index) => ({ ...row, steps: { countSum: index === 0 ? 0 : '20' } }));
  const recordedExercises = {
    coverage: history.exerciseCoverage, intervals: [{ start: history.hours[23]!.start, end: history.hours[24]!.end }],
    completeForOverlaps: true,
  };
  const payload = { ...source, retrievedAt: history.retrievedAt, recordedExercises,
    calories: { rollupDataPoints: calories }, steps: { rollupDataPoints: steps } };

  it('maps reported energy with explicit same-window steps and excludes recorded exercise without claiming classification', () => {
    const partlyPaired = steps.filter((_, index) => index !== 2).map((step, index) =>
      index === 4 ? { ...step, endTime: new Date(Date.parse(step.endTime) - 60000).toISOString() } : step);
    const proxy = normalizeGoogleHealthOrdinaryHistory({ ...payload, steps: { rollupDataPoints: partlyPaired } });
    expect(proxy?.history.hours[0]).toMatchObject({ coverage: 'reported_interval', classification: 'unknown' });
    expect(estimateFiveDayOrdinaryRate({ ...input, history: proxy!.history })).toMatchObject({
      rawOrdinaryKcalPerHour: 75, includedHours: 116, excludedHours: 2, missingHours: 2, basis: 'recorded_sessions_proxy',
    });
  });

  it('declines unexhausted pagination, duplicate buckets and a workout query without overlap proof', () => {
    expect(normalizeGoogleHealthOrdinaryHistory({ ...payload, steps: { ...payload.steps, nextPageToken: 'more' } })).toBeNull();
    expect(normalizeGoogleHealthOrdinaryHistory({ ...payload, steps: { rollupDataPoints: [...steps, steps[0]!] } })).toBeNull();
    expect(normalizeGoogleHealthOrdinaryHistory({ ...payload, recordedExercises: { ...recordedExercises, completeForOverlaps: false } })).toBeNull();
  });
});

describe('ordinary forecast through the existing Steps calculators', () => {
  it('replaces ordinary burn during hypothetical walking and applies 0.8 once', () => {
    const old = calculateBurnToStepPlan({
      currentSteps: 9000, projectedProviderBurnAtRest: 1700, providerCaloriesPerStep: 0.04,
      targetActualBurnCalories: 2000, adjustmentFactor: 0.8,
    });
    expect(old).toMatchObject({ totalDailyStepsNeeded: 29000, remainingSteps: 20000 });
    const qualified = ready();
    expect(qualified.plannerInput.projectedProviderBurnAtRest).toBe(2000);
    expect(qualified.plannerInput.providerCaloriesPerStep).toBeCloseTo(0.03583333333333);
    expect(plan(qualified)).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 14000 });
    expect(calculateStepToBurnPlan({ ...qualified.plannerInput, targetSteps: 23000 })).toMatchObject({
      additionalSteps: 14000, projectedProviderBurnCalories: 2500, projectedAdjustedBurnCalories: 2000,
    });
  });

  it('keeps the value-anchor pair fixed through elapsed time and identical polls', () => {
    const initial = ready();
    const later = ready({ now: instant('12:15') });
    expect(later.elapsedOrdinaryKcal).toBe(18.75);
    expect(later.elapsedOrdinaryKcal + later.futureOrdinaryKcal).toBe(initial.futureOrdinaryKcal);
    expect(plan(later)).toEqual(plan(initial));
    expect(ready({ now: instant('12:15') })).toEqual(later);
  });

  it('uses the existing reported planning reference for the baseline without claiming uncovered walking', () => {
    const observation = {
      ...source, localDate, cutoff, expiresAt: instant('12:30'), rawProviderKcal: 1100,
      coverage: 'reported_reference' as const, currentSteps: 9000,
    };
    const original = ready({ observation });
    const later = ready({ now: instant('12:12'), observation: { ...observation, currentSteps: 10000 } });
    expect(later.observationBasis).toBe('reported_reference');
    expect(later.incurredActivityReplacementKcal).toBe(0);
    expect(later.plannerInput.projectedProviderBurnAtRest).toBe(original.plannerInput.projectedProviderBurnAtRest);
    expect(plan(later)).toMatchObject({ totalDailyStepsNeeded: 24000, remainingSteps: 14000 });
  });

  it('replaces delayed walking once and reconciles aligned partial and full calorie catch-up', () => {
    const now = instant('12:12');
    const beforeCatchUp = ready({ now, observation: delayed });
    expect(beforeCatchUp.incurredActivityReplacementKcal).toBe(43);
    expect(beforeCatchUp.plannerInput.projectedProviderBurnAtRest).toBe(2043);
    expect(plan(beforeCatchUp)).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 12800 });
    for (const [nextCutoff, rawProviderKcal, stepsAtCutoff] of [
      [instant('12:06'), 1129, 9600], [now, 1158, 10200],
    ] as const) {
      const result = ready({ now, observation: { ...delayed, cutoff: nextCutoff, rawProviderKcal, stepsAtCutoff } });
      expect(result.plannerInput).toEqual(beforeCatchUp.plannerInput);
      expect(plan(result)).toEqual(plan(beforeCatchUp));
    }
    const straddle = { ...delayed, cutoff: instant('12:06'), rawProviderKcal: 1129, stepsAtCutoff: 9600, activity: [walk('12:00', '12:12', 1200)] };
    expect(qualifyOrdinaryStepForecast({ ...input, now, observation: straddle })).toMatchObject({ status: 'unavailable', reason: 'unqualified_activity_intervals' });
  });

  it('does not add incidental steps twice and replaces matched nonwalking exercise only once', () => {
    const now = instant('12:12');
    const incidental = { ...baseline, activityThrough: now, currentSteps: 9100, ordinaryStepsAfterCutoff: 100 };
    const ordinary = ready({ now, observation: incidental });
    expect(ordinary.incurredActivityReplacementKcal).toBe(0);
    expect(ordinary.plannerInput.projectedProviderBurnAtRest).toBe(2000);
    expect(plan(ordinary).remainingSteps).toBe(plan(ready()).remainingSteps);
    const cycling = { kind: 'other' as const, start: cutoff, end: now, rawGrossKcal: 75, steps: 0 };
    const cycled = ready({ now, observation: { ...incidental, activity: [cycling] } });
    expect(cycled.incurredActivityReplacementKcal).toBe(60);
    expect(cycled.plannerInput.projectedProviderBurnAtRest).toBe(2060);
    expect(qualifyOrdinaryStepForecast({ ...input, now, observation: { ...incidental, activity: [cycling, cycling] } }))
      .toMatchObject({ status: 'unavailable', reason: 'unqualified_activity_intervals' });
  });

  it('withholds unknown alignment, invalid calibration, expiry and day rollover', () => {
    for (const observation of [
      { ...baseline, coverage: 'unknown' as const }, { ...baseline, activityCoverage: 'unknown' as const },
      { ...baseline, currentSteps: 9100 }, { ...baseline, activityThrough: instant('12:05') },
      { ...baseline, accountId: 'different' }, { ...baseline, sourceId: 'different' }, { ...baseline, timezone: 'America/Chicago' },
      { ...baseline, localDate: '2026-10-29' },
    ]) {
      expect(qualifyOrdinaryStepForecast({ ...input, observation })).toMatchObject({ status: 'unavailable', reason: 'unqualified_current_coverage' });
    }
    expect(qualifyOrdinaryStepForecast({ ...input, now: instant('12:30') })).toMatchObject({ status: 'unavailable', reason: 'unqualified_current_coverage' });
    expect(qualifyOrdinaryStepForecast({ ...input, now: new Date('2026-10-31T00:00:00Z') })).toMatchObject({ status: 'unavailable', reason: 'unqualified_history' });
    expect(qualifyOrdinaryStepForecast({ ...input, calibration: { ...calibration, expiresAt: cutoff } }))
      .toMatchObject({ status: 'unavailable', reason: 'unqualified_calibration' });
    expect(qualifyOrdinaryStepForecast({ ...input, calibration: { ...calibration, rawNetWalkingKcalPerStep: 0.001 } }))
      .toMatchObject({ status: 'unavailable', reason: 'walking_does_not_support_target' });
  });

  it('shows genuine downward evidence and calibration revisions, and preserves exact feasibility', () => {
    const original = plan(ready());
    const revised = ready({ observation: { ...baseline, rawProviderKcal: 1060 } });
    expect(plan(revised).remainingSteps).toBeGreaterThan(original.remainingSteps);
    const recalibrated = ready({ calibration: { ...calibration, rawNetWalkingKcalPerStep: 0.035 } });
    expect(plan(recalibrated).remainingSteps).toBeGreaterThan(original.remainingSteps);
    const late = instant('23:45');
    const projected = ready({
      now: late,
      observation: { ...baseline, cutoff: late, activityThrough: late, expiresAt: new Date('2026-10-31T00:00:00Z') },
      calibration: { ...calibration, expiresAt: new Date('2026-10-31T00:00:00Z') },
    });
    expect(walkingMidnightFeasibility({
      remainingSteps: plan(projected).remainingSteps, stepsPerMinute: projected.stepsPerMinute, localDate, timezone: 'UTC', now: late,
    })).toBe('insufficient_time');
  });
});


it('keeps ordinary forecast configuration off unless an explicit supported mode is selected', () => {
  expect(parseApiEnv({ NODE_ENV: 'test' }).GOOGLE_HEALTH_ORDINARY_FORECAST_MODE).toBe('disabled');
  expect(parseApiEnv({ NODE_ENV: 'test', GOOGLE_HEALTH_ORDINARY_FORECAST_MODE: 'recorded_sessions_proxy' }).GOOGLE_HEALTH_ORDINARY_FORECAST_MODE).toBe('recorded_sessions_proxy');
  expect(() => parseApiEnv({ NODE_ENV: 'test', GOOGLE_HEALTH_ORDINARY_FORECAST_MODE: 'guess' })).toThrow();
});


it('does not call an empirical low-activity TOTAL rate a basal component for walking replacement', () => {
  const lowActivity = qualifyOrdinaryStepForecast({ ...input, calibration: {
    ...calibration, energyBasis: 'low_activity_total',
  } as unknown as Parameters<typeof qualifyOrdinaryStepForecast>[0]['calibration'] });
  expect(lowActivity).toMatchObject({ status: 'unavailable', reason: 'unqualified_calibration' });
  const gross = qualifyOrdinaryStepForecast({ ...input, calibration: {
    ...source, expiresAt: instant('13:00'), energyBasis: 'matched_total_interval',
    rawGrossWalkingKcalPerStep: 0.04 + 50 / 6000, stepsPerMinute: 100,
  } });
  expect(gross.status).toBe('ready');
  if (gross.status === 'ready') expect(gross.plannerInput.providerCaloriesPerStep).toBeCloseTo(0.04 + (50 - 75) / 6000);
});

it('excludes high-step reported hours from the nonactivity proxy and never hides start-window uncertainty', () => {
  const proxy = { ...history, basis: 'recorded_sessions_proxy' as const, sessionCoverage: 'start_window_only' as const,
    hours: history.hours.map(hour => ({ ...hour, steps: 20 })) };
  proxy.hours[0]!.steps = 500;
  const result = estimateFiveDayOrdinaryRate({ ...input, history: proxy });
  expect(result?.sessionCoverage).toBe('start_window_only');
  expect(result?.excludedHours).toBe(1);
});
