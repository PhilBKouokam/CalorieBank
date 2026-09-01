import {
  canProvideAuthoritativeExpenditure,
  getProviderCapabilities,
  resolveAuthoritativeProviderRecord,
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  type FetchDailyAggregateInput,
} from '@caloriebank/domain';
import { providerSelectionInputSchema } from '@caloriebank/schemas';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { env } from '../src/env';
import type { FinalizationScheduler } from '../src/modules/finalization-orchestration/finalization-orchestration.service';
import {
  GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
  GoogleHealthFitbitExpenditureProvider,
  GoogleHealthFitbitStepProvider,
  GoogleHealthFitbitWorkoutProvider,
} from '../src/modules/google-health/google-health.provider';
import {
  GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
  GoogleHealthFitbitService,
} from '../src/modules/google-health/google-health.service';
import {
  decryptGoogleHealthSecret,
  encryptGoogleHealthSecret,
} from '../src/modules/google-health/token-crypto';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const input: FetchDailyAggregateInput = {
  userId: 'user', localDate: '2026-08-14', timezone: 'America/Chicago', isCurrentDay: true,
};

function rollup(kcalSum: number) {
  return {
    rollupDataPoints: [{
      civilStartTime: { date: { year: 2026, month: 8, day: 14 } },
      civilEndTime: { date: { year: 2026, month: 8, day: 15 } },
      totalCalories: { kcalSum },
    }],
  };
}

describe('authoritative provider resolution', () => {
  const records = [
    { provider: 'apple_health', calories: 2100 },
    { provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, calories: 2600 },
  ];

  it('selects Google Health Fitbit data without summing provider totals', () => {
    const selected = resolveAuthoritativeProviderRecord(records, {
      authoritativeProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, allowFallback: false,
    });
    expect(selected).toEqual({ provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, calories: 2600 });
    expect(selected?.calories).not.toBe(4700);
  });

  it('uses Apple Health fallback only when policy explicitly allows it', () => {
    expect(resolveAuthoritativeProviderRecord(records.slice(0, 1), {
      authoritativeProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      fallbackProvider: 'apple_health', allowFallback: false,
    })).toBeNull();
    expect(resolveAuthoritativeProviderRecord(records.slice(0, 1), {
      authoritativeProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      fallbackProvider: 'apple_health', allowFallback: true,
    })?.provider).toBe('apple_health');
  });

  it('publishes only capabilities verified for each provider', () => {
    expect(getProviderCapabilities('google_health_fitbit')).toMatchObject({
      expenditure: true, intake: false, steps: true, workouts: true, workoutEnergy: true,
    });
    expect(getProviderCapabilities('apple_health')).toMatchObject({
      expenditure: true, expenditureCapability: 'derivable_total', intake: true, steps: true, workouts: true,
    });
    expect(getProviderCapabilities('garmin')).toMatchObject({
      expenditure: false, expenditureCapability: 'unavailable', steps: true, workouts: true,
    });
    expect(getProviderCapabilities('whoop')).toMatchObject({
      expenditure: false, expenditureCapability: 'unavailable', steps: false, workouts: true,
    });
    expect(getProviderCapabilities('fatsecret')).toMatchObject({
      expenditure: false, intake: true, steps: false, workouts: false,
    });
    expect(canProvideAuthoritativeExpenditure('google_health_fitbit')).toBe(true);
    expect(canProvideAuthoritativeExpenditure('apple_health')).toBe(true);
    expect(canProvideAuthoritativeExpenditure('garmin')).toBe(false);
    expect(canProvideAuthoritativeExpenditure('whoop')).toBe(false);
  });

  it('does not allow unqualified providers to be selected for expenditure', () => {
    expect(providerSelectionInputSchema.safeParse({
      authoritativeExpenditureProvider: 'garmin',
      authoritativeActivityProvider: 'garmin',
      authoritativeIntakeProvider: 'apple_health',
    }).success).toBe(false);
    expect(providerSelectionInputSchema.safeParse({
      authoritativeExpenditureProvider: 'whoop',
      authoritativeActivityProvider: 'whoop',
      authoritativeIntakeProvider: 'apple_health',
    }).success).toBe(false);
  });

  it('resolves one authoritative intake provider without summing Apple Health and FatSecret', () => {
    const records = [
      { provider: 'apple_health', calories: 1700 },
      { provider: 'fatsecret', calories: 1900 },
    ];
    expect(resolveAuthoritativeProviderRecord(records, {
      authoritativeProvider: 'fatsecret', allowFallback: false,
    })).toEqual({ provider: 'fatsecret', calories: 1900 });
    expect(resolveAuthoritativeProviderRecord(records, {
      authoritativeProvider: 'apple_health', allowFallback: false,
    })).toEqual({ provider: 'apple_health', calories: 1700 });
  });
});

