import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateProjectedEatingBudget, calculateEatingBudget, planIntakeForSteps, planStepsForIntake, getLocalDateUtcBounds,
  type BudgetContext, type BudgetExpenditure, type BudgetIntake, type EatPlanningModel } from '../src/index';

const context = (): BudgetContext => ({ accountId: 'synthetic-user', expenditureSourceId: 'synthetic-burn', intakeSourceId: 'synthetic-intake',
  localDate: '2026-10-18', timezone: 'America/Chicago', now: new Date('2026-10-18T17:05:00Z'), signedGoalAdjustmentCalories: -500, dailyBankTargetCalories: 200 });
const expenditure = (): BudgetExpenditure => ({ accountId: 'synthetic-user', sourceId: 'synthetic-burn', localDate: '2026-10-18', timezone: 'America/Chicago',
  semantic: 'accumulated', rawProviderCalories: 2000, coverage: 'verified', coverageAt: new Date('2026-10-18T17:00:00Z'), planningExpiresAt: new Date('2026-10-18T17:30:00Z'),
  remainingRest: { rawProviderCalories: 1000, from: new Date('2026-10-18T17:00:00Z'), through: new Date('2026-10-19T05:00:00Z'), qualified: true } });
const intake = (): BudgetIntake => ({ accountId: 'synthetic-user', sourceId: 'synthetic-intake', localDate: '2026-10-18', timezone: 'America/Chicago',
  semantic: 'observed_current_day_intake', calories: 1000, coverage: { verified: true, policyId: 'synthetic-approved-policy', through: new Date('2026-10-18T17:00:00Z'), expiresAt: new Date('2026-10-18T17:15:00Z') }, correction: null });
const model = (): EatPlanningModel => ({ accountId: 'synthetic-user', sourceId: 'synthetic-burn', localDate: '2026-10-18', timezone: 'America/Chicago',
  qualified: true, currentSteps: 8000, currentStepsAt: new Date('2026-10-18T17:00:00Z'), providerCaloriesPerAdditionalStep: 0.05, stepsPerMinute: 100 });
