import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { calculateBurnToStepPlan, normalizeDailyExpenditureAggregate } from '@caloriebank/domain';
import { todayResponseSchema } from '@caloriebank/schemas';
import express from 'express';
import request from 'supertest';
import { afterAll, expect, it, vi } from 'vitest';
import { parseApiEnv } from '../src/env';
import { GoogleHealthNetStepReader } from '../src/modules/google-health/google-health-net-step-reader';
import { readGoogleHealthOrdinaryHistory } from '../src/modules/google-health/google-health-ordinary-history';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { createTodayRouter } from '../src/modules/today/today.routes';

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const now = new Date('2026-10-30T12:00:00Z');
const date = '2026-10-30';
const localDate = new Date(`${date}T00:00:00Z`);
const provider = 'google_health_fitbit';
const workoutDates = ['2026-10-28', '2026-10-29'];
const midnight = (day: string) => new Date(`${day}T00:00:00Z`);
const interval = (start: number, duration: number) => ({
  startTime: new Date(start).toISOString(), endTime: new Date(start + duration).toISOString(),
});
const walk = (day: string) => interval(midnight(day).getTime() + 8 * 3_600_000, 3_600_000);
const record = (name: string, window: ReturnType<typeof interval>) => ({
  name, exercise: { exerciseType: 'WALKING', interval: window },
});

function syntheticGoogleFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe('https://health.googleapis.com');
    if (parsed.pathname.endsWith('dataPoints:reconcile')) {
      const selectedDay = workoutDates.find(day => parsed.searchParams.get('filter')?.includes(day));
      if (!selectedDay) throw new Error('Unexpected calibration window');
      const start = Date.parse(walk(selectedDay).startTime);
      const active = parsed.pathname.includes('active-energy-burned');
      return Response.json({ dataPoints: Array.from({ length: 60 }, (_, minute) => {
        const sample = interval(start + minute * 60000, 60000);
        return active ? { activeEnergyBurned: { interval: sample, kcal: 4 } } : { steps: { interval: sample, count: '100' } };
      }) });
    }
    if (parsed.pathname.endsWith('/exercise/dataPoints')) {
      expect(parsed.searchParams.get('filter')).toBe('exercise.interval.civil_start_time >= "2026-10-24" AND exercise.interval.civil_start_time < "2026-11-01"');
      expect(parsed.searchParams.get('pageSize')).toBe('25');
      return parsed.searchParams.has('pageToken') ? Response.json({ dataPoints: [
        record('cross-start', interval(Date.parse('2026-10-24T23:30:00Z'), 3_600_000)),
      ] }) : Response.json({
        dataPoints: [...workoutDates].reverse().map(day => record(day, walk(day))), nextPageToken: 'older',
      });
    }
    if (parsed.pathname.endsWith('dataPoints:rollUp')) {
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body.dataSourceFamily).toBe('users/me/dataSourceFamilies/all-sources');
      if (body.windowSize === '60s') {
        const start = Date.parse(body.range.startTime);
        return Response.json({ rollupDataPoints: Array.from({ length: 60 }, (_, minute) => ({
          ...interval(start + minute * 60000, 60000), totalCalories: { kcalSum: 29 / 6 },
        })) });
      }
      expect(body.windowSize).toBe('3600s');
      const start = Date.parse(body.range.startTime);
      expect(body.windowSize === '60s' || Date.parse(body.range.endTime) - start === 24 * 3_600_000).toBe(true);
      const energy = parsed.pathname.includes('total-calories');
      return Response.json({ rollupDataPoints: Array.from({ length: 24 }, (_, hour) => ({
        ...interval(start + hour * 3_600_000, 3_600_000),
        ...(energy
          ? { totalCalories: { kcalSum: hour === 0 ? 50 : start === Date.parse('2026-10-26T00:00:00Z') && hour === 1 ? 175 : 75 } }
          : { steps: { countSum: hour === 0 ? 0 : 20 } }),
      })) });
    }
    throw new Error('Unexpected synthetic request');
  });
}

