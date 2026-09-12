import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { bankingProviderSchema, nativeIntakeBatchSchema, type NativeIntakeBatch } from '@caloriebank/schemas';
import { canProvideAuthoritativeExpenditure } from '@caloriebank/domain';
import { createNativeIntakeRouter } from '../src/modules/native-intake/native-intake.routes';
import { errorHandler } from '../src/errors';
import { openingImportDates, readOpeningImportState } from '../src/modules/bank-history/opening-bank-import';
import { resolveDaySourceAuthority } from '../src/modules/bank-history/day-source-authority';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';

const db = new PrismaClient();
const ids: string[] = [];
const now = new Date('2026-09-12T12:00:00Z');
const revision = '2026-09-12T11:59:00.000Z';
const dates = openingImportDates('2026-09-12');
async function account(origin = 'com.sbs.diet') {
  const id = randomUUID(); ids.push(id);
  await db.user.create({ data: { id, email: `${id}@test.local`, bankAccountInitialization: { create: {} }, profile: { create: { timezone: 'UTC' } },
    goalConfiguration: { create: { goalMode: 'maintain', dailyEnergyAdjustment: 0, adjustmentSource: 'manual_calories' } },
    providerSelection: { create: { expenditureSelected: true, intakeSelected: true,
      authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeActivityProvider: 'google_health_fitbit',
      authoritativeIntakeProvider: 'health_connect', nativeIntakeSourceId: origin, updatedAt: new Date(revision) } } } });
  return { id, email: `${id}@test.local` };
}
function batch(origin = 'com.sbs.diet'): NativeIntakeBatch {
  return { source: { namespace: 'android_package', id: origin }, selectionRevision: revision,
    queryStartedAt: '2026-09-12T11:59:30.000Z', observedAt: '2026-09-12T11:59:35.000Z', timezone: 'UTC',
    days: dates.map((localDate) => ({ localDate, quality: 'usable_evidence', totalCaloriesConsumed: 2000, providerUpdatedAt: '2026-09-12T11:30:00.000Z' })) };
}
function api(user: Awaited<ReturnType<typeof account>>, scheduler = { execute: vi.fn(async () => ({ datesReconciled: [], datesLocked: [], waitingDates: [], errors: [] })) }) {
  const app = express(); app.use(express.json()); app.use('/native', createNativeIntakeRouter(db, user, scheduler, () => now)); app.use(errorHandler); return { app, scheduler };
}
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(async () => db.$disconnect());
describe('exact native intake persistence and authority', () => {
  it('stores one normalized origin and invokes existing server orchestration', async () => {
    const user = await account(); const { app, scheduler } = api(user);
    await request(app).post('/native').send(batch()).expect(200);
    const rows = await db.dailyIntakeAggregate.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(8); expect(rows.every((r) => r.provider === 'health_connect' && r.sourceId === 'com.sbs.diet' && r.writerBundleIdentifier === null)).toBe(true);
    expect(scheduler.execute).toHaveBeenCalledWith(expect.objectContaining({ user, dates, timezone: 'UTC' }));
    expect((await readOpeningImportState(db, user.id, '2026-09-12')).intake).toBe('complete');
  });
  it('rejects a different package or stale source selection without writing anything', async () => {
    const user = await account(); const { app } = api(user);
    await request(app).post('/native').send(batch('com.sbs.diet.other')).expect(409);
    await request(app).post('/native').send({ ...batch(), selectionRevision: '2026-09-12T11:58:00.000Z' }).expect(409);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.ingestionSyncSession.count({ where: { userId: user.id } })).toBe(0);
  });
  it('does not give account B account A authority or accept a client owner field', async () => {
    const a = await account(), b = await account('com.other.food');
    const { app } = api(b);
    await request(app).post('/native').send(batch()).expect(409);
    await request(app).post('/native').send({ ...batch('com.other.food'), userId: a.id }).expect(400);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: { in: [a.id, b.id] } } })).toBe(0);
  });
  it('preserves empty and missing-energy days rather than inserting zero, while explicit zero is usable', async () => {
    const user = await account(); const { app } = api(user); const input = batch();
    input.days[0] = { ...input.days[0]!, quality: 'empty', totalCaloriesConsumed: null };
    input.days[1] = { ...input.days[1]!, quality: 'no_calorie_records', totalCaloriesConsumed: null };
    input.days[2]!.totalCaloriesConsumed = 0;
    await request(app).post('/native').send(input).expect(200);
    const rows = await db.dailyIntakeAggregate.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(6); expect(rows.find((r) => r.localDate.toISOString().startsWith(dates[2]!))?.totalCaloriesConsumed).toBe(0);
    expect((await readOpeningImportState(db, user.id, '2026-09-12')).intake).toBe('complete');
  });
  it('withholds ambiguous preparation and invalidates a previously usable exact-source day', async () => {
    const user = await account(); const { app } = api(user); await request(app).post('/native').send(batch()).expect(200);
    const input = batch(); input.queryStartedAt = '2026-09-12T11:59:40.000Z'; input.observedAt = '2026-09-12T11:59:45.000Z';
    input.days[1] = { ...input.days[1]!, quality: 'ambiguous_overlap', totalCaloriesConsumed: null };
    await request(app).post('/native').send(input).expect(200);
    expect((await readOpeningImportState(db, user.id, '2026-09-12')).intake).toBe('retry_needed');
    expect((await resolveDaySourceAuthority(db, user.id, new Date(`${dates[1]}T00:00:00Z`), 'UTC')).selectedIntake).toBeNull();
  });
  it('rejects mixed ranges, duplicate dates, future/stale observations and unsupported burn', async () => {
    const user = await account(); const { app } = api(user);
    const duplicate = batch(); duplicate.days[1] = duplicate.days[0]!;
    await request(app).post('/native').send(duplicate).expect(409);
    await request(app).post('/native').send({ ...batch(), observedAt: '2026-09-13T12:00:00.000Z' }).expect(409);
    expect(bankingProviderSchema.safeParse('health_connect').success).toBe(false);
    expect(canProvideAuthoritativeExpenditure('health_connect')).toBe(false);
    expect(nativeIntakeBatchSchema.safeParse({ ...batch(), caloriesBurned: 4000 }).success).toBe(false);
  });
  it('retains prior origins and never resolves populated unselected writers after switching', async () => {
    const user = await account(); const { app } = api(user); await request(app).post('/native').send(batch()).expect(200);
    await db.providerSelection.update({ where: { userId: user.id }, data: { nativeIntakeSourceId: 'com.other.food', updatedAt: new Date(revision) } });
    expect((await resolveDaySourceAuthority(db, user.id, new Date(`${dates[1]}T00:00:00Z`), 'UTC')).selectedIntake).toBeNull();
    const next = batch('com.other.food'); next.days.forEach((d) => { d.totalCaloriesConsumed = 1800; });
    await request(app).post('/native').send(next).expect(200);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: user.id } })).toBe(16);
    expect((await resolveDaySourceAuthority(db, user.id, new Date(`${dates[1]}T00:00:00Z`), 'UTC')).selectedIntake?.sourceId).toBe('com.other.food');
    await request(app).post('/native').send(batch()).expect(409);
  });
  it('uses Fitbit plus exact nutrition for canonical Opening Bank and never reopens it', async () => {
    const user = await account(); const { app } = api(user); await request(app).post('/native').send(batch()).expect(200);
    await db.ingestionSyncSession.create({ data: { userId: user.id, provider: 'google_health_fitbit', localDate: new Date('2026-09-12'), timezone: 'UTC', trigger: 'manual_refresh', status: 'completed', startedAt: new Date('2026-09-12T11:59:20Z'), completedAt: now, expenditureStatus: 'ready', datesQueried: dates } });
    for (const date of dates.slice(1)) await db.dailyExpenditureAggregate.create({ data: { userId: user.id, provider: 'google_health_fitbit', providerRecordId: `fitbit:${date}`, localDate: new Date(date), timezone: 'UTC', importedAt: now, rawTotalDailyExpenditure: 4000, adjustedDailyExpenditure: 3200, adjustmentFactor: 0.8, syncStatus: 'ready', isCurrentDay: false } });
    const bank = new PrismaBankHistoryRepository(db, { now: () => now });
    await bank.initializeOpeningBank(user, '2026-09-12', 'UTC');
    const initial = await db.bankAccountInitialization.findUniqueOrThrow({ where: { userId: user.id } });
    expect(Number(initial.openingEffectiveBalanceCalories)).toBe(8400);
    const selections = new PrismaProviderSelectionRepository(db, bank);
    expect((await selections.get(user.id)).intake).toMatchObject({ authoritativeProvider: 'health_connect', displayName: 'MacroFactor', status: 'ready', nativeIntakeSource: { id: 'com.sbs.diet' } });
    await db.dailyIntakeAggregate.updateMany({ where: { userId: user.id }, data: { totalCaloriesConsumed: 1000 } });
    await bank.initializeOpeningBank(user, '2026-09-12', 'UTC');
    expect((await db.bankAccountInitialization.findUniqueOrThrow({ where: { userId: user.id } })).openingEffectiveBalanceCalories).toBe(initial.openingEffectiveBalanceCalories);
  });
});
