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

function localDateOffset(localDate: string, offset: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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
  it('accepts the bounded eight-date setup session and rejects a ninth date', async () => {
    const app = appFor();
    const localDate = getLocalDateForTimezone(timezone);
    const datesQueried = Array.from({ length: 8 }, (_, offset) => localDateOffset(localDate, -offset));
    await request(app)
      .post('/v1/me/ingestion/sync-sessions')
      .send({
        localDate, timezone, provider: 'apple_health', trigger: 'provider_reconnect',
        datesQueried,
      })
      .expect(201)
      .expect(({ body }) => expect(body.datesQueried).toEqual(datesQueried));

    await request(app)
      .post('/v1/me/ingestion/sync-sessions')
      .send({
        localDate, timezone, provider: 'apple_health', trigger: 'provider_reconnect',
        datesQueried: [...datesQueried, localDateOffset(localDate, -8)],
      })
      .expect(400);
  });

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
      totalSteps: 2_300,
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
        items: [{ displayName: 'Outdoor Walk', totalEnergyBurned: 250, totalSteps: 2_300 }],
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
      showPlannedTreat: false,
      showSteps: false,
      showWorkouts: false,
      showCurrentGoal: false,
    });

    const updated = await request(app)
      .patch('/v1/me/dashboard-preferences')
      .send({ showSteps: true })
      .expect(200);
    expect(updated.body.showSteps).toBe(true);
    expect(updated.body.showWorkouts).toBe(false);
    await request(app)
      .patch('/v1/me/dashboard-preferences')
      .send({ availableBank: false })
      .expect(400);
    const persisted = await request(app).get('/v1/me/dashboard-preferences').expect(200);
    expect(persisted.body.showSteps).toBe(true);
    expect(persisted.body.stepsVisibilitySource).toBe('explicit');
  });

  it('infers the initial Steps visibility once from the selected provider and preserves manual override', async () => {
    const app = appFor();
    const today = getLocalDateForTimezone(timezone);
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        profile: { create: { timezone } },
        providerSelection: {
          create: { authoritativeActivityProvider: 'google_health_fitbit' },
        },
        dailyStepAggregates: {
          create: [12_000, 14_000, 11_000].map((totalSteps, index) => ({
            localDate: new Date(`${localDateOffset(today, -(index + 1))}T00:00:00.000Z`),
            timezone,
            provider: 'google_health_fitbit',
            providerRecordId: `fitbit-step-${index}`,
            totalSteps,
            importedAt: new Date(),
            providerUpdatedAt: new Date(),
            syncStatus: 'ready',
            isCurrentDay: false,
          })),
        },
      },
    });

    const inferred = await request(app).get('/v1/me/dashboard-preferences').expect(200);
    expect(inferred.body).toMatchObject({ showSteps: true, stepsVisibilitySource: 'inferred' });
    await request(app)
      .patch('/v1/me/dashboard-preferences')
      .send({ showSteps: false })
      .expect(200)
      .expect(({ body }) => expect(body.stepsVisibilitySource).toBe('explicit'));
    await prisma.dailyStepAggregate.create({
      data: {
        userId: user.id,
        localDate: new Date(`${localDateOffset(today, -4)}T00:00:00.000Z`),
        timezone,
        provider: 'google_health_fitbit',
        providerRecordId: 'fitbit-step-4',
        totalSteps: 20_000,
        importedAt: new Date(),
        providerUpdatedAt: new Date(),
        syncStatus: 'ready',
        isCurrentDay: false,
      },
    });
    const preserved = await request(app).get('/v1/me/dashboard-preferences').expect(200);
    expect(preserved.body).toMatchObject({ showSteps: false, stepsVisibilitySource: 'explicit' });

    await prisma.user.create({
      data: {
        id: otherUser.id,
        email: otherUser.email,
        profile: { create: { timezone } },
        providerSelection: {
          create: { authoritativeActivityProvider: 'google_health_fitbit' },
        },
        dailyStepAggregates: {
          create: [7_000, 8_000, 9_000].map((totalSteps, index) => ({
            localDate: new Date(`${localDateOffset(today, -(index + 1))}T00:00:00.000Z`),
            timezone,
            provider: 'google_health_fitbit',
            providerRecordId: `other-fitbit-step-${index}`,
            totalSteps,
            importedAt: new Date(),
            providerUpdatedAt: new Date(),
            syncStatus: 'ready',
            isCurrentDay: false,
          })),
        },
      },
    });
    const otherPreferences = await request(appFor(otherUser))
      .get('/v1/me/dashboard-preferences')
      .expect(200);
    expect(otherPreferences.body).toMatchObject({
      showSteps: false,
      stepsVisibilitySource: 'inferred',
    });
    await request(appFor(otherUser))
      .patch('/v1/me/dashboard-preferences')
      .send({ showSteps: true })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({
        showSteps: true,
        stepsVisibilitySource: 'explicit',
      }));
  });

  it('returns a provider-aware walking estimate without changing expenditure or ledger state', async () => {
    const app = appFor();
    const today = getLocalDateForTimezone(timezone);
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        profile: { create: { timezone } },
        providerSelection: {
          create: { authoritativeActivityProvider: 'google_health_fitbit' },
        },
        dailyStepAggregates: {
          create: {
            localDate: new Date(`${today}T00:00:00.000Z`),
            timezone,
            provider: 'google_health_fitbit',
            providerRecordId: 'fitbit-steps-today',
            totalSteps: 20_000,
            importedAt: new Date(),
            providerUpdatedAt: new Date(),
            syncStatus: 'ready',
            isCurrentDay: true,
          },
        },
        currentDayWorkouts: {
          create: [8_000, 10_000, 12_000].map((totalSteps, index) => ({
            localDate: new Date(`${localDateOffset(today, -(index + 1))}T00:00:00.000Z`),
            timezone,
            provider: 'google_health_fitbit',
            providerWorkoutId: `walk-${index}`,
            activityType: 'walking',
            displayName: 'Walk',
            startedAt: new Date(`${localDateOffset(today, -(index + 1))}T12:00:00.000Z`),
            endedAt: new Date(`${localDateOffset(today, -(index + 1))}T13:00:00.000Z`),
            durationMinutes: 60,
            totalEnergyBurned: totalSteps / 20,
            totalSteps,
            importedAt: new Date(),
            providerUpdatedAt: new Date(),
            syncStatus: 'ready',
            isCurrentDay: false,
          })),
        },
      },
    });

    const response = await request(app)
      .get(`/v1/me/today?timezone=${encodeURIComponent(timezone)}`)
      .expect(200);
    expect(response.body.steps).toMatchObject({
      count: 20_000,
      source: 'Fitbit',
      estimatedContributionCalories: 1_000,
      estimatedCaloriesPer1000Steps: 50,
      calibrationWorkoutCount: 3,
      calibrationTotalSteps: 30_000,
      calibrationTotalCalories: 1_500,
      estimationStatus: 'ready',
    });
    expect(response.body.burned).toMatchObject({ adjusted: null, raw: null });
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);

    await prisma.user.create({
      data: {
        id: otherUser.id,
        email: otherUser.email,
        profile: { create: { timezone } },
        providerSelection: {
          create: { authoritativeActivityProvider: 'google_health_fitbit' },
        },
        dailyStepAggregates: {
          create: {
            localDate: new Date(`${today}T00:00:00.000Z`), timezone,
            provider: 'google_health_fitbit', providerRecordId: 'other-steps-today',
            totalSteps: 10_000, importedAt: new Date(), providerUpdatedAt: new Date(),
            syncStatus: 'ready', isCurrentDay: true,
          },
        },
        currentDayWorkouts: {
          create: {
            localDate: new Date(`${localDateOffset(today, -1)}T00:00:00.000Z`), timezone,
            provider: 'google_health_fitbit', providerWorkoutId: 'other-run',
            activityType: 'running', displayName: 'Run',
            startedAt: new Date(`${localDateOffset(today, -1)}T12:00:00.000Z`),
            endedAt: new Date(`${localDateOffset(today, -1)}T13:00:00.000Z`),
            durationMinutes: 60, totalEnergyBurned: 160, totalSteps: 2_000,
            importedAt: new Date(), providerUpdatedAt: new Date(), syncStatus: 'ready',
            isCurrentDay: false,
          },
        },
      },
    });
    const otherResponse = await request(appFor(otherUser))
      .get(`/v1/me/today?timezone=${encodeURIComponent(timezone)}`)
      .expect(200);
    expect(otherResponse.body.steps).toMatchObject({
      estimatedContributionCalories: 800,
      calibrationWorkoutCount: 1,
      calibrationTotalSteps: 2_000,
      calibrationTotalCalories: 160,
    });
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