it('carries paged recorded sessions and matched hours through the local Today route without altering observed burn', async () => {
  const user = { id: randomUUID(), email: `${randomUUID()}@caloriebank.local` };
  const key = Buffer.alloc(32, 8).toString('base64');
  const encrypted = encryptGoogleHealthSecret('synthetic', key);
  const config = parseApiEnv({
    NODE_ENV: 'test', APP_ENV: 'local', AUTH_MODE: 'clerk', CLERK_SECRET_KEY: 'sk_test_synthetic',
    CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
  });
  const fetcher = syntheticGoogleFetch();
  const reader = new GoogleHealthNetStepReader(db, config, fetcher, () => now, 'recorded_sessions_proxy');
  const repository = new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, now: () => now, stepCalibrationReader: reader });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  try {
    await db.user.create({ data: {
      ...user, profile: { create: { timezone: 'UTC' } },
      providerSelection: { create: { expenditureSelected: true, authoritativeExpenditureProvider: provider, authoritativeActivityProvider: provider } },
    } });
    await db.googleHealthConnection.create({ data: {
      userId: user.id, healthUserId: 'synthetic', encryptedAccessToken: encrypted, encryptedRefreshToken: encrypted,
      accessTokenExpiresAt: new Date('2026-10-30T13:00:00Z'), scopes: ['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'],
    } });
    for (const day of workoutDates) {
      const window = walk(day);
      await db.currentDayWorkout.create({ data: {
        userId: user.id, provider, providerWorkoutId: day, localDate: midnight(day), timezone: 'UTC',
        activityType: 'walking', displayName: 'Synthetic walk', startedAt: new Date(window.startTime), endedAt: new Date(window.endTime),
        durationMinutes: 60, totalSteps: 6000, totalEnergyBurned: 240, importedAt: now, isCurrentDay: false, syncStatus: 'ready',
      } });
    }
    const session = await db.ingestionSyncSession.create({ data: {
      userId: user.id, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: now, completedAt: now, status: 'completed',
    } });
    await repository.upsertExpenditureAggregate(user, normalizeDailyExpenditureAggregate({
      userId: user.id, provider, providerRecordId: 'synthetic', localDate: date, timezone: 'UTC',
      rawTotalDailyExpenditure: 1100, reportedIntervalEndAt: now, importedAt: now, providerUpdatedAt: now,
      isCurrentDay: true, syncStatus: 'ready', syncSessionId: session.id,
    }));
    const step = await db.dailyStepAggregate.create({ data: {
      userId: user.id, provider, localDate, timezone: 'UTC', providerRecordId: 'synthetic', totalSteps: 9000,
      importedAt: now, updatedAt: now, isCurrentDay: true, syncStatus: 'ready', syncSessionId: session.id,
    } });
    const capture = () => Promise.all([
      db.dailyExpenditureAggregate.findMany({ where: { userId: user.id } }),
      db.googleHealthConnection.findUnique({ where: { userId: user.id } }),
      db.providerSelection.findUnique({ where: { userId: user.id } }),
      db.calorieLedgerTransaction.findMany({ where: { userId: user.id } }),
      db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } }),
      db.bankAccountInitialization.findMany({ where: { userId: user.id } }),
    ]);
    const before = await capture();
    const route = (repo: PrismaTodayAggregateRepository) => express().use('/v1/me', createTodayRouter(repo, () => user));
    const read = async (app: ReturnType<typeof route>) => {
      const response = await request(app).get('/v1/me/today?timezone=UTC').expect(200);
      return todayResponseSchema.parse(response.body);
    };
    const app = route(repository);
    const result = await read(app);
    expect(result.burned).toMatchObject({ raw: 1100, adjusted: 880 });
    expect(result.restOfDayProjection.planningAnchorKind).toBe('reported_interval');
    expect(result.steps.ordinaryProjection).toMatchObject({
      basis: 'recorded_sessions_proxy', sessionCoverage: 'start_window_only', historySelection: 'low_activity_at_most_100_steps_per_hour', rawProjectedBurnBeforeWalking: 2000, stepsPerMinute: 100,
      includedHistoryHours: 117, missingHistoryHours: 0,
    });
    expect(result.steps.caloriesPerStep).toBe(0.04);
    const plan = (currentSteps: number, projection: NonNullable<typeof result.steps.ordinaryProjection>) =>
      calculateBurnToStepPlan({
        currentSteps, projectedProviderBurnAtRest: projection.rawProjectedBurnBeforeWalking,
        providerCaloriesPerStep: projection.rawIncrementalKcalPerStep, targetActualBurnCalories: 2000, adjustmentFactor: 0.8,
      });
    expect(plan(9000, result.steps.ordinaryProjection!)).toMatchObject({ totalDailyStepsNeeded: 23000, remainingSteps: 14000 });
    await db.dailyStepAggregate.update({ where: { id: step.id }, data: { totalSteps: 10000 } });
    const later = await read(app);
    expect(later.steps.ordinaryProjection).toEqual(result.steps.ordinaryProjection);
    expect(plan(10000, later.steps.ordinaryProjection!)).toMatchObject({ totalDailyStepsNeeded: 24000, remainingSteps: 14000 });
    expect(fetcher).toHaveBeenCalledTimes(18);
    expect(await capture()).toEqual(before);

    const grossMissing = syntheticGoogleFetch();
    const withoutGross = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      return body?.windowSize === '60s' ? Response.json({ rollupDataPoints: [] }) : grossMissing(url, init);
    }) as unknown as typeof fetch;
    const missingGrossReader = new GoogleHealthNetStepReader(db, config, withoutGross, () => now, 'recorded_sessions_proxy');
    const missingGross = await read(route(new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, now: () => now, stepCalibrationReader: missingGrossReader })));
    expect(missingGross.steps.ordinaryProjection).toBeUndefined();
    expect(missingGross.steps.caloriesPerStep).toBe(0.04);

    for (const [readerConfig, mode] of [[config, undefined], [{ ...config, APP_ENV: 'beta' }, undefined]] as const) {
      const legacyFetch = syntheticGoogleFetch();
      const legacyReader = new GoogleHealthNetStepReader(db, readerConfig, legacyFetch, () => now, mode);
      const legacy = await read(route(new PrismaTodayAggregateRepository(db, {
        allowSyntheticProviders: false, now: () => now, stepCalibrationReader: legacyReader,
      })));
      expect(legacy.steps.ordinaryProjection).toBeUndefined();
      expect(legacyFetch).toHaveBeenCalledTimes(4);
    }
  } finally {
    try { await db.user.deleteMany({ where: { id: user.id } }); }
    finally { vi.useRealTimers(); }
  }
});

it('withholds the proxy when the workout inventory exceeds the fixed page limit', async () => {
  let page = 0;
  const transport = vi.fn(async (path: string) => {
    expect(path).toContain('/exercise/dataPoints?');
    return { dataPoints: [], nextPageToken: `still-paging-${++page}` };
  });
  expect(await readGoogleHealthOrdinaryHistory({
    accountId: 'synthetic', sourceId: 'synthetic', localDate: date, timezone: 'UTC', now: () => now, request: transport,
  })).toBeNull();
  expect(transport).toHaveBeenCalledTimes(3);
});
