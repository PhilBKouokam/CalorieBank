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
const date = '2026-08-25';
const timezone = 'America/Chicago';

function user() {
  const id = randomUUID();
  userIds.push(id);
  return { id, email: `historical-source-${id}@caloriebank.local` };
}

async function setup(account: ReturnType<typeof user>) {
  await prisma.user.create({
    data: {
      id: account.id,
      email: account.email,
      profile: { create: { timezone } },
      goalConfiguration: { create: { goalMode: 'maintain', dailyEnergyAdjustment: 0, adjustmentSource: 'manual_calories' } },
      providerSelection: {
        create: {
          authoritativeExpenditureProvider: 'google_health_fitbit',
          authoritativeActivityProvider: 'google_health_fitbit',
          authoritativeIntakeProvider: 'apple_health',
          appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD',
          appleHealthIntakeWriterDisplayName: 'Cronometer',
        },
      },
    },
  });
}

function expenditure(userId: string, provider: 'google_health_fitbit' | 'apple_health', calories: number) {
  const importedAt = new Date('2026-08-26T12:00:00.000Z');
  return normalizeDailyExpenditureAggregate({
    userId, localDate: date, timezone, provider,
    providerRecordId: `${provider}:expenditure:${date}`,
    rawTotalDailyExpenditure: calories,
    adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
    importedAt, providerUpdatedAt: importedAt, syncStatus: 'ready', isCurrentDay: false,
  });
}

function intake(userId: string, provider: 'apple_health' | 'fatsecret', calories: number) {
  const importedAt = new Date('2026-08-26T12:00:00.000Z');
  return normalizeDailyIntakeAggregate({
    userId, localDate: date, timezone, provider,
    providerRecordId: `${provider}:intake:${date}`,
    totalCaloriesConsumed: calories,
    ...(provider === 'apple_health' ? { writerBundleIdentifier: 'CRONOMETER-GOLD', writerDisplayName: 'Cronometer' } : {}),
    importedAt, providerUpdatedAt: importedAt, syncStatus: 'ready', isCurrentDay: false,
  });
}

async function seed(account: ReturnType<typeof user>, appleBurn = 3_500, fatSecretIntake = 2_000) {
  const aggregates = new PrismaTodayAggregateRepository(prisma, { allowSyntheticProviders: false });
  await aggregates.upsertExpenditureAggregate(account, expenditure(account.id, 'google_health_fitbit', 4_000));
  await aggregates.upsertExpenditureAggregate(account, expenditure(account.id, 'apple_health', appleBurn));
  await aggregates.upsertIntakeAggregate(account, intake(account.id, 'apple_health', 1_800));
  await aggregates.upsertIntakeAggregate(account, intake(account.id, 'fatsecret', fatSecretIntake));
}

