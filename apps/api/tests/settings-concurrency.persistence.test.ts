import express from 'express';
import request from 'supertest';
import { createGoalConfigurationRouter } from '../src/modules/goal-configuration/goal-configuration.routes';
import { createDailyBankTargetRouter } from '../src/modules/daily-bank-target/daily-bank-target.routes';
import { createPlannedTreatRouter } from '../src/modules/planned-treat/planned-treat.routes';
import { errorHandler } from '../src/errors';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { PrismaGoalConfigurationRepository } from '../src/modules/goal-configuration/goal-configuration.repository';
import { DailyBankTargetRepository } from '../src/modules/daily-bank-target/daily-bank-target.repository';
import { PrismaPlannedTreatRepository } from '../src/modules/planned-treat/planned-treat.repository';
import type { SettingsOptions } from '../src/modules/settings-concurrency/settings-concurrency';

const db = new PrismaClient();
const users: string[] = [];
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); });
async function fixture(kind: string) {
  const user = { id: randomUUID(), email: `${randomUUID()}@settings-test.local` }; users.push(user.id);
  await db.user.create({ data: { ...user, profile: { create: {} } } });
  const goal = new PrismaGoalConfigurationRepository(db), target = new DailyBankTargetRepository(db), treat = new PrismaPlannedTreatRepository(db);
  return { user,
    get: (options?: SettingsOptions) => kind === 'fitness-goal' ? goal.findByUserId(user.id, options) : kind === 'daily-bank-target' ? target.get(user.id, options) : treat.getForUser(user.id, options),
    write: (value: number, options?: SettingsOptions) => kind === 'fitness-goal'
      ? goal.upsertForUser(user, { goalMode: 'bulk', dailyEnergyAdjustment: value, adjustmentSource: 'manual_calories' }, options)
      : kind === 'daily-bank-target' ? target.update(user.id, value, options)
      : treat.createOrReplaceForUser(user, { name: 'Synthetic goal', requiredCalories: value }, options),
    remove: (options?: SettingsOptions) => treat.deleteForUser(user.id, options),
    patch: (value: number, options?: SettingsOptions) => treat.updateForUser(user.id, { name: 'Updated', requiredCalories: value }, options),
  };
}
async function revision(f: Awaited<ReturnType<typeof fixture>>) { let revision = ''; await f.get({ onRevision: v => { revision = v; } }); return revision; }
for (const kind of ['fitness-goal', 'daily-bank-target', 'banking-goal']) {
  it(`${kind}: concurrent new/new creation has one winner, stale update cannot change the winner`, async () => {
    const f = await fixture(kind);
    expect(await revision(f)).toBe('0');
    const results = await Promise.allSettled([f.write(500, { expectedRevision: '0' }), f.write(600, { expectedRevision: '0' })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await revision(f)).toBe('1');
    const saved = await f.get();
    await expect(f.write(700, { expectedRevision: '0' })).rejects.toMatchObject({ statusCode: 409, details: { code: 'SETTINGS_CONFLICT' } });
    expect(await f.get()).toEqual(saved);
    await f.write(800, { expectedRevision: '1' }); expect(await revision(f)).toBe('2');
  });
  it(`${kind}: legacy/new rejects stale new writes; new/legacy preserves documented unconditional behavior`, async () => {
    const f = await fixture(kind);
    await f.write(500); expect(await revision(f)).toBe('1');
    await expect(f.write(600, { expectedRevision: '0' })).rejects.toMatchObject({ statusCode: 409 });
    await f.write(700, { expectedRevision: '1' });
    await f.write(800); expect(await revision(f)).toBe('3');
    await expect(f.write(900, { expectedRevision: '2' })).rejects.toMatchObject({ statusCode: 409 });
  });
  it(`${kind}: concurrent mixed writes advance once for every committed write`, async () => {
    const f = await fixture(kind);
    const results = await Promise.allSettled([f.write(500), f.write(600, { expectedRevision: '0' })]);
    const committed = results.filter(r => r.status === 'fulfilled').length;
    expect(await revision(f)).toBe(String(committed));
    expect(results[0]!.status).toBe('fulfilled');
  });
  it(`${kind}: account isolation and no accounting records created`, async () => {
    const a = await fixture(kind), b = await fixture(kind);
    await a.write(500); expect(await revision(b)).toBe('0');
    await b.write(600, { expectedRevision: '0' }); expect(await revision(a)).toBe('1');
    for (const id of [a.user.id, b.user.id]) {
      expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
      expect(await db.bankAccountInitialization.count({ where: { userId: id } })).toBe(0);
      expect(await db.finalizedDailyBankRecord.count({ where: { userId: id } })).toBe(0);
    }
  });
}
it('Banking Goal: update/delete races, tombstone and recreate never reuse a revision', async () => {
  const f = await fixture('banking-goal'); await f.write(500, { expectedRevision: '0' });
  const results = await Promise.allSettled([f.patch(600, { expectedRevision: '1' }), f.remove({ expectedRevision: '1' })]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await revision(f)).toBe('2');
  await f.remove(); expect(await revision(f)).toBe('3');
  await expect(f.write(700, { expectedRevision: '0' })).rejects.toMatchObject({ statusCode: 409 });
  await f.write(700, { expectedRevision: '3' }); expect(await revision(f)).toBe('4');
  await expect(f.remove({ expectedRevision: '2' })).rejects.toMatchObject({ statusCode: 409 });
  expect(await revision(f)).toBe('4');
});
it('failed mutation rolls back revision and account deletion cascades revision metadata', async () => {
  const f = await fixture('banking-goal');
  await expect(f.patch(500, { expectedRevision: '0' })).rejects.toMatchObject({ statusCode: 404 });
  expect(await revision(f)).toBe('0');
  await f.write(500); await db.user.delete({ where: { id: f.user.id } });
  expect(await db.settingsRevision.count({ where: { userId: f.user.id } })).toBe(0);
});

it('real routes preserve legacy bodies and enforce protected revisions, including delete', async () => {
  const f = await fixture('banking-goal'); const app = express(); app.use(express.json());
  app.use('/goal', createGoalConfigurationRouter(new PrismaGoalConfigurationRepository(db), f.user));
  app.use('/target', createDailyBankTargetRouter(new DailyBankTargetRepository(db), f.user));
  app.use('/treat', createPlannedTreatRouter(new PrismaPlannedTreatRepository(db), f.user)); app.use(errorHandler);
  const cap = { 'X-CB-Settings-Concurrency': '1' };
  const absent = await request(app).get('/goal').set(cap).expect(404);
  expect(absent.headers['x-cb-settings-revision']).toBe('0');
  await request(app).put('/goal').set(cap).expect(400);
  const goal = { goalMode: 'bulk', dailyEnergyAdjustment: 500, adjustmentSource: 'manual_calories' };
  await request(app).put('/goal').set(cap).send(goal).expect(428);
  await request(app).put('/goal').set(cap).set('If-Match', '"0"').send(goal).expect(200);
  await request(app).put('/goal').set(cap).set('If-Match', '"0"').send(goal).expect(409);
  const legacy = await request(app).put('/target').send({ calories: 100 }).expect(200);
  expect(legacy.body).toEqual({ calories: 100, chosen: true });
  const target = await request(app).get('/target').set(cap).expect(200);
  expect(target.body).toEqual(legacy.body); expect(target.headers['x-cb-settings-revision']).toBe('1');
  await request(app).put('/target').set(cap).set('If-Match', '"0"').send({ calories: 200 }).expect(409);
  await request(app).post('/treat').set(cap).set('If-Match', '"0"').send({ name: 'Synthetic', requiredCalories: 500 }).expect(201);
  await request(app).patch('/treat').send({ name: 'Legacy update', requiredCalories: 600 }).expect(200);
  await request(app).delete('/treat').set(cap).set('If-Match', '"1"').expect(409);
  await request(app).delete('/treat').set(cap).set('If-Match', '"2"').expect(204);
  const deleted = await request(app).get('/treat').set(cap).expect(200);
  expect(deleted.body.status).toBe('no_plan'); expect(deleted.headers['x-cb-settings-revision']).toBe('3');
});