describe('Google Health Fitbit activity adapters', () => {
  it('normalizes cumulative daily steps without combining another provider', async () => {
    const provider = new GoogleHealthFitbitStepProvider({
      fetchDailySteps: async () => ({
        rollupDataPoints: [{
          civilStartTime: { date: { year: 2026, month: 8, day: 14 } },
          steps: { countSum: '8123' },
        }],
      }),
    }, () => new Date('2026-08-14T18:00:00.000Z'));
    await expect(provider.fetchDailyStepAggregate(input)).resolves.toMatchObject({
      provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      totalSteps: 8123,
    });
  });

  it('normalizes exercise sessions and preserves optional context fields', async () => {
    const provider = new GoogleHealthFitbitWorkoutProvider({
      fetchDailyExercises: async () => ({
        dataPoints: [{
          name: 'users/me/dataTypes/exercise/dataPoints/session-1',
          exercise: {
            interval: {
              startTime: '2026-08-14T12:00:00.000Z',
              endTime: '2026-08-14T12:30:00.000Z',
            },
            exerciseType: 'RUNNING',
            displayName: 'Morning run',
            activeDuration: '1800s',
            metricsSummary: {
              caloriesKcal: 240.4,
              distanceMillimeters: '5000000',
              steps: '6200',
            },
            updateTime: '2026-08-14T12:35:00.000Z',
          },
        }],
      }),
    });
    const workouts = await provider.fetchDailyWorkouts(input);
    expect(workouts).toEqual([
      expect.objectContaining({
        provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
        providerWorkoutId: 'users/me/dataTypes/exercise/dataPoints/session-1',
        activityType: 'running',
        displayName: 'Morning run',
        durationMinutes: 30,
        totalEnergyBurned: 240,
        totalSteps: 6200,
        totalDistance: 5,
        distanceUnit: 'km',
      }),
    ]);
  });

  it('uses a neutral classification and does not fabricate optional workout values', async () => {
    const provider = new GoogleHealthFitbitWorkoutProvider({
      fetchDailyExercises: async () => ({ dataPoints: [{
        name: 'session-unknown',
        exercise: {
          interval: { startTime: '2026-08-14T12:00:00.000Z', endTime: '2026-08-14T12:20:00.000Z' },
          exerciseType: 'OTHER',
        },
      }] }),
    });
    await expect(provider.fetchDailyWorkouts(input)).resolves.toEqual([
      expect.objectContaining({
        activityType: 'other', totalEnergyBurned: null, totalSteps: null, totalDistance: null,
      }),
    ]);
  });
});

