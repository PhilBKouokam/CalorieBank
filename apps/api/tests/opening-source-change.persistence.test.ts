import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { openingImportDates, openingPreparationSourceKey, readOpeningImportState } from '../src/modules/bank-history/opening-bank-import';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';

const db = new PrismaClient();
const ids: string[] = [];
const today = '2026-09-08';
const zone = 'America/Chicago';
const bank = new PrismaBankHistoryRepository(db, { now: () => new Date(`${today}T18:00:00Z`) });
const sources = new PrismaProviderSelectionRepository(db, bank);
const date = (value: string) => new Date(`${value}T00:00:00Z`);

async function account() {
  const id = randomUUID(); ids.push(id);
  const user = { id, email: `${id}@test.local` };
  await db.user.create({ data: {
    ...user, profile: { create: { timezone: zone } }, bankAccountInitialization: { create: {} },
    goalConfiguration: { create: { goalMode: 'maintain', dailyEnergyAdjustment: 0, adjustmentSource: 'manual_calories' } },
    providerSelection: { create: { expenditureSelected: true, intakeSelected: true, authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'fatsecret' } },
    googleHealthConnection: { create: { status: 'connected', encryptedAccessToken: 'test', encryptedRefreshToken: 'test', accessTokenExpiresAt: new Date('2030-01-01') } },
    externalProviderConnections: { create: { provider: 'fatsecret', status: 'connected', encryptedAccessToken: 'test' } },
  } });
  return user;
}

async function checked(id: string) {
  const selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
  for (const provider of new Set([selection.authoritativeExpenditureProvider, selection.authoritativeIntakeProvider])) {
    const startedAt = new Date(Math.max(Date.now(), selection.updatedAt.getTime() + 2));
    await db.ingestionSyncSession.create({ data: {
      userId: id, provider, localDate: date(today), timezone: zone, trigger: 'manual_refresh',
      status: 'completed', startedAt, completedAt: new Date(startedAt.getTime() + 1),
      expenditureStatus: 'unavailable', intakeStatus: 'unavailable', datesQueried: openingImportDates(today),
    } });
  }
}

async function history(id: string) {
  const selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
  await db.dailyExpenditureAggregate.create({ data: {
    userId: id, localDate: date('2026-09-07'), timezone: zone, provider: selection.authoritativeExpenditureProvider,
    providerRecordId: `${id}:burn`, rawTotalDailyExpenditure: 2500, adjustedDailyExpenditure: 2000,
    adjustmentFactor: 0.8, importedAt: new Date(`${today}T12:00:00Z`), syncStatus: 'ready', isCurrentDay: false,
  } });
  await db.dailyIntakeAggregate.create({ data: {
    userId: id, localDate: date('2026-09-07'), timezone: zone, provider: selection.authoritativeIntakeProvider,
    providerRecordId: `${id}:food`, totalCaloriesConsumed: 1500,
    writerBundleIdentifier: selection.authoritativeIntakeProvider === 'apple_health' ? selection.appleHealthIntakeWriterBundleId : null,
    writerDisplayName: selection.appleHealthIntakeWriterDisplayName,
    importedAt: new Date(`${today}T12:00:00Z`), syncStatus: 'ready', isCurrentDay: false,
  } });
}

