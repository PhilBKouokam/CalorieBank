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

    const first = await repository.finalizeDailyRecord(user, input);
    const second = await repository.finalizeDailyRecord(user, input);

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

    await repository.finalizeDailyRecord(user, {
      logDate: '2026-07-18',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 1950,
      finalizedAt: new Date('2026-07-19T05:30:00.000Z'),
    });
    await repository.finalizeDailyRecord(user, {
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
});
