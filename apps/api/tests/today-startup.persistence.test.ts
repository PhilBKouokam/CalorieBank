import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';

describe('new-day provider configuration without current-day evidence', () => {
  it('keeps configured missing data separate from no selection, then resolves each source independently', async () => {
    const db = new PrismaClient(); const id = randomUUID();
    const repository = new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false });
    const date = '2026-09-24'; const localDate = new Date(date); const timezone = 'America/Chicago';
    try {
      await db.user.create({ data: { id, email: `${id}@test.local` } });
      const unset = await repository.getTodayForUser(id, date, timezone);
      expect(unset.burned.status).toBe('not_connected');
      expect(unset.eaten.status).toBe('not_connected');
      await db.providerSelection.create({ data: { userId: id, expenditureSelected: true, intakeSelected: true,
        authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD', appleHealthIntakeWriterDisplayName: 'Cronometer' } });
      const waiting = await repository.getTodayForUser(id, date, timezone);
      expect(waiting.burned).toMatchObject({ status: 'unavailable', raw: null });
      expect(waiting.eaten).toMatchObject({ status: 'unavailable', calories: null });
      await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate, timezone, provider: 'google_health_fitbit',
        providerRecordId: `${id}:burn`, rawTotalDailyExpenditure: 2000, adjustedDailyExpenditure: 1600,
        adjustmentFactor: .8, importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true } });
      const burnFirst = await repository.getTodayForUser(id, date, timezone);
      expect(burnFirst.burned.raw).toBe(2000); expect(burnFirst.eaten.status).toBe('unavailable');
      await db.dailyIntakeAggregate.create({ data: { userId: id, localDate, timezone, provider: 'apple_health',
        providerRecordId: `${id}:intake`, totalCaloriesConsumed: 1000, writerBundleIdentifier: 'CRONOMETER-GOLD',
        writerDisplayName: 'Cronometer', importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true } });
      expect((await repository.getTodayForUser(id, date, timezone)).eaten.calories).toBe(1000);
      const tomorrow = await repository.getTodayForUser(id, '2026-09-25', timezone);
      expect(tomorrow.burned.raw).toBeNull(); expect(tomorrow.eaten.calories).toBeNull();
      expect(tomorrow.eaten.status).toBe('unavailable');
    } finally { await db.user.deleteMany({ where: { id } }); await db.$disconnect(); }
  });
});
