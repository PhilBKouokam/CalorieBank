import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { prisma } from '../src/db/client';
import { env } from '../src/env';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';
import { CURRENT_DAY_STALE_AFTER_MS, currentDayFreshness } from '../src/modules/today/today.freshness';

const timezone = 'America/Chicago';
const user = {
  id: '00000000-0000-4000-8000-000000000880',
  email: 'activity-context@caloriebank.local',
};
const otherUser = {
  id: '00000000-0000-4000-8000-000000000881',
  email: 'activity-context-other@caloriebank.local',
};

function appFor(currentUser = user) {
  return createApp({
    ...env,
    DEV_USER_ID: currentUser.id,
    DEV_USER_EMAIL: currentUser.email,
    TODAY_INGESTION_MODE: 'device',
  });
}

async function startSession(app: ReturnType<typeof createApp>) {
  const response = await request(app)
    .post('/v1/me/ingestion/sync-sessions')
    .send({
      localDate: getLocalDateForTimezone(timezone),
      timezone,
      provider: 'apple_health',
      trigger: 'manual_refresh',
      appVersion: '1.0.0',
      providerAdapterVersion: 'apple-health-v1',
    })
    .expect(201);
  return response.body.id as string;
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
});

describe('activity context ingestion', () => {
  it('derives stale state from one centralized threshold', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    expect(
      currentDayFreshness(
        'ready',
        new Date(now.getTime() - CURRENT_DAY_STALE_AFTER_MS - 1),
        now,
      ),
    ).toBe('stale');
    expect(currentDayFreshness('ready', new Date(now.getTime() - 60_000), now)).toBe('ready');
  });
  it('replaces cumulative steps, suppresses stale snapshots, and never writes the ledger', async () => {
    const app = appFor();
    const localDate = getLocalDateForTimezone(timezone);
    const sessionId = await startSession(app);
    const firstAt = new Date();
    const secondAt = new Date(firstAt.getTime() + 60_000);
    const payload = {
      localDate,
      timezone,
      provider: 'apple_health',
      totalSteps: 7500,
      providerUpdatedAt: firstAt.toISOString(),
      sessionId,
      syncSessionId: sessionId,
    };

    await request(app).post('/v1/me/ingestion/steps').send(payload).expect(400);
    const validPayload = { ...payload };
    delete (validPayload as Partial<typeof validPayload>).sessionId;
    await request(app).post('/v1/me/ingestion/steps').send(validPayload).expect(200, {
      result: 'created',
    });
    await request(app)
      .post('/v1/me/ingestion/steps')
      .send({ ...validPayload, totalSteps: 8100, providerUpdatedAt: secondAt.toISOString() })
      .expect(200, { result: 'updated' });
    await request(app)
      .post('/v1/me/ingestion/steps')
      .send({ ...validPayload, totalSteps: 7600 })
      .expect(200, { result: 'ignored_stale' });

    const [step, ledgerCount] = await Promise.all([
      prisma.dailyStepAggregate.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.calorieLedgerTransaction.count({ where: { userId: user.id } }),
    ]);
    expect(step.totalSteps).toBe(8100);
    expect(ledgerCount).toBe(0);
  });

  it('upserts normalized workouts without adding their calories to expenditure or bank', async () => {
    const app = appFor();
    const localDate = getLocalDateForTimezone(timezone);
    const sessionId = await startSession(app);
    const updatedAt = new Date();
    const workout = {
      providerWorkoutId: 'healthkit-workout-1',
      activityType: 'walking',
      displayName: 'Outdoor Walk',
      startedAt: new Date(updatedAt.getTime() - 42 * 60_000).toISOString(),
      endedAt: updatedAt.toISOString(),
      durationMinutes: 42,
      totalEnergyBurned: 238,
      totalDistance: 3.5,
      distanceUnit: 'km',
    };
    const payload = {
      localDate,
      timezone,
      provider: 'apple_health',
      providerUpdatedAt: updatedAt.toISOString(),
      syncSessionId: sessionId,
      workouts: [workout],
    };

    await request(app).post('/v1/me/ingestion/workouts').send(payload).expect(200, {
      created: 1,
      updated: 0,
      skipped: 0,
      deleted: 0,
    });
    await request(app).post('/v1/me/ingestion/workouts').send(payload).expect(200, {
      created: 0,
      updated: 0,
      skipped: 1,
      deleted: 0,
    });
    const newerPayload = {
      ...payload,
      providerUpdatedAt: new Date(updatedAt.getTime() + 60_000).toISOString(),
      workouts: [{ ...workout, totalEnergyBurned: 250 }],
    };
    await request(app).post('/v1/me/ingestion/workouts').send(newerPayload).expect(200, {
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
    });
    await request(app)
      .post('/v1/me/ingestion/workouts')
      .send({ ...payload, workouts: [] })
      .expect(200, { created: 0, updated: 0, skipped: 0, deleted: 0 });
    await request(app).post('/v1/me/ingestion/workouts').send(payload).expect(200, {
      created: 0,
      updated: 0,
      skipped: 1,
      deleted: 0,
    });

    const [workoutCount, expenditureCount, ledgerCount, today] = await Promise.all([
      prisma.currentDayWorkout.count({ where: { userId: user.id } }),
      prisma.dailyExpenditureAggregate.count({ where: { userId: user.id } }),
      prisma.calorieLedgerTransaction.count({ where: { userId: user.id } }),
      request(app).get(`/v1/me/today?timezone=${encodeURIComponent(timezone)}`).expect(200),
    ]);
    expect(workoutCount).toBe(1);
    expect(expenditureCount).toBe(0);
    expect(ledgerCount).toBe(0);
    expect(today.body).toMatchObject({
      workouts: {
        totalCount: 1,
        items: [{ displayName: 'Outdoor Walk', totalEnergyBurned: 250 }],
      },
      burned: { adjusted: null, raw: null },
    });
  });

  it('validates malformed activity context and accepts an empty workout list', async () => {
    const app = appFor();
    const localDate = getLocalDateForTimezone(timezone);
    const sessionId = await startSession(app);
    const base = {
      localDate,
      timezone,
      provider: 'apple_health',
      providerUpdatedAt: new Date().toISOString(),
      syncSessionId: sessionId,
    };

    await request(app)
      .post('/v1/me/ingestion/steps')
      .send({ ...base, totalSteps: -1 })
      .expect(400);
    await request(app)
      .post('/v1/me/ingestion/workouts')
      .send({ ...base, workouts: [] })
      .expect(200, { created: 0, updated: 0, skipped: 0, deleted: 0 });
    await request(app)
      .post('/v1/me/ingestion/workouts')
      .send({
        ...base,
        workouts: [
          {
            providerWorkoutId: 'bad-time',
            activityType: 'walking',
            displayName: 'Walk',
            startedAt: '2026-07-21T12:30:00.000Z',
            endedAt: '2026-07-21T12:00:00.000Z',
            durationMinutes: -1,
            totalEnergyBurned: -1,
            totalDistance: null,
            distanceUnit: null,
          },
        ],
      })
      .expect(400);
  });

  it('persists fixed-order visibility preferences while keeping Available Bank mandatory', async () => {
    const app = appFor();
    const defaults = await request(app).get('/v1/me/dashboard-preferences').expect(200);
    expect(defaults.body).toMatchObject({
      showLatestFinalizedContribution: true,
      showTodaySoFar: true,
      showPlannedTreat: true,
      showSteps: true,
      showWorkouts: true,
      showCurrentGoal: true,
    });

    const updated = await request(app)
      .patch('/v1/me/dashboard-preferences')
      .send({ showSteps: false })
      .expect(200);
    expect(updated.body.showSteps).toBe(false);
    expect(updated.body.showWorkouts).toBe(true);
    await request(app)
      .patch('/v1/me/dashboard-preferences')
      .send({ availableBank: false })
      .expect(400);
    const persisted = await request(app).get('/v1/me/dashboard-preferences').expect(200);
    expect(persisted.body.showSteps).toBe(false);
  });

  it('records partial sync outcomes without raw payloads and enforces session ownership', async () => {
    const app = appFor();
    const sessionId = await startSession(app);
    await request(app)
      .patch(`/v1/me/ingestion/sync-sessions/${sessionId}`)
      .send({
        expenditureStatus: 'ready',
        intakeStatus: 'unavailable',
        stepsStatus: 'ready',
        workoutsStatus: 'error',
        recordsImported: 1,
        recordsUpdated: 1,
        recordsSkipped: 0,
        warningCount: 1,
        errorCode: 'health_category_sync_failed',
      })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('partially_completed'));

    const stored = await prisma.ingestionSyncSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(stored.errorCode).toBe('health_category_sync_failed');
    expect(stored).not.toHaveProperty('payload');

    const otherApp = appFor(otherUser);
    await request(otherApp)
      .post('/v1/me/ingestion/steps')
      .send({
        localDate: getLocalDateForTimezone(timezone),
        timezone,
        provider: 'apple_health',
        totalSteps: 100,
        providerUpdatedAt: new Date().toISOString(),
        syncSessionId: sessionId,
      })
      .expect(404);
  });
});
