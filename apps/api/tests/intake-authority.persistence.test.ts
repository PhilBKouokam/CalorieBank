import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { lockIntakeAuthority, resolveIntakeAuthority, selectionIdentity, transitionIntakeAuthority } from '../src/modules/provider-selection/intake-authority';
import { resolveDaySourceAuthority } from '../src/modules/bank-history/day-source-authority';
import { todayResponseSchema, bankHistoryDayDetailResponseSchema } from '@caloriebank/schemas';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';

const db = new PrismaClient();
const accounts: string[] = [];
const cron = { authoritativeIntakeProvider: 'health_connect', appleHealthIntakeWriterBundleId: null, nativeIntakeSourceId: 'com.cronometer.android.gold' };
const fat = { authoritativeIntakeProvider: 'fatsecret', appleHealthIntakeWriterBundleId: null, nativeIntakeSourceId: null };
async function account(timezone = 'America/Chicago') {
  const id = randomUUID(); accounts.push(id);
  return db.user.create({ data: { id, email: `${id}@test.local`, profile: { create: { timezone } },
    goalConfiguration: { create: { goalMode: 'maintain', dailyEnergyAdjustment: 0, adjustmentSource: 'manual_calories' } },
    providerSelection: { create: { ...cron, expenditureSelected: true, intakeSelected: true, authoritativeExpenditureProvider: 'google_health_fitbit' } } } });
}
async function switchAt(userId: string, next: { authoritativeIntakeProvider: string; appleHealthIntakeWriterBundleId: string | null; nativeIntakeSourceId: string | null }, now: string) {
  return db.$transaction(async (tx) => {
    await lockIntakeAuthority(tx, userId);
    const prior = await tx.providerSelection.findUniqueOrThrow({ where: { userId } });
    await transitionIntakeAuthority(tx, userId, prior, selectionIdentity(next), new Date(now));
    await tx.providerSelection.update({ where: { userId }, data: next });
  });
}
async function resolve(userId: string, date: string) {
  const projection = await db.providerSelection.findUniqueOrThrow({ where: { userId } });
  return resolveIntakeAuthority(db, userId, new Date(date), projection);
}