function total(c = context(), e = expenditure(), i: BudgetIntake | null = null) {
  const result = calculateEatingBudget(c, e, i);
  assert.notEqual(result.status, 'unavailable');
  if (result.status === 'unavailable') throw new Error(result.reason);
  return result;
}
for (const [name, adjustment, expected] of [['cut', -500, 1700], ['maintain', 0, 2200], ['bulk', 300, 2500]] as const) {
  test(`${name}: signed goal and independent optional target`, () => {
    assert.equal(total({ ...context(), signedGoalAdjustmentCalories: adjustment }).totalCalories, expected);
    assert.equal(total({ ...context(), signedGoalAdjustmentCalories: adjustment, dailyBankTargetCalories: 0 }).totalCalories, expected + 200);
  });
}
test('raw round-once boundary; 0.8 is not applied to already adjusted display values', () => {
  const e = expenditure(); e.rawProviderCalories = 1000.4; e.remainingRest!.rawProviderCalories = 1000.4;
  assert.equal(total({ ...context(), signedGoalAdjustmentCalories: 0, dailyBankTargetCalories: 0 }, e).totalCalories, 1601);
});
test('observed intake alone yields Remaining Today; full-day estimate never becomes consumed food', () => {
  assert.deepEqual(total(context(), expenditure(), intake()).comparison, { kind: 'remaining_today', calories: 700 });
  assert.deepEqual(total(context(), expenditure(), { ...intake(), semantic: 'estimated_total_day_intake', calories: 1800, coverage: null }).comparison,
    { kind: 'estimated_day_difference', calories: -100 });
});
test('source-bound correction adds once; replacement switches to whole-day semantic; zero valid', () => {
  const i = intake(); i.correction = { ...i, mode: 'add', calories: 100 };
  assert.equal(total(context(), expenditure(), i).comparison?.calories, 600);
  i.correction.mode = 'replace'; i.correction.calories = 0;
  assert.deepEqual(total(context(), expenditure(), i).comparison, { kind: 'estimated_day_difference', calories: 1700 });
  i.calories = null; i.correction.mode = 'add';
  assert.equal(total(context(), expenditure(), i).comparison, null);
  i.correction.mode = 'replace';
  assert.equal(total(context(), expenditure(), i).comparison?.kind, 'estimated_day_difference');
});
test('mismatched source/writer/account/date correction rejected; no authority fallback', () => {
  for (const patch of [{ accountId: 'other' }, { sourceId: 'another-writer' }, { localDate: '2026-10-17' }, { timezone: 'UTC' }]) {
    const i = intake(); i.correction = { ...i, ...patch, mode: 'add', calories: 100 };
    assert.equal(total(context(), expenditure(), i).comparison, null);
    assert.equal(total(context(), expenditure(), { ...i, correction: null, ...patch }).comparison, null);
  }
});
test('observed missing/stale/unverified/future coverage omits comparison without hiding valid total', () => {
  assert.equal(total().comparison, null);
  for (const coverage of [null, { ...intake().coverage!, verified: false }, { ...intake().coverage!, policyId: '' }, { ...intake().coverage!, expiresAt: context().now },
    { ...intake().coverage!, through: new Date('2026-10-18T18:00:00Z') }]) {
    assert.equal(total(context(), expenditure(), { ...intake(), coverage }).comparison, null);
  }
  assert.equal(total(context(), expenditure(), { ...intake(), semantic: 'unknown' }).comparison, null);
});
test('invalid numeric intake/correction never changes or invents budget', () => {
  for (const value of [-1, NaN, Infinity, 1.5]) {
    assert.equal(total(context(), expenditure(), { ...intake(), calories: value }).comparison, null);
    const i = intake(); i.correction = { ...i, mode: 'add', calories: value };
    assert.equal(total(context(), expenditure(), i).comparison, null);
  }
});
test('negative/zero total explicit non_positive, never clamped into valid actionable recommendation', () => {
  assert.equal(total({ ...context(), signedGoalAdjustmentCalories: -3000 }).status, 'non_positive');
  assert.equal(total({ ...context(), signedGoalAdjustmentCalories: -3000 }).totalCalories, -800);
  assert.equal(total({ ...context(), signedGoalAdjustmentCalories: -2200 }).totalCalories, 0);
});
test('late provider correction decreases total; changed calorie number cannot extend same horizon', () => {
  assert.equal(total(context(), { ...expenditure(), rawProviderCalories: 1900 }).totalCalories, 1620);
  assert.deepEqual(calculateEatingBudget({ ...context(), now: new Date('2026-10-18T17:30:00Z') }, { ...expenditure(), rawProviderCalories: 2100, planningExpiresAt: new Date('2026-10-18T18:00:00Z') }),
    { status: 'unavailable', reason: 'stale_expenditure' });
});
test('missing/unknown/unverified/invalid expenditure fails closed', () => {
  assert.equal(calculateEatingBudget(context(), null).status, 'unavailable');
  for (const patch of [{ semantic: 'unknown' as const }, { coverage: 'unverified' as const }, { rawProviderCalories: -1 }, { rawProviderCalories: NaN },
    { accountId: 'other' }, { sourceId: 'other' }, { coverageAt: new Date('2026-10-18T18:00:00Z') }, { coverageAt: new Date('invalid') }]) {
    assert.equal(calculateEatingBudget(context(), { ...expenditure(), ...patch }).status, 'unavailable');
  }
});
test('rest must start exactly after common coverage and end at local midnight; no overlapping windows', () => {
  const e = expenditure();
  for (const rest of [null, { ...e.remainingRest!, qualified: false }, { ...e.remainingRest!, from: new Date('2026-10-18T16:59:00Z') },
    { ...e.remainingRest!, through: new Date('2026-10-19T06:00:00Z') }, { ...e.remainingRest!, rawProviderCalories: -1 }]) {
    assert.equal(calculateEatingBudget(context(), { ...e, remainingRest: rest }).status, 'unavailable');
  }
});
test('verified full-day estimate never appends rest', () => {
  assert.equal(total(context(), { ...expenditure(), semantic: 'verified_full_day_estimate', rawProviderCalories: 3000, remainingRest: null }).totalCalories, 1700);
  assert.equal(calculateEatingBudget(context(), { ...expenditure(), semantic: 'verified_full_day_estimate' }).status, 'unavailable');
});
test('earlier forecast deadline wins; rollover and timezone mismatch fail closed', () => {
  assert.equal(calculateEatingBudget(context(), { ...expenditure(), planningExpiresAt: context().now }).status, 'unavailable');
  assert.equal(calculateEatingBudget({ ...context(), now: new Date('2026-10-19T05:00:00Z') }, expenditure()).status, 'unavailable');
  assert.equal(calculateEatingBudget({ ...context(), localDate: '2026-10-19' }, expenditure()).status, 'unavailable');
  assert.equal(calculateEatingBudget({ ...context(), timezone: 'UTC' }, expenditure()).status, 'unavailable');
});
test('actual Chicago DST bounds 23/25 hours enforce rest end and midnight expiry', () => {
  for (const [date, start, end, hours] of [['2026-03-08', '2026-03-08T06:00:00Z', '2026-03-09T05:00:00Z', 23], ['2026-11-01', '2026-11-01T05:00:00Z', '2026-11-02T06:00:00Z', 25]] as const) {
    const bounds = getLocalDateUtcBounds(date, 'America/Chicago');
    assert.equal(bounds.start.getTime(), Date.parse(start)); assert.equal(bounds.end.getTime(), Date.parse(end));
    assert.equal((bounds.end.getTime() - bounds.start.getTime()) / 3600000, hours);
    const horizon = new Date(bounds.end.getTime() - 60_000);
    const c = { ...context(), localDate: date, now: horizon };
    const e = { ...expenditure(), localDate: date, coverageAt: horizon, planningExpiresAt: new Date(bounds.end.getTime() + 3600000), remainingRest: { rawProviderCalories: 1, from: horizon, through: bounds.end, qualified: true } };
    assert.equal(total(c, e).expiresAt.getTime(), Date.parse(end));
  }
});
test('invalid context date/timezone/numbers never throws or borrows historical evidence', () => {
  for (const patch of [{ timezone: 'Invalid/Zone' }, { localDate: 'bad' }, { now: new Date('invalid') }, { dailyBankTargetCalories: 2001 }, { dailyBankTargetCalories: -1 }, { signedGoalAdjustmentCalories: Infinity }]) {
    assert.equal(calculateEatingBudget({ ...context(), ...patch }, expenditure()).status, 'unavailable');
  }
});
test('Direction B preserves outcome and only credits future steps, raw precision retained', () => {
  const result = planIntakeForSteps(context(), expenditure(), model(), 10000);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') { assert.equal(result.totalIntakeCalories, 1780); assert.equal(result.additionalSteps, 2000); }
  const below = planIntakeForSteps(context(), expenditure(), model(), 5000);
  if (below.status === 'ready') { assert.equal(below.totalIntakeCalories, 1700); assert.equal(below.additionalSteps, 0); assert.equal(below.totalSteps, 8000); }
  else assert.fail(below.reason);
});
test('Direction A reuses conservative inverse; already-on-track branch preserves exact step count', () => {
  const result = planStepsForIntake(context(), expenditure(), model(), 1900);
  if (result.status === 'ready') { assert.equal(result.totalSteps, 13000); assert.ok(result.totalIntakeCalories >= 1900); } else assert.fail(result.reason);
  const noActivity = planStepsForIntake(context(), expenditure(), { ...model(), currentSteps: 8001, stepsPerMinute: null }, 1000);
  if (noActivity.status === 'ready') { assert.equal(noActivity.totalSteps, 8001); assert.equal(noActivity.additionalSteps, 0); } else assert.fail(noActivity.reason);
});
test('invalid model, missing pace/time and impossible steps do not promise feasible activity', () => {
  for (const patch of [{ qualified: false }, { accountId: 'other' }, { sourceId: 'other' }, { currentStepsAt: new Date('2026-10-18T16:59:00Z') }, { providerCaloriesPerAdditionalStep: 0 }, { currentSteps: -1 }]) {
    assert.deepEqual(planStepsForIntake(context(), expenditure(), { ...model(), ...patch }, 1900), { status: 'unavailable', reason: 'invalid_model' });
  }
  assert.equal(planStepsForIntake(context(), expenditure(), { ...model(), stepsPerMinute: null }, 1900).status, 'unavailable');
  assert.equal(planIntakeForSteps(context(), expenditure(), model(), 1000000).status, 'unavailable');
  assert.equal(planStepsForIntake(context(), expenditure(), model(), -1).status, 'unavailable');
});
test('2,430 forward/inverse combinations meet hypothetical target or explicitly decline time feasibility', () => {
  let count = 0;
  for (const q of [1000, 2000.4, 3000.8]) for (const goal of [-500, 0, 300]) for (const target of [0, 200, 2000])
    for (const steps of [0, 8001, 12000]) for (const rate of [0.02, 0.05, 0.1]) for (const food of [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]) {
      const c = { ...context(), signedGoalAdjustmentCalories: goal, dailyBankTargetCalories: target };
      const e = { ...expenditure(), rawProviderCalories: q, remainingRest: { ...expenditure().remainingRest!, rawProviderCalories: 0 } };
      const m = { ...model(), currentSteps: steps, providerCaloriesPerAdditionalStep: rate };
      const result = planStepsForIntake(c, e, m, food);
      if (result.status === 'ready') {
        assert.ok(result.totalIntakeCalories >= food); assert.ok(result.totalSteps >= steps);
        const forward = planIntakeForSteps(c, e, m, result.totalSteps);
        assert.equal(forward.status, 'ready');
        if (forward.status === 'ready') assert.equal(forward.totalIntakeCalories, result.totalIntakeCalories);
      } else assert.ok(['insufficient_time', 'invalid_target'].includes(result.reason));
      count++;
    }
  assert.equal(count, 2430);
});
test('pure reads leave synthetic inputs and accounting snapshot byte-equivalent', () => {
  const c = context(), e = expenditure(), i = intake(), m = model();
  const accounting = { openingBank: 700, ledger: [{ id: 'immutable', amount: 100 }], availableBank: 800, recovery: 0, history: ['locked'] };
  const before = JSON.stringify({ c, e, i, m, accounting });
  calculateEatingBudget(c, e, i); planIntakeForSteps(c, e, m, 10000); planStepsForIntake(c, e, m, 1900);
  assert.equal(JSON.stringify({ c, e, i, m, accounting }), before);
  // A pure-domain test does not qualify future API/database persistence boundaries.
});