describe('Google Health Fitbit expenditure adapter', () => {
  it('normalizes Total Calories and applies the centralized adjustment exactly once', async () => {
    const provider = new GoogleHealthFitbitExpenditureProvider(
      { fetchDailyTotalCalories: async () => rollup(2500) },
      () => new Date('2026-08-14T18:00:00.000Z'),
    );
    const aggregate = await provider.fetchDailyExpenditureAggregate(input);
    expect(aggregate).toMatchObject({
      provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      rawTotalDailyExpenditure: 2500,
      adjustedDailyExpenditure: 2000,
      adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
    });
    expect(aggregate).not.toHaveProperty('activeEnergy');
    expect(aggregate).not.toHaveProperty('basalMetabolicRate');
    expect(aggregate).not.toHaveProperty('steps');
  });

  it('rounds Total Calories deterministically and does not add component fields', async () => {
    const provider = new GoogleHealthFitbitExpenditureProvider({
      fetchDailyTotalCalories: async () => ({
        ...rollup(2000.6), activeEnergy: 800, basalMetabolicRate: 1400,
      }),
    });
    const aggregate = await provider.fetchDailyExpenditureAggregate(input);
    expect(aggregate?.rawTotalDailyExpenditure).toBe(2001);
    expect(aggregate?.adjustedDailyExpenditure).toBe(1601);
    expect(JSON.stringify(aggregate)).not.toContain('basalMetabolicRate');
  });

  it('returns unavailable rather than zero when Total Calories is missing', async () => {
    const provider = new GoogleHealthFitbitExpenditureProvider({
      fetchDailyTotalCalories: async () => ({ rollupDataPoints: [] }),
    });
    await expect(provider.fetchDailyExpenditureAggregate(input)).resolves.toBeNull();
  });

  it('rejects negative Total Calories', async () => {
    const provider = new GoogleHealthFitbitExpenditureProvider({
      fetchDailyTotalCalories: async () => rollup(-1),
    });
    await expect(provider.fetchDailyExpenditureAggregate(input)).rejects.toThrow();
  });
});

describe('Google Health token encryption', () => {
  it('encrypts tokens at rest without retaining plaintext', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptGoogleHealthSecret('refresh-secret', key);
    expect(encrypted).not.toContain('refresh-secret');
    expect(decryptGoogleHealthSecret(encrypted, key)).toBe('refresh-secret');
  });
});