describe('historical per-day source authority', () => {
  afterEach(async () => prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }));
  afterAll(async () => prisma.$disconnect());

  it('switches burn and intake independently with append-only corrections and supports A to B to A', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const initial = await bank.getDayDetail(account.id, date);
    expect(initial?.effectiveDailyBankChange).toBe(1_400);

    let sources = await bank.getHistoricalSourceOptions(account.id, date);
    expect(sources.expenditure.options.map((item) => item.label).sort()).toEqual(['Apple Health', 'Fitbit']);
    expect(sources.intake.options.map((item) => item.label).sort()).toEqual(['Cronometer', 'FatSecret']);
    const apple = sources.expenditure.options.find((item) => item.label === 'Apple Health')!;
    const changedBurn = await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: apple.id, expectedRevision: 0, idempotencyKey: randomUUID(),
    });
    expect(changedBurn.day.effectiveDailyBankChange).toBe(1_000);
    expect(changedBurn.day.versions.at(-1)).toMatchObject({ expenditureProvider: 'apple_health', correctionDelta: -400 });

    const fitbit = changedBurn.sources.expenditure.options.find((item) => item.label === 'Fitbit')!;
    const restoreKey = randomUUID();
    const restoredBurn = await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: fitbit.id, expectedRevision: 1, idempotencyKey: restoreKey,
    });
    expect(restoredBurn.day.effectiveDailyBankChange).toBe(1_400);
    expect(restoredBurn.day.versions.at(-1)).toMatchObject({ expenditureProvider: 'google_health_fitbit', correctionDelta: 400 });
    const restoredRetry = await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: fitbit.id, expectedRevision: 1, idempotencyKey: restoreKey,
    });
    expect(restoredRetry.day.versions).toHaveLength(3);

    const changedBurnAgain = await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: apple.id, expectedRevision: 2, idempotencyKey: randomUUID(),
    });
    expect(changedBurnAgain.day.effectiveDailyBankChange).toBe(1_000);

    sources = changedBurnAgain.sources;
    const fatSecret = sources.intake.options.find((item) => item.label === 'FatSecret')!;
    const changedIntake = await bank.setHistoricalSource(account, date, 'intake', {
      optionId: fatSecret.id, expectedRevision: 0, idempotencyKey: randomUUID(),
    });
    expect(changedIntake.day.effectiveDailyBankChange).toBe(800);
    expect(changedIntake.sources.expenditure.selected.label).toBe('Apple Health');

    const restored = await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: fitbit.id, expectedRevision: 3, idempotencyKey: randomUUID(),
    });
    expect(restored.day.effectiveDailyBankChange).toBe(1_200);
    const cronometer = restored.sources.intake.options.find((item) => item.label === 'Cronometer')!;
    const restoredIntake = await bank.setHistoricalSource(account, date, 'intake', {
      optionId: cronometer.id, expectedRevision: 1, idempotencyKey: randomUUID(),
    });
    expect(restoredIntake.day.effectiveDailyBankChange).toBe(1_400);
    expect(restoredIntake.sources.intake.selected.label).toBe('Cronometer');
    expect(restoredIntake.day.versions.at(-1)).toMatchObject({ intakeProvider: 'apple_health', correctionDelta: 200 });
    expect(await prisma.providerSelection.findUnique({ where: { userId: account.id } })).toMatchObject({
      authoritativeExpenditureProvider: 'google_health_fitbit',
      authoritativeIntakeProvider: 'apple_health',
    });
    expect((await prisma.calorieLedgerTransaction.findMany({ where: { userId: account.id } })).map((item) => item.amountCalories))
      .toEqual([1_400, -400, 400, -400, -200, 400, 200]);
  });

  it('honors an override during later sync reconciliation and ignores nonselected updates', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const sources = await bank.getHistoricalSourceOptions(account.id, date);
    await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: sources.expenditure.options.find((item) => item.label === 'Apple Health')!.id,
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
    });
    await prisma.dailyExpenditureAggregate.update({
      where: { userId_localDate_provider: { userId: account.id, localDate: new Date(`${date}T00:00:00.000Z`), provider: 'google_health_fitbit' } },
      data: { rawTotalDailyExpenditure: 9_000, adjustedDailyExpenditure: 7_200 },
    });
    await bank.reconcileStoredDay(account, date, timezone);
    expect(await bank.getDayDetail(account.id, date)).toMatchObject({ importedTotalDailyExpenditure: 3_500, effectiveDailyBankChange: 1_000 });

    const afterAppleOverride = await bank.getHistoricalSourceOptions(account.id, date);
    const fitbit = afterAppleOverride.expenditure.options.find((item) => item.label === 'Fitbit')!;
    await bank.setHistoricalSource(account, date, 'expenditure', {
      optionId: fitbit.id, expectedRevision: 1, idempotencyKey: randomUUID(),
    });
    await prisma.dailyExpenditureAggregate.update({
      where: { userId_localDate_provider: { userId: account.id, localDate: new Date(`${date}T00:00:00.000Z`), provider: 'apple_health' } },
      data: { rawTotalDailyExpenditure: 9_000, adjustedDailyExpenditure: 7_200 },
    });
    await bank.reconcileStoredDay(account, date, timezone);
    expect(await bank.getDayDetail(account.id, date)).toMatchObject({ importedTotalDailyExpenditure: 9_000, effectiveDailyBankChange: 5_400 });

    await prisma.dailyExpenditureAggregate.update({
      where: { userId_localDate_provider: { userId: account.id, localDate: new Date(`${date}T00:00:00.000Z`), provider: 'google_health_fitbit' } },
      data: { rawTotalDailyExpenditure: 4_100, adjustedDailyExpenditure: 3_280 },
    });
    await bank.reconcileStoredDay(account, date, timezone);
    expect(await bank.getDayDetail(account.id, date)).toMatchObject({ importedTotalDailyExpenditure: 4_100, effectiveDailyBankChange: 1_480 });
  });

  it('makes duplicate requests idempotent and creates no correction for a zero-delta switch', async () => {
    const account = user();
    await setup(account);
    await seed(account, 4_000);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const sources = await bank.getHistoricalSourceOptions(account.id, date);
    const input = {
      optionId: sources.expenditure.options.find((item) => item.label === 'Apple Health')!.id,
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
    };
    await bank.setHistoricalSource(account, date, 'expenditure', input);
    await bank.setHistoricalSource(account, date, 'expenditure', input);
    expect(await prisma.bankCalculationSnapshot.count({ where: { userId: account.id } })).toBe(1);
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: account.id } })).toBe(1);
    expect((await bank.getHistoricalSourceOptions(account.id, date)).expenditure.selected.label).toBe('Apple Health');
  });

  it('rejects expired correction windows and option IDs owned by another account', async () => {
    const first = user();
    const second = user();
    await setup(first);
    await setup(second);
    await seed(first);
    await seed(second);
    const openBank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await openBank.reconcileStoredDay(first, date, timezone);
    await openBank.reconcileStoredDay(second, date, timezone);
    const firstApple = (await openBank.getHistoricalSourceOptions(first.id, date)).expenditure.options.find((item) => item.label === 'Apple Health')!;
    await expect(openBank.setHistoricalSource(second, date, 'expenditure', {
      optionId: firstApple.id, expectedRevision: 0, idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({ statusCode: 409 });

    const expired = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-29T05:00:00.000Z') });
    await expect(expired.setHistoricalSource(first, date, 'expenditure', {
      optionId: firstApple.id, expectedRevision: 0, idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({ statusCode: 409, details: { code: 'DAY_NO_LONGER_CHANGEABLE' } });
  });

  it('keeps GET options and PATCH eligibility aligned when a connected alternative has exact-date data', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    await prisma.externalProviderConnection.create({ data: {
      userId: account.id,
      provider: 'fatsecret',
      encryptedAccessToken: 'encrypted-access',
      encryptedTokenSecret: 'encrypted-secret',
      authProtocol: 'oauth1',
      status: 'connected',
    } });
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const sources = await bank.getHistoricalSourceOptions(account.id, date);
    const fatSecret = sources.intake.options.find((option) => option.label === 'FatSecret');
    expect(fatSecret).toBeDefined();

    const changed = await bank.setHistoricalSource(account, date, 'intake', {
      optionId: fatSecret!.id,
      expectedRevision: sources.intake.revision,
      idempotencyKey: randomUUID(),
    });
    expect(changed.sources.intake.selected.label).toBe('FatSecret');
    expect(changed.day.versions.at(-1)).toMatchObject({ intakeProvider: 'fatsecret' });
    expect(await prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
      .toMatchObject({ authoritativeIntakeProvider: 'apple_health' });
  });

  it('uses the latest effective snapshot for the unchanged role when its new global source has no date data', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    await prisma.providerSelection.update({
      where: { userId: account.id },
      data: { authoritativeExpenditureProvider: 'apple_health', authoritativeActivityProvider: 'apple_health' },
    });
    await prisma.dailyExpenditureAggregate.delete({
      where: {
        userId_localDate_provider: {
          userId: account.id,
          localDate: new Date(`${date}T00:00:00.000Z`),
          provider: 'apple_health',
        },
      },
    });

    const sources = await bank.getHistoricalSourceOptions(account.id, date);
    expect(sources.expenditure.selected.label).toBe('Fitbit');
    const fatSecret = sources.intake.options.find((option) => option.label === 'FatSecret');
    expect(fatSecret).toBeDefined();

    const changed = await bank.setHistoricalSource(account, date, 'intake', {
      optionId: fatSecret!.id,
      expectedRevision: sources.intake.revision,
      idempotencyKey: randomUUID(),
    });
    expect(changed.sources.intake.selected.label).toBe('FatSecret');
    expect(changed.day.versions.at(-1)).toMatchObject({
      expenditureProvider: 'google_health_fitbit',
      intakeProvider: 'fatsecret',
    });
    expect(await prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
      .toMatchObject({ authoritativeExpenditureProvider: 'apple_health' });
  });

  it('omits missing exact-date alternatives and returns a specific reason if loaded data disappears', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const before = await bank.getHistoricalSourceOptions(account.id, date);
    const fatSecret = before.intake.options.find((option) => option.label === 'FatSecret')!;
    await prisma.dailyIntakeAggregate.delete({
      where: {
        userId_localDate_provider: {
          userId: account.id,
          localDate: new Date(`${date}T00:00:00.000Z`),
          provider: 'fatsecret',
        },
      },
    });
    const after = await bank.getHistoricalSourceOptions(account.id, date);
    expect(after.intake.options.map((option) => option.label)).not.toContain('FatSecret');
    await expect(bank.setHistoricalSource(account, date, 'intake', {
      optionId: fatSecret.id,
      expectedRevision: before.intake.revision,
      idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({ statusCode: 409, details: { code: 'SOURCE_NO_DATA_FOR_DATE' } });
  });

  it('distinguishes unusable exact-date data from missing data', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const before = await bank.getHistoricalSourceOptions(account.id, date);
    const fatSecret = before.intake.options.find((option) => option.label === 'FatSecret')!;
    await prisma.dailyIntakeAggregate.update({
      where: {
        userId_localDate_provider: {
          userId: account.id,
          localDate: new Date(`${date}T00:00:00.000Z`),
          provider: 'fatsecret',
        },
      },
      data: { syncStatus: 'unavailable' },
    });

    await expect(bank.setHistoricalSource(account, date, 'intake', {
      optionId: fatSecret.id,
      expectedRevision: before.intake.revision,
      idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'SOURCE_DATA_NOT_USABLE' },
    });
  });

  it('returns a specific reason when a previously offered Apple Health writer disappears', async () => {
    const account = user();
    await setup(account);
    await seed(account);
    await prisma.providerSelection.update({
      where: { userId: account.id },
      data: { authoritativeIntakeProvider: 'fatsecret' },
    });
    const bank = new PrismaBankHistoryRepository(prisma, { now: () => new Date('2026-08-26T12:00:00.000Z') });
    await bank.reconcileStoredDay(account, date, timezone);
    const before = await bank.getHistoricalSourceOptions(account.id, date);
    const cronometer = before.intake.options.find((option) => option.label === 'Cronometer')!;
    await prisma.dailyIntakeAggregate.delete({
      where: {
        userId_localDate_provider: {
          userId: account.id,
          localDate: new Date(`${date}T00:00:00.000Z`),
          provider: 'apple_health',
        },
      },
    });
    await expect(bank.setHistoricalSource(account, date, 'intake', {
      optionId: cronometer.id,
      expectedRevision: before.intake.revision,
      idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'APPLE_HEALTH_WRITER_UNAVAILABLE' },
    });
  });
});
