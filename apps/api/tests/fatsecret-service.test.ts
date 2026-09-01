import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { env } from '../src/env';
import { localDateToFatSecretDateInt } from '../src/modules/fatsecret/fatsecret.provider';
import { FatSecretService } from '../src/modules/fatsecret/fatsecret.service';
import { decryptProviderSecret } from '../src/modules/provider-oauth/token-crypto';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

function config(key: string) {
  return {
    ...env,
    FATSECRET_CONSUMER_KEY: 'consumer-key',
    FATSECRET_CONSUMER_SECRET: 'consumer-secret',
    FATSECRET_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/fatsecret/callback',
    EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY: key,
  };
}

describe('FatSecret delegated connection and rolling sync', () => {
  it('completes three-legged OAuth, encrypts delegated secrets, rejects callback reuse, and disconnects', async () => {
    const db = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 41).toString('base64');
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const url = String(request);
      if (url.includes('/oauth/request_token')) {
        return new Response('oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true');
      }
      if (url.includes('/oauth/access_token')) {
        return new Response('oauth_token=access-token&oauth_token_secret=access-secret');
      }
      throw new Error('Unexpected request');
    });
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = new FatSecretService(
      db,
      {} as TodayAggregateRepository,
      config(key),
      fetcher as unknown as typeof fetch,
      () => new Date('2026-08-17T18:00:00.000Z'),
      () => 'nonce',
    );
    try {
      const authorizationUrl = await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` }, 'caloriebank://integrations',
      );
      expect(authorizationUrl).toBe('https://authentication.fatsecret.com/oauth/authorize?oauth_token=request-token');
      const requestBody = String(fetcher.mock.calls[0]?.[1]?.body);
      expect(requestBody).toContain('oauth_callback=https%3A%2F%2Fapi.example.test%2Fv1%2Fme%2Fintegrations%2Ffatsecret%2Fcallback');

      await expect(service.completeAuthorization('request-token', 'verifier'))
        .resolves.toBe('caloriebank://integrations');
      const connection = await db.externalProviderConnection.findUniqueOrThrow({
        where: { userId_provider: { userId: id, provider: 'fatsecret' } },
      });
      expect(connection).toMatchObject({ authProtocol: 'oauth1', encryptedRefreshToken: null, accessTokenExpiresAt: null });
      expect(decryptProviderSecret(connection.encryptedAccessToken, key)).toBe('access-token');
      expect(decryptProviderSecret(connection.encryptedTokenSecret!, key)).toBe('access-secret');
      await expect(service.completeAuthorization('request-token', 'verifier')).rejects.toThrow('invalid or expired');
      expect(consoleSpy.mock.calls.flat().join(' ')).not.toContain('access-secret');
      await service.disconnect({ id, email: `${id}@test.local` });
      await expect(db.externalProviderConnection.findUnique({
        where: { userId_provider: { userId: id, provider: 'fatsecret' } },
      })).resolves.toBeNull();
    } finally {
      consoleSpy.mockRestore();
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    }
  });

  it('rejects unknown and expired request tokens before access-token exchange', async () => {
    const db = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 43).toString('base64');
    let now = new Date('2026-08-17T18:00:00.000Z');
    const fetcher = vi.fn<typeof fetch>(async () => new Response(
      'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
    ));
    const service = new FatSecretService(
      db, {} as TodayAggregateRepository, config(key), fetcher as unknown as typeof fetch,
      () => now, () => 'nonce',
    );
    try {
      await expect(service.completeAuthorization('unknown-token', 'verifier'))
        .rejects.toThrow('invalid or expired');
      await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` }, 'caloriebank://integrations',
      );
      now = new Date('2026-08-17T18:11:00.000Z');
      await expect(service.completeAuthorization('request-token', 'verifier'))
        .rejects.toThrow('invalid or expired');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    }
  });

  it('returns an explicit provider failure when FatSecret rejects the verifier', async () => {
    const db = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 44).toString('base64');
    const fetcher = vi.fn<typeof fetch>(async (request) => String(request).includes('/oauth/request_token')
      ? new Response('oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true')
      : new Response('oauth_problem=permission_denied', { status: 401 }));
    const service = new FatSecretService(
      db, {} as TodayAggregateRepository, config(key), fetcher as unknown as typeof fetch,
      () => new Date('2026-08-17T18:00:00.000Z'), () => 'nonce',
    );
    try {
      await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` }, 'caloriebank://integrations',
      );
      await expect(service.completeAuthorization('request-token', 'invalid-verifier'))
        .rejects.toThrow('could not be completed');
      await expect(db.externalProviderConnection.findUnique({
        where: { userId_provider: { userId: id, provider: 'fatsecret' } },
      })).resolves.toBeNull();
    } finally {
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    }
  });

  it('syncs the rolling three-day diary independently and preserves missing days', async () => {
    const db = new PrismaClient();
    const id = randomUUID();
    const key = Buffer.alloc(32, 42).toString('base64');
    const upserts: Array<{ localDate: string; calories: number }> = [];
    const missing: string[] = [];
    const repository = {
      upsertIntakeAggregate: async (_user, aggregate) => {
        upserts.push({ localDate: aggregate.localDate, calories: aggregate.totalCaloriesConsumed });
        return 'created' as const;
      },
      markIntakeAggregateUnavailable: async (_user, input) => {
        missing.push(input.localDate);
        return false;
      },
    } as TodayAggregateRepository;
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ month: { day: [
      { date_int: String(localDateToFatSecretDateInt('2026-08-17')), calories: '1731' },
      { date_int: String(localDateToFatSecretDateInt('2026-08-16')), calories: '2500' },
    ] } }), { headers: { 'Content-Type': 'application/json' } }));
    const service = new FatSecretService(
      db, repository, config(key), fetcher as unknown as typeof fetch,
      () => new Date('2026-08-17T18:00:00.000Z'), () => 'nonce',
    );
    try {
      await db.user.create({ data: { id, email: `${id}@test.local` } });
      const { encryptProviderSecret } = await import('../src/modules/provider-oauth/token-crypto');
      await db.externalProviderConnection.create({ data: {
        userId: id,
        provider: 'fatsecret',
        authProtocol: 'oauth1',
        encryptedAccessToken: encryptProviderSecret('access-token', key),
        encryptedTokenSecret: encryptProviderSecret('access-secret', key),
        scopes: ['food_diary_read'],
      } });
      await expect(service.syncRollingWindow(
        { id, email: `${id}@test.local` }, '2026-08-17', 'America/Chicago', true, 8,
      )).resolves.toEqual({
        datesRequested: [
          '2026-08-17', '2026-08-16', '2026-08-15', '2026-08-14',
          '2026-08-13', '2026-08-12', '2026-08-11', '2026-08-10',
        ],
        datesUpdated: ['2026-08-17', '2026-08-16'],
        datesSkipped: [
          '2026-08-15', '2026-08-14', '2026-08-13',
          '2026-08-12', '2026-08-11', '2026-08-10',
        ],
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(upserts).toEqual([
        { localDate: '2026-08-17', calories: 1731 },
        { localDate: '2026-08-16', calories: 2500 },
      ]);
      expect(missing).toEqual([
        '2026-08-15', '2026-08-14', '2026-08-13',
        '2026-08-12', '2026-08-11', '2026-08-10',
      ]);
    } finally {
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    }
  });

  it('requires reconnect only for a revoked delegated token', async () => {
    const db = new PrismaClient();
    const key = Buffer.alloc(32, 45).toString('base64');
    const { encryptProviderSecret } = await import('../src/modules/provider-oauth/token-crypto');

    async function createConnectedUser(id: string) {
      await db.user.create({ data: { id, email: `${id}@test.local` } });
      await db.externalProviderConnection.create({ data: {
        userId: id,
        provider: 'fatsecret',
        authProtocol: 'oauth1',
        encryptedAccessToken: encryptProviderSecret('access-token', key),
        encryptedTokenSecret: encryptProviderSecret('access-secret', key),
        scopes: [],
      } });
    }

    const revokedId = randomUUID();
    const temporaryId = randomUUID();
    try {
      await createConnectedUser(revokedId);
      await createConnectedUser(temporaryId);
      const revoked = new FatSecretService(
        db, {} as TodayAggregateRepository, config(key),
        vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
          error: { code: 9, message: 'Invalid access token' },
        }), { headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch,
        () => new Date('2026-08-17T18:00:00.000Z'), () => 'nonce',
      );
      await expect(revoked.syncRollingWindow(
        { id: revokedId, email: `${revokedId}@test.local` },
        '2026-08-17', 'America/Chicago', true,
      )).rejects.toThrow('could not be refreshed');
      await expect(db.externalProviderConnection.findUniqueOrThrow({
        where: { userId_provider: { userId: revokedId, provider: 'fatsecret' } },
      })).resolves.toMatchObject({ status: 'needs_reconnect', lastErrorCode: 'access_token_invalid' });

      const temporary = new FatSecretService(
        db, {} as TodayAggregateRepository, config(key),
        vi.fn<typeof fetch>(async () => new Response('unavailable', { status: 503 })) as unknown as typeof fetch,
        () => new Date('2026-08-17T18:00:00.000Z'), () => 'nonce',
      );
      await expect(temporary.syncRollingWindow(
        { id: temporaryId, email: `${temporaryId}@test.local` },
        '2026-08-17', 'America/Chicago', true,
      )).rejects.toThrow('could not be refreshed');
      await expect(db.externalProviderConnection.findUniqueOrThrow({
        where: { userId_provider: { userId: temporaryId, provider: 'fatsecret' } },
      })).resolves.toMatchObject({ status: 'connected', lastErrorCode: 'diary_sync_failed' });
    } finally {
      await db.user.deleteMany({ where: { id: { in: [revokedId, temporaryId] } } });
      await db.$disconnect();
    }
  });
});
