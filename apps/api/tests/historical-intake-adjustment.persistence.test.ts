import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { HistoricalIntakeAdjustmentRepository } from '../src/modules/intake-adjustment/historical-intake-adjustment.repository';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.includes('test')) throw new Error('Dedicated localhost test database required.');
const db = new PrismaClient({ datasourceUrl: url }), ids: string[] = [];
const timezone = 'America/Chicago', day = '2026-11-06', date = new Date(`${day}T00:00:00Z`);
const input = (s: IntakeAdjustmentState, mode: 'add' | 'replace' | 'none', calories: number) => ({ localDate: s.localDate, expectedRevision: s.revision, selectionRevision: s.selectionRevision, manualRevision: s.manualRevision, mode, calories });
async function fixture() {
  const id = randomUUID(); ids.push(id);
  const user = await db.user.create({ data: { id, email: `${id}@test.local`, profile: { create: { timezone } } } });
  await db.providerSelection.create({ data: { userId: id, expenditureSelected: true, authoritativeExpenditureProvider: 'google_health_fitbit', intakeSelected: true, authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriterBundleId: 'com.cronometer' } });
  await db.goalConfiguration.create({ data: { userId: id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
  await db.dailyIntakeAggregate.create({ data: { userId: id, localDate: date, timezone, provider: 'apple_health', providerRecordId: 'food', writerBundleIdentifier: 'com.cronometer', writerDisplayName: 'Cronometer', totalCaloriesConsumed: 1800, importedAt: new Date('2026-11-07T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
  await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date, timezone, provider: 'google_health_fitbit', providerRecordId: 'burn', rawTotalDailyExpenditure: 4000, adjustedDailyExpenditure: 3200, adjustmentFactor: 0.8, importedAt: new Date('2026-11-07T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
  let now = new Date('2026-11-07T14:00:00Z');
  const bank = new PrismaBankHistoryRepository(db, { now: () => now });
  await bank.reconcileStoredDay(user, day, timezone);
  const repo = new HistoricalIntakeAdjustmentRepository(db, bank, () => now);
  return { id, user, bank, repo, setNow: (value: string) => { now = new Date(value); } };
}
describe('two-day intake corrections', () => {
  afterEach(async () => { await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
  afterAll(async () => { await db.$disconnect(); });
  it('adds, replaces, removes and repeats without duplicate ledger changes', async () => {
    const { id, user, repo } = await fixture();
    const initial = await db.calorieLedgerTransaction.findFirstOrThrow({ where: { userId: id } });
    const save = input(await repo.read(id, day), 'add', 300);
    await repo.mutate(user, day, save); await repo.mutate(user, day, save);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(2);
    await repo.mutate(user, day, input(await repo.read(id, day), 'replace', 2700));
    await repo.mutate(user, day, input(await repo.read(id, day), 'none', 0));
    expect((await db.finalizedDailyBankRecord.findFirstOrThrow({ where: { userId: id } })).effectiveDailyBankChange).toBe(1400);
    expect((await db.calorieLedgerTransaction.aggregate({ where: { userId: id }, _sum: { amountCalories: true } }))._sum.amountCalories).toBe(1400);
    expect(await db.calorieLedgerTransaction.findUnique({ where: { id: initial.id } })).toEqual(initial);
  });
  it('accepts yesterday and day before in captured timezone, rejects lock boundary, other users and invalid dates', async () => {
    const { id, user, repo, setNow } = await fixture();
    setNow('2026-11-09T05:59:59Z'); // Nov 8 23:59 Chicago: Nov 6 is day before yesterday.
    await repo.mutate(user, day, input(await repo.read(id, day), 'replace', 2000));
    const stale = await repo.read(id, day);
    setNow('2026-11-09T06:00:00Z');
    await expect(repo.mutate(user, day, input(stale, 'replace', 2100))).rejects.toMatchObject({ statusCode: 409 });
    await expect(repo.read(randomUUID(), day)).rejects.toMatchObject({ statusCode: 404 });
    await expect(repo.read(id, '2026-02-30')).rejects.toMatchObject({ statusCode: 400 });
  });
  it('keeps the posted writer despite a new current selection and rejects stale concurrent edits', async () => {
    const { id, user, repo } = await fixture();
    await db.providerSelection.update({ where: { userId: id }, data: { appleHealthIntakeWriterBundleId: 'other' } });
    expect((await repo.read(id, day)).source).toBe('Cronometer');
    const stale = await repo.read(id, day);
    const results = await Promise.allSettled([repo.mutate(user, day, input(stale, 'replace', 2500)), repo.mutate(user, day, input(stale, 'add', 100))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });
  it('follows provider changes under addition, holds replacement, and restores provider after removal', async () => {
    const { id, user, repo, bank } = await fixture();
    await repo.mutate(user, day, input(await repo.read(id, day), 'add', 300));
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 2000 } });
    await bank.reconcileStoredDay(user, day, timezone);
    expect((await repo.read(id, day)).calories).toBe(2300);
    await repo.mutate(user, day, input(await repo.read(id, day), 'replace', 2700));
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 1800 } });
    await bank.reconcileStoredDay(user, day, timezone);
    expect((await repo.read(id, day)).calories).toBe(2700);
    await repo.mutate(user, day, input(await repo.read(id, day), 'none', 0));
    expect((await repo.read(id, day)).calories).toBe(1800);
    expect((await db.finalizedDailyBankRecord.findFirstOrThrow({ where: { userId: id } })).effectiveDailyBankChange).toBe(1400);
  });
  it('rejects an editor after an equal-calorie historical source override', async () => {
    const { id, user, repo } = await fixture();
    const state = await repo.read(id, day);
    await db.historicalSourceAuthorityOverride.create({ data: { userId: id, localDate: date, role: 'INTAKE', provider: 'apple_health', intakeWriterBundleIdentifier: 'com.cronometer', revision: 1 } });
    await expect(repo.mutate(user, day, input(state, 'replace', 2200))).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.dailyIntakeAdjustment.count({ where: { userId: id } })).toBe(0);
  });
  it('keeps a replacement and bank unchanged if removal has no tracker data', async () => {
    const { id, user, repo } = await fixture();
    await repo.mutate(user, day, input(await repo.read(id, day), 'replace', 2200));
    await db.dailyIntakeAggregate.deleteMany({ where: { userId: id } });
    const state = await repo.read(id, day);
    await expect(repo.mutate(user, day, input(state, 'none', 0))).rejects.toMatchObject({ statusCode: 409 });
    expect((await repo.read(id, day)).adjustment).toEqual({ mode: 'replace', calories: 2200 });
    expect((await db.finalizedDailyBankRecord.findFirstOrThrow({ where: { userId: id } })).effectiveDailyBankChange).toBe(1000);
  });
  it('rejects Opening Bank dates without any adjustment write', async () => {
    const { id, repo } = await fixture();
    await db.bankAccountInitialization.create({ data: { userId: id, status: 'INITIALIZED', timezone } });
    await db.openingBankCalculationDay.create({ data: {
      userId: id, logDate: date, timezone, importedTotalDailyExpenditure: 4000, expenditureAdjustmentRate: 0.8,
      adjustedExpenditure: 3200, goalMode: 'maintain', goalAdjustmentCalories: 0, importedCalorieIntake: 1800,
      dailyAllowance: 3200, dailyBankChange: 1400, expenditureProvider: 'google_health_fitbit', expenditureProviderRecordId: 'burn',
      intakeProvider: 'apple_health', intakeProviderRecordId: 'food',
    } });
    await expect(repo.read(id, day)).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.dailyIntakeAdjustment.count({ where: { userId: id } })).toBe(0);
  });
  it('rolls back the adjustment if the bank cannot reconcile', async () => {
    const { id, user, repo } = await fixture();
    const state = await repo.read(id, day);
    await db.dailyExpenditureAggregate.deleteMany({ where: { userId: id } });
    await expect(repo.mutate(user, day, input(state, 'replace', 2200))).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.dailyIntakeAdjustment.count({ where: { userId: id } })).toBe(0);
  });
});
