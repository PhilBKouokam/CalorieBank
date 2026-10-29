import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, type ApiEnv } from '../src/env';
import { errorHandler } from '../src/errors';
import { createGoogleHealthFitbitRouter } from '../src/modules/google-health/google-health.routes';
import { GoogleHealthFitbitService, GOOGLE_HEALTH_ACTIVITY_READ_SCOPE } from '../src/modules/google-health/google-health.service';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const database = process.env.TEST_DATABASE_URL;
if (!database || !['localhost','127.0.0.1'].includes(new URL(database).hostname)
  || !/^\/caloriebank_(test|rc_)[a-zA-Z0-9_]*$/.test(new URL(database).pathname)) {
  throw new Error('Admission persistence tests require the dedicated localhost test database.');
}
const db = new PrismaClient({ datasources: { db: { url: database } }, log: [] });
const key = Buffer.alloc(32, 29).toString('base64');
const now = new Date('2026-10-28T12:00:00Z');
const healthId = 'synthetic-approved-health';
let approved: { id: string; email: string; subject: string };
let other: typeof approved;
let config: ApiEnv;
let policy: { version: number; members: { accountId: string; clerkSubject: string; healthUserIds: string[] }[] };
function setPolicy() { config.GOOGLE_HEALTH_TESTER_COHORT_JSON = JSON.stringify(policy); }
function service(options: { health?: string; afterIdentity?: () => Promise<void> } = {}) {
  const fetcher = vi.fn(async (input: unknown) => {
    if (String(input).endsWith('/users/me/identity')) {
      await options.afterIdentity?.();
      return new Response(JSON.stringify({ healthUserId: options.health ?? healthId }), { status: 200 });
    }
    return new Response(JSON.stringify({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
      expires_in: 3600, scope: GOOGLE_HEALTH_ACTIVITY_READ_SCOPE }), { status: 200 });
  });
  return { fetcher, api: new GoogleHealthFitbitService(db, {} as TodayAggregateRepository, config,
    undefined, fetcher, () => now, () => undefined) };
}
async function state(api: GoogleHealthFitbitService) {
  return new URL(await api.createAuthorizationUrl(approved, 'caloriebank://integrations')).searchParams.get('state')!;
}
async function evidence() {
  const ids = [approved.id, other.id];
  return { selections: await db.providerSelection.findMany({ where: { userId: { in: ids } }, orderBy: { userId: 'asc' } }),
    ledger: await db.calorieLedgerTransaction.count({ where: { userId: { in: ids } } }),
    history: await db.finalizedDailyBankRecord.count({ where: { userId: { in: ids } } }),
    intake: await db.dailyIntakeAggregate.count({ where: { userId: { in: ids } } }) };
}
beforeEach(async () => {
  approved = { id: randomUUID(), subject: `synthetic-${randomUUID()}`, email: 'approved@synthetic.invalid' };
  other = { id: randomUUID(), subject: `synthetic-${randomUUID()}`, email: 'other@synthetic.invalid' };
  for (const user of [approved, other]) await db.user.create({ data: { id: user.id, email: user.email,
    authProvider: 'clerk', authSubject: user.subject, providerSelection: { create: {
      authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health' } } } });
  config = { ...env, APP_ENV: 'beta', GOOGLE_HEALTH_CLIENT_ID: 'synthetic-client',
    GOOGLE_HEALTH_CLIENT_SECRET: 'synthetic-secret', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
    GOOGLE_HEALTH_REDIRECT_URI: 'https://synthetic.invalid/v1/me/integrations/fitbit/callback' };
  policy = { version: 1, members: [{ accountId: approved.id, clerkSubject: approved.subject, healthUserIds: [healthId] }] };
  setPolicy();
});
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: [approved.id, other.id] } } }); });
afterAll(async () => { await db.$disconnect(); });

