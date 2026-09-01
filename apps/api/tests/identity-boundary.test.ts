import type { TodayResponse } from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createAuthenticationBoundary, type AuthenticationBoundary } from '../src/auth/current-user';
import { createApp } from '../src/app';
import { env, parseApiEnv } from '../src/env';
import { AppError } from '../src/errors';
import type { BankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import type {
  DevelopmentUser,
  GoalConfigurationRepository,
} from '../src/modules/goal-configuration/goal-configuration.repository';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const users: Record<string, DevelopmentUser> = {
  'token-a': { id: '10000000-0000-4000-8000-000000000001', email: 'a@test.local' },
  'token-b': { id: '20000000-0000-4000-8000-000000000002', email: 'b@test.local' },
};

function testAuthentication(): AuthenticationBoundary {
  return {
    verify: (_request, _response, next) => next(),
    requireUser: (request, response, next) => {
      const token = request.header('authorization')?.replace(/^Bearer /, '');
      const user = token ? users[token] : undefined;
      if (!user) return next(new AppError('Authentication is required.', 401));
      response.locals.currentUser = user;
      next();
    },
  };
}

class IsolatedGoals implements GoalConfigurationRepository {
  private readonly values = new Map<string, Awaited<ReturnType<GoalConfigurationRepository['upsertForUser']>>>();
  async findByUserId(userId: string) { return this.values.get(userId) ?? null; }
  async upsertForUser(user: DevelopmentUser, input: Parameters<GoalConfigurationRepository['upsertForUser']>[1]) {
    const value = { userId: user.id, ...input, desiredWeeklyWeightChange: input.desiredWeeklyWeightChange ?? null, updatedAt: new Date().toISOString() };
    this.values.set(user.id, value);
    return value;
  }
}

function emptyToday(date: string, timezone: string): TodayResponse {
  return {
    date, timezone, isCurrentDay: true, dataFreshness: 'not_connected',
    burned: { adjusted: null, raw: null, adjustmentFactor: 0.8, source: null, lastSyncedAt: null, status: 'not_connected' },
    eaten: { calories: null, source: null, lastSyncedAt: null, status: 'not_connected' },
    steps: {
      count: null, source: null, lastSyncedAt: null, status: 'not_connected',
      estimatedContributionCalories: null,
      estimatedCaloriesPer1000Steps: null,
      caloriesPerStep: null,
      calibrationWorkoutCount: 0,
      calibrationTotalSteps: 0,
      calibrationTotalCalories: 0,
      estimationStatus: 'unavailable',
      providerReportedCaloriesPer1000Steps: null,
      adjustedCaloriesPer1000Steps: null,
      adjustedCaloriesPerStep: null,
      currentAdjustedContributionCalories: null,
      nonStepAdjustedBurnBaselineCalories: null,
    },
    restOfDayProjection: {
      status: 'insufficient_data', providerKcalPerHour: null, adjustedKcalPerHour: null,
      remainingMinutes: 0, projectedProviderBurnCalories: null,
      projectedAdjustedBurnCalories: null, source: null, evidenceType: null,
      observationCount: 0, calculatedAt: null,
    },
    workouts: { items: [], totalCount: 0, source: null, lastSyncedAt: null, status: 'not_connected' },
  };
}

describe('beta identity and ownership boundary', () => {
  it('fails closed when a beta or production environment attempts to use DEV_USER_ID', () => {
    expect(() => parseApiEnv({ APP_ENV: 'beta', AUTH_MODE: 'development', CORS_ORIGIN: 'https://app.example.test' })).toThrow(
      'Beta and production environments require Clerk authentication',
    );
    expect(() => parseApiEnv({
      APP_ENV: 'beta', AUTH_MODE: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      CLERK_SECRET_KEY: 'sk_test_x', CORS_ORIGIN: '*',
    })).toThrow('Beta and production environments require an explicit CORS origin');
  });

  it('fails closed when hosted provider configuration is missing or cryptographically invalid', () => {
    const hosted = {
      APP_ENV: 'beta', AUTH_MODE: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      CLERK_SECRET_KEY: 'sk_test_x', CORS_ORIGIN: 'https://beta.caloriebank.test',
    };
    expect(() => parseApiEnv(hosted)).toThrow('GOOGLE_HEALTH_CLIENT_ID is required');
    expect(() => parseApiEnv({
      ...hosted,
      GOOGLE_HEALTH_CLIENT_ID: 'client', GOOGLE_HEALTH_CLIENT_SECRET: 'secret',
      GOOGLE_HEALTH_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
      GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: 'not-a-32-byte-key',
      EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
      FATSECRET_CONSUMER_KEY: 'consumer', FATSECRET_CONSUMER_SECRET: 'secret',
      FATSECRET_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fatsecret/callback',
    })).toThrow('GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  });

  it('keeps readiness public while protected account routes still require authentication', async () => {
    const hostedConfig = {
      ...env, APP_ENV: 'beta' as const, AUTH_MODE: 'clerk' as const,
      CLERK_PUBLISHABLE_KEY: 'pk_test_x', CLERK_SECRET_KEY: 'sk_test_x',
    };
    const app = createApp(hostedConfig, {
      authenticationBoundary: createAuthenticationBoundary(
        hostedConfig,
        {} as PrismaClient,
        async () => null,
      ),
      bankHistoryRepository: {} as BankHistoryRepository,
      todayRepository: {} as TodayAggregateRepository,
    });
    await request(app).get('/health').expect(200);
    await request(app).get('/health/ready').expect(200);
    await request(app).get('/v1/me/today').expect(401);
  });

  it('rejects missing and invalid credentials', async () => {
    const app = createApp(
      { ...env, APP_ENV: 'beta', AUTH_MODE: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_x', CLERK_SECRET_KEY: 'sk_test_x' },
      { authenticationBoundary: testAuthentication() },
    );
    await request(app).get('/v1/me/today').expect(401);
    await request(app).get('/v1/me/today').set('Authorization', 'Bearer invalid').expect(401);
  });

  it('isolates goal, Today, bank/history, and Apple Health ingestion by authenticated user', async () => {
    const goals = new IsolatedGoals();
    const todayReads: string[] = [];
    const intakeWrites: string[] = [];
    const bankReads: string[] = [];
    const todayRepository = {
      getTodayForUser: async (userId: string, date: string, timezone: string) => {
        todayReads.push(userId);
        return emptyToday(date, timezone);
      },
      assertSyncSessionOwnedBy: async (_sessionId: string, userId: string) => {
        if (!Object.values(users).some((user) => user.id === userId)) throw new Error('wrong owner');
      },
      upsertIntakeAggregate: async (user: DevelopmentUser) => {
        intakeWrites.push(user.id);
        return 'created' as const;
      },
    } as unknown as TodayAggregateRepository;
    const bankRepository = {
      getSummary: async (userId: string) => {
        bankReads.push(userId);
        return { availableBankCalories: userId === users['token-a']!.id ? 100 : 200 };
      },
      getHistory: async (userId: string) => {
        bankReads.push(userId);
        return { range: 'W', finalizedDays: [] };
      },
      getDayDetail: async () => null,
      reconcileStoredDay: async () => ({ outcome: 'not_ready' as const, detail: null }),
      postProvisionalDailyRecord: async () => { throw new Error('not used'); },
      lockExpired: async () => 0,
      lockExpiredDates: async () => [],
    } as unknown as BankHistoryRepository;
    const app = createApp(
      { ...env, APP_ENV: 'beta', AUTH_MODE: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_x', CLERK_SECRET_KEY: 'sk_test_x', TODAY_INGESTION_MODE: 'device' },
      {
        authenticationBoundary: testAuthentication(),
        goalConfigurationRepository: goals,
        todayRepository,
        bankHistoryRepository: bankRepository,
      },
    );

    for (const [token, adjustment] of [['token-a', -300], ['token-b', -500]] as const) {
      await request(app).put('/v1/me/goal-configuration').set('Authorization', `Bearer ${token}`).send({
        goalMode: 'cut', dailyEnergyAdjustment: adjustment, adjustmentSource: 'manual_calories',
      }).expect(200);
      await request(app).get('/v1/me/today?timezone=America/Chicago').set('Authorization', `Bearer ${token}`).expect(200);
      await request(app).get('/v1/me/bank-summary').set('Authorization', `Bearer ${token}`).expect(200);
      await request(app).post('/v1/me/ingestion/intake').set('Authorization', `Bearer ${token}`).send({
        localDate: '2026-08-19', timezone: 'America/Chicago', provider: 'apple_health',
        totalCaloriesConsumed: 1500, providerUpdatedAt: '2026-08-19T18:00:00.000Z',
        writerBundleIdentifier: 'CRONOMETER-GOLD', writerDisplayName: 'Cronometer',
      }).expect(200);
    }

    const [goalA, goalB] = await Promise.all([
      request(app).get('/v1/me/goal-configuration').set('Authorization', 'Bearer token-a'),
      request(app).get('/v1/me/goal-configuration').set('Authorization', 'Bearer token-b'),
    ]);
    expect(goalA.body.dailyEnergyAdjustment).toBe(-300);
    expect(goalB.body.dailyEnergyAdjustment).toBe(-500);
    expect(new Set(todayReads)).toEqual(new Set([users['token-a']!.id, users['token-b']!.id]));
    expect(new Set(intakeWrites)).toEqual(new Set([users['token-a']!.id, users['token-b']!.id]));
    expect(new Set(bankReads)).toEqual(new Set([users['token-a']!.id, users['token-b']!.id]));
  });
});
