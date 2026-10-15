import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeDailyExpenditureAggregate, calculateBurnToStepPlan, calculateStepToBurnPlan } from '@caloriebank/domain';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';

const db = new PrismaClient();
afterAll(() => db.$disconnect());
describe('persisted forecast coverage', () => {
  it('keeps the supported anchor across retrievals, expires it and accepts genuine revisions without touching accounting', async () => {
    const user = { id: randomUUID(), email: `${randomUUID()}@caloriebank.local` };
    const provider = 'google_health_fitbit';
    const date = '2026-10-15';
    const localDate = new Date(`${date}T00:00:00Z`);
    const anchor = new Date(`${date}T08:00:00Z`);
    let now = anchor;
    const repo = new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, now: () => now });
    try {
      await db.user.create({ data: { ...user, providerSelection: { create: { authoritativeExpenditureProvider: provider, authoritativeActivityProvider: provider, authoritativeIntakeProvider: 'fatsecret' } } } });
      const session = await db.ingestionSyncSession.create({ data: { userId: user.id, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: now, completedAt: now, status: 'completed' } });
      await db.restingBurnEstimate.create({ data: { userId: user.id, provider, providerKcalPerHour: 80, evidenceType: 'historical_low_activity_hours', observationCount: 20, lookbackStartDate: localDate, lookbackEndDate: localDate, calculatedAt: anchor } });
      await db.dailyStepAggregate.create({ data: { userId: user.id, provider, localDate, timezone: 'UTC', providerRecordId: 'steps', importedAt: anchor, providerUpdatedAt: anchor, isCurrentDay: true, syncStatus: 'ready', syncSessionId: session.id, totalSteps: 2000 } });
      const write = (burn: number, forecastCoverageAt: Date | null, updated = now) => repo.upsertExpenditureAggregate(user, normalizeDailyExpenditureAggregate({ userId: user.id, provider, localDate: date, timezone: 'UTC', providerRecordId: 'burn', importedAt: now, providerUpdatedAt: updated, isCurrentDay: true, syncStatus: 'ready', syncSessionId: session.id, rawTotalDailyExpenditure: burn, forecastCoverageAt }));
      const read = () => repo.getTodayForUser(user.id, date, 'UTC');
      const row = () => db.dailyExpenditureAggregate.findUniqueOrThrow({ where: { userId_localDate_provider: { userId: user.id, localDate, provider } } });
      const accounting = () => Promise.all([db.calorieLedgerTransaction.findMany({ where: { userId: user.id } }), db.bankCalculationSnapshot.findMany({ where: { userId: user.id } }), db.bankAccountInitialization.findMany({ where: { userId: user.id } }), db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } })]);
      const before = await accounting();
      await write(2260, anchor);
      const initial = await read();
      expect(initial.restOfDayProjection).toMatchObject({ status: 'ready', coverageStatus: 'known', projectedProviderBurnCalories: 3540, unroundedProjectedProviderBurnCalories: 3540 });
      now = new Date(`${date}T08:30:00Z`);
      await write(2260, null);
      const repeated = await read();
      expect(repeated.restOfDayProjection).toEqual(initial.restOfDayProjection);
      expect(repeated.steps.planningSnapshotReady).toBe(true);
      expect(await row()).toMatchObject({ retrievedAt: now, forecastCoverageAt: anchor });
      const shared = { currentSteps: 2000, projectedProviderBurnAtRest: repeated.restOfDayProjection.unroundedProjectedProviderBurnCalories!, providerCaloriesPerStep: .05, adjustmentFactor: .8 };
      expect(calculateBurnToStepPlan({ ...shared, targetActualBurnCalories: 4000 }).remainingSteps).toBe(29200);
      expect(calculateStepToBurnPlan({ ...shared, targetSteps: 31200 }).projectedAdjustedBurnCalories).toBe(4000);
      // The same legacy ordering timestamp can update retrieval diagnostics only.
      now = new Date(`${date}T08:30:01Z`);
      await write(2260, null, new Date(`${date}T08:30:00Z`));
      expect((await read()).restOfDayProjection).toMatchObject({ status: 'stale', coverageStatus: 'stale', projectedProviderBurnCalories: null });
      expect((await row()).forecastCoverageAt).toEqual(anchor);
      await write(2300, now);
      expect((await read()).restOfDayProjection.coverageStatus).toBe('known');
      now = new Date(`${date}T08:31:00Z`);
      await write(2200, now);
      expect((await read()).restOfDayProjection.unroundedProjectedProviderBurnCalories).toBeCloseTo(3438.6666667);
      now = new Date(`${date}T08:32:00Z`);
      await write(2201, null);
      expect((await read()).restOfDayProjection).toMatchObject({ status: 'ready', coverageStatus: 'uncertain', coverageAt: null, planningAnchorKind: 'retrieval_assumption', planningExpiresAt: `${date}T09:01:00.000Z` });
      // Delayed observations cannot borrow the fresh database update time.
      now = new Date(`${date}T09:00:00Z`);
      await write(2260, anchor);
      expect((await read()).restOfDayProjection.coverageStatus).toBe('stale');
      expect(await write(9999, now, anchor)).toBe('ignored_stale');
      expect((await row()).rawTotalDailyExpenditure).toBe(2260);
      // Changing the user's local day boundaries requires compatible coverage.
      expect((await repo.getTodayForUser(user.id, date, 'America/Chicago')).restOfDayProjection.coverageStatus).toBe('uncertain');
      expect(await accounting()).toEqual(before);
    } finally { await db.user.deleteMany({ where: { id: user.id } }); }
  });
  it('does not promote legacy database/provider timestamps into initial coverage', async () => {
    const userId = randomUUID();
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    try {
      await db.user.create({ data: { id: userId, email: `${userId}@caloriebank.local` } });
      await db.dailyExpenditureAggregate.create({ data: { userId, localDate: new Date(`${date}T00:00:00Z`), timezone: 'UTC', provider: 'apple_health', providerRecordId: 'legacy', importedAt: now, providerUpdatedAt: now, rawTotalDailyExpenditure: 2260, adjustedDailyExpenditure: 1808, adjustmentFactor: .8, isCurrentDay: true, syncStatus: 'ready' } });
      const today = await new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: true, now: () => now }).getTodayForUser(userId, date, 'UTC');
      expect(today.restOfDayProjection).toMatchObject({ coverageStatus: 'uncertain', coverageAt: null, projectedProviderBurnCalories: null });
    } finally { await db.user.deleteMany({ where: { id: userId } }); }
  });
  it('persists fallback expiry across repository restarts/account switching and accepts only temporal renewal', async () => {
    const users = [0, 1].map(() => ({ id: randomUUID(), email: `${randomUUID()}@caloriebank.local` }));
    const date = '2026-10-15';
    const localDate = new Date(`${date}T00:00:00Z`);
    const provider = 'google_health_fitbit';
    let now = new Date(`${date}T08:00:00Z`);
    const repository = () => new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, now: () => now });
    try {
      for (const user of users) {
        await db.user.create({ data: { ...user, providerSelection: { create: { authoritativeExpenditureProvider: provider, authoritativeActivityProvider: provider, authoritativeIntakeProvider: 'fatsecret' } } } });
        await db.restingBurnEstimate.create({ data: { userId: user.id, provider, providerKcalPerHour: 80, evidenceType: 'historical_low_activity_hours', observationCount: 20, lookbackStartDate: localDate, lookbackEndDate: localDate, calculatedAt: now } });
      }
      const write = async (user: typeof users[number], burn: number, reportedIntervalEndAt?: Date) => {
        const session = await db.ingestionSyncSession.create({ data: { userId: user.id, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: now, completedAt: now, status: 'completed' } });
        await repository().upsertExpenditureAggregate(user, normalizeDailyExpenditureAggregate({ userId: user.id, localDate: date, timezone: 'UTC', provider, providerRecordId: 'burn', rawTotalDailyExpenditure: burn, importedAt: now, providerUpdatedAt: now, reportedIntervalEndAt: reportedIntervalEndAt ?? null, isCurrentDay: true, syncStatus: 'ready', syncSessionId: session.id }));
        await db.dailyStepAggregate.upsert({ where: { userId_localDate_provider: { userId: user.id, localDate, provider } }, create: { userId: user.id, localDate, provider, timezone: 'UTC', providerRecordId: 'steps', totalSteps: 2000, importedAt: now, providerUpdatedAt: now, syncSessionId: session.id, isCurrentDay: true, syncStatus: 'ready' }, update: { syncSessionId: session.id, providerUpdatedAt: now } });
      };
      const read = (user: typeof users[number]) => repository().getTodayForUser(user.id, date, 'UTC');
      await write(users[0]!, 2260);
      const first = await read(users[0]!);
      expect(first.restOfDayProjection).toMatchObject({ status: 'ready', coverageStatus: 'uncertain', planningAnchorKind: 'retrieval_assumption', unroundedProjectedProviderBurnCalories: 3540, planningExpiresAt: `${date}T08:30:00.000Z` });
      now = new Date(`${date}T08:15:00Z`);
      await write(users[1]!, 1800);
      expect((await read(users[1]!)).burned.raw).toBe(1800);
      await write(users[0]!, 2260);
      expect((await read(users[0]!)).restOfDayProjection).toEqual(first.restOfDayProjection);
      now = new Date(`${date}T08:30:01Z`);
      await write(users[0]!, 2260);
      const expired = await read(users[0]!);
      expect(expired.restOfDayProjection).toMatchObject({ status: 'stale', projectedProviderBurnCalories: null, planningExpiresAt: `${date}T08:30:00.000Z` });
      expect(expired.burned.raw).toBe(2260);
      expect(expired.steps.count).toBe(2000);
      expect((await read(users[1]!)).restOfDayProjection.status).toBe('ready');
      now = new Date(`${date}T08:35:00Z`);
      await write(users[0]!, 2200); // Unknown-timing revision does not revive an expired forecast.
      expect((await read(users[0]!)).restOfDayProjection.status).toBe('stale');
      now = new Date(`${date}T08:40:00Z`);
      await write(users[0]!, 2300, new Date(`${date}T08:35:00Z`));
      expect((await read(users[0]!)).restOfDayProjection).toMatchObject({ status: 'ready', planningAnchorKind: 'reported_interval', planningExpiresAt: `${date}T09:05:00.000Z` });
      expect((await read(users[1]!)).restOfDayProjection.planningExpiresAt).toBe(`${date}T08:45:00.000Z`);
    } finally { await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } }); }
  });

});
