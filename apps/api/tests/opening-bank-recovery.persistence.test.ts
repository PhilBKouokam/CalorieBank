import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaPlannedTreatRepository } from '../src/modules/planned-treat/planned-treat.repository';

const prisma = new PrismaClient();
const userIds: string[] = [];

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function createUser(options: { openingPolicy?: boolean; goalAdjustment?: number; importComplete?: boolean } = {}) {
  const id = randomUUID();
  userIds.push(id);
  const user = { id, email: `opening-${id}@caloriebank.local` };
  await prisma.user.create({
    data: {
      ...user,
      profile: { create: { timezone: 'America/Chicago' } },
      goalConfiguration: {
        create: {
          goalMode: options.goalAdjustment ? 'cut' : 'maintain',
          dailyEnergyAdjustment: -(options.goalAdjustment ?? 0),
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
      ...(options.openingPolicy ? { bankAccountInitialization: { create: {} } } : {}),
    },
  });
  if (options.openingPolicy && options.importComplete !== false) {
    await prisma.ingestionSyncSession.create({
      data: {
        userId: id,
        provider: 'apple_health',
        localDate: dateOnly('2026-08-19'),
        timezone: 'America/Chicago',
        trigger: 'connection',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(Date.now() + 1_000),
        expenditureStatus: 'ready',
        intakeStatus: 'ready',
        stepsStatus: 'skipped',
        workoutsStatus: 'skipped',
        datesQueried: Array.from({ length: 8 }, (_, offset) => {
          const date = new Date('2026-08-19T12:00:00.000Z');
          date.setUTCDate(date.getUTCDate() - offset);
          return date.toISOString().slice(0, 10);
        }),
      },
    });
  }
  return user;
}

async function addProviderDay(
  userId: string,
  logDate: string,
  dailyBankChange: number,
  options: { expenditure?: boolean; intake?: boolean } = {},
) {
  const rawExpenditure = 2500;
  const adjustedExpenditure = 2000;
  const intake = adjustedExpenditure - dailyBankChange;
  const importedAt = new Date(`${logDate}T18:00:00.000Z`);
  if (options.expenditure !== false) {
    await prisma.dailyExpenditureAggregate.create({
      data: {
        userId,
        localDate: dateOnly(logDate),
        timezone: 'America/Chicago',
        provider: 'apple_health',
        providerRecordId: `apple_health:expenditure:${logDate}`,
        rawTotalDailyExpenditure: rawExpenditure,
        adjustedDailyExpenditure: adjustedExpenditure,
        adjustmentFactor: 0.8,
        importedAt,
        providerUpdatedAt: importedAt,
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
  }
  if (options.intake !== false) {
    await prisma.dailyIntakeAggregate.create({
      data: {
        userId,
        localDate: dateOnly(logDate),
        timezone: 'America/Chicago',
        provider: 'apple_health',
        providerRecordId: `apple_health:intake:${logDate}`,
        totalCaloriesConsumed: intake,
        writerBundleIdentifier: 'CRONOMETER-GOLD',
        writerDisplayName: 'Cronometer',
        importedAt,
        providerUpdatedAt: importedAt,
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
  }
}

describe('Opening Bank and Recovery persistence', () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('does not initialize from an early matching day before the full import attempt completes', async () => {
    const user = await createUser({ openingPolicy: true, importComplete: false });
    await addProviderDay(user.id, '2026-08-18', 400);
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });

    await expect(repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago')).resolves.toEqual({
      outcome: 'waiting_for_opening_data', accountingStartsOn: null, openingEffectiveBalanceCalories: 0,
    });
    await expect(prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('creates one positive Opening Bank from eligible prior-seven-day data without double counting', async () => {
    const user = await createUser({ openingPolicy: true });
    await addProviderDay(user.id, '2026-08-18', 400);
    await addProviderDay(user.id, '2026-08-17', -100);
    await addProviderDay(user.id, '2026-08-16', 900, { intake: false });
    await addProviderDay(user.id, '2026-08-11', 1500);
    await addProviderDay(user.id, '2026-08-19', 1500);
    const repository = new PrismaBankHistoryRepository(prisma, {
      now: () => new Date('2026-08-19T18:00:00.000Z'),
      allowSyntheticProviders: false,
    });

    const first = await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago');
    const second = await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago');

    expect(first).toEqual({
      outcome: 'initialized',
      accountingStartsOn: '2026-08-19',
      openingEffectiveBalanceCalories: 300,
    });
    expect(second).toMatchObject({ outcome: 'already_initialized', openingEffectiveBalanceCalories: 300 });
    expect(await prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).toBe(2);
    expect(await repository.reconcileStoredDay(user, '2026-08-18', 'America/Chicago')).toEqual({
      outcome: 'excluded',
      detail: null,
    });
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
    const history = await repository.getHistory(user.id, 'ALL');
    expect(history.days.map((day) => ({ date: day.logDate, change: day.dailyBankChange, provenance: day.provenance }))).toEqual([
      { date: '2026-08-18', change: 400, provenance: 'opening' },
      { date: '2026-08-17', change: -100, provenance: 'opening' },
    ]);
    expect(history.finalizedDays).toEqual([]);
    expect(await repository.getDayDetail(user.id, '2026-08-18')).toMatchObject({
      provenance: 'opening',
      importedTotalDailyExpenditure: 2500,
      adjustedExpenditure: 2000,
      importedCalorieIntake: 1600,
      dailyBankChange: 400,
      startingBalanceFloorApplied: false,
    });
    expect(await repository.getSummary(user.id)).toMatchObject({
      effectiveBankBalanceCalories: 300,
      availableBankCalories: 300,
      recoveryCalories: 0,
      openingBankStatus: 'initialized',
      openingBankCalories: 300,
      latestCompletedDate: '2026-08-18',
      latestDailyBankChange: 400,
      latestContributionStatus: 'locked',
    });
    const plannedTreat = await new PrismaPlannedTreatRepository(prisma).createOrReplaceForUser(user, {
      name: 'Opening plan',
      requiredCalories: 500,
    });
    expect(plannedTreat).toMatchObject({ availableBankCalories: 300, progressCalories: 300 });
  });

  it('initializes every eligible prior day after the complete eight-date bootstrap attempt', async () => {
    const user = await createUser({ openingPolicy: true });
    for (const logDate of [
      '2026-08-18', '2026-08-17', '2026-08-16', '2026-08-15',
      '2026-08-14', '2026-08-13', '2026-08-12',
    ]) {
      await addProviderDay(user.id, logDate, 100);
    }
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });

    await expect(repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'initialized', openingEffectiveBalanceCalories: 700 });
    await expect(prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).resolves.toBe(7);
    await expect(prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).resolves.toBe(0);
    expect((await repository.getHistory(user.id, 'ALL')).days).toHaveLength(7);
  });

  it.each([
    { dailyChanges: [-400, 100], historicalNet: -300 },
    { dailyChanges: [100, -100], historicalNet: 0 },
  ])('floors a $historicalNet opening net once without creating Recovery', async ({ dailyChanges }) => {
    const user = await createUser({ openingPolicy: true });
    await addProviderDay(user.id, '2026-08-18', dailyChanges[0]!);
    await addProviderDay(user.id, '2026-08-17', dailyChanges[1]!);
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });

    await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago');
    expect(await repository.getSummary(user.id)).toMatchObject({
      effectiveBankBalanceCalories: 0,
      availableBankCalories: 0,
      recoveryCalories: 0,
      openingBankCalories: 0,
    });
    const history = await repository.getHistory(user.id, 'ALL');
    expect(history.days).toHaveLength(2);
    expect(history.days.map((day) => day.dailyBankChange)).toEqual(dailyChanges);
    expect((await repository.getDayDetail(user.id, '2026-08-18'))?.startingBalanceFloorApplied).toBe(true);
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it('unifies opening and finalized dates while filtering ranges across both types', async () => {
    const user = await createUser({ openingPolicy: true });
    await addProviderDay(user.id, '2026-08-18', 400);
    await addProviderDay(user.id, '2026-08-17', -100);
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });
    await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago');
    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-08-25',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 1800,
      finalizedAt: new Date('2026-08-26T06:00:00.000Z'),
    });

    expect((await repository.getHistory(user.id, 'ALL')).days.map((day) => [day.logDate, day.provenance])).toEqual([
      ['2026-08-25', 'finalized'],
      ['2026-08-18', 'opening'],
      ['2026-08-17', 'opening'],
    ]);
    expect((await repository.getHistory(user.id, 'W')).days.map((day) => day.logDate)).toEqual(['2026-08-25']);
    const openingDetail = await repository.getDayDetail(user.id, '2026-08-18');
    const finalizedDetail = await repository.getDayDetail(user.id, '2026-08-25');
    expect(openingDetail).not.toBeNull();
    expect(finalizedDetail).not.toBeNull();
    expect(Object.keys(openingDetail!).sort()).toEqual(Object.keys(finalizedDetail!).sort());
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(1);
    expect(await repository.reconcileStoredDay(user, '2026-08-18', 'America/Chicago')).toEqual({
      outcome: 'excluded',
      detail: null,
    });
  });

  it('records a truthful no-history boundary when the completed import has no matching day', async () => {
    const user = await createUser({ openingPolicy: true });
    await addProviderDay(user.id, '2026-08-18', 200, { intake: false });
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });

    expect(await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago')).toEqual({
      outcome: 'no_history',
      accountingStartsOn: '2026-08-19',
      openingEffectiveBalanceCalories: 0,
    });
    expect(await repository.getSummary(user.id)).toMatchObject({
      openingBankStatus: 'waiting_for_opening_data',
      openingBankCalories: 0,
    });
  });

  it('repairs a false-complete Opening Bank when acknowledged HealthKit skips lacked server intake', async () => {
    const user = await createUser({ openingPolicy: true });
    const skippedDates = Array.from({ length: 8 }, (_, offset) => {
      const date = new Date('2026-08-19T12:00:00.000Z');
      date.setUTCDate(date.getUTCDate() - offset);
      return date.toISOString().slice(0, 10);
    });
    await prisma.ingestionSyncSession.updateMany({
      where: { userId: user.id, provider: 'apple_health' },
      data: { completedAt: new Date(), datesSkipped: skippedDates },
    });
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });
    await expect(repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'no_history', openingEffectiveBalanceCalories: 0 });
    await expect(repository.initializeOpeningBank(user, '2026-08-20', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'initialized', openingEffectiveBalanceCalories: 0 });
    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-08-20',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 1722,
      expenditureProvider: 'apple_health',
      expenditureProviderRecordId: 'apple_health:expenditure:2026-08-20',
      intakeProvider: 'apple_health',
      intakeProviderRecordId: 'apple_health:intake:2026-08-20',
      intakeSourceDisplayName: 'Cronometer',
      intakeWriterBundleIdentifier: 'CRONOMETER-GOLD',
    });
    const ledgerBeforeRepair = await prisma.calorieLedgerTransaction.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'asc' },
    });
    const initialized = await prisma.bankAccountInitialization.findUniqueOrThrow({
      where: { userId: user.id },
    });

    await addProviderDay(user.id, '2026-08-18', 400);
    await addProviderDay(user.id, '2026-08-17', -100);
    const recoveredAt = new Date(initialized.initializedAt!.getTime() + 1_000);
    await Promise.all([
      prisma.dailyExpenditureAggregate.updateMany({ where: { userId: user.id }, data: { importedAt: recoveredAt } }),
      prisma.dailyIntakeAggregate.updateMany({ where: { userId: user.id }, data: { importedAt: recoveredAt } }),
    ]);

    await expect(repository.initializeOpeningBank(user, '2026-08-21', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'already_initialized', openingEffectiveBalanceCalories: 300 });
    expect((await repository.getHistory(user.id, 'ALL')).days.map((day) => [
      day.logDate, day.dailyBankChange, day.provenance,
    ])).toEqual([
      ['2026-08-20', 278, 'finalized'],
      ['2026-08-18', 400, 'opening'],
      ['2026-08-17', -100, 'opening'],
    ]);
    await repository.initializeOpeningBank(user, '2026-08-21', 'America/Chicago');
    await expect(prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).resolves.toBe(2);
    await expect(prisma.calorieLedgerTransaction.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'asc' },
    })).resolves.toEqual(ledgerBeforeRepair);
    await expect(prisma.finalizedDailyBankRecord.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('does not rewrite a legitimate no-history boundary for ordinary late provider data', async () => {
    const user = await createUser({ openingPolicy: true });
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });
    await repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago');
    await repository.initializeOpeningBank(user, '2026-08-20', 'America/Chicago');
    const initialized = await prisma.bankAccountInitialization.findUniqueOrThrow({
      where: { userId: user.id },
    });
    await addProviderDay(user.id, '2026-08-18', 400);
    const recoveredAt = new Date(initialized.initializedAt!.getTime() + 1_000);
    await Promise.all([
      prisma.dailyExpenditureAggregate.updateMany({ where: { userId: user.id }, data: { importedAt: recoveredAt } }),
      prisma.dailyIntakeAggregate.updateMany({ where: { userId: user.id }, data: { importedAt: recoveredAt } }),
    ]);

    await expect(repository.initializeOpeningBank(user, '2026-08-21', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'already_initialized', openingEffectiveBalanceCalories: 0 });
    await expect(prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('posts the first post-signup completed day normally after a no-history opening boundary', async () => {
    const user = await createUser({ openingPolicy: true });
    const repository = new PrismaBankHistoryRepository(prisma, { allowSyntheticProviders: false });
    await expect(repository.initializeOpeningBank(user, '2026-08-19', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'no_history', accountingStartsOn: '2026-08-19' });
    await addProviderDay(user.id, '2026-08-19', 350);

    await expect(repository.initializeOpeningBank(user, '2026-08-20', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'initialized', accountingStartsOn: '2026-08-19' });
    await expect(repository.reconcileStoredDay(user, '2026-08-19', 'America/Chicago'))
      .resolves.toMatchObject({ outcome: 'posted', detail: { dailyBankChange: 350 } });
    await expect(prisma.openingBankCalculationDay.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('preserves an existing negative account and derives Recovery without changing its ledger', async () => {
    const user = await createUser();
    const repository = new PrismaBankHistoryRepository(prisma);
    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-08-18',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 3000,
      finalizedAt: new Date('2026-08-19T06:00:00.000Z'),
    });
    const ledgerBefore = await prisma.calorieLedgerTransaction.findMany({ where: { userId: user.id } });

    const summary = await repository.getSummary(user.id);
    const history = await repository.getHistory(user.id, 'ALL');
    const ledgerAfter = await prisma.calorieLedgerTransaction.findMany({ where: { userId: user.id } });
    expect(summary).toMatchObject({
      effectiveBankBalanceCalories: -1000,
      availableBankCalories: 0,
      recoveryCalories: 1000,
      openingBankStatus: 'initialized',
    });
    expect(ledgerAfter).toEqual(ledgerBefore);
    expect(history.finalizedDays[0]).toMatchObject({ dailyBankChange: -1000 });
  });

  it('naturally repays Recovery and exposes only the positive remainder as Available Bank', async () => {
    const user = await createUser();
    const repository = new PrismaBankHistoryRepository(prisma);
    const inputs = [
      { date: '2026-08-16', raw: 2500, intake: 3800 },
      { date: '2026-08-17', raw: 2500, intake: 1500 },
      { date: '2026-08-18', raw: 2500, intake: 700 },
    ];
    for (const [index, input] of inputs.entries()) {
      await repository.postProvisionalDailyRecord(user, {
        logDate: input.date,
        timezone: 'America/Chicago',
        importedTotalDailyExpenditure: input.raw,
        goalMode: 'maintain',
        goalAdjustmentCalories: 0,
        importedCalorieIntake: input.intake,
        finalizedAt: new Date('2026-08-19T06:00:00.000Z'),
      });
      if (index === 1) {
        expect(await repository.getSummary(user.id)).toMatchObject({
          effectiveBankBalanceCalories: -1300,
          availableBankCalories: 0,
          recoveryCalories: 1300,
        });
      }
    }
    expect(await repository.getSummary(user.id)).toMatchObject({
      effectiveBankBalanceCalories: 0,
      availableBankCalories: 0,
      recoveryCalories: 0,
    });

    await repository.postProvisionalDailyRecord(user, {
      logDate: '2026-08-15',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 1800,
      finalizedAt: new Date('2026-08-19T06:00:00.000Z'),
    });
    expect(await repository.getSummary(user.id)).toMatchObject({
      effectiveBankBalanceCalories: 200,
      availableBankCalories: 200,
      recoveryCalories: 0,
    });
  });

  it('uses zero Available Bank for Planned Treat while the effective account is in Recovery', async () => {
    const user = await createUser();
    const bank = new PrismaBankHistoryRepository(prisma);
    await bank.postProvisionalDailyRecord(user, {
      logDate: '2026-08-18',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 2500,
      finalizedAt: new Date('2026-08-19T06:00:00.000Z'),
    });
    const plannedTreat = new PrismaPlannedTreatRepository(prisma);
    const response = await plannedTreat.createOrReplaceForUser(user, {
      name: 'Dinner',
      requiredCalories: 500,
    });
    expect(response).toMatchObject({
      availableBankCalories: 0,
      progressCalories: 0,
      remainingCalories: 500,
      status: 'saving',
    });
  });
});