describe('Google Health burn parity diagnostic', () => {
  it('compares a fresh total-calories rollup with account-owned stored values without writes', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const otherUserId = randomUUID();
    const key = Buffer.alloc(32, 17).toString('base64');
    const localDate = new Date('2026-08-23T00:00:00.000Z');
    const now = new Date('2026-08-24T18:00:00.000Z');
    let requestedBody: unknown;
    let finalizationCalls = 0;
    try {
      await prisma.user.createMany({ data: [
        { id, email: `${id}@test.local` },
        { id: otherUserId, email: `${otherUserId}@test.local` },
      ] });
      await prisma.googleHealthConnection.create({ data: {
        userId: id,
        encryptedAccessToken: encryptGoogleHealthSecret('valid-access', key),
        encryptedRefreshToken: encryptGoogleHealthSecret('valid-refresh', key),
        accessTokenExpiresAt: new Date('2026-08-30T18:00:00.000Z'),
        scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
      } });
      await prisma.providerSelection.create({ data: {
        userId: id,
        authoritativeExpenditureProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
        authoritativeActivityProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      } });
      await prisma.dailyExpenditureAggregate.createMany({ data: [
        {
          userId: id, localDate, timezone: 'America/Chicago', provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          providerRecordId: `${GOOGLE_HEALTH_FITBIT_PROVIDER_ID}:expenditure:2026-08-23`,
          rawTotalDailyExpenditure: 3656, adjustedDailyExpenditure: 2925, adjustmentFactor: 0.8,
          importedAt: new Date('2026-08-24T09:39:48.000Z'), providerUpdatedAt: new Date('2026-08-24T09:39:48.000Z'),
          syncStatus: 'ready', isCurrentDay: false,
        },
        {
          userId: otherUserId, localDate, timezone: 'America/Chicago', provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          providerRecordId: `${GOOGLE_HEALTH_FITBIT_PROVIDER_ID}:expenditure:2026-08-23`,
          rawTotalDailyExpenditure: 9999, adjustedDailyExpenditure: 7999, adjustmentFactor: 0.8,
          importedAt: now, providerUpdatedAt: now, syncStatus: 'ready', isCurrentDay: false,
        },
      ] });
      const record = await prisma.finalizedDailyBankRecord.create({ data: {
        userId: id, logDate: localDate, timezone: 'America/Chicago', importedTotalDailyExpenditure: 3656,
        expenditureAdjustmentRate: 0.8, adjustedExpenditure: 2925, goalMode: 'maintain',
        goalAdjustmentCalories: 0, importedCalorieIntake: 1864, dailyAllowance: 2925,
        dailyBankChange: 1061, originalDailyBankChange: 1061, effectiveDailyBankChange: 1061,
        status: 'PROVISIONAL', lockAt: new Date('2026-08-26T05:00:00.000Z'), finalizedAt: new Date('2026-08-24T09:31:29.000Z'),
      } });
      await prisma.bankCalculationSnapshot.create({ data: {
        finalizedDailyBankRecordId: record.id, userId: id, version: 1, reason: 'INITIAL_POSTING',
        importedTotalDailyExpenditure: 3656, expenditureAdjustmentRate: 0.8, adjustedExpenditure: 2925,
        goalMode: 'maintain', goalAdjustmentCalories: 0, importedCalorieIntake: 1864,
        dailyAllowance: 2925, dailyBankChange: 1061, correctionDelta: 0,
        expenditureProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
        expenditureProviderRecordId: `${GOOGLE_HEALTH_FITBIT_PROVIDER_ID}:expenditure:2026-08-23`,
        intakeProvider: 'fatsecret', intakeProviderRecordId: 'fatsecret:intake:2026-08-23',
        inputFingerprint: randomUUID(),
      } });
      const fetcher: typeof fetch = async (request, init) => {
        expect(String(request)).toBe('https://health.googleapis.com/v4/users/me/dataTypes/total-calories/dataPoints:dailyRollUp');
        requestedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          rollupDataPoints: [{
            civilStartTime: { date: { year: 2026, month: 8, day: 23 } },
            civilEndTime: { date: { year: 2026, month: 8, day: 24 } },
            totalCalories: { kcalSum: 3655.93434 },
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      const service = new GoogleHealthFitbitService(
        prisma, {} as TodayAggregateRepository,
        {
          ...env, APP_ENV: 'local', GOOGLE_HEALTH_CLIENT_ID: 'client-id',
          GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
          GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
          GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
        },
        {
          execute: async () => {
            finalizationCalls += 1;
            throw new Error('Diagnostic must not invoke finalization.');
          },
        } as FinalizationScheduler,
        fetcher, () => now,
      );
      const aggregateBefore = await prisma.dailyExpenditureAggregate.findUniqueOrThrow({
        where: {
          userId_localDate_provider: {
            userId: id, localDate, provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          },
        },
      });
      const before = {
        ledger: await prisma.calorieLedgerTransaction.count({ where: { userId: id } }),
        snapshots: await prisma.bankCalculationSnapshot.count({ where: { userId: id } }),
        sessions: await prisma.ingestionSyncSession.count({ where: { userId: id } }),
      };
      const result = await service.inspectBurnParity(
        { id, email: `${id}@test.local` }, '2026-08-23', 'America/Chicago',
      );
      await service.inspectBurnParity(
        { id, email: `${id}@test.local` }, '2026-08-23', 'America/Chicago',
      );
      const lockedResult = await new GoogleHealthFitbitService(
        prisma, {} as TodayAggregateRepository,
        {
          ...env, APP_ENV: 'local', GOOGLE_HEALTH_CLIENT_ID: 'client-id',
          GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
          GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
          GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
        },
        {
          execute: async () => {
            finalizationCalls += 1;
            throw new Error('Diagnostic must not invoke finalization.');
          },
        } as FinalizationScheduler,
        fetcher, () => new Date('2026-08-27T18:00:00.000Z'),
      ).inspectBurnParity(
        { id, email: `${id}@test.local` }, '2026-08-23', 'America/Chicago',
      );

      expect(requestedBody).toEqual({
        range: {
          start: { date: { year: 2026, month: 8, day: 23 } },
          end: { date: { year: 2026, month: 8, day: 24 } },
        },
        windowSizeDays: 1,
        dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
      });
      expect(result).toMatchObject({
        liveApiKcal: 3655.93434,
        normalizedKcal: 3656,
        persistedAggregate: { rawKcal: 3656, adjustedKcal: 2925 },
        latestSnapshot: { rawKcal: 3656, adjustedKcal: 2925 },
        lifecycle: { status: 'provisional', locksAt: '2026-08-26T05:00:00.000Z' },
        parity: { apiToNormalized: true, normalizedToStored: true, storedToSnapshot: true },
      });
      expect(result.persistedAggregate?.rawKcal).not.toBe(9999);
      expect(lockedResult.lifecycle?.status).toBe('locked');
      expect(finalizationCalls).toBe(0);
      const aggregateAfter = await prisma.dailyExpenditureAggregate.findUniqueOrThrow({
        where: {
          userId_localDate_provider: {
            userId: id, localDate, provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          },
        },
      });
      expect(aggregateAfter).toEqual(aggregateBefore);
      await expect(prisma.calorieLedgerTransaction.count({ where: { userId: id } })).resolves.toBe(before.ledger);
      await expect(prisma.bankCalculationSnapshot.count({ where: { userId: id } })).resolves.toBe(before.snapshots);
      await expect(prisma.ingestionSyncSession.count({ where: { userId: id } })).resolves.toBe(before.sessions);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [id, otherUserId] } } });
      await prisma.$disconnect();
    }
  });

  it('reports missing live, stored, and snapshot values without fabricating zeroes', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 18).toString('base64');
    try {
      await prisma.user.create({ data: { id, email: `${id}@test.local` } });
      await prisma.googleHealthConnection.create({ data: {
        userId: id,
        encryptedAccessToken: encryptGoogleHealthSecret('valid-access', key),
        encryptedRefreshToken: encryptGoogleHealthSecret('valid-refresh', key),
        accessTokenExpiresAt: new Date('2026-08-25T18:00:00.000Z'),
        scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
      } });
      const service = new GoogleHealthFitbitService(
        prisma, {} as TodayAggregateRepository,
        {
          ...env, APP_ENV: 'local', GOOGLE_HEALTH_CLIENT_ID: 'client-id',
          GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
          GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
          GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
        },
        undefined,
        async () => new Response(JSON.stringify({ rollupDataPoints: [] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
        () => new Date('2026-08-24T18:00:00.000Z'),
      );
      await expect(service.inspectBurnParity(
        { id, email: `${id}@test.local` }, '2026-08-23', 'America/Chicago',
      )).resolves.toMatchObject({
        liveApiKcal: null, normalizedKcal: null, persistedAggregate: null,
        latestSnapshot: null, lifecycle: null,
        parity: { apiToNormalized: null, normalizedToStored: null, storedToSnapshot: null },
      });
    } finally {
      await prisma.user.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });
});

