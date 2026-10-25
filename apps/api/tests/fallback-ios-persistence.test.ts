import { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createIosFixtureGuard, createIosFixturePayloadGuard, createIosFixtureStore } from '../../../tools/qualification/fallback-ios-guard';
import { blockedFallbackTestRoute } from '../../../tools/qualification/fallback-test-policy';
import { currentUser } from '../src/auth/current-user';
import { errorHandler } from '../src/errors';
import { createSyncSessionRouter } from '../src/modules/today/sync-session.routes';
import { PrismaSyncSessionRepository } from '../src/modules/today/sync-session.repository';
import { createTodayIngestionRouter } from '../src/modules/today/today-ingestion.routes';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { iosComplete, iosFixture, iosIntake, iosNow, iosStart } from './support/ios-qualification-fixture';

const db = new PrismaClient();
const users: string[] = [];
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); });

async function fixture() {
  const user = { id: randomUUID(), email: `${randomUUID()}@ios-fixture.test.local` };
  users.push(user.id);
  await db.user.create({ data: { ...user, profile: { create: {} }, providerSelection: { create: {
    intakeSelected: true, authoritativeIntakeProvider: 'apple_health',
    appleHealthIntakeWriterBundleId: iosFixture.writer, appleHealthIntakeWriterDisplayName: iosFixture.writerName,
    updatedAt: new Date(iosFixture.startedAt - 1000),
  } } } });
  await db.bankAccountInitialization.create({ data: { userId: user.id, status: 'INITIALIZED',
    openingEffectiveBalanceCalories: 700, historicalOpeningNetCalories: 700, eligibleDayCount: 1,
    initializedAt: new Date(iosNow - 86400000), accountingStartsOn: new Date('2026-10-24'), timezone: iosFixture.timezone } });
  const record = await db.finalizedDailyBankRecord.create({ data: { userId: user.id, logDate: new Date('2026-10-24'),
    timezone: iosFixture.timezone, importedTotalDailyExpenditure: 3000, expenditureAdjustmentRate: 0.8,
    adjustedExpenditure: 2400, goalMode: 'maintain', goalAdjustmentCalories: 0, importedCalorieIntake: 2300,
    dailyAllowance: 2400, dailyBankChange: 100, originalDailyBankChange: 100, effectiveDailyBankChange: 100,
    lockAt: new Date(iosNow), finalizedAt: new Date(iosNow - 10000) } });
  await db.calorieLedgerTransaction.create({ data: { userId: user.id, logDate: new Date('2026-10-24'),
    type: 'daily_finalization', amountCalories: 100, sourceType: 'finalized_daily_bank_record', sourceId: record.id,
    idempotencyKey: 'synthetic-finalized-day', description: 'Synthetic baseline' } });
  let time = iosNow;
  const app = express();
  app.use((req, res, next) => blockedFallbackTestRoute(req, null, iosFixture) ? void res.sendStatus(403) : next());
  app.use(createIosFixturePayloadGuard(iosFixture, () => time));
  // Deterministic verified-owner stand-in only: this does NOT qualify real Clerk.
  app.use((_req, res, next) => { res.locals.currentUser = user; next(); });
  app.use(createIosFixtureGuard(iosFixture, createIosFixtureStore(db), () => time));
  app.use(express.json());
  app.use('/v1/me/ingestion/sync-sessions', createSyncSessionRouter(new PrismaSyncSessionRepository(db), currentUser, undefined, () => new Date(time)));
  app.use('/v1/me/ingestion', createTodayIngestionRouter(new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false }), currentUser, () => new Date(time)));
  app.use(errorHandler);
  const start = async () => {
    const result = await request(app).post('/v1/me/ingestion/sync-sessions').send(iosStart()).expect(201);
    return result.body.id as string;
  };
  const accounting = async () => JSON.stringify(await Promise.all([
    db.bankAccountInitialization.findUnique({ where: { userId: user.id } }),
    db.finalizedDailyBankRecord.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }),
    db.calorieLedgerTransaction.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }),
    db.openingBankCalculationDay.findMany({ where: { userId: user.id } }),
  ]));
  return { app, user, start, accounting, setTime: (value: number) => { time = value; } };
}

