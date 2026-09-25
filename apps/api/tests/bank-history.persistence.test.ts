import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';

const prisma = new PrismaClient();
const repository = new PrismaBankHistoryRepository(prisma);

describe('bank history PostgreSQL persistence', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('finalizes one daily record and one ledger transaction idempotently', async () => {
    const user = {
      id: randomUUID(),
      email: `bank-${randomUUID()}@caloriebank.local`,
    };

    const input = {
      logDate: '2026-07-19',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 3000,
      goalMode: 'bulk' as const,
      goalAdjustmentCalories: 300,
      importedCalorieIntake: 2500,
      finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
    };

    const first = await repository.postProvisionalDailyRecord(user, input);
    const second = await repository.postProvisionalDailyRecord(user, input);

    expect(second).toEqual(first);
    expect(first.dailyBankChange).toBe(200);

    const finalizedRecords = await prisma.finalizedDailyBankRecord.findMany({
      where: { userId: user.id },
    });
    const ledgerTransactions = await prisma.calorieLedgerTransaction.findMany({
      where: { userId: user.id },
    });

    expect(finalizedRecords).toHaveLength(1);
    expect(ledgerTransactions).toHaveLength(1);
    expect(ledgerTransactions[0]?.amountCalories).toBe(finalizedRecords[0]?.dailyBankChange);

    const summary = await repository.getSummary(user.id);
    expect(summary.availableBankCalories).toBe(200);
    expect(summary.availableBankCalories).toBe(
      ledgerTransactions.reduce((sum, transaction) => sum + transaction.amountCalories, 0),
    );

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('returns filtered history ranges without replacing all-time bank', async () => {
    const user = {
      id: randomUUID(),
      email: `bank-${randomUUID()}@caloriebank.local`,
    };

    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-07-18',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 1950,
      finalizedAt: new Date('2026-07-19T05:30:00.000Z'),
    });
    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-07-19',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 3000,
      goalMode: 'bulk',
      goalAdjustmentCalories: 300,
      importedCalorieIntake: 2500,
      finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
    });

    const history = await repository.getHistory(user.id, 'D');

    expect(history.availableBankCalories).toBe(250);
    expect(history.rangeNetChangeCalories).toBe(200);
    expect(history.finalizedDays).toHaveLength(1);
    expect(history.finalizedDays[0]?.logDate).toBe('2026-07-19');

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('returns every unexplained post-boundary date instead of silently skipping it', async () => {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `continuity-${randomUUID()}@caloriebank.local`,
        bankAccountInitialization: {
          create: {
            status: 'INITIALIZED',
            accountingStartsOn: new Date('2026-08-21T00:00:00.000Z'),
            timezone: 'America/Chicago',
          },
        },
        providerSelection: {
          create: {
            authoritativeExpenditureProvider: 'google_health_fitbit',
            authoritativeActivityProvider: 'google_health_fitbit',
            authoritativeIntakeProvider: 'fatsecret',
          },
        },
      },
    });
    const continuityRepository = new PrismaBankHistoryRepository(prisma, {
      now: () => new Date('2026-08-29T17:00:00.000Z'),
    });

    const history = await continuityRepository.getHistory(userId, 'ALL');

    expect(history.days).toEqual([]);
    expect(history.missingDays.map((day) => day.logDate)).toEqual([
      '2026-08-28',
      '2026-08-27',
      '2026-08-26',
      '2026-08-25',
      '2026-08-24',
      '2026-08-23',
      '2026-08-22',
      '2026-08-21',
    ]);
    expect(history.missingDays.every((day) => day.status === 'unprocessed')).toBe(true);

    await prisma.user.delete({ where: { id: userId } });
  });
  it('explains missing completed-day Android intake using dated authority despite current iPhone selection', async () => {
    const userId = randomUUID();
    const date = new Date('2026-09-24T00:00:00Z');
    await prisma.user.create({ data: { id: userId, email: `recovery-${userId}@caloriebank.local`,
      bankAccountInitialization: { create: { status: 'INITIALIZED', accountingStartsOn: date, timezone: 'America/Chicago' } },
      providerSelection: { create: { authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeActivityProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriterBundleId: 'com.cronometer.Cronometer' } },
      intakeAuthorityBoundaries: { create: [
        { effectiveFrom: date, provider: 'health_connect', sourceId: 'com.cronometer.android.gold', timezone: 'America/Chicago' },
        { effectiveFrom: new Date('2026-09-25T00:00:00Z'), provider: 'apple_health', writerId: 'com.cronometer.Cronometer', timezone: 'America/Chicago' },
      ] },
    } });
    try {
      await prisma.dailyExpenditureAggregate.create({ data: { userId, localDate: date, timezone: 'America/Chicago', provider: 'google_health_fitbit', providerRecordId: 'burn', rawTotalDailyExpenditure: 3000, adjustedDailyExpenditure: 2400, adjustmentFactor: 0.8, importedAt: new Date('2026-09-25T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
      await prisma.dailyIntakeAggregate.create({ data: { userId, localDate: date, timezone: 'America/Chicago', provider: 'health_connect', sourceId: 'com.cronometer.android.gold', sourceDisplayName: 'Cronometer', providerRecordId: 'food', totalCaloriesConsumed: 2000, importedAt: new Date('2026-09-25T02:00:00Z'), syncStatus: 'ready', isCurrentDay: true } });
      const history = await new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-09-25T17:00:00Z') }).getHistory(userId, 'ALL');
      expect(history.missingDays).toHaveLength(1);
      expect(history.missingDays[0]).toMatchObject({ recoveryDevice: 'android', status: 'missing_food_data' });
      expect(history.missingDays[0]?.message).toBe('Waiting for Cronometer calories eaten.');
      expect(history.missingDays[0]?.recoveryMessage).toContain('calories eaten for this day from Cronometer');
      expect(history.missingDays[0]?.recoveryMessage).toContain('Android phone');
      expect(await prisma.calorieLedgerTransaction.count({ where: { userId } })).toBe(0);
    } finally { await prisma.user.delete({ where: { id: userId } }); }
  });

});