describe('Google OAuth state and token exchange', () => {
  it('accepts a single valid state, requests only the activity scope, and persists encrypted tokens', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 9).toString('base64');
    const service = new GoogleHealthFitbitService(
      prisma,
      {} as TodayAggregateRepository,
      {
        ...env,
        GOOGLE_HEALTH_CLIENT_ID: 'client-id',
        GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
        GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
        GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
      },
      undefined,
      async (request) => String(request).endsWith('/users/me/identity')
        ? new Response(JSON.stringify({
          healthUserId: 'health-user', legacyUserId: 'legacy-user',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({
          access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600,
          refresh_token_expires_in: 604800, scope: GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    try {
      const authorizationUrl = await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` }, 'caloriebank://integrations',
      );
      const url = new URL(authorizationUrl);
      const state = url.searchParams.get('state');
      expect(state).toBeTruthy();
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.searchParams.get('scope')).toBe(GOOGLE_HEALTH_ACTIVITY_READ_SCOPE);
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      await service.completeAuthorization('authorization-code', state!);
      const connection = await prisma.googleHealthConnection.findUniqueOrThrow({ where: { userId: id } });
      expect(connection.encryptedAccessToken).not.toContain('access-secret');
      expect(connection.encryptedRefreshToken).not.toContain('refresh-secret');
      expect(connection.refreshTokenExpiresAt).not.toBeNull();
      expect(connection).toMatchObject({ healthUserId: 'health-user', legacyUserId: 'legacy-user' });
      await expect(service.completeAuthorization('authorization-code', state!))
        .rejects.toThrow('invalid or expired');
    } finally {
      await prisma.user.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });

  it('retrieves three civil days independently and rotates a refresh token', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 11).toString('base64');
    const now = new Date('2026-08-14T18:00:00.000Z');
    const receivedDates: string[] = [];
    const exerciseDates: string[] = [];
    const receivedAggregates: Array<{ localDate: string; isCurrentDay: boolean; raw: number }> = [];
    let restingEstimate: { providerKcalPerHour: number; observationCount: number } | null = null;
    const repository = {
      upsertExpenditureAggregate: async (_user: unknown, aggregate: {
        localDate: string;
        isCurrentDay: boolean;
        rawTotalDailyExpenditure: number;
      }) => {
        receivedAggregates.push({
          localDate: aggregate.localDate,
          isCurrentDay: aggregate.isCurrentDay,
          raw: aggregate.rawTotalDailyExpenditure,
        });
        return 'updated' as const;
      },
      upsertStepAggregate: async () => 'unchanged' as const,
      upsertWorkouts: async () => [],
      deleteMissingWorkoutsForDay: async () => 0,
      upsertRestingBurnEstimate: async (_user: unknown, input: {
        providerKcalPerHour: number;
        observationCount: number;
      }) => {
        restingEstimate = input;
      },
    } as unknown as TodayAggregateRepository;
    const fetcher: typeof fetch = async (request, init) => {
      const url = String(request);
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({
          access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 3600,
          scope: GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/dataTypes/exercise/dataPoints')) {
        const localDate = new URL(url).searchParams.get('filter')
          ?.match(/civil_start_time >= "(\d{4}-\d{2}-\d{2})"/)?.[1];
        if (localDate) exerciseDates.push(localDate);
        const calibration = localDate === '2026-08-11'
          ? Array.from({ length: 5 }, (_, index) => ({
            name: `walk-${index}`,
            exercise: {
              interval: {
                startTime: `2026-08-11T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
                endTime: `2026-08-11T${String(10 + index).padStart(2, '0')}:30:00.000Z`,
              },
              exerciseType: index === 4 ? 'RUNNING' : 'WALKING',
              metricsSummary: { caloriesKcal: 100, steps: '2000' },
            },
          }))
          : [];
        return new Response(JSON.stringify({ dataPoints: calibration }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/dataPoints:rollUp')) {
        const body = JSON.parse(String(init?.body)) as {
          pageSize?: number;
          range: { startTime: string; endTime: string };
        };
        if (url.includes('/total-calories/')) expect(body.pageSize).toBeUndefined();
        const isCalories = url.includes('/total-calories/');
        return new Response(JSON.stringify({
          rollupDataPoints: [0, 1, 2].map((index) => ({
            startTime: `2026-08-10T0${index + 1}:00:00.000Z`,
            endTime: `2026-08-10T0${index + 2}:00:00.000Z`,
            ...(isCalories
              ? { totalCalories: { kcalSum: 70 + index * 2 } }
              : { steps: { countSum: String(index * 10) } }),
          })),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const body = JSON.parse(String(init?.body)) as {
        range: { start: { date: { year: number; month: number; day: number } } };
        dataSourceFamily: string;
      };
      const date = body.range.start.date;
      const localDate = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      const isExpenditure = url.includes('/total-calories/');
      if (isExpenditure) receivedDates.push(localDate);
      expect(body.dataSourceFamily).toBe('users/me/dataSourceFamilies/all-sources');
      return new Response(JSON.stringify({
        rollupDataPoints: [{
          civilStartTime: { date },
          civilEndTime: { date: { ...date, day: date.day + 1 } },
          ...(isExpenditure ? { totalCalories: { kcalSum: 2000 } } : { steps: { countSum: '5000' } }),
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      await prisma.user.create({ data: { id, email: `${id}@test.local` } });
      await prisma.googleHealthConnection.create({ data: {
        userId: id,
        encryptedAccessToken: encryptGoogleHealthSecret('expired-access', key),
        encryptedRefreshToken: encryptGoogleHealthSecret('old-refresh', key),
        accessTokenExpiresAt: new Date('2026-08-14T17:00:00.000Z'),
        scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
      } });
      await prisma.providerSelection.create({ data: {
        userId: id,
        authoritativeExpenditureProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
        authoritativeActivityProvider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      } });
      const service = new GoogleHealthFitbitService(
        prisma, repository,
        {
          ...env,
          GOOGLE_HEALTH_CLIENT_ID: 'client-id', GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
          GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
          GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
        },
        undefined, fetcher, () => now,
      );
      expect(await service.resolveRestingBurnEstimate(
        { id, email: `${id}@test.local` }, '2026-08-14', 'America/Chicago',
      )).toBe(true);
      expect(restingEstimate).toMatchObject({ providerKcalPerHour: 72, observationCount: 3 });
      await expect(prisma.ingestionSyncSession.count({ where: { userId: id } })).resolves.toBe(0);
      const result = await service.syncRollingWindow(
        { id, email: `${id}@test.local` }, '2026-08-14', 'America/Chicago', true,
      );
      expect(receivedDates).toEqual(['2026-08-14', '2026-08-13', '2026-08-12']);
      expect(exerciseDates).toEqual([
        '2026-07-31',
        '2026-07-31',
        '2026-08-14',
        '2026-08-13',
        '2026-08-12',
        '2026-08-11',
      ]);
      expect(receivedAggregates).toEqual([
        { localDate: '2026-08-14', isCurrentDay: true, raw: 2000 },
        { localDate: '2026-08-13', isCurrentDay: false, raw: 2000 },
        { localDate: '2026-08-12', isCurrentDay: false, raw: 2000 },
      ]);
      expect(result.datesUpdated).toEqual(receivedDates);
      expect(restingEstimate).toMatchObject({ providerKcalPerHour: 72, observationCount: 3 });
      const connection = await prisma.googleHealthConnection.findUniqueOrThrow({ where: { userId: id } });
      expect(decryptGoogleHealthSecret(connection.encryptedRefreshToken, key)).toBe('rotated-refresh');
    } finally {
      await prisma.user.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });

  it('marks the connection for reconnect when Google rejects API access', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 13).toString('base64');
    const now = new Date('2026-08-14T18:00:00.000Z');
    try {
      await prisma.user.create({ data: { id, email: `${id}@test.local` } });
      await prisma.googleHealthConnection.create({ data: {
        userId: id,
        encryptedAccessToken: encryptGoogleHealthSecret('valid-access', key),
        encryptedRefreshToken: encryptGoogleHealthSecret('refresh', key),
        accessTokenExpiresAt: new Date('2026-08-14T20:00:00.000Z'),
        scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
      } });
      const service = new GoogleHealthFitbitService(
        prisma, {} as TodayAggregateRepository,
        {
          ...env,
          GOOGLE_HEALTH_CLIENT_ID: 'client-id', GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
          GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
          GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
        },
        undefined, async () => new Response(null, { status: 401 }), () => now,
      );
      await expect(service.syncRollingWindow(
        { id, email: `${id}@test.local` }, '2026-08-14', 'America/Chicago', true,
      )).rejects.toThrow('reconnected');
      const connection = await prisma.googleHealthConnection.findUniqueOrThrow({ where: { userId: id } });
      expect(connection).toMatchObject({ status: 'needs_reconnect', lastErrorCode: 'access_revoked' });
    } finally {
      await prisma.user.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });
});
