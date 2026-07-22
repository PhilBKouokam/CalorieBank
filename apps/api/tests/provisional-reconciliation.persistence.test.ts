import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  normalizeDailyExpenditureAggregate,
  normalizeDailyIntakeAggregate,
} from '@caloriebank/domain';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';

const prisma = new PrismaClient();
const userIds: string[] = [];

function testUser() {
  const id = randomUUID();
  userIds.push(id);
  return { id, email: `reconciliation-${id}@caloriebank.local` };
}

async function configureCut(user: ReturnType<typeof testUser>) {
  await prisma.user.create({
    data: {
      id: user.id,
      email: user.email,
      profile: { create: { timezone: 'America/Chicago' } },
      goalConfiguration: {
        create: {
          goalMode: 'cut',
          dailyEnergyAdjustment: -500,
          adjustmentSource: 'manual_calories',
        },
      },
    },
  });
}

function expenditure(userId: string, calories: number, updatedAt: Date) {
  return normalizeDailyExpenditureAggregate({
    userId,
    localDate: '2026-07-21',
    timezone: 'America/Chicago',
    provider: 'apple_health',
    providerRecordId: 'apple_health:expenditure:2026-07-21',
    rawTotalDailyExpenditure: calories,
    adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
    importedAt: updatedAt,
    providerUpdatedAt: updatedAt,
    syncStatus: 'ready',
    isCurrentDay: false,
  });
}

function intake(userId: string, calories: number, updatedAt: Date, localDate = '2026-07-21') {
  return normalizeDailyIntakeAggregate({
    userId,
    localDate,
    timezone: 'America/Chicago',
    provider: 'apple_health',
    providerRecordId: `apple_health:intake:${localDate}`,
    totalCaloriesConsumed: calories,
    importedAt: updatedAt,
    providerUpdatedAt: updatedAt,
    syncStatus: 'ready',
    isCurrentDay: localDate === '2026-07-22',
  });
}

describe('provisional finalization and reconciliation persistence', () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('posts immediately, appends positive and negative corrections, and ignores zero deltas', async () => {
    const user = testUser();
    await configureCut(user);
    let now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now });
    const aggregates = new PrismaTodayAggregateRepository(prisma, {
      allowSyntheticProviders: false,
      onBankingAggregateChanged: async (changedUser, date, timezone, sessionId) => {
        await bank.reconcileStoredDay(changedUser, date, timezone, sessionId);
      },
    });

    await aggregates.upsertExpenditureAggregate(user, expenditure(user.id, 3000, now));
    expect((await bank.getSummary(user.id)).availableBankCalories).toBe(0);
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1800, now));

    let detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({
      status: 'provisional',
      originalDailyBankChange: 100,
      effectiveDailyBankChange: 100,
      correctionCount: 0,
    });
    expect((await bank.getSummary(user.id)).availableBankCalories).toBe(100);

    now = new Date('2026-07-22T14:00:00.000Z');
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1600, now));
    detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({ effectiveDailyBankChange: 300, correctionCount: 1 });
    expect(detail?.versions.map((version) => version.correctionDelta)).toEqual([100, 200]);

    now = new Date('2026-07-22T16:00:00.000Z');
    await aggregates.upsertExpenditureAggregate(user, expenditure(user.id, 2750, now));
    detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({ effectiveDailyBankChange: 100, correctionCount: 2 });
    expect(detail?.versions.map((version) => version.correctionDelta)).toEqual([100, 200, -200]);

    now = new Date('2026-07-22T18:00:00.000Z');
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1600, now));
    detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail?.versions).toHaveLength(3);

    const ledger = await prisma.calorieLedgerTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledger.map((transaction) => transaction.amountCalories)).toEqual([100, 200, -200]);
    expect(ledger.map((transaction) => transaction.type)).toEqual([
      'daily_finalization',
      'adjustment',
      'adjustment',
    ]);
    const report = await prisma.finalizedDailyBankRecord.findUniqueOrThrow({
      where: { userId_logDate: { userId: user.id, logDate: new Date('2026-07-21T00:00:00.000Z') } },
    });
    expect(report.importedCalorieIntake).toBe(1800);
    expect(report.dailyBankChange).toBe(100);
    expect(report.effectiveDailyBankChange).toBe(100);
    expect((await bank.getSummary(user.id)).availableBankCalories).toBe(100);
  });

  it('is idempotent under duplicate and concurrent reconciliation', async () => {
    const user = testUser();
    await configureCut(user);
    const now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now });
    const aggregates = new PrismaTodayAggregateRepository(prisma, { allowSyntheticProviders: false });
    await aggregates.upsertExpenditureAggregate(user, expenditure(user.id, 3000, now));
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1800, now));

    const results = await Promise.all([
      bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago'),
      bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago'),
    ]);
    expect(results.map((result) => result.outcome).sort()).toEqual(['posted', 'unchanged']);
    await bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago');

    expect(await prisma.finalizedDailyBankRecord.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.bankCalculationSnapshot.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(1);
  });

  it('locks at local midnight after two full correction days and rejects later automatic changes', async () => {
    const user = testUser();
    await configureCut(user);
    let now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now });
    const aggregates = new PrismaTodayAggregateRepository(prisma, {
      allowSyntheticProviders: false,
      onBankingAggregateChanged: async (changedUser, date, timezone) => {
        await bank.reconcileStoredDay(changedUser, date, timezone);
      },
    });
    await aggregates.upsertExpenditureAggregate(user, expenditure(user.id, 3000, now));
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1800, now));

    now = new Date('2026-07-24T04:59:59.999Z');
    expect((await bank.getDayDetail(user.id, '2026-07-21'))?.status).toBe('provisional');
    now = new Date('2026-07-24T05:00:00.000Z');
    expect(await bank.lockExpired(user.id)).toBe(1);
    expect(await bank.lockExpired(user.id)).toBe(0);

    now = new Date('2026-07-24T06:00:00.000Z');
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1000, now));
    const detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({ status: 'locked', effectiveDailyBankChange: 100, correctionCount: 0 });
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(1);
  });

  it('keeps the current local day open and outside the ledger', async () => {
    const user = testUser();
    await configureCut(user);
    const now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now });
    const result = await bank.reconcileStoredDay(user, '2026-07-22', 'America/Chicago');
    expect(result).toEqual({ outcome: 'open', detail: null });
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
  });
});
