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
      providerSelection: {
        create: {
          authoritativeExpenditureProvider: 'apple_health',
          authoritativeActivityProvider: 'apple_health',
          authoritativeIntakeProvider: 'apple_health',
          appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD',
          appleHealthIntakeWriterDisplayName: 'Cronometer',
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

function providerExpenditure(userId: string, provider: string, calories: number, updatedAt: Date) {
  return normalizeDailyExpenditureAggregate({
    ...expenditure(userId, calories, updatedAt),
    provider,
    providerRecordId: `${provider}:expenditure:2026-07-21`,
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
    writerBundleIdentifier: 'CRONOMETER-GOLD',
    writerDisplayName: 'Cronometer',
    importedAt: updatedAt,
    providerUpdatedAt: updatedAt,
    syncStatus: 'ready',
    isCurrentDay: localDate === '2026-07-22',
  });
}

function providerIntake(userId: string, provider: string, calories: number, updatedAt: Date) {
  return normalizeDailyIntakeAggregate({
    ...intake(userId, calories, updatedAt),
    provider,
    providerRecordId: `${provider}:intake:2026-07-21`,
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

  it('uses one selected expenditure provider and records a provisional source switch as a delta', async () => {
    const user = testUser();
    await configureCut(user);
    await prisma.providerSelection.update({
      where: { userId: user.id },
      data: {
        authoritativeExpenditureProvider: 'google_health_fitbit',
        authoritativeIntakeProvider: 'apple_health',
      },
    });
    const now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now, allowSyntheticProviders: false });
    const aggregates = new PrismaTodayAggregateRepository(prisma, {
      allowSyntheticProviders: false,
      onBankingAggregateChanged: (changedUser, date, timezone) =>
        bank.reconcileStoredDay(changedUser, date, timezone).then(() => undefined),
    });
    await aggregates.upsertExpenditureAggregate(user, providerExpenditure(user.id, 'apple_health', 2500, now));
    await aggregates.upsertIntakeAggregate(user, intake(user.id, 1800, now));
    expect(await bank.getDayDetail(user.id, '2026-07-21')).toBeNull();

    await aggregates.upsertExpenditureAggregate(user, providerExpenditure(user.id, 'google_health_fitbit', 3000, now));
    expect(await bank.getDayDetail(user.id, '2026-07-21')).toMatchObject({
      effectiveDailyBankChange: 100,
      versions: [{ expenditureProvider: 'google_health_fitbit', intakeProvider: 'apple_health' }],
    });

    await prisma.providerSelection.update({
      where: { userId: user.id },
      data: { authoritativeExpenditureProvider: 'apple_health' },
    });
    await bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago');
    const detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({ effectiveDailyBankChange: -300, correctionCount: 1 });
    expect(detail?.versions.map((version) => version.expenditureProvider)).toEqual(['google_health_fitbit', 'apple_health']);
    expect((await prisma.calorieLedgerTransaction.findMany({ where: { userId: user.id } }))
      .map((transaction) => transaction.amountCalories)).toEqual([100, -400]);
    expect(await bank.getSummary(user.id)).toMatchObject({
      effectiveBankBalanceCalories: -300,
      availableBankCalories: 0,
      recoveryCalories: 300,
    });
  });

  it('uses one selected intake provider and records a FatSecret source switch exactly once', async () => {
    const user = testUser();
    await configureCut(user);
    await prisma.providerSelection.update({
      where: { userId: user.id },
      data: {
        authoritativeExpenditureProvider: 'apple_health',
        authoritativeIntakeProvider: 'apple_health',
      },
    });
    const now = new Date('2026-07-22T12:00:00.000Z');
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => now, allowSyntheticProviders: false });
    const aggregates = new PrismaTodayAggregateRepository(prisma, { allowSyntheticProviders: false });
    await aggregates.upsertExpenditureAggregate(user, expenditure(user.id, 3000, now));
    await aggregates.upsertIntakeAggregate(user, providerIntake(user.id, 'apple_health', 1800, now));
    await aggregates.upsertIntakeAggregate(user, providerIntake(user.id, 'fatsecret', 2000, now));
    await bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago');
    expect(await bank.getDayDetail(user.id, '2026-07-21')).toMatchObject({
      effectiveDailyBankChange: 100,
      versions: [{ intakeProvider: 'apple_health' }],
    });

    await prisma.providerSelection.update({
      where: { userId: user.id },
      data: { authoritativeIntakeProvider: 'fatsecret' },
    });
    await bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago');
    await bank.reconcileStoredDay(user, '2026-07-21', 'America/Chicago');
    const detail = await bank.getDayDetail(user.id, '2026-07-21');
    expect(detail).toMatchObject({ effectiveDailyBankChange: -100, correctionCount: 1 });
    expect(detail?.versions.map((version) => version.intakeProvider)).toEqual(['apple_health', 'fatsecret']);
    expect((await prisma.calorieLedgerTransaction.findMany({ where: { userId: user.id } }))
      .map((transaction) => transaction.amountCalories)).toEqual([100, -200]);
  });
});