describe('persisted Google tester admission', () => {
  it('allows approved initial connection, pins its identity, and leaves selections/accounting unchanged', async () => {
    const before = await evidence(); const h = service(); const s = await state(h.api);
    expect(await h.api.completeAuthorization('synthetic-code', s)).toBe('caloriebank://integrations');
    const row = await db.googleHealthConnection.findUniqueOrThrow({ where: { userId: approved.id } });
    expect(row.healthUserId).toBe(healthId);
    expect(row.encryptedAccessToken).not.toContain('synthetic-access');
    expect(await db.googleHealthConnection.count({ where: { userId: other.id } })).toBe(0);
    expect(await evidence()).toEqual(before);
    const second = await state(h.api);
    await h.api.completeAuthorization('synthetic-reconnect-code', second);
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(1);
    expect(await evidence()).toEqual(before);
  });
  it('denies simultaneous unapproved starts without creating state, including reconnect with existing tokens', async () => {
    await db.googleHealthConnection.create({ data: { userId: other.id, healthUserId: 'synthetic-prior',
      encryptedAccessToken: encryptGoogleHealthSecret('synthetic-prior-access', key),
      encryptedRefreshToken: encryptGoogleHealthSecret('synthetic-prior-refresh', key), accessTokenExpiresAt: new Date('2030-01-01') } });
    const original = await db.googleHealthConnection.findUniqueOrThrow({ where: { userId: other.id } });
    const h = service(); const before = await evidence();
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => h.api.createAuthorizationUrl(other, 'caloriebank://integrations')));
    expect(attempts.every(row => row.status === 'rejected')).toBe(true);
    expect(await db.googleHealthOAuthAttempt.count({ where: { userId: other.id } })).toBe(0);
    expect(await db.googleHealthConnection.findUniqueOrThrow({ where: { userId: other.id } })).toEqual(original);
    expect(h.fetcher).not.toHaveBeenCalled(); expect(await evidence()).toEqual(before);
  });
  it('requires membership again for a state created before a configuration change', async () => {
    const h = service(); const s = await state(h.api);
    policy.members = []; setPolicy();
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toMatchObject({ statusCode: 403 });
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(0);
  });
  it('rejects a different Google identity without replacing an existing connection or consuming state', async () => {
    await db.googleHealthConnection.create({ data: { userId: approved.id, healthUserId: healthId,
      encryptedAccessToken: 'synthetic-preserved-access', encryptedRefreshToken: 'synthetic-preserved-refresh', accessTokenExpiresAt: new Date('2030-01-01') } });
    const original = await db.googleHealthConnection.findUniqueOrThrow({ where: { userId: approved.id } });
    const h = service({ health: 'synthetic-unapproved-health' }); const s = await state(h.api);
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.googleHealthConnection.findUniqueOrThrow({ where: { userId: approved.id } })).toEqual(original);
    expect((await db.googleHealthOAuthAttempt.findFirstOrThrow({ where: { userId: approved.id } })).consumedAt).toBeNull();
  });
  it('rechecks membership/ownership after the remote identity response and before persistence', async () => {
    const h = service({ afterIdentity: async () => { policy.members = []; setPolicy(); } }); const s = await state(h.api);
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(0);
  });
  it('does not admit a stale or same-email recreated subject', async () => {
    const h = service(); const s = await state(h.api);
    await db.user.update({ where: { id: approved.id }, data: { authSubject: 'synthetic-recreated-subject' } });
    await expect(h.api.createAuthorizationUrl(approved, 'caloriebank://integrations')).rejects.toMatchObject({ statusCode: 403 });
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toMatchObject({ statusCode: 403 });
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('serializes concurrent callbacks to one connection and one consumed attempt', async () => {
    const h = service(); const s = await state(h.api);
    const results = await Promise.allSettled([h.api.completeAuthorization('synthetic-code', s), h.api.completeAuthorization('synthetic-code', s)]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(1);
    expect(await db.googleHealthOAuthAttempt.count({ where: { userId: approved.id, consumedAt: { not: null } } })).toBe(1);
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toThrow('invalid or expired');
  });
  it('denies deletion-in-progress before remote exchange', async () => {
    const h = service(); const s = await state(h.api);
    await db.user.update({ where: { id: approved.id }, data: { deletionRequestedAt: now } });
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toThrow('unavailable');
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(0);
  });
  it('fresh signup with the same email cannot inherit cohort membership or an old attempt', async () => {
    const h = service(); const s = await state(h.api); const old = { ...approved };
    await db.user.delete({ where: { id: old.id } });
    approved = { ...old, id: randomUUID(), subject: `synthetic-fresh-${randomUUID()}` };
    await db.user.create({ data: { id: approved.id, email: approved.email, authProvider: 'clerk', authSubject: approved.subject } });
    await expect(h.api.createAuthorizationUrl(old, 'caloriebank://integrations')).rejects.toMatchObject({ statusCode: 403 });
    await expect(h.api.createAuthorizationUrl(approved, 'caloriebank://integrations')).rejects.toMatchObject({ statusCode: 403 });
    await expect(h.api.completeAuthorization('synthetic-code', s)).rejects.toThrow('invalid or expired');
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(await db.googleHealthConnection.count({ where: { userId: { in: [old.id, approved.id] } } })).toBe(0);
  });
  it('callback routing uses only stored ownership, not a switched browser account', async () => {
    const h = service(); const s = await state(h.api);
    const app = express(); app.use(createGoogleHealthFitbitRouter(h.api, other));
    const response = await request(app).get('/callback').query({ code: 'synthetic-code', state: s, userId: other.id });
    expect(response.headers.location).toBe('caloriebank://integrations?fitbit=connected');
    expect(await db.googleHealthConnection.count({ where: { userId: approved.id } })).toBe(1);
    expect(await db.googleHealthConnection.count({ where: { userId: other.id } })).toBe(0);
  });
  it('old-client authorization gets a safe typed 403; denied callback redirects without private detail', async () => {
    const h = service(); const s = await state(h.api);
    const app = express(); app.use(createGoogleHealthFitbitRouter(h.api, other)); app.use(errorHandler);
    const response = await request(app).get('/authorize');
    expect(response.status).toBe(403); expect(response.body).toEqual({ error: { message: "Google Health connection isn't available yet.", details: { code: 'GOOGLE_HEALTH_NOT_AVAILABLE' } } });
    policy.members = []; setPolicy();
    const callback = await request(app).get('/callback').query({ code: 'synthetic-code', state: s });
    expect(callback.headers.location).toBe('caloriebank://integrations?fitbit=unavailable');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});
