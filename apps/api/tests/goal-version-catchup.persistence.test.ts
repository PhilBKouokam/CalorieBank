import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { calculateFinalizedDailyBankChange } from '@caloriebank/domain';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaGoalConfigurationRepository } from '../src/modules/goal-configuration/goal-configuration.repository';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.includes('test')) {
  throw new Error('Dedicated localhost test database required.');
}

const db = new PrismaClient({ datasourceUrl: url });
const ids: string[] = [];
const timezone = 'America/Chicago';
const goals = new PrismaGoalConfigurationRepository(db);

function shiftDate(localDate: string, days: number) {
  const value = new Date(`${localDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseDate(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

async function userWithDay(localDate: string, intake: number | null) {
  const id = randomUUID();
  ids.push(id);
  const user = await db.user.create({
    data: { id, email: `${id}@test.local`, profile: { create: { timezone } } },
  });
  await db.providerSelection.create({
    data: {
      userId: id,
      expenditureSelected: true,
      authoritativeExpenditureProvider: 'google_health_fitbit',
      intakeSelected: true,
      authoritativeIntakeProvider: 'apple_health',
      appleHealthIntakeWriterBundleId: 'com.cronometer',
    },
  });
  await db.bankAccountInitialization.create({
    data: {
      userId: id,
      status: 'INITIALIZED',
      openingEffectiveBalanceCalories: 0,
      historicalOpeningNetCalories: 0,
      accountingStartsOn: parseDate(shiftDate(localDate, -3)),
      timezone,
      initializedAt: new Date(`${localDate}T18:00:00.000Z`),
    },
  });
  await db.dailyExpenditureAggregate.create({
    data: {
      userId: id,
      localDate: parseDate(localDate),
      timezone,
      provider: 'google_health_fitbit',
      providerRecordId: `burn-${localDate}`,
      rawTotalDailyExpenditure: 4000,
      adjustedDailyExpenditure: 3200,
      adjustmentFactor: 0.8,
      importedAt: new Date(`${shiftDate(localDate, 1)}T18:00:00.000Z`),
      syncStatus: 'ready',
      isCurrentDay: false,
    },
  });
  if (intake !== null) {
    await db.dailyIntakeAggregate.create({
      data: {
        userId: id,
        localDate: parseDate(localDate),
        timezone,
        provider: 'apple_health',
        providerRecordId: `food-${localDate}`,
        writerBundleIdentifier: 'com.cronometer',
        writerDisplayName: 'Cronometer',
        totalCaloriesConsumed: intake,
        importedAt: new Date(`${shiftDate(localDate, 1)}T18:00:00.000Z`),
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
  }
  return user;
}

describe('goal versions and missed-day catch-up', () => {
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } });
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('posts a missed day with the pre-edit goal after the live goal changes', async () => {
    const today = getLocalDateForTimezone(timezone, new Date());
    const missedDay = shiftDate(today, -2);
    const user = await userWithDay(missedDay, 1800);
    await goals.upsertForUser(user, {
      goalMode: 'cut',
      dailyEnergyAdjustment: -500,
      adjustmentSource: 'manual_calories',
    });
    await goals.upsertForUser(user, {
      goalMode: 'bulk',
      dailyEnergyAdjustment: 300,
      adjustmentSource: 'manual_calories',
    });
    const bank = new PrismaBankHistoryRepository(db);
    await bank.prepareForGoalChange(user);
    await bank.prepareForGoalChange(user);

    const record = await db.finalizedDailyBankRecord.findUniqueOrThrow({
      where: { userId_logDate: { userId: user.id, logDate: parseDate(missedDay) } },
    });
    const expected = calculateFinalizedDailyBankChange({
      importedTotalDailyExpenditure: 4000,
      expenditureAdjustmentRate: 0.8,
      goalMode: 'cut',
      goalAdjustmentCalories: 500,
      importedCalorieIntake: 1800,
    });
    expect(record.goalMode).toBe('cut');
    expect(record.goalAdjustmentCalories).toBe(500);
    expect(record.dailyBankChange).toBe(expected.dailyBankChange);
    const ledger = await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.type).toBe('daily_finalization');
    expect(ledger[0]?.amountCalories).toBe(expected.dailyBankChange);
    expect(ledger[0]?.idempotencyKey).toBe(`provisional-posting:${user.id}:${missedDay}`);
    const versions = await db.goalConfigurationVersion.findMany({
      where: { userId: user.id },
      orderBy: { recordedAt: 'asc' },
    });
    expect(versions.map((version) => version.effectiveFrom.toISOString().slice(0, 10))).toEqual([
      '1970-01-01',
      today,
    ]);
  });

  it('uses the version effective on each date and does not invent a day with no intake', async () => {
    const today = getLocalDateForTimezone(timezone, new Date());
    const earlier = shiftDate(today, -3);
    const edited = shiftDate(today, -2);
    const missingIntake = shiftDate(today, -1);
    const earlierUser = await userWithDay(earlier, 1800);
    const editedUser = earlierUser;
    await db.dailyExpenditureAggregate.create({
      data: {
        userId: editedUser.id,
        localDate: parseDate(edited),
        timezone,
        provider: 'google_health_fitbit',
        providerRecordId: `burn-${edited}`,
        rawTotalDailyExpenditure: 4000,
        adjustedDailyExpenditure: 3200,
        adjustmentFactor: 0.8,
        importedAt: new Date(`${shiftDate(edited, 1)}T18:00:00.000Z`),
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
    await db.dailyIntakeAggregate.create({
      data: {
        userId: editedUser.id,
        localDate: parseDate(edited),
        timezone,
        provider: 'apple_health',
        providerRecordId: `food-${edited}`,
        writerBundleIdentifier: 'com.cronometer',
        writerDisplayName: 'Cronometer',
        totalCaloriesConsumed: 1800,
        importedAt: new Date(`${shiftDate(edited, 1)}T18:00:00.000Z`),
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
    await db.dailyExpenditureAggregate.create({
      data: {
        userId: editedUser.id,
        localDate: parseDate(missingIntake),
        timezone,
        provider: 'google_health_fitbit',
        providerRecordId: `burn-${missingIntake}`,
        rawTotalDailyExpenditure: 4000,
        adjustedDailyExpenditure: 3200,
        adjustmentFactor: 0.8,
        importedAt: new Date(),
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
    await db.goalConfiguration.create({
      data: {
        userId: editedUser.id,
        goalMode: 'bulk',
        dailyEnergyAdjustment: 300,
        adjustmentSource: 'manual_calories',
      },
    });
    await db.goalConfiguration.update({
      where: { userId: editedUser.id },
      data: { dailyEnergyAdjustment: 300 },
    });
    await db.goalConfigurationVersion.createMany({
      data: [
        {
          userId: editedUser.id,
          effectiveFrom: parseDate('1970-01-01'),
          goalMode: 'cut',
          dailyEnergyAdjustment: -500,
          adjustmentSource: 'manual_calories',
          recordedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          userId: editedUser.id,
          effectiveFrom: parseDate(edited),
          goalMode: 'bulk',
          dailyEnergyAdjustment: 300,
          adjustmentSource: 'manual_calories',
          recordedAt: new Date('2026-11-01T00:00:00.000Z'),
        },
      ],
    });
    const bank = new PrismaBankHistoryRepository(db);
    await bank.reconcileStoredDay(editedUser, earlier, timezone);
    await bank.reconcileStoredDay(editedUser, edited, timezone);
    await bank.reconcileStoredDay(editedUser, earlier, timezone);
    const missing = await bank.reconcileStoredDay(editedUser, missingIntake, timezone);

    const before = await db.finalizedDailyBankRecord.findUniqueOrThrow({
      where: { userId_logDate: { userId: editedUser.id, logDate: parseDate(earlier) } },
    });
    const onEdit = await db.finalizedDailyBankRecord.findUniqueOrThrow({
      where: { userId_logDate: { userId: editedUser.id, logDate: parseDate(edited) } },
    });
    expect(before.goalMode).toBe('cut');
    expect(before.goalAdjustmentCalories).toBe(500);
    expect(before.dailyBankChange).toBe(900);
    expect(onEdit.goalMode).toBe('bulk');
    expect(onEdit.goalAdjustmentCalories).toBe(300);
    expect(onEdit.dailyBankChange).toBe(1700);
    expect(missing.outcome).toBe('not_ready');
    expect(await db.finalizedDailyBankRecord.count({ where: { userId: editedUser.id } })).toBe(2);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: editedUser.id } })).toBe(2);
    const original = await db.calorieLedgerTransaction.findFirstOrThrow({
      where: { userId: editedUser.id, logDate: parseDate(earlier) },
    });
    await bank.reconcileStoredDay(editedUser, earlier, timezone);
    expect(await db.calorieLedgerTransaction.findUnique({ where: { id: original.id } })).toEqual(original);
  });
});