describe('effective-dated intake authority persistence', () => {
  afterEach(async () => { await db.user.deleteMany({ where: { id: { in: accounts.splice(0) } } }); });
  afterAll(async () => { await db.$disconnect(); });
  it('holds hosted transitions without writes and freezes the legacy cutover selection', async () => {
    const user = await account();
    await db.intakeAuthorityBoundary.create({ data: { userId: user.id, ...selectionIdentity(cron) } });
    // An old instance changes only its legacy projection during rolling deployment.
    await db.providerSelection.update({ where: { userId: user.id }, data: fat });
    expect(await resolve(user.id, '2026-09-19')).toMatchObject(selectionIdentity(fat));
    await expect(db.$transaction(async (tx) => {
      await lockIntakeAuthority(tx, user.id);
      await transitionIntakeAuthority(tx, user.id, fat, selectionIdentity(cron), new Date('2026-09-20T18:00:00Z'), false);
    })).rejects.toThrow('Sources are updating');
    expect(await db.intakeAuthorityBoundary.count({ where: { userId: user.id } })).toBe(1);
    await switchAt(user.id, cron, '2026-09-20T18:00:00Z');
    expect(await resolve(user.id, '2026-09-19')).toMatchObject(selectionIdentity(fat));
    expect(await resolve(user.id, '2026-09-20')).toMatchObject(selectionIdentity(cron));
  });
  it('preserves old dates, switches Today, reverses on later dates and ignores duplicate retries', async () => {
    const user = await account();
    await switchAt(user.id, fat, '2026-09-20T18:00:00Z');
    expect(await resolve(user.id, '2026-09-19')).toMatchObject(selectionIdentity(cron));
    expect(await resolve(user.id, '2026-09-20')).toMatchObject(selectionIdentity(fat));
    await Promise.all([switchAt(user.id, fat, '2026-09-20T18:01:00Z'), switchAt(user.id, fat, '2026-09-20T18:02:00Z')]);
    expect(await db.intakeAuthorityBoundary.count({ where: { userId: user.id } })).toBe(2);
    await switchAt(user.id, cron, '2026-09-22T18:00:00Z');
    expect(await resolve(user.id, '2026-09-21')).toMatchObject(selectionIdentity(fat));
    expect(await resolve(user.id, '2026-09-22')).toMatchObject(selectionIdentity(cron));
  });
  it('distinguishes exact writers and serializes competing same-day switches', async () => {
    const user = await account();
    const other = { ...cron, nativeIntakeSourceId: 'com.myfitnesspal.android' };
    await Promise.all([switchAt(user.id, fat, '2026-09-20T18:00:00Z'), switchAt(user.id, other, '2026-09-20T18:00:00Z')]);
    const projection = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    expect(await resolve(user.id, '2026-09-20')).toMatchObject(selectionIdentity(projection));
    expect(await resolve(user.id, '2026-09-19')).toMatchObject(selectionIdentity(cron));
    expect(await db.intakeAuthorityBoundary.count({ where: { userId: user.id } })).toBe(2);
  });
  it.each(['2026-03-08T07:59:59Z', '2026-03-08T08:00:00Z', '2026-11-01T06:59:59Z', '2026-11-01T07:00:00Z'])('uses civil dates at DST boundary %s', async (instant) => {
    const user = await account(); await switchAt(user.id, fat, instant);
    expect(await resolve(user.id, instant.slice(0, 10))).toMatchObject(selectionIdentity(fat));
  });
  it('rejects a backwards travel-date switch without changing the projection', async () => {
    const user = await account('Pacific/Kiritimati');
    await switchAt(user.id, fat, '2026-09-20T12:00:00Z');
    await db.userProfile.update({ where: { userId: user.id }, data: { timezone: 'Pacific/Honolulu' } });
    await expect(switchAt(user.id, cron, '2026-09-20T12:00:00Z')).rejects.toThrow('local day');
    expect(await resolve(user.id, '2026-09-21')).toMatchObject(selectionIdentity(fat));
    expect(await resolve(user.id, '2026-09-20')).toMatchObject(selectionIdentity(cron));
    const bank = new PrismaBankHistoryRepository(db);
    const sources = new PrismaProviderSelectionRepository(db, bank, () => new Date('2026-09-20T12:00:00Z'));
    expect((await sources.get(user.id)).intake.authoritativeProvider).toBe('health_connect');
    expect((await sources.getHealthConnections(user.id)).eaten.selected?.label).toBe('Cronometer');
  });
  it('enforces baseline/date uniqueness, exact identities, account ownership and deletion cascade', async () => {
    const user = await account(); const other = await account();
    await switchAt(user.id, fat, '2026-09-20T18:00:00Z');
    await expect(db.intakeAuthorityBoundary.create({ data: { userId: user.id, provider: 'fatsecret' } })).rejects.toThrow();
    await expect(db.intakeAuthorityBoundary.create({ data: { userId: other.id, provider: 'health_connect' } })).rejects.toThrow();
    await expect(db.intakeAuthorityBoundary.create({ data: { userId: randomUUID(), provider: 'fatsecret' } })).rejects.toThrow();
    await expect(db.intakeAuthorityBoundary.create({ data: { userId: other.id, provider: 'future_source', writerId: 'incorrect' } })).rejects.toThrow();
    expect(await resolve(other.id, '2026-09-20')).toMatchObject(selectionIdentity(cron));
    await db.user.delete({ where: { id: user.id } });
    expect(await db.intakeAuthorityBoundary.count({ where: { userId: user.id } })).toBe(0);
    await db.user.deleteMany({ where: { id: user.id } });
  });
  it('retains posted source, permits Cronometer 2716→3149 late evidence and never sums FatSecret', async () => {
    const user = await account('UTC'); const day = new Date('2026-09-16');
    await db.dailyExpenditureAggregate.create({ data: { userId: user.id, localDate: day, timezone: 'UTC', provider: 'google_health_fitbit', providerRecordId: 'burn', rawTotalDailyExpenditure: 5000, adjustedDailyExpenditure: 4000, adjustmentFactor: 0.8, importedAt: new Date('2026-09-17T01:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
    const row = await db.dailyIntakeAggregate.create({ data: { userId: user.id, localDate: day, timezone: 'UTC', provider: 'health_connect', sourceId: cron.nativeIntakeSourceId, sourceDisplayName: 'Cronometer', providerRecordId: 'cron', totalCaloriesConsumed: 2716, importedAt: new Date('2026-09-17T01:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-17T12:00:00Z') });
    await bank.reconcileStoredDay(user, '2026-09-16', 'UTC');
    const before = await bank.getDayDetail(user.id, '2026-09-16');
    expect(before?.effectiveDailyBankChange).toBe(1284);
    const futureHistory = structuredClone(before!);
    futureHistory.versions[0]!.intakeProvider = 'manual_estimate';
    expect(bankHistoryDayDetailResponseSchema.parse(futureHistory).effectiveDailyBankChange).toBe(1284);
    const futureToday = await new PrismaTodayAggregateRepository(db).getTodayForUser(user.id, '2026-09-17', 'UTC');
    futureToday.eaten = { ...futureToday.eaten, calories: 2500, source: 'Calorie source', status: 'ready' };
    expect(todayResponseSchema.parse(futureToday).eaten.calories).toBe(2500);

    const ledger = await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } });
    await switchAt(user.id, fat, '2026-09-17T12:00:00Z');
    await bank.reconcileStoredDay(user, '2026-09-16', 'UTC');
    expect(await bank.getDayDetail(user.id, '2026-09-16')).toEqual(before);
    expect(await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } })).toEqual(ledger);
    await db.dailyIntakeAggregate.update({ where: { id: row.id }, data: { totalCaloriesConsumed: 3149 } });
    await bank.reconcileStoredDay(user, '2026-09-16', 'UTC');
    expect((await bank.getDayDetail(user.id, '2026-09-16'))?.effectiveDailyBankChange).toBe(851);
    expect((await resolveDaySourceAuthority(db, user.id, day, 'UTC')).selectedIntake?.sourceId).toBe(cron.nativeIntakeSourceId);
    const count = await db.calorieLedgerTransaction.count({ where: { userId: user.id } });
    await Promise.all([bank.reconcileStoredDay(user, '2026-09-16', 'UTC'), bank.reconcileStoredDay(user, '2026-09-16', 'UTC')]);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(count);
  });
  it('serializes a midnight switch against first posting without mixing source and value', async () => {
    const user = await account('UTC'); const day = new Date('2026-09-16');
    await db.dailyExpenditureAggregate.create({ data: { userId: user.id, localDate: day, timezone: 'UTC', provider: 'google_health_fitbit', providerRecordId: 'race-burn', rawTotalDailyExpenditure: 5000, adjustedDailyExpenditure: 4000, adjustmentFactor: 0.8, importedAt: new Date('2026-09-17T00:00:01Z'), syncStatus: 'ready', isCurrentDay: false } });
    for (const [provider, calories, sourceId] of [['health_connect', 2716, cron.nativeIntakeSourceId], ['fatsecret', 1000, '']] as const) {
      await db.dailyIntakeAggregate.create({ data: { userId: user.id, localDate: day, timezone: 'UTC', provider, sourceId, sourceDisplayName: 'Cronometer', providerRecordId: provider, totalCaloriesConsumed: calories, importedAt: new Date('2026-09-17T00:00:01Z'), syncStatus: 'ready', isCurrentDay: false } });
    }
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-17T00:00:02Z') });
    await Promise.all([switchAt(user.id, fat, '2026-09-17T00:00:02Z'), bank.reconcileStoredDay(user, '2026-09-16', 'UTC')]);
    expect((await bank.getDayDetail(user.id, '2026-09-16'))?.effectiveDailyBankChange).toBe(1284);
    const snapshots = await db.bankCalculationSnapshot.findMany({ where: { userId: user.id } });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ intakeProvider: 'health_connect', intakeSourceId: cron.nativeIntakeSourceId, importedCalorieIntake: 2716 });
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(1);
  });

});
