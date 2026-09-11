import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const db = new PrismaClient();
afterAll(() => db.$disconnect());
describe('persisted planning snapshot', () => {
  it('anchors cached burn, rejects partial generations and preserves accounting', async () => {
    const userId = randomUUID();
    const now = new Date();
    const date = getLocalDateForTimezone('UTC', now);
    const localDate = new Date(`${date}T00:00:00Z`);
    const provider = 'google_health_fitbit';
    let readAt = now;
    const repository = new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, now: () => readAt });
    try {
      await db.user.create({ data: { id: userId, email: `forecast-${userId}@caloriebank.local`, providerSelection: { create: { authoritativeExpenditureProvider: provider, authoritativeActivityProvider: provider, authoritativeIntakeProvider: 'fatsecret' } } } });
      const session = await db.ingestionSyncSession.create({ data: { userId, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: now, completedAt: now, status: 'completed' } });
      const common = { userId, provider, localDate, timezone: 'UTC', importedAt: now, providerUpdatedAt: now, isCurrentDay: true, syncStatus: 'ready' as const, syncSessionId: session.id };
      const burn = await db.dailyExpenditureAggregate.create({ data: { ...common, providerRecordId: 'burn', rawTotalDailyExpenditure: 3000, adjustedDailyExpenditure: 2400, adjustmentFactor: .8 } });
      const steps = await db.dailyStepAggregate.create({ data: { ...common, providerRecordId: 'steps', totalSteps: 10000 } });
      await db.restingBurnEstimate.create({ data: { userId, provider, providerKcalPerHour: 80, evidenceType: 'historical_low_activity_hours', observationCount: 20, lookbackStartDate: localDate, lookbackEndDate: localDate, calculatedAt: now } });
      const accounting = () => Promise.all([
        db.calorieLedgerTransaction.findMany({ where: { userId } }),
        db.bankCalculationSnapshot.findMany({ where: { userId } }),
        db.bankAccountInitialization.findMany({ where: { userId } }),
        db.finalizedDailyBankRecord.findMany({ where: { userId } }),
      ]);
      const before = await accounting();
      const first = await repository.getTodayForUser(userId, date, 'UTC');
      expect(first.steps.planningSnapshotReady).toBe(true);
      readAt = new Date(now.getTime() + 15 * 60 * 1000);
      const later = await repository.getTodayForUser(userId, date, 'UTC');
      expect(later.restOfDayProjection).toEqual(first.restOfDayProjection);

      const next = await db.ingestionSyncSession.create({ data: { userId, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: new Date(now.getTime() + 1) } });
      expect((await repository.getTodayForUser(userId, date, 'UTC')).steps.planningSnapshotReady).toBe(false);
      await db.dailyStepAggregate.update({ where: { id: steps.id }, data: { totalSteps: 13000, syncSessionId: next.id } });
      expect((await repository.getTodayForUser(userId, date, 'UTC')).steps.planningSnapshotReady).toBe(false);
      await db.dailyExpenditureAggregate.update({ where: { id: burn.id }, data: { rawTotalDailyExpenditure: 3150, syncSessionId: next.id } });
      expect((await repository.getTodayForUser(userId, date, 'UTC')).steps.planningSnapshotReady).toBe(false);
      await db.ingestionSyncSession.update({ where: { id: next.id }, data: { status: 'completed', completedAt: readAt } });
      const coherent = await repository.getTodayForUser(userId, date, 'UTC');
      expect(coherent.steps.planningSnapshotReady).toBe(true);
      expect(coherent.steps.count).toBe(13000);
      expect(coherent.burned.raw).toBe(3150);
      expect(await accounting()).toEqual(before);
    } finally { await db.user.deleteMany({ where: { id: userId } }); }
  });
});