test('comparison deadline is independently bounded by approved intake SLA', () => {
  const result = total(context(), expenditure(), intake());
  assert.equal(result.expiresAt.toISOString(), '2026-10-18T17:30:00.000Z');
  assert.equal(result.comparisonExpiresAt?.toISOString(), '2026-10-18T17:15:00.000Z');
});

test('safe total and safe intake cannot yield an unsafe comparison difference', () => {
  const c = { ...context(), signedGoalAdjustmentCalories: -2401, dailyBankTargetCalories: 0 };
  for (const semantic of ['observed_current_day_intake', 'estimated_total_day_intake'] as const) {
    const result = total(c, expenditure(), { ...intake(), semantic, calories: Number.MAX_SAFE_INTEGER });
    assert.equal(result.totalCalories, -1);
    assert.equal(result.comparison, null);
    assert.equal(result.comparisonUnavailable, true);
    assert.equal(result.comparisonExpiresAt, null);
  }
});

test('projected adjusted burn budget: once-only units, goal signs, bank target and dynamic updates',()=>{
 for(const [burn,goal,bank,expected] of [[3000,-500,300,2200],[2400,-500,300,1600],[3200,-500,300,2400],[3000,0,300,2700],[3000,300,300,3000],[100,-500,300,-700]]){
  const result=calculateProjectedEatingBudget({projectedAdjustedBurnCalories:burn,signedGoalAdjustmentCalories:goal,dailyBankTargetCalories:bank});assert.notEqual(result.status,'unavailable');if(result.status!=='unavailable')assert.equal(result.totalCalories,expected);
 }
 assert.equal(calculateProjectedEatingBudget({projectedAdjustedBurnCalories:NaN,signedGoalAdjustmentCalories:0,dailyBankTargetCalories:0}).status,'unavailable');
});