describe('isolated iOS admission with real PostgreSQL and ordinary API repositories', () => {
  it('starts, stores one exact current-day intake and honestly completes without changing saved accounting', async () => {
    const f = await fixture(), before = await f.accounting(), id = await f.start();
    await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(200);
    await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(200);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: f.user.id, syncSessionId: id, totalCaloriesConsumed: 123 } })).toBe(1);
    expect(await f.accounting()).toBe(before);
    expect(await db.dailyExpenditureAggregate.count({ where: { userId: f.user.id } })).toBe(0);
    expect(await db.dailyStepAggregate.count({ where: { userId: f.user.id } })).toBe(0);
    expect(await db.currentDayWorkout.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('rejects another owner’s session for upload and completion without altering either account', async () => {
    const a = await fixture(), b = await fixture(), id = await a.start();
    const before = await a.accounting(), otherBefore = await b.accounting();
    await request(b.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(403);
    await request(b.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(403);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: { in: [a.user.id, b.user.id] } } })).toBe(0);
    expect(await a.accounting()).toBe(before); expect(await b.accounting()).toBe(otherBefore);
  });
  it('requires persisted same-session evidence before completion, and freezes a closed session', async () => {
    const f = await fixture(), id = await f.start();
    await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(403);
    await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(200);
    await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(200);
    const saved = await db.ingestionSyncSession.findUnique({ where: { id } });
    await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(403);
    await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(403);
    expect(await db.ingestionSyncSession.findUnique({ where: { id } })).toEqual(saved);
  });
  it('permits repeated/concurrent identical uploads without duplicate intake or accounting', async () => {
    const f = await fixture(), before = await f.accounting(), id = await f.start();
    await Promise.all(Array.from({ length: 4 }, () => request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(200)));
    expect(await db.dailyIntakeAggregate.count({ where: { userId: f.user.id } })).toBe(1);
    expect(await f.accounting()).toBe(before);
  });
  it('rejects a session from before the fixture window, an expired session and a changed selection revision', async () => {
    const f = await fixture(), id = await f.start();
    for (const startedAt of [new Date(iosFixture.startedAt - 1), new Date(iosNow - 300001), new Date(iosNow + 1)]) {
      await db.ingestionSyncSession.update({ where: { id }, data: { startedAt } });
      await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(403);
    }
    await db.ingestionSyncSession.update({ where: { id }, data: { startedAt: new Date(iosNow) } });
    await db.providerSelection.update({ where: { userId: f.user.id }, data: { updatedAt: new Date(iosNow + 1) } });
    await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(403);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('denies manual authority, wrong writer/name and unselected intake before session creation', async () => {
    const f = await fixture();
    for (const change of [{ authoritativeIntakeProvider: 'manual' }, { appleHealthIntakeWriterBundleId: 'org.other' },
      { appleHealthIntakeWriterDisplayName: 'Other' }, { intakeSelected: false }]) {
      await db.providerSelection.update({ where: { userId: f.user.id }, data: {
        authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriterBundleId: iosFixture.writer,
        appleHealthIntakeWriterDisplayName: iosFixture.writerName, intakeSelected: true, ...change,
      } });
      await request(f.app).post('/v1/me/ingestion/sync-sessions').send(iosStart()).expect(403);
    }
    expect(await db.ingestionSyncSession.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('denies malformed, oversized, historical and unbounded payloads without exposing rejected content', async () => {
    const f = await fixture(), id = await f.start();
    for (const payload of [JSON.stringify({ ...iosIntake(id), localDate: '2026-10-24' }),
      '{"secret-canary":', JSON.stringify({ ...iosIntake(id), note: 'private-canary'.repeat(4000) })]) {
      const result = await request(f.app).post('/v1/me/ingestion/intake').set('Content-Type', 'application/json').send(payload).expect(403);
      expect(result.text).not.toMatch(/canary|2026-10-24|SyntaxError|PayloadTooLarge/);
    }
    expect(await db.dailyIntakeAggregate.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('does not accept the unchanged client’s empty workout upload or false all-category readiness', async () => {
    const f = await fixture(), id = await f.start(), before = await f.accounting();
    await request(f.app).post('/v1/me/ingestion/workouts').send({ localDate: iosFixture.localDate, workouts: [], syncSessionId: id }).expect(403);
    await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send({ ...iosComplete(), workoutsStatus: 'ready' }).expect(403);
    expect(await f.accounting()).toBe(before);
  });
  it('rejects expiry and midnight before writing or completing', async () => {
    const f = await fixture(), id = await f.start();
    for (const time of [iosFixture.expiresAt, Date.parse('2026-10-26T05:00:00Z')]) {
      f.setTime(time);
      await request(f.app).post('/v1/me/ingestion/intake').send(iosIntake(id)).expect(403);
      await request(f.app).patch(`/v1/me/ingestion/sync-sessions/${id}`).send(iosComplete()).expect(403);
    }
    expect(await db.dailyIntakeAggregate.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('fails closed on missing authentication context or database faults without returning raw errors', async () => {
    const f = await fixture();
    const app = express(); app.use(express.json());
    app.use(createIosFixtureGuard(iosFixture, createIosFixtureStore(db), () => iosNow));
    const absent = await request(app).post('/v1/me/ingestion/sync-sessions').send(iosStart()).expect(403);
    expect(absent.text).not.toContain('Authentication');
    const failing = express(); failing.use(express.json());
    failing.use((_req, res, next) => { res.locals.currentUser = f.user; next(); });
    failing.use(createIosFixtureGuard(iosFixture, { ...createIosFixtureStore(db), selection: async () => { throw new Error('secret-canary'); } }, () => iosNow));
    const failed = await request(failing).post('/v1/me/ingestion/sync-sessions').send(iosStart()).expect(403);
    expect(failed.text).not.toContain('canary');
  });
});