describe('Opening Bank source-context recovery', () => {
  afterEach(async () => { await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
  afterAll(async () => { await db.$disconnect(); });

  for (const change of ['burn', 'intake', 'both', 'writer'] as const) {
    it(`reconsiders empty preparation after changing ${change}, then initializes idempotently`, async () => {
      const user = await account();
      if (change === 'writer') await sources.update(user, {
        selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriter: { bundleIdentifier: 'old.exact.writer', displayName: 'Old tracker' },
      });
      await checked(user.id);
      expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('no_history');
      const before = await db.bankAccountInitialization.findUniqueOrThrow({ where: { userId: user.id } });
      await new Promise(resolve => setTimeout(resolve, 5));
      if (change === 'burn' || change === 'both') await sources.update(user, {
        selectionRole: 'burned', authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'fatsecret',
      });
      if (change !== 'burn') await sources.update(user, {
        selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriter: { bundleIdentifier: 'CRONOMETER-GOLD', displayName: 'Cronometer' },
      });
      expect((await readOpeningImportState(db, user.id, today)).complete).toBe(false);
      expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('waiting_for_opening_data');
      const pending = await db.bankAccountInitialization.findUniqueOrThrow({ where: { userId: user.id } });
      expect(pending.accountingStartsOn).toBeNull();
      expect(pending.preparationSourceKey).not.toBe(before.preparationSourceKey);
      expect(pending.preparationSourceKey).toBe(openingPreparationSourceKey(await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } })));
      await history(user.id); await checked(user.id);
      expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('initialized');
      expect((await bank.getSummary(user.id)).availableBankCalories).toBe(500);
      expect((await bank.getHistory(user.id, 'ALL')).days).toHaveLength(1);
      await bank.initializeOpeningBank(user, today, zone);
      expect(await db.openingBankCalculationDay.count({ where: { userId: user.id } })).toBe(1);
      expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
    });
  }

  it('does not invalidate unchanged selections or mutable labels, and new empty sources stay truthful', async () => {
    const user = await account();
    await checked(user.id); await bank.initializeOpeningBank(user, today, zone);
    const before = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    await sources.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'fatsecret' });
    expect((await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } })).updatedAt).toEqual(before.updatedAt);
    expect((await readOpeningImportState(db, user.id, today)).complete).toBe(true);
    await sources.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriter: { bundleIdentifier: 'CRONOMETER-GOLD', displayName: 'Cronometer' } });
    await checked(user.id);
    expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('no_history');
    const selected = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    await sources.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriter: { bundleIdentifier: 'CRONOMETER-GOLD', displayName: 'New display label' } });
    expect((await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } })).updatedAt).toEqual(selected.updatedAt);
    expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('no_history');
    expect(await db.openingBankCalculationDay.count({ where: { userId: user.id } })).toBe(0);
  });

  it('preserves an initialized Opening Bank and its rows after source changes', async () => {
    const user = await account(); await history(user.id); await checked(user.id);
    await bank.initializeOpeningBank(user, today, zone);
    await bank.postProvisionalDailyRecord(user, {
      logDate: today, timezone: zone, importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain', goalAdjustmentCalories: 0, importedCalorieIntake: 1722,
      finalizedAt: new Date('2026-09-09T06:00:00Z'),
    });
    const opening = await db.openingBankCalculationDay.findMany({ where: { userId: user.id } });
    const ledger = await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } });
    const finalized = await db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    await sources.update(user, { selectionRole: 'burned', authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'fatsecret' });
    expect((await bank.initializeOpeningBank(user, today, zone)).outcome).toBe('already_initialized');
    expect((await bank.getSummary(user.id)).availableBankCalories).toBe(778);
    expect(await db.openingBankCalculationDay.findMany({ where: { userId: user.id } })).toEqual(opening);
    expect(await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } })).toEqual(ledger);
    expect(await db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } })).toEqual(finalized);
  });

  it('rejects an old-context session that finishes after a source change', async () => {
    const user = await account();
    const selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    await db.ingestionSyncSession.create({ data: { userId: user.id, provider: 'apple_health', localDate: date(today), timezone: zone, trigger: 'manual_refresh', status: 'completed', startedAt: new Date(selection.updatedAt.getTime() - 100), completedAt: new Date(selection.updatedAt.getTime() + 100), expenditureStatus: 'ready', intakeStatus: 'ready', datesQueried: openingImportDates(today) } });
    expect((await readOpeningImportState(db, user.id, today)).expenditure).toBe('preparing');
  });
});
