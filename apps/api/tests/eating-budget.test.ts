import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { eatingBudgetResponseSchema, todayResponseSchema } from '@caloriebank/schemas';
import { createEatingBudgetRouter } from '../src/modules/eating-budget/eating-budget.routes';
import { PrismaEatingBudgetRepository, type BudgetSnapshot } from '../src/modules/eating-budget/eating-budget.repository';
import { errorHandler } from '../src/errors';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import type { TodayResponse } from '@caloriebank/schemas';
const now = new Date('2026-10-18T17:05:00Z');
function snapshot(userId = 'synthetic-one'): BudgetSnapshot {
  const identity = { accountId: userId, sourceId: 'synthetic-burn', localDate: '2026-10-18', timezone: 'UTC' };
  return {
    context: { accountId: userId, expenditureSourceId: 'synthetic-burn', intakeSourceId: 'synthetic-intake', localDate: identity.localDate, timezone: identity.timezone, now, signedGoalAdjustmentCalories: -500, dailyBankTargetCalories: 200 },
    expenditure: { ...identity, semantic: 'accumulated', rawProviderCalories: 2000, coverage: 'verified', coverageAt: new Date('2026-10-18T17:00:00Z'), planningExpiresAt: new Date('2026-10-18T17:30:00Z'), remainingRest: { rawProviderCalories: 1000, from: new Date('2026-10-18T17:00:00Z'), through: new Date('2026-10-19T00:00:00Z'), qualified: true } },
    intake: { ...identity, sourceId: 'synthetic-intake', semantic: 'estimated_total_day_intake', calories: 1800, coverage: null, correction: null },
    baselineModelVersion:'synthetic-baseline-v2',model: { ...identity,evidence:{basis:'matched_total_above_selected_quiet',baselineModelVersion:'synthetic-baseline-v2',calibrationVersion:'synthetic-walk-v1',expiresAt:new Date('2026-10-18T17:30:00Z')}, qualified: true, currentSteps: 8000, currentStepsAt: new Date('2026-10-18T17:00:00Z'), providerCaloriesPerAdditionalStep: 0.05, stepsPerMinute: 100 }, goalConfigured: true,
  };
}
function app(read: (userId: string, timezone: string) => Promise<BudgetSnapshot>, enabled = true) {
  const result = express(); result.use(express.json());
  result.use((req, res, next) => { const user = req.get('x-synthetic-user'); if (!user) { res.sendStatus(401); return; } res.locals.currentUser = { id: user, email: 'synthetic@example.invalid' }; next(); });
  result.use('/v1/me/eating-budget', createEatingBudgetRouter({ read }, res => res.locals.currentUser!, enabled));
  result.use(errorHandler); return result;
}
describe('isolated read-only Eating Budget API', () => {
 it('opt-in projected estimate preserves old wire and never enables step plans',async()=>{
  const s=snapshot('one');s.model=null;s.expenditure=null;s.projectedEstimate={status:'ready',basis:'caloriebank_adjusted_projection',estimated:true,totalCalories:2200,projectedAdjustedBurnCalories:3000,expiresAt:'2026-10-18T17:30:00Z'};
  const api=app(async()=>s);
  const legacy=await request(api).get('/v1/me/eating-budget').set('x-synthetic-user','one').expect(200);expect(legacy.body).not.toHaveProperty('projectedEstimate');
  const current=await request(api).get('/v1/me/eating-budget?estimate=projected').set('x-synthetic-user','one').expect(200);expect(current.body.projectedEstimate.totalCalories).toBe(2200);expect(current.body.budget.status).toBe('unavailable');expect(current.body.planningAvailable).toBe(false);
  const plan=await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user','one').send({direction:'steps_to_intake',totalSteps:10000}).expect(200);expect(plan.body.snapshot).not.toHaveProperty('projectedEstimate');expect(plan.body.plan.status).toBe('unavailable');
 });

  it('default/off gate makes no repository reads; legacy Today schema unchanged', async () => {
    const read = vi.fn(); await request(app(read, false)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(404);
    await request(app(read, false)).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'steps_to_intake', totalSteps: 10000 }).expect(404);
    expect(read).not.toHaveBeenCalled(); expect(todayResponseSchema.shape).not.toHaveProperty('eatingBudget');
  });
  it('requires authenticated owner; supplied user identity cannot override ownership', async () => {
    const read = vi.fn(async (id: string) => snapshot(id)); const api = app(read);
    await request(api).get('/v1/me/eating-budget').expect(401);
    await request(api).get('/v1/me/eating-budget?userId=other').set('x-synthetic-user', 'one').expect(200);
    expect(read).toHaveBeenCalledWith('one', 'UTC');
    await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'steps_to_intake', totalSteps: 10000, userId: 'other' }).expect(400);
  });
  it('serializes qualified synthetic fixture without account identifiers and preserves manual semantic', async () => {
    const response = await request(app(async id => snapshot(id))).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    const value = eatingBudgetResponseSchema.parse(response.body);
    expect(value.budget).toMatchObject({ status: 'ready', totalCalories: 1700, comparison: { kind: 'estimated_day_difference', calories: -100 } });
    expect(JSON.stringify(value)).not.toContain('synthetic-one'); expect(JSON.stringify(value)).not.toContain('accountId');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('keeps reported burn separate when food-guidance coverage is unavailable', async () => {
    const s = snapshot('one'); s.expenditure = null;
    s.observation = { rawCalories: 2000, adjustedCalories: 1600, source: 'Synthetic tracker', lastSyncedAt: '2026-10-18T17:00:00Z', status: 'ready', coverage: 'unverified' };
    const value = await request(app(async () => s)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(value.body.budget.status).toBe('unavailable'); expect(value.body.planningAvailable).toBe(false);
    expect(value.body.expenditure).toMatchObject({ rawCalories: 2000, adjustedCalories: 1600, coverage: 'unverified' });
  });
  it('resolved current-day corrections retain their semantic and source switches suppress old comparison', async () => {
    const s = snapshot('one'); s.intake!.calories = 1900;
    const api = app(async () => s);
    const corrected = await request(api).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(corrected.body.budget.comparison).toEqual({ kind: 'estimated_day_difference', calories: -200 });
    s.context.intakeSourceId = 'new-source';
    const switched = await request(api).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(switched.body.budget.totalCalories).toBe(1700); expect(switched.body.budget.comparison).toBeNull();
    expect(switched.body.intake).toEqual({ calories: null, semantic: 'unknown' });
  });
  it('retains resolved FatSecret attribution but suppresses unknown intake semantics', async () => {
    const s = snapshot('one'); s.intakeAttributionProviders = ['fatsecret'];
    const api = app(async () => s);
    const known = await request(api).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(known.body.intake.attributionProviders).toEqual(['fatsecret']);
    s.intake!.semantic = 'unknown';
    const unknown = await request(api).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(unknown.body.intake).toEqual({ calories: null, semantic: 'unknown' }); expect(unknown.body.budget.comparison).toBeNull();
  });
  it('both directions preserve the approved outcome and do not mutate read fixtures', async () => {
    const value = snapshot('one'); const before = JSON.stringify(value); const api = app(async () => value);
    const forward = await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'steps_to_intake', totalSteps: 10000 }).expect(200);
    expect(forward.body.plan).toMatchObject({ status: 'ready', totalIntakeCalories: 1780, totalSteps: 10000 });
    const inverse = await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'intake_to_steps', totalIntakeCalories: 1900 }).expect(200);
    expect(inverse.body.plan).toMatchObject({ status: 'ready', totalSteps: 13000 }); expect(JSON.stringify(value)).toBe(before);
  });
  it('returns goal/target/Budget from the exact plan snapshot, without a second read', async () => {
    const s = snapshot('one'); s.context.signedGoalAdjustmentCalories = -400;
    const read = vi.fn(async () => s);
    const value = await request(app(read)).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'intake_to_steps', totalIntakeCalories: 1900 }).expect(200);
    expect(value.body.snapshot.signedGoalAdjustmentCalories).toBe(-400);
    expect(value.body.snapshot.budget.totalCalories).toBe(1800);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('missing/unverified/stale evidence and missing goal never produce an actionable total', async () => {
    for (const alter of [(s: BudgetSnapshot) => { s.expenditure = null; }, (s: BudgetSnapshot) => { s.expenditure!.coverage = 'unverified'; },
      (s: BudgetSnapshot) => { s.context.now = new Date('2026-10-18T17:30:00Z'); }, (s: BudgetSnapshot) => { s.goalConfigured = false; }]) {
      const s = snapshot('one'); alter(s); const result = await request(app(async () => s)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
      expect(result.body.budget.status).toBe('unavailable');
    }
  });
  it('does not infer observed-intake freshness or a step horizon from successful reads', async () => {
    const s = snapshot('one'); s.intake!.semantic = 'observed_current_day_intake'; s.model = null;
    const result = await request(app(async () => s)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(result.body.budget.comparison).toBeNull(); expect(result.body.planningAvailable).toBe(false);
    const plan = await request(app(async () => s)).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send({ direction: 'steps_to_intake', totalSteps: 10000 }).expect(200);
    expect(plan.body.plan.status).toBe('unavailable');
  });
  it('rejects cross-account evidence even when injected repository returns it', async () => {
    const s = snapshot('one'); s.expenditure!.accountId = 'other';
    const response = await request(app(async () => s)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(response.body.budget).toEqual({ status: 'unavailable', reason: 'identity_mismatch' });
  });
  it('rejects wrong-owner cached snapshots and suppresses mismatched intake serialization', async () => {
    await request(app(async () => snapshot('other'))).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(403);
    const s = snapshot('one'); s.intake!.accountId = 'other';
    const value = await request(app(async () => s)).get('/v1/me/eating-budget').set('x-synthetic-user', 'one').expect(200);
    expect(value.body.intake).toEqual({ calories: null, semantic: 'unknown' });
  });

  it('does not qualify legacy cross-provider resting fallback for food guidance', async () => {
    const today = { burned: { status: 'ready', raw: 2000 }, eaten: { authoritative: null }, restOfDayProjection: {
      status: 'ready', coverageStatus: 'known', planningAnchorKind: 'verified_coverage', coverageAt: '2026-10-18T17:00:00.000Z',
      planningAnchorAt: '2026-10-18T17:00:00.000Z', planningExpiresAt: '2026-10-18T17:30:00.000Z', unroundedProjectedProviderBurnCalories: 3000,
    } } as unknown as TodayResponse; // Mock boundary supplies exactly the adapter-consumed read fields.
    const read = vi.spyOn(PrismaTodayAggregateRepository.prototype, 'readTodaySnapshotForBudget').mockResolvedValue(today);
    let restingProvider = 'apple_health';let restingEvidence='historical_low_activity_hours';
    const tx = { userProfile: { findUnique: async () => ({ timezone: 'UTC', dailyBankTargetCalories: 200 }) },
      providerSelection: { findUnique: async () => ({ expenditureSelected: true, authoritativeExpenditureProvider: 'google_health_fitbit' }) },
      goalConfiguration: { findUnique: async () => ({ dailyEnergyAdjustment: -500 }) },
      intakeAuthorityBoundary: { findFirst: async () => null },
      dailyExpenditureAggregate: { findUnique: async () => ({provider:'google_health_fitbit',isCurrentDay:true,timezone:'UTC',rawTotalDailyExpenditure:2000,forecastCoverageAt:new Date(today.restOfDayProjection.coverageAt!),planningAnchorAt:new Date(today.restOfDayProjection.coverageAt!),planningAnchorKind:'verified_coverage'}) },
      restingBurnEstimate: { findUnique: async () => ({provider:restingProvider,evidenceType:restingEvidence,calculatedAt:now,providerKcalPerHour:140}) } };
    const db = { $transaction: async (callback: (value: unknown) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
    try {
      const repository = new PrismaEatingBudgetRepository(db, () => now);
      expect((await repository.read('synthetic-one', 'UTC')).expenditure).toBeNull();
      restingProvider = 'google_health_fitbit';
      expect((await repository.read('synthetic-one','UTC')).expenditure).toBeNull();
      restingEvidence='historical_low_activity_hours_v2';
      expect((await repository.read('synthetic-one','UTC')).expenditure).not.toBeNull();
    } finally { read.mockRestore(); }
  });
  it('production repository performs scoped reads only, never issues accounting/settings writes', async () => {
    const calls: { model: string; method: string; args: unknown }[] = [];
    const tx = new Proxy({}, { get: (_target, model: string) => new Proxy({}, { get: (_delegate, method: string) => async (args: unknown) => {
      if (!['findUnique', 'findFirst', 'findMany'].includes(method)) throw new Error(`Unexpected mutation ${model}.${method}`);
      calls.push({ model, method, args }); return method === 'findMany' ? [] : null;
    } }) });
    // Mock is deliberately confined to the Prisma boundary; unknown conversion avoids hiding unsafe any.
    const db = { $transaction: async (callback: (value: unknown) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
    const result = await new PrismaEatingBudgetRepository(db, () => now).read('synthetic-one', 'UTC');
    expect(result.expenditure).toBeNull(); expect(result.model).toBeNull(); expect(calls.length).toBeGreaterThan(8);
    for (const call of calls) expect(JSON.stringify(call.args)).toContain('"userId":"synthetic-one"');
    expect(calls.some(call => /ledger|bank|opening/i.test(call.model))).toBe(false);
  });
});

describe('Budget through the current Today snapshot', () => {
  it.each(['verified_coverage', 'reported_interval', 'sample_horizon', 'retrieval_assumption'] as const)(
    'uses one scoped clock and transaction with %s evidence and no provider calls',
    async (anchorKind) => {
      const provider = 'google_health_fitbit';
      const cutoff = new Date('2026-10-18T17:00:00Z');
      const expires = new Date('2026-10-18T17:30:00Z');
      const expenditure = {
        provider, timezone: 'UTC', isCurrentDay: true, syncStatus: 'ready', syncSessionId: 'synthetic-session',
        rawTotalDailyExpenditure: 2000, adjustedDailyExpenditure: 1600, updatedAt: now,
        adjustmentFactor: { toNumber: () => 0.8 },
        forecastCoverageAt: anchorKind === 'verified_coverage' ? cutoff : null,
        planningAnchorKind: anchorKind, planningAnchorAt: cutoff, planningExpiresAt: expires,
        reportedIntervalEndAt: anchorKind === 'reported_interval' ? cutoff : null,
        activeSampleEndAt: anchorKind === 'sample_horizon' ? cutoff : null,
        retrievedAt: now,
      };
      const calls: unknown[] = [];
      const models: Record<string, Record<string, unknown>> = {
        userProfile: { findUnique: { timezone: 'UTC', dailyBankTargetCalories: 200 } },
        goalConfiguration: { findUnique: { dailyEnergyAdjustment: -500 } },
        providerSelection: { findUnique: {
          expenditureSelected: true, authoritativeExpenditureProvider: provider,
          authoritativeActivityProvider: provider, authoritativeIntakeProvider: 'fatsecret',
        } },
        intakeAuthorityBoundary: { findFirst: null },
        dailyExpenditureAggregate: { findUnique: expenditure, findMany: [expenditure] },
        restingBurnEstimate: { findUnique: { provider, calculatedAt: now, evidenceType:"historical_low_activity_hours_v2",providerKcalPerHour: 140 } },
        dailyIntakeAggregate: { findMany: [{
          provider: 'fatsecret', totalCaloriesConsumed: 1000, updatedAt: now, syncStatus: 'ready',
        }] },
        dailyIntakeAdjustment: { findUnique: null },
        dailyStepAggregate: { findMany: [{
          provider, totalSteps: 8000, timezone: 'UTC', syncSessionId: 'synthetic-session', updatedAt: now, syncStatus: 'ready',
        }] },
        currentDayWorkout: { findMany: [] },
        ingestionSyncSession: { findMany: [{ id: 'synthetic-session', provider, status: 'completed', completedAt: now }] },
      };
      const tx = Object.fromEntries(Object.entries(models).map(([model, methods]) => [
        model, Object.fromEntries(Object.entries(methods).map(([method, value]) => [
          method, async (query: unknown) => { calls.push(query); return value; },
        ])),
      ]));
      const transaction = vi.fn(async (callback: (value: unknown) => Promise<unknown>, _options: unknown) => callback(tx));
      const db = { $transaction: transaction } as unknown as PrismaClient;
      const clock = vi.fn(() => now);
      const repo = new PrismaEatingBudgetRepository(db, clock);
      const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Budget must not fetch from a provider'));
      try {
        const api = app((account, timezone) => repo.read(account, timezone));
        const result = await request(api).get('/v1/me/eating-budget?timezone=Asia/Tokyo').set('x-synthetic-user', 'one').expect(200);
        expect(result.body).toMatchObject({ localDate: '2026-10-18', timezone: 'UTC', planningAvailable: false,
          expenditure: { rawCalories: 2000, adjustedCalories: 1600 } });
        if (anchorKind === 'verified_coverage') {
          // 2,000 reported + 7h × 140 raw resting; 0.8 once, then signed goal and target.
          expect(result.body.budget).toMatchObject({ status: 'ready', totalCalories: 1684, comparison: null, expiresAt: expires.toISOString() });
          expect(result.body.intake).toMatchObject({ calories: 1000, semantic: 'observed_current_day_intake', attributionProviders: ['fatsecret'] });
        } else {
          expect(result.body.budget).toEqual({ status: 'unavailable', reason: 'expenditure_cutoff_unverified' });
          expect(result.body.expenditure.coverage).toBe('unverified');
        }
        expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
        expect(clock).toHaveBeenCalledTimes(1);
        for (const query of calls) expect(JSON.stringify(query)).toContain('"userId":"one"');
        for (const input of [
          { direction: 'steps_to_intake', totalSteps: 10000 },
          { direction: 'intake_to_steps', totalIntakeCalories: 1900 },
        ]) {
          const plan = await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user', 'one').send(input).expect(200);
          expect(plan.body.plan).toEqual({ status: 'unavailable', reason: anchorKind==='verified_coverage'?'walking_calibration_unavailable':'expenditure_cutoff_unverified' });
        }
        expect(fetcher).not.toHaveBeenCalled();
      } finally {
        fetcher.mockRestore();
      }
    },
  );
});

describe('Budget model evidence boundary',()=>{
 it('withholds planning on unknown basis/expiry or baseline mismatch without withholding independent total Budget',async()=>{
  for(const kind of ['missing','expired','baseline','cutoff'] as const){const s=snapshot('one');
   if(kind==='missing')delete s.model!.evidence;
   if(kind==='expired')s.model!.evidence!.expiresAt=new Date('2026-10-18T16:00:00Z');
   if(kind==='baseline')s.baselineModelVersion='changed';
   if(kind==='cutoff')s.model!.currentStepsAt=new Date('2026-10-18T16:00:00Z');
   const api=app(async()=>s),r=await request(api).get('/v1/me/eating-budget').set('x-synthetic-user','one').expect(200);
   expect(r.body.budget.status).toBe('ready');expect(r.body.planningAvailable).toBe(false);expect(r.body.planningUnavailableReason).toBe(({missing:'walking_calibration_unqualified',expired:'walking_calibration_stale',baseline:'baseline_calibration_mismatch',cutoff:'step_alignment_unverified'} as const)[kind]);
   const p=await request(api).post('/v1/me/eating-budget/plan').set('x-synthetic-user','one').send({direction:'steps_to_intake',totalSteps:10000}).expect(200);expect(p.body.plan.status).toBe('unavailable');
  }
 });
 it('sets no-store even for malformed enabled planning requests',async()=>{const read=vi.fn();const r=await request(app(read)).post('/v1/me/eating-budget/plan').set('x-synthetic-user','one').send({direction:'wrong'}).expect(400);expect(r.headers['cache-control']).toBe('no-store');expect(read).not.toHaveBeenCalled();});
});
