import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { IntakeAdjustmentRepository } from '../src/modules/intake-adjustment/intake-adjustment.repository';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
import express from 'express';
import request from 'supertest';
import { intakeCapabilityBoundary } from '../src/security/intake-capability';
import { createBankHistoryRouter } from '../src/modules/bank-history/bank-history.routes';
import { createIntakeAdjustmentRouter } from '../src/modules/intake-adjustment/intake-adjustment.routes';
import { errorHandler } from '../src/errors';
const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.includes('test')) throw new Error('Dedicated localhost test database required.');
const db = new PrismaClient({ datasourceUrl: url }), ids: string[] = [];
const day = '2026-10-13', date = new Date(`${day}T00:00:00Z`), timezone = 'America/Chicago';
const input = (s: IntakeAdjustmentState, mode: 'add' | 'replace' | 'none', calories: number) => ({ localDate: s.localDate, expectedRevision: s.revision, selectionRevision: s.selectionRevision, manualRevision: s.manualRevision, mode, calories });
async function fixture() {
  const id = randomUUID(); ids.push(id);
  const user = await db.user.create({ data: { id, email: `${id}@test.local`, profile: { create: { timezone } } } });
  await db.providerSelection.create({ data: { userId: id, expenditureSelected: true, authoritativeExpenditureProvider: 'google_health_fitbit', intakeSelected: true, authoritativeIntakeProvider: 'health_connect', nativeIntakeSourceId: 'com.cronometer.android.gold' } });
  await db.dailyIntakeAggregate.create({ data: { userId: id, localDate: date, timezone, provider: 'health_connect', providerRecordId: 'food', sourceId: 'com.cronometer.android.gold', sourceDisplayName: 'Cronometer', totalCaloriesConsumed: 1800, importedAt: new Date('2026-10-13T18:00:00Z'), syncStatus: 'ready', isCurrentDay: true } });
  return { id, user, repo: new IntakeAdjustmentRepository(db, () => new Date('2026-10-13T18:00:00Z')) };
}
describe('daily intake adjustments', () => {
  afterEach(async () => { await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
  afterAll(async () => { await db.$disconnect(); });
  it('adds once, follows tracker updates, replaces, removes, and leaves the provider selected', async () => {
    const { id, repo } = await fixture();
    const original = await repo.read(id), save = input(original, 'add', 300);
    expect(await repo.mutate(id, save)).toMatchObject({ calories: 2100, revision: 1 });
    expect(await repo.mutate(id, save)).toMatchObject({ calories: 2100, revision: 1 });
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 2200 } });
    expect((await repo.read(id)).calories).toBe(2500);
    const today = await new PrismaTodayAggregateRepository(db).getTodayForUser(id, day, timezone);
    expect(today.eaten).toMatchObject({ calories: 2500, source: 'Cronometer', intakeAdjustment: { mode: 'add', calories: 300 } });
    await repo.mutate(id, input(await repo.read(id), 'replace', 2700));
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 2400 } });
    expect((await repo.read(id)).calories).toBe(2700);
    await repo.mutate(id, input(await repo.read(id), 'none', 0));
    expect((await repo.read(id)).calories).toBe(2400);
    expect((await db.providerSelection.findUniqueOrThrow({ where: { userId: id } })).authoritativeIntakeProvider).toBe('health_connect');
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
  });
  it('protects missing intake, exact writer, concurrent edits, local date and account ownership', async () => {
    const { id, repo } = await fixture(), other = await fixture();
    const stale = await repo.read(id);
    await repo.mutate(id, input(stale, 'add', 100));
    await expect(repo.mutate(id, input(stale, 'replace', 900))).rejects.toMatchObject({ statusCode: 409 });
    expect((await repo.read(other.id)).adjustment).toBeNull();
    await db.dailyIntakeAggregate.deleteMany({ where: { userId: id } });
    expect((await repo.read(id)).calories).toBeNull();
    await expect(repo.mutate(id, input(await repo.read(id), 'add', 200))).rejects.toMatchObject({ statusCode: 409 });
    expect(await repo.mutate(id, input(await repo.read(id), 'replace', 0))).toMatchObject({ calories: 0 });
    await expect(repo.mutate(id, { ...input(await repo.read(id), 'replace', 100), localDate: '2026-10-12' })).rejects.toMatchObject({ statusCode: 409 });
    expect((await new IntakeAdjustmentRepository(db, () => new Date('2026-10-14T18:00:00Z')).read(id)).adjustment).toBeNull();
    await db.user.delete({ where: { id } });
    expect(await db.dailyIntakeAdjustment.count({ where: { userId: id } })).toBe(0);
  });
  it.each(['add', 'replace'] as const)('finalizes %s coherently, reconciles only applicable evidence, and protects older clients', async mode => {
    const { id, user, repo } = await fixture();
    await repo.mutate(id, input(await repo.read(id), mode, mode === 'add' ? 300 : 2500));
    await db.goalConfiguration.create({ data: { userId: id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
    await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date, timezone, provider: 'google_health_fitbit', providerRecordId: 'burn', rawTotalDailyExpenditure: 4000, adjustedDailyExpenditure: 3200, adjustmentFactor: 0.8, importedAt: new Date('2026-10-14T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { importedAt: new Date('2026-10-14T08:00:00Z'), isCurrentDay: false } });
    let now = new Date('2026-10-14T12:00:00Z');
    const bank = new PrismaBankHistoryRepository(db, { now: () => now });
    await bank.reconcileStoredDay(user, day, timezone);
    if (mode === 'replace') await db.dailyIntakeAggregate.deleteMany({ where: { userId: id } });
    const initial = await db.bankCalculationSnapshot.findFirstOrThrow({ where: { userId: id } });
    expect(initial.importedCalorieIntake).toBe(mode === 'add' ? 2100 : 2500);
    expect(initial.dailyBankChange).toBe(mode === 'add' ? 1100 : 700);
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 2000 } });
    await bank.reconcileStoredDay(user, day, timezone);
    const latest = await db.bankCalculationSnapshot.findFirstOrThrow({ where: { userId: id }, orderBy: { version: 'desc' } });
    expect(latest.importedCalorieIntake).toBe(mode === 'add' ? 2300 : 2500);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(mode === 'add' ? 2 : 1);
    await expect(repo.mutate(id, input(await repo.read(id), 'none', 0))).rejects.toMatchObject({ statusCode: 409 });
    const app = express(); app.use(intakeCapabilityBoundary); app.use(createBankHistoryRouter(bank, user)); app.use(errorHandler);
    for (const path of ['/bank-history?range=ALL', `/bank-history/${day}`, `/bank-history/${day}/sources`]) {
      await request(app).get(path).set('x-caloriebank-capabilities', 'intake-authority-v2').expect(426);
      await request(app).get(path).set('x-caloriebank-capabilities', 'intake-authority-v2,intake-adjustment-v1').expect(200);
    }
    now = new Date('2026-10-17T12:00:00Z');
    await bank.reconcileStoredDay(user, day, timezone);
    await db.dailyIntakeAggregate.updateMany({ where: { userId: id }, data: { totalCaloriesConsumed: 3000 } });
    await bank.reconcileStoredDay(user, day, timezone);
    expect((await db.bankCalculationSnapshot.findFirstOrThrow({ where: { userId: id }, orderBy: { version: 'desc' } })).importedCalorieIntake).toBe(latest.importedCalorieIntake);
  });
  it('guards the adjustment endpoint by capability and rejects injected ownership fields', async () => {
    const { id, user, repo } = await fixture();
    const app = express(); app.use(express.json()); app.use(intakeCapabilityBoundary); app.use(createIntakeAdjustmentRouter(db, user)); app.use(errorHandler);
    await request(app).get('/').set('x-caloriebank-capabilities', 'intake-authority-v2').expect(426);
    await request(app).get('/').set('x-caloriebank-capabilities', 'intake-authority-v2,intake-adjustment-v1').expect(200);
    await request(app).put('/').set('x-caloriebank-capabilities', 'intake-authority-v2,intake-adjustment-v1')
      .send({ ...input(await repo.read(id), 'add', 300), userId: randomUUID() }).expect(400);
    expect(await db.dailyIntakeAdjustment.count({ where: { userId: id } })).toBe(0);
  });
  it('clears the adjustment on an explicit source change, without resurrecting it on return', async () => {
    const { id, user, repo } = await fixture();
    await repo.mutate(id, input(await repo.read(id), 'add', 300));
    const providers = new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db), () => new Date('2026-10-13T19:00:00Z'));
    for (const writer of ['com.myfitnesspal.android', 'com.cronometer.android.gold']) {
      await providers.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'health_connect', nativeIntakeSource: { namespace: 'android_package', id: writer } });
      expect((await repo.read(id)).adjustment).toBeNull();
    }
  });
  it('shares one truth across two device editors and rejects a stale removal', async () => {
    const { id, repo: phoneA } = await fixture();
    const phoneB = new IntakeAdjustmentRepository(db, () => new Date('2026-10-13T18:00:00Z'));
    const [a, b] = await Promise.all([phoneA.read(id), phoneB.read(id)]);
    const outcomes = await Promise.allSettled([
      phoneA.mutate(id, input(a, 'add', 300)), phoneB.mutate(id, input(b, 'replace', 2600)),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await phoneA.read(id)).toEqual(await phoneB.read(id));
    const before = await phoneB.read(id);
    await phoneA.mutate(id, input(await phoneA.read(id), 'add', 400));
    await expect(phoneB.mutate(id, input(before, 'none', 0))).rejects.toMatchObject({ statusCode: 409 });
    expect((await phoneB.read(id)).calories).toBe(2200);
  });
  it('uses the local midnight boundary and never carries an addition into tomorrow', async () => {
    const { id } = await fixture();
    let now = new Date('2026-10-14T04:59:59Z');
    const repo = new IntakeAdjustmentRepository(db, () => now);
    await repo.mutate(id, input(await repo.read(id), 'add', 300));
    const stale = await repo.read(id);
    now = new Date('2026-10-14T05:00:01Z');
    await expect(repo.mutate(id, input(stale, 'replace', 2700))).rejects.toMatchObject({ statusCode: 409 });
    expect(await repo.read(id)).toMatchObject({ localDate: '2026-10-14', adjustment: null, calories: null });
    expect((await db.dailyIntakeAdjustment.findUniqueOrThrow({ where: { userId_localDate: { userId: id, localDate: date } } })).calories).toBe(300);
  });
  it('rejects an editor opened before a source change, even if the adjustment revision still matches', async () => {
    const { id, user, repo } = await fixture();
    const stale = await repo.read(id);
    await new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db), () => new Date('2026-10-13T19:00:00Z')).update(user,
      { selectionRole: 'eaten', authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'health_connect', nativeIntakeSource: { namespace: 'android_package', id: 'com.myfitnesspal.android' } });
    await expect(repo.mutate(id, input(stale, 'replace', 2700))).rejects.toMatchObject({ statusCode: 409 });
    expect((await repo.read(id)).adjustment).toBeNull();
  });

});
