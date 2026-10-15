import { describe, expect, it } from 'vitest';
import { calculateBurnToStepPlan, calculateStepToBurnPlan, getLocalDateUtcBounds, resolveForecastCoverage, walkingMidnightFeasibility, type ForecastEvidence } from '@caloriebank/domain';

const evidence: ForecastEvidence = { provider: 'google_health_fitbit', localDate: '2026-10-15', timezone: 'UTC', rawTotalDailyExpenditure: 2260, forecastCoverageAt: new Date('2026-10-15T08:00:00Z') };
const at = (time: string) => new Date(`2026-10-15T${time}Z`);
function plan(observation: ForecastEvidence, steps = 2000, coefficient = .05) {
  const hours = (getLocalDateUtcBounds(observation.localDate, observation.timezone).end.getTime() - observation.forecastCoverageAt!.getTime()) / 3600000;
  const common = { currentSteps: steps, projectedProviderBurnAtRest: observation.rawTotalDailyExpenditure + 80 * hours, providerCaloriesPerStep: coefficient, adjustmentFactor: .8 };
  return { baseline: common.projectedProviderBurnAtRest, inverse: calculateBurnToStepPlan({ ...common, targetActualBurnCalories: 4000 }), forward: calculateStepToBurnPlan({ ...common, targetSteps: 31200 }) };
}
describe('Phase 2A evidence coverage and conservative planning', () => {
  it('reproduces 29200 -> 30000 and prevents retrieval from manufacturing that change', () => {
    expect(plan(evidence).baseline).toBe(3540);
    expect(plan(evidence).inverse.remainingSteps).toBe(29200);
    expect(plan({ ...evidence, forecastCoverageAt: at('08:30:00') }).inverse.remainingSteps).toBe(30000);
    const incoming = { ...evidence, forecastCoverageAt: null };
    const coverage = resolveForecastCoverage(evidence, incoming, at('08:30:00'));
    expect(coverage).toEqual(evidence.forecastCoverageAt);
    expect(plan({ ...incoming, forecastCoverageAt: coverage })).toEqual(plan(evidence));
  });
  it('keeps both directions identical across clock-only reads and repeated identical retrievals', () => {
    for (let minute = 0; minute <= 30; minute++) {
      const now = new Date(at('08:00:00').getTime() + minute * 60000);
      const anchor = resolveForecastCoverage(evidence, { ...evidence, forecastCoverageAt: null }, now);
      for (const steps of [0, 2000, 2051, 30000]) {
        expect(plan({ ...evidence, forecastCoverageAt: anchor }, steps)).toEqual(plan(evidence, steps));
      }
    }
  });
  it('recalculates genuine observations, downward revisions and calibration changes without caps', () => {
    const fresh = { ...evidence, rawTotalDailyExpenditure: 2300, forecastCoverageAt: at('08:30:00') };
    expect(resolveForecastCoverage(evidence, fresh, at('08:30:00'))).toEqual(fresh.forecastCoverageAt);
    expect(plan(fresh).inverse.remainingSteps).toBe(29200);
    expect(plan({ ...fresh, rawTotalDailyExpenditure: 2290 }).inverse.remainingSteps).toBe(29400);
    expect(plan({ ...fresh, rawTotalDailyExpenditure: 2200 }).inverse.remainingSteps).toBe(31200);
    expect(plan({ ...fresh, rawTotalDailyExpenditure: 2450 }, 5000).inverse.remainingSteps).toBe(26200);
    expect(plan(evidence, 2000, .04).inverse.remainingSteps).toBe(36500);
    // Identical calories may legitimately have newer proven coverage.
    expect(resolveForecastCoverage(evidence, { ...evidence, forecastCoverageAt: at('08:30:00') }, at('08:30:00'))).toEqual(at('08:30:00'));
  });
  it('does not invent coverage for initial, delayed or revised unverified observations', () => {
    expect(resolveForecastCoverage(null, { ...evidence, forecastCoverageAt: null }, at('08:30:00'))).toBeNull();
    expect(resolveForecastCoverage(evidence, { ...evidence, rawTotalDailyExpenditure: 2300, forecastCoverageAt: null }, at('08:30:00'))).toBeNull();
    expect(resolveForecastCoverage(evidence, { ...evidence, rawTotalDailyExpenditure: 2200, forecastCoverageAt: null }, at('08:30:00'))).toBeNull();
    expect(resolveForecastCoverage(null, evidence, at('09:00:00'))).toEqual(at('08:00:00'));
    expect(resolveForecastCoverage(evidence, { ...evidence, forecastCoverageAt: at('09:00:00') }, at('08:30:00'))).toBeNull();
    expect(resolveForecastCoverage(evidence, { ...evidence, forecastCoverageAt: new Date('2026-10-14T23:59:00Z') }, at('08:30:00'))).toBeNull();
  });
  it.each([{ provider: 'apple_health' }, { timezone: 'America/Chicago' }, { localDate: '2026-10-16' }, { activeEnergyCalories: 200 }])('never carries coverage across incompatible evidence %j', change => {
    expect(resolveForecastCoverage(evidence, { ...evidence, ...change, forecastCoverageAt: null }, at('08:30:00'))).toBeNull();
  });
  it('rounds total targets upwards and subtracts observed steps exactly', () => {
    for (const currentSteps of [0, 2000, 2001, 2050, 2099]) {
      for (const needed of [0, .01, 49, 50, 50.01, 99, 100, 100.01, 29200.01]) {
        const baseline = 5000 - needed * .05;
        const result = calculateBurnToStepPlan({ currentSteps, projectedProviderBurnAtRest: baseline, targetActualBurnCalories: 4000, providerCaloriesPerStep: .05, adjustmentFactor: .8 });
        expect(result.remainingSteps).toBe(result.totalDailyStepsNeeded - currentSteps);
        expect((baseline + result.remainingSteps * .05) * .8).toBeGreaterThanOrEqual(4000 - 1e-9);
        if (needed > 0) expect(result.totalDailyStepsNeeded % 100).toBe(0);
      }
    }
    // Nearest-100 previously gave 100 remaining, below the necessary 140.
    const result = calculateBurnToStepPlan({ currentSteps: 2000, projectedProviderBurnAtRest: 4993, targetActualBurnCalories: 4000, providerCaloriesPerStep: .05, adjustmentFactor: .8 });
    expect(result.remainingSteps).toBe(200);
    // Rounded-up burn must not make a deficient plan look already on track.
    expect(calculateBurnToStepPlan({ currentSteps: 2000, projectedProviderBurnAtRest: 4996, targetActualBurnCalories: 4000, providerCaloriesPerStep: .05, adjustmentFactor: .8 }).remainingSteps).toBe(100);
  });
});
describe('personalized midnight feasibility', () => {
  const input = { remainingSteps: 3000, stepsPerMinute: 100, localDate: '2026-10-15', timezone: 'UTC', now: at('23:30:00') };
  it('preserves exact boundary, rejects one second later, and handles unavailable pace', () => {
    expect(walkingMidnightFeasibility(input)).toBe('fits');
    expect(walkingMidnightFeasibility({ ...input, now: at('23:30:01') })).toBe('insufficient_time');
    expect(walkingMidnightFeasibility({ ...input, stepsPerMinute: null })).toBe('unknown');
    expect(walkingMidnightFeasibility({ ...input, remainingSteps: 0, now: at('23:59:59') })).toBe('fits');
    expect(walkingMidnightFeasibility({ ...input, stepsPerMinute: 50 })).toBe('insufficient_time');
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('uses the %s DST day length (%i hours)', (localDate, hours) => {
    const bounds = getLocalDateUtcBounds(localDate, 'America/Chicago');
    const base = { remainingSteps: hours * 60 * 100, stepsPerMinute: 100, localDate, timezone: 'America/Chicago', now: bounds.start };
    expect(walkingMidnightFeasibility(base)).toBe('fits');
    expect(walkingMidnightFeasibility({ ...base, remainingSteps: base.remainingSteps + 1 })).toBe('insufficient_time');
  });
  it('uses the current timezone without changing the required steps', () => {
    const late = { ...input, now: at('23:45:00') };
    expect(walkingMidnightFeasibility(late)).toBe('insufficient_time');
    expect(walkingMidnightFeasibility({ ...late, timezone: 'America/Chicago' })).toBe('fits');
    expect(late.remainingSteps).toBe(3000);
  });
});
