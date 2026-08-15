import {
  resolveAuthoritativeProviderRecord,
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  type FetchDailyAggregateInput,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { FitbitExpenditureProvider } from '../src/modules/fitbit/fitbit.provider';
import { decryptFitbitSecret, encryptFitbitSecret } from '../src/modules/fitbit/token-crypto';
import { FitbitService } from '../src/modules/fitbit/fitbit.service';
import { env } from '../src/env';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const input: FetchDailyAggregateInput = {
  userId: 'user', localDate: '2026-08-14', timezone: 'America/Chicago', isCurrentDay: true,
};

describe('authoritative provider resolution', () => {
  const records = [
    { provider: 'apple_health', calories: 2100 },
    { provider: 'fitbit', calories: 2600 },
  ];

  it('selects Fitbit without summing provider totals', () => {
    const selected = resolveAuthoritativeProviderRecord(records, {
      authoritativeProvider: 'fitbit', allowFallback: false,
    });
    expect(selected).toEqual({ provider: 'fitbit', calories: 2600 });
    expect(selected?.calories).not.toBe(4700);
  });

  it('uses Apple Health fallback only when policy explicitly allows it', () => {
    expect(resolveAuthoritativeProviderRecord(records.slice(0, 1), {
      authoritativeProvider: 'fitbit', fallbackProvider: 'apple_health', allowFallback: false,
    })).toBeNull();
    expect(resolveAuthoritativeProviderRecord(records.slice(0, 1), {
      authoritativeProvider: 'fitbit', fallbackProvider: 'apple_health', allowFallback: true,
    })?.provider).toBe('apple_health');
  });
});

describe('Fitbit expenditure adapter', () => {
  it('normalizes Fitbit caloriesOut and applies the centralized adjustment exactly once', async () => {
    const provider = new FitbitExpenditureProvider(
      { fetchDailyActivity: async () => ({ summary: { caloriesOut: 2500 } }) },
      () => new Date('2026-08-14T18:00:00.000Z'),
    );
    const aggregate = await provider.fetchDailyExpenditureAggregate(input);
    expect(aggregate).toMatchObject({
      provider: 'fitbit', rawTotalDailyExpenditure: 2500,
      adjustedDailyExpenditure: 2000,
      adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
    });
    expect(aggregate).not.toHaveProperty('steps');
    expect(aggregate).not.toHaveProperty('workouts');
  });

  it('keeps provider-specific response fields outside the normalized model', async () => {
    const provider = new FitbitExpenditureProvider({
      fetchDailyActivity: async () => ({ summary: { caloriesOut: 2000, steps: 10_000, activityCalories: 900 } }),
    });
    const aggregate = await provider.fetchDailyExpenditureAggregate(input);
    expect(aggregate.rawTotalDailyExpenditure).toBe(2000);
    expect(JSON.stringify(aggregate)).not.toContain('activityCalories');
  });
});

describe('Fitbit token encryption', () => {
  it('encrypts tokens at rest without retaining plaintext', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptFitbitSecret('refresh-secret', key);
    expect(encrypted).not.toContain('refresh-secret');
    expect(decryptFitbitSecret(encrypted, key)).toBe('refresh-secret');
  });
});

describe('Fitbit OAuth state', () => {
  it('accepts a single valid state and persists only encrypted tokens', async () => {
    const prisma = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 9).toString('base64');
    const service = new FitbitService(
      prisma,
      {} as TodayAggregateRepository,
      {
        ...env,
        FITBIT_CLIENT_ID: 'client-id',
        FITBIT_CLIENT_SECRET: 'client-secret',
        FITBIT_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fitbit/callback',
        FITBIT_TOKEN_ENCRYPTION_KEY: key,
      },
      undefined,
      async () => new Response(JSON.stringify({
        access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600,
        user_id: 'fitbit-user', scope: 'activity',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    try {
      const authorizationUrl = await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` }, 'caloriebank://integrations',
      );
      const state = new URL(authorizationUrl).searchParams.get('state');
      expect(state).toBeTruthy();
      expect(authorizationUrl).toContain('code_challenge_method=S256');
      await service.completeAuthorization('authorization-code', state!);
      const connection = await prisma.fitbitConnection.findUniqueOrThrow({ where: { userId: id } });
      expect(connection.encryptedAccessToken).not.toContain('access-secret');
      expect(connection.encryptedRefreshToken).not.toContain('refresh-secret');
      await expect(service.completeAuthorization('authorization-code', state!))
        .rejects.toThrow('invalid or expired');
    } finally {
      await prisma.user.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });
});
