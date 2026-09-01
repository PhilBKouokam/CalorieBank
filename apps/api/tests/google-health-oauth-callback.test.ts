import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { env, type ApiEnv } from '../src/env';
import { errorHandler } from '../src/errors';
import { createGoogleHealthFitbitRouter } from '../src/modules/google-health/google-health.routes';
import {
  GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
  GoogleHealthFitbitService,
  type GoogleHealthOAuthDiagnosticLogger,
} from '../src/modules/google-health/google-health.service';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const key = Buffer.alloc(32, 17).toString('base64');
const user = { id: randomUUID(), email: 'oauth-callback@test.local' };

function config(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    ...env,
    GOOGLE_HEALTH_CLIENT_ID: 'client-id',
    GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_HEALTH_REDIRECT_URI: 'https://sliding-sneer-vendor.ngrok-free.dev/v1/me/integrations/fitbit/callback',
    GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
    ...overrides,
  };
}

type StoredAttempt = {
  id: string;
  userId: string;
  stateHash: string;
  encryptedCodeVerifier: string;
  mobileRedirectUri: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

function oauthDb(options: {
  existingRefreshToken?: string;
  persistenceError?: Error;
} = {}) {
  let attempt: StoredAttempt | null = null;
  let connection: Record<string, unknown> | null = options.existingRefreshToken
    ? {
      userId: user.id,
      encryptedRefreshToken: options.existingRefreshToken,
      refreshTokenExpiresAt: null,
    }
    : null;
  const db = {
    user: { upsert: async () => user },
    googleHealthOAuthAttempt: {
      create: async ({ data }: { data: Omit<StoredAttempt, 'id' | 'consumedAt'> }) => {
        attempt = { ...data, id: randomUUID(), consumedAt: null };
        return attempt;
      },
      findUnique: async () => attempt,
      update: async ({ data }: { data: { consumedAt: Date } }) => {
        if (attempt) attempt.consumedAt = data.consumedAt;
        return attempt;
      },
    },
    googleHealthConnection: {
      findUnique: async () => connection,
      upsert: async ({ create, update }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        if (options.persistenceError) throw options.persistenceError;
        connection = connection ? { ...connection, ...update } : create;
        return connection;
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  return {
    db: db as unknown as PrismaClient,
    getAttempt: () => attempt,
    getConnection: () => connection,
  };
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    access_token: 'access-secret',
    refresh_token: 'refresh-secret',
    expires_in: 3600,
    scope: GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
    ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function authorizationState(service: GoogleHealthFitbitService) {
  const authorizationUrl = await service.createAuthorizationUrl(user, 'caloriebank://integrations');
  const state = new URL(authorizationUrl).searchParams.get('state');
  if (!state) throw new Error('Expected OAuth state.');
  return { authorizationUrl, state };
}

describe('Google Health OAuth callback', () => {
  it('rejects a non-canonical mobile redirect with a typed error and safe authorization-start diagnostics', async () => {
    const harness = oauthDb();
    const events: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined, fetch, undefined,
      (event, metadata = {}) => events.push({ event, metadata }),
    );

    await expect(service.createAuthorizationUrl(user, 'caloriebank://onboarding')).rejects.toMatchObject({
      statusCode: 400,
      details: { code: 'INVALID_REDIRECT' },
    });
    expect(events.at(-1)).toMatchObject({
      event: 'authorization_start_failure',
      metadata: {
        stage: 'mobile_redirect_validation',
        httpStatus: 400,
        validationErrorCode: 'INVALID_REDIRECT',
        parsedScheme: 'caloriebank',
        oauthAttemptCreated: false,
      },
    });
    expect(JSON.stringify(events)).not.toContain('caloriebank://onboarding');
  });

  it('reuses the exact redirect URI and PKCE verifier, looks up identity, persists, and redirects', async () => {
    const harness = oauthDb();
    const requests: Array<{ url: string; body: string | null }> = [];
    const events: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    const logger: GoogleHealthOAuthDiagnosticLogger = (event, metadata = {}) => events.push({ event, metadata });
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async (input, init) => {
        requests.push({ url: String(input), body: init?.body ? String(init.body) : null });
        return String(input).endsWith('/users/me/identity')
          ? new Response(JSON.stringify({ healthUserId: 'health-user' }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          })
          : tokenResponse();
      },
      () => new Date('2026-08-16T20:00:00.000Z'), logger,
    );
    const { authorizationUrl, state } = await authorizationState(service);
    const redirect = await service.completeAuthorization('authorization-code', state);
    const tokenBody = new URLSearchParams(requests[0]?.body ?? '');
    const verifier = tokenBody.get('code_verifier');
    const challenge = createHash('sha256').update(verifier ?? '').digest('base64url');

    expect(tokenBody.get('redirect_uri')).toBe(config().GOOGLE_HEALTH_REDIRECT_URI);
    expect(new URL(authorizationUrl).searchParams.get('redirect_uri')).toBe(tokenBody.get('redirect_uri'));
    expect(new URL(authorizationUrl).searchParams.get('code_challenge')).toBe(challenge);
    expect(tokenBody.get('grant_type')).toBe('authorization_code');
    expect(tokenBody.get('client_id')).toBe('client-id');
    expect(tokenBody.get('client_secret')).toBe('client-secret');
    expect(requests[1]?.url).toBe('https://health.googleapis.com/v4/users/me/identity');
    expect(harness.getConnection()).toMatchObject({ healthUserId: 'health-user', legacyUserId: null });
    expect(redirect).toBe('caloriebank://integrations');
    expect(events.map(({ event }) => event)).toEqual(expect.arrayContaining([
      'state_found', 'state_validated', 'token_exchange_success', 'identity_lookup_success',
      'token_encryption_success', 'connection_persist_success', 'mobile_redirect_started',
    ]));
    const serializedLogs = JSON.stringify(events);
    expect(serializedLogs).not.toContain('authorization-code');
    expect(serializedLogs).not.toContain('access-secret');
    expect(serializedLogs).not.toContain('refresh-secret');
    expect(serializedLogs).not.toContain('client-secret');
  });

  it.each([
    [400, 'invalid_grant'],
    [401, 'invalid_client'],
  ])('preserves token endpoint status %s and code %s in safe diagnostics', async (status, code) => {
    const harness = oauthDb();
    const events: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => new Response(JSON.stringify({ error: code, error_description: 'OAuth exchange rejected' }), {
        status, headers: { 'Content-Type': 'application/json' },
      }), undefined,
      (event, metadata = {}) => events.push({ event, metadata }),
    );
    const { state } = await authorizationState(service);
    await expect(service.completeAuthorization('single-use-code', state)).rejects.toThrow('rejected');
    expect(events.at(-1)).toMatchObject({
      event: 'oauth_callback_failure',
      metadata: { stage: 'token_exchange_started', googleHttpStatus: status, googleErrorCode: code },
    });
    expect(harness.getAttempt()?.consumedAt).toBeNull();
  });

  it.each([403, 500])('reports getIdentity HTTP %s without requiring a legacy user ID', async (status) => {
    const harness = oauthDb();
    const events: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    let call = 0;
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => ++call === 1
        ? tokenResponse()
        : new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'Identity unavailable' } }), {
          status, headers: { 'Content-Type': 'application/json' },
        }), undefined,
      (event, metadata = {}) => events.push({ event, metadata }),
    );
    const { state } = await authorizationState(service);
    await expect(service.completeAuthorization('code', state)).rejects.toThrow('Identity unavailable');
    expect(events.at(-1)?.metadata).toMatchObject({
      stage: 'identity_lookup_started', googleHttpStatus: status, googleErrorCode: 'PERMISSION_DENIED',
    });
  });

  it('accepts identity without legacyUserId and reuses an existing refresh token when omitted', async () => {
    const harness = oauthDb({ existingRefreshToken: 'already-encrypted' });
    let call = 0;
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => ++call === 1
        ? tokenResponse({ refresh_token: undefined })
        : new Response(JSON.stringify({ healthUserId: 'new-google-user' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
    );
    const { state } = await authorizationState(service);
    await expect(service.completeAuthorization('code', state)).resolves.toBe('caloriebank://integrations');
    expect(harness.getConnection()).toMatchObject({
      encryptedRefreshToken: 'already-encrypted', healthUserId: 'new-google-user', legacyUserId: null,
    });
  });

  it('returns an explicit error when a first connection has no refresh token', async () => {
    const harness = oauthDb();
    let call = 0;
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => ++call === 1
        ? tokenResponse({ refresh_token: undefined })
        : new Response(JSON.stringify({ healthUserId: 'health-user' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
    );
    const { state } = await authorizationState(service);
    await expect(service.completeAuthorization('code', state)).rejects.toThrow('offline refresh token');
    expect(harness.getAttempt()?.consumedAt).toBeNull();
  });

  it('reports encryption configuration and persistence failures at their exact stages', async () => {
    const harness = oauthDb({ persistenceError: new Error('Database unavailable') });
    const events: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    let call = 0;
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => ++call === 1
        ? tokenResponse()
        : new Response(JSON.stringify({ healthUserId: 'health-user' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), undefined,
      (event, metadata = {}) => events.push({ event, metadata }),
    );
    const { state } = await authorizationState(service);
    await expect(service.completeAuthorization('code', state)).rejects.toThrow('Database unavailable');
    expect(events.at(-1)?.metadata.stage).toBe('connection_persist_started');
    service.logOAuthFailure('connection_persist_started', new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.19.0' },
    ));
    expect(events.at(-1)?.metadata.prismaCode).toBe('P2002');

    const invalidKeyEvents: Array<{ event: string; metadata: Readonly<Record<string, unknown>> }> = [];
    const invalidKeyService = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository,
      config({ GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') }),
      undefined, fetch, undefined,
      (event, metadata = {}) => invalidKeyEvents.push({ event, metadata }),
    );
    await expect(invalidKeyService.completeAuthorization('code', state)).rejects.toThrow('32 bytes');
    expect(invalidKeyEvents.at(-1)?.metadata.stage).toBe('configuration_validation');
  });

  it('rejects expired and reused state', async () => {
    const harness = oauthDb();
    let now = new Date('2026-08-16T20:00:00.000Z');
    let call = 0;
    const service = new GoogleHealthFitbitService(
      harness.db, {} as TodayAggregateRepository, config(), undefined,
      async () => ++call % 2 === 1
        ? tokenResponse()
        : new Response(JSON.stringify({ healthUserId: 'health-user' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), () => now,
    );
    const { state } = await authorizationState(service);
    now = new Date('2026-08-16T20:11:00.000Z');
    await expect(service.completeAuthorization('code', state)).rejects.toThrow('invalid or expired');

    now = new Date('2026-08-16T20:00:00.000Z');
    const second = await authorizationState(service);
    await service.completeAuthorization('code', second.state);
    await expect(service.completeAuthorization('code', second.state)).rejects.toThrow('invalid or expired');
  });

  it('validates callback input and sends the successful mobile deep-link redirect once', async () => {
    const events: string[] = [];
    const service = {
      logOAuthStage: (event: string) => events.push(event),
      logOAuthFailure: (stage: string) => events.push(`failure:${stage}`),
      completeAuthorization: async () => 'caloriebank://integrations',
    } as unknown as GoogleHealthFitbitService;
    const app = express();
    app.use('/v1/me/integrations/fitbit', createGoogleHealthFitbitRouter(service, user));
    app.use(errorHandler);

    await request(app).get('/v1/me/integrations/fitbit/callback?state=state-only').expect(400);
    const response = await request(app)
      .get('/v1/me/integrations/fitbit/callback?state=state&code=code')
      .expect(302);
    expect(response.headers.location).toBe('caloriebank://integrations?fitbit=connected');
    expect(events).toContain('authorization_code_present');
    expect(events).toContain('mobile_redirect_success');
    expect(events).toContain('failure:callback_validation');
  });
});
