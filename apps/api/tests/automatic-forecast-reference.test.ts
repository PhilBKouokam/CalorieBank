import { describe, expect, it } from 'vitest';
import { calculateAnchoredRestProjection, calculateBurnToStepPlan, calculateStepToBurnPlan,
  getLocalDateUtcBounds, normalizeDailyExpenditureAggregate, resolvePlanningEvidence,
  walkingMidnightFeasibility } from '@caloriebank/domain';

const at = (time: string) => new Date(`2026-10-30T${time}Z`);
const base = { provider: 'google_health_fitbit', localDate: '2026-10-30', timezone: 'UTC', rawTotalDailyExpenditure: 2260 };
const first = () => resolvePlanningEvidence(null, { ...base, reportedIntervalEndAt: at('08:00:00') }, at('08:00:00'));
function forecast(anchor: Date, now: Date, burn = 2260, steps = 2000, rate = 80, coefficient = .05) {
  const projection = calculateAnchoredRestProjection({ observedProviderCalories: burn,
    providerRestCaloriesPerHour: rate, anchor, now, localDate: base.localDate, timezone: base.timezone })!;
  const shared = { currentSteps: steps, projectedProviderBurnAtRest: projection.unroundedProjectedProviderBurnCalories,
    providerCaloriesPerStep: coefficient, adjustmentFactor: .8 };
  return { ...projection, inverse: calculateBurnToStepPlan({ ...shared, targetActualBurnCalories: 4000 }),
    forward: calculateStepToBurnPlan({ ...shared, targetSteps: 31200 }) };
}
describe('automatic forecast: value/reference conservation', () => {
  it.each([10, 15, 30])('carries %i minutes of elapsed rest in planning only, with an invariant full-day baseline', minutes => {
    const now = new Date(at('08:00:00').getTime() + minutes * 60000);
    const value = forecast(at('08:00:00'), now);
    expect(value.estimatedProviderCaloriesNow).toBeCloseTo(2260 + 80 * minutes / 60);
    expect(value.estimatedProviderCaloriesNow + value.remainingRestCalories).toBeCloseTo(3540);
    expect(value.unroundedProjectedProviderBurnCalories).toBe(3540);
    expect(value.inverse.totalDailyStepsNeeded).toBe(31200);
    expect(value.inverse.remainingSteps).toBe(29200);
  });
  it('does not move the reference or renew freshness for identical totals and newer reported buckets', () => {
    let state = first();
    for (let minutes = 1; minutes <= 31; minutes++) {
      const now = new Date(at('08:00:00').getTime() + minutes * 60000);
      state = resolvePlanningEvidence({ ...base, ...state }, { ...base, reportedIntervalEndAt: now }, now);
      expect(state.planningAnchorAt).toEqual(at('08:00:00'));
      expect(state.planningExpiresAt).toEqual(at('08:30:00'));
      expect(forecast(state.planningAnchorAt, now).inverse.totalDailyStepsNeeded).toBe(31200);
    }
    expect(state.planningExpiresAt < at('08:31:00')).toBe(true);
  });
  it('does not replace stronger unchanged-value evidence with a later reported bucket', () => {
    const initial = resolvePlanningEvidence(null, { ...base, forecastCoverageAt: at('08:00:00') }, at('08:00:00'));
    const result = resolvePlanningEvidence({ ...base, ...initial }, { ...base, reportedIntervalEndAt: at('08:15:00') }, at('08:15:00'));
    expect(result.planningAnchorAt).toEqual(at('08:00:00'));
    expect(result.planningAnchorKind).toBe('verified_coverage');
    expect(result.planningExpiresAt).toEqual(at('08:30:00'));
  });
  it('does not move a supported value/reference pair when repeated retrieval has no optional metadata', () => {
    const next = resolvePlanningEvidence({ ...base, ...first() }, base, at('08:15:00'));
    expect(next.planningAnchorAt).toEqual(at('08:00:00'));
    expect(next.planningAnchorKind).toBe('reported_interval');
    expect(next.planningExpiresAt).toEqual(at('08:30:00'));
  });
  it.each([10, 15, 30])('replaces elapsed rest with authoritative catch-up after %i minutes, without double counting', minutes => {
    const now = new Date(at('08:00:00').getTime() + minutes * 60000);
    const burn = 2260 + Math.round(80 * minutes / 60);
    const next = resolvePlanningEvidence({ ...base, ...first() }, { ...base, rawTotalDailyExpenditure: burn, reportedIntervalEndAt: now }, now);
    const result = forecast(next.planningAnchorAt, now, burn);
    expect(result.estimatedProviderCaloriesNow).toBe(burn);
    expect(result.elapsedRestCalories).toBe(0);
    expect(Math.abs(result.unroundedProjectedProviderBurnCalories - 3540)).toBeLessThanOrEqual(.5);
  });
  it('extra steps with unchanged expenditure can raise the total target: no calorie contribution is invented', () => {
    const before = forecast(at('08:00:00'), at('08:00:00'));
    const after = forecast(at('08:00:00'), at('08:15:00'), 2260, 3500);
    expect(after.inverse.remainingSteps).toBe(before.inverse.remainingSteps);
    expect(after.inverse.totalDailyStepsNeeded).toBe(before.inverse.totalDailyStepsNeeded + 1500);
    // The old walking evidence is not added on top of the provider's cumulative total.
    expect(after.unroundedProjectedProviderBurnCalories).toBe(before.unroundedProjectedProviderBurnCalories);
  });
  it('reconciles calories catching up after steps without adding hypothetical activity twice', () => {
    const initial = forecast(at('08:00:00'), at('08:00:00'));
    const stepsAhead = forecast(at('08:00:00'), at('08:15:00'), 2260, 3500);
    expect(stepsAhead.inverse.totalDailyStepsNeeded).toBe(32700);
    // Synthetic provider catch-up: 40 observed rest calories + 75 observed activity
    // calories. These are provider observations here, never client-side credits.
    const caughtUp = forecast(at('08:30:00'), at('08:30:00'), 2375, 3500);
    expect(caughtUp.inverse.totalDailyStepsNeeded).toBe(initial.inverse.totalDailyStepsNeeded);
    expect(caughtUp.inverse.remainingSteps).toBe(27700);
    expect(caughtUp.elapsedRestCalories).toBe(0);
  });
  it('permits genuine shortfall, downward revision and calibration changes without a minimum cap', () => {
    expect(forecast(at('08:30:00'), at('08:30:00'), 2290).inverse.totalDailyStepsNeeded).toBe(31400);
    expect(forecast(at('08:30:00'), at('08:30:00'), 2200).inverse.totalDailyStepsNeeded).toBe(33200);
    expect(forecast(at('08:00:00'), at('08:00:00'), 2260, 2000, 70).inverse.totalDailyStepsNeeded).toBe(34400);
    expect(forecast(at('08:00:00'), at('08:00:00'), 2260, 2000, 80, .04).inverse.totalDailyStepsNeeded).toBe(38500);
  });
  it('continues to respect actual measurement/verified coverage progress, even at unchanged totals', () => {
    for (const metadata of [{ forecastCoverageAt: at('08:15:00') }, { activeSampleEndAt: at('08:15:00') }]) {
      expect(resolvePlanningEvidence({ ...base, ...first() }, { ...base, ...metadata }, at('08:15:00')).planningAnchorAt).toEqual(at('08:15:00'));
    }
  });
  it('withholds undated values/revisions, rather than manufacturing a measurement timestamp', () => {
    for (const previous of [null, { ...base, ...first() }]) {
      const result = resolvePlanningEvidence(previous, { ...base, rawTotalDailyExpenditure: 2300 }, at('08:15:00'));
      expect(result.planningAnchorKind).toBe('retrieval_assumption');
      expect(result.planningExpiresAt < at('08:15:00')).toBe(true);
    }
  });
  it('never imports estimated rest or the adjustment twice', () => {
    const row = normalizeDailyExpenditureAggregate({ ...base, userId: 'synthetic', providerRecordId: 'synthetic',
      importedAt: at('08:15:00'), providerUpdatedAt: at('08:15:00'), syncStatus: 'ready', isCurrentDay: true });
    expect(row.rawTotalDailyExpenditure).toBe(2260);
    expect(row.adjustedDailyExpenditure).toBe(1808);
    expect(forecast(at('08:00:00'), at('08:15:00')).estimatedProviderCaloriesNow).toBe(2280);
    expect(row.rawTotalDailyExpenditure).toBe(2260);
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('uses the actual %s local day (%i hours)', (localDate, hours) => {
    const { start, end } = getLocalDateUtcBounds(localDate, 'America/Chicago');
    const input = { observedProviderCalories: 10, providerRestCaloriesPerHour: 80, anchor: start, localDate, timezone: 'America/Chicago' };
    expect(calculateAnchoredRestProjection({ ...input, now: new Date(end.getTime() - 1) })?.unroundedProjectedProviderBurnCalories).toBe(10 + 80 * hours);
    expect(calculateAnchoredRestProjection({ ...input, now: end })).toBeNull();
  });
  it('does not let a clock-stable target imply feasibility after the deadline has passed', () => {
    const input = { remainingSteps: 3000, stepsPerMinute: 100, localDate: base.localDate, timezone: base.timezone };
    expect(walkingMidnightFeasibility({ ...input, now: at('23:30:00') })).toBe('fits');
    expect(walkingMidnightFeasibility({ ...input, now: at('23:30:01') })).toBe('insufficient_time');
  });
  it.each([{ provider: 'apple_health' }, { localDate: '2026-10-31' }])('never borrows another source/day reference: %j', change => {
    const result = resolvePlanningEvidence({ ...base, ...first() }, { ...base, ...change }, new Date('2026-10-31T08:00:00Z'));
    expect(result.planningAnchorKind).toBe('retrieval_assumption');
    expect(result.planningExpiresAt < new Date('2026-10-31T08:00:00Z')).toBe(true);
  });
});
