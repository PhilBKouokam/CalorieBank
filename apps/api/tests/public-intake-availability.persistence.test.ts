import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { env, parseApiEnv } from '../src/env';
import { publicIntakeAvailability, requirePublicIntakeSource } from '../src/security/public-intake-availability';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { FatSecretService } from '../src/modules/fatsecret/fatsecret.service';
import { createFatSecretRouter } from '../src/modules/fatsecret/fatsecret.routes';
import { createNativeIntakeRouter } from '../src/modules/native-intake/native-intake.routes';
import { ManualIntakeRepository } from '../src/modules/manual-intake/manual-intake.repository';
import { errorHandler } from '../src/errors';
import { resolveVerifiedClerkIdentity } from '../src/auth/current-user';
import { openingImportDates } from '../src/modules/bank-history/opening-bank-import';
import { normalizeDailyIntakeAggregate } from '@caloriebank/domain';
import { providerSelectionResponseSchema, type NativeIntakeBatch } from '@caloriebank/schemas';

const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !/^\/caloriebank_test/.test(new URL(url).pathname)) throw new Error('Dedicated local test database required');
const db = new PrismaClient({ datasourceUrl: url });
const ids: string[] = [];
const now = () => new Date('2026-10-24T12:00:00Z');
const config = { ...env, PUBLIC_INTAKE_MODE: 'without_fatsecret' as const, FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: '',
  FATSECRET_CONSUMER_KEY: 'synthetic', FATSECRET_CONSUMER_SECRET: 'synthetic', FATSECRET_REDIRECT_URI: 'https://example.com/callback',
  EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64') };
async function account(privateBeta = false, createdAt = '2026-10-24T00:00:00Z') {
  const id = randomUUID(); ids.push(id);
  if (privateBeta) config.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS = [config.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS, id].filter(Boolean).join(',');
  return db.user.create({ data: { id, email: `${id}@test.local`, createdAt: new Date(createdAt), profile: { create: { timezone: 'UTC' } } } });
}
const repo = () => new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db), now, true, config);
const input = { selectionRole: 'eaten' as const, authoritativeExpenditureProvider: 'apple_health' as const, authoritativeActivityProvider: 'apple_health' as const, authoritativeIntakeProvider: 'health_connect' as const,
  nativeIntakeSource: { namespace: 'android_package' as const, id: 'com.cronometer.android.gold' } };
async function connection(userId: string) {
  return db.externalProviderConnection.create({ data: { userId, provider: 'fatsecret', authProtocol: 'oauth1', encryptedAccessToken: 'opaque-test', encryptedTokenSecret: 'opaque-test' } });
}
afterEach(async () => { config.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS = ''; await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(async () => db.$disconnect());

describe('default-off public intake contingency with real PostgreSQL', () => {
  it('uses exact stable membership independently of account age and profile timezone', async () => {
    for (const [listed, createdAt, timezone] of [
      [true, '2026-10-25T03:00:00.001Z', 'Pacific/Kiritimati'],
      [false, '2026-09-01T00:00:00Z', 'America/Adak'],
      [true, '2026-10-25T03:00:00Z', 'UTC'],
    ] as const) {
      const user = await account(listed, createdAt);
      await db.userProfile.update({ where: { userId: user.id }, data: { timezone } });
      expect(await publicIntakeAvailability(db, user.id, config)).toEqual({ fatSecret: listed });
    }
  });
  it('preserves cohort on restored sessions/devices and reclassifies deliberate fresh identity signup', async () => {
    const old = await account(true);
    const subject = `user_${randomUUID().replaceAll('-', '')}`;
    await db.user.update({ where: { id: old.id }, data: { authProvider: 'clerk', authSubject: subject } });
    const authConfig = { ...env, APP_ENV: 'beta' as const, AUTH_MODE: 'clerk' as const };
    const existing = { subject, email: old.email };
    const restored = await resolveVerifiedClerkIdentity(db, authConfig, existing, async () => existing);
    expect(restored.id).toBe(old.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).createdAt).toEqual(old.createdAt);
    expect(await publicIntakeAvailability(db, restored.id, config)).toEqual({ fatSecret: true });
    // Disposable local fixture only, not a repeated production deletion test.
    await db.user.delete({ where: { id: old.id } });
    const fresh = { subject: `user_${randomUUID().replaceAll('-', '')}`, email: old.email };
    const recreated = await resolveVerifiedClerkIdentity(db, authConfig, fresh, async () => fresh);
    ids.push(recreated.id);
    expect(recreated.id).not.toBe(old.id);
    expect(await publicIntakeAvailability(db, recreated.id, config)).toEqual({ fatSecret: false });
    expect(await db.externalProviderConnection.count({ where: { userId: recreated.id } })).toBe(0);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: recreated.id } })).toBe(0);
  });
  it('does not substitute an unlisted account\'s pre-existing selected FatSecret source on reads', async () => {
    const user = await account();
    const saved = await connection(user.id);
    const privateRepo = new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db), now, true,
      { ...config, PUBLIC_INTAKE_MODE: 'unchanged' });
    await privateRepo.update(user, { ...input, authoritativeIntakeProvider: 'fatsecret' });
    const before = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    const publicView = await repo().getHealthConnections(user.id);
    expect(publicView.intakeAvailability).toEqual({ fatSecret: false });
    expect(publicView.eaten.selected?.label).toBe('FatSecret');
    expect(await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(before);
    expect(await db.externalProviderConnection.findUnique({ where: { id: saved.id } })).toEqual(saved);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
  });
  it('requires an explicit stable allowlist, rejects email/invalid/duplicate IDs, and accepts deny-all', () => {
    expect(parseApiEnv({ NODE_ENV: 'test' }).PUBLIC_INTAKE_MODE).toBe('unchanged');
    expect(() => parseApiEnv({ NODE_ENV: 'test', PUBLIC_INTAKE_MODE: 'without_fatsecret' })).toThrow();
    const duplicate = randomUUID();
    for (const invalid of ['test@example.com', 'not-a-uuid', `${randomUUID()},`, `${duplicate},${duplicate}`,
      Array.from({ length: 101 }, () => randomUUID()).join(',')]) {
      expect(() => parseApiEnv({ NODE_ENV: 'test', PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: invalid })).toThrow();
    }
    expect(() => parseApiEnv({ NODE_ENV: 'test', PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_CREATED_BEFORE: '2026-10-01T00:00:00Z' })).toThrow();
    expect(parseApiEnv({ NODE_ENV: 'test', PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: '' }).FATSECRET_PRIVATE_BETA_ACCOUNT_IDS).toBe('');
  });
  it('keeps membership, deletion and account switching decisions independent', async () => {
    const old = await account(true), current = await account();
    expect(await publicIntakeAvailability(db, current.id, config)).toEqual({ fatSecret: false });
    expect(await publicIntakeAvailability(db, old.id, config)).toEqual({ fatSecret: true });
    expect(await publicIntakeAvailability(db, current.id, config)).toEqual({ fatSecret: false });
    await db.user.update({ where: { id: old.id }, data: { deletionRequestedAt: now() } });
    expect(await publicIntakeAvailability(db, old.id, config)).toEqual({ fatSecret: false });
    expect(await publicIntakeAvailability(db, randomUUID(), config)).toEqual({ fatSecret: false });
  });
  it('omits the additive field with the default policy and preserves legacy wire parsing', async () => {
    const user = await account();
    const unchanged = new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db), now);
    const response = await unchanged.get(user.id);
    expect(response.intakeAvailability).toBeUndefined();
    const current = await repo().get(user.id);
    expect(providerSelectionResponseSchema.omit({ intakeAvailability: true }).parse(current)).not.toHaveProperty('intakeAvailability');
    expect(current.intakeAvailability).toEqual({ fatSecret: false });
  });
  it('rejects legacy authorize before remote work and leaves other accounts/connections intact', async () => {
    const user = await account(), other = await account(true);
    const saved = await connection(other.id), fetcher = vi.fn(async () => new Response('unexpected', { status: 500 }));
    const app = express(); app.use('/fatsecret', createFatSecretRouter(new FatSecretService(db, new PrismaTodayAggregateRepository(db), config, fetcher), user)); app.use(errorHandler);
    const response = await request(app).get('/fatsecret/authorize').expect(403);
    expect(response.body.error.details.code).toBe('PUBLIC_INTAKE_SOURCE_UNAVAILABLE');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.externalProviderOAuthAttempt.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.externalProviderConnection.findUnique({ where: { id: saved.id } })).toEqual(saved);
  });
  it('preserves existing private users including legitimate new private authorization', async () => {
    const user = await account(true);
    const fetcher = vi.fn(async () => new Response('oauth_token=synthetic&oauth_token_secret=synthetic-secret&oauth_callback_confirmed=true'));
    const service = new FatSecretService(db, new PrismaTodayAggregateRepository(db), config, fetcher, now);
    await expect(service.createAuthorizationUrl(user, 'caloriebank://integrations')).resolves.toContain('oauth_token=synthetic');
    expect(await db.externalProviderOAuthAttempt.count({ where: { userId: user.id } })).toBe(1);
  });
  it('blocks pending callback completion before exchange without consuming or creating records', async () => {
    const user = await account(true);
    const fetcher = vi.fn(async () => new Response('oauth_token=synthetic&oauth_token_secret=synthetic-secret&oauth_callback_confirmed=true'));
    const service = new FatSecretService(db, new PrismaTodayAggregateRepository(db), config, fetcher, now);
    await service.createAuthorizationUrl(user, 'caloriebank://integrations');
    config.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS = ''; // explicit synthetic membership removal; no record mutation
    await expect(service.completeAuthorization('synthetic', 'synthetic')).rejects.toMatchObject({ statusCode: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await db.externalProviderConnection.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.externalProviderOAuthAttempt.findFirstOrThrow({ where: { userId: user.id } })).consumedAt).toBeNull();
  });
  it('blocks direct and native FatSecret selection without touching authority, history or ledger', async () => {
    const user = await account(); await connection(user.id);
    await repo().update(user, input);
    const before = await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } });
    for (const next of [ { ...input, authoritativeIntakeProvider: 'fatsecret' as const },
      { ...input, nativeIntakeSource: { namespace: 'android_package' as const, id: 'com.fatsecret.android' } },
      { ...input, authoritativeIntakeProvider: 'apple_health' as const, appleHealthIntakeWriter: { bundleIdentifier: 'com.fatsecret.caloriecounter', displayName: 'FatSecret' } } ]) {
      await expect(repo().update(user, next)).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(await db.providerSelection.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(before);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.bankAccountInitialization.count({ where: { userId: user.id } })).toBe(0);
  });
  it('keeps legacy FatSecret authority, credentials and selected row visible', async () => {
    const user = await account(true); const saved = await connection(user.id);
    await repo().update(user, { ...input, authoritativeIntakeProvider: 'fatsecret' });
    const health = await repo().getHealthConnections(user.id);
    expect(health.eaten.selected?.label).toBe('FatSecret');
    expect(health.intakeAvailability).toEqual({ fatSecret: true });
    expect(await db.externalProviderConnection.findUnique({ where: { id: saved.id } })).toEqual(saved);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
  });
  it('allows independent Cronometer and manual authority without creating provider or bank records', async () => {
    const user = await account();
    await repo().update(user, input);
    expect((await repo().get(user.id)).intake.nativeIntakeSource?.id).toBe('com.cronometer.android.gold');
    const manual = new ManualIntakeRepository(db, true, now);
    await manual.mutate(user.id, { operation: 'select', calories: 2200, expectedRevision: 0, selectionRevision: (await repo().get(user.id)).intake.selectionRevision! });
    const today = await new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, publicIntakeConfig: config, now }).getTodayForUser(user.id, '2026-10-24', 'UTC');
    expect(today.eaten.authoritative?.semanticKind).toBe('estimated_total_day_intake');
    expect(today.eaten.calories).toBe(2200);
    expect(await db.externalProviderConnection.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: user.id } })).toBe(0);
  });
  it('rejects native FatSecret ingestion before a session or aggregate write', async () => {
    const user = await account(); const app = express(); app.use(express.json());
    app.use('/native', createNativeIntakeRouter(db, user, undefined, now, config)); app.use(errorHandler);
    const batch: NativeIntakeBatch = { source: { namespace: 'android_package', id: 'com.fatsecret.android' }, selectionRevision: '2026-10-24T11:00:00Z', queryStartedAt: '2026-10-24T11:59:00Z', observedAt: '2026-10-24T11:59:01Z', timezone: 'UTC', days: openingImportDates('2026-10-24').map(localDate => ({ localDate, quality: 'usable_evidence', totalCaloriesConsumed: 2000, providerUpdatedAt: null })) };
    await request(app).post('/native').send(batch).expect(403);
    expect(await db.ingestionSyncSession.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: user.id } })).toBe(0);
  });
  it('accepts exact Apple Health intake but rejects FatSecret-origin input before storage', async () => {
    const user = await account();
    await repo().update(user, { ...input, authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriter: { bundleIdentifier: 'com.cronometer', displayName: 'Cronometer' } });
    const today = new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false, publicIntakeConfig: config, now });
    const aggregate = normalizeDailyIntakeAggregate({ userId: user.id, localDate: '2026-10-24', timezone: 'UTC', provider: 'apple_health', providerRecordId: 'synthetic', totalCaloriesConsumed: 1800, importedAt: now(), providerUpdatedAt: null, syncStatus: 'ready', isCurrentDay: true, writerBundleIdentifier: 'com.cronometer', writerDisplayName: 'Cronometer' });
    await today.upsertIntakeAggregate(user, aggregate);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: user.id } })).toBe(1);
    await expect(today.upsertIntakeAggregate(user, { ...aggregate, writerBundleIdentifier: 'com.fatsecret.caloriecounter', writerDisplayName: 'FatSecret' })).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.dailyIntakeAggregate.count({ where: { userId: user.id } })).toBe(1);
  });
  it('preserves real finalized manual accounting across denied source changes and read projections', async () => {
    const user = await account(false, '2026-10-20T00:00:00Z');
    const manual = new ManualIntakeRepository(db, true, () => new Date('2026-10-23T18:00:00Z'));
    await manual.mutate(user.id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await db.providerSelection.update({ where: { userId: user.id }, data: { authoritativeExpenditureProvider: 'google_health_fitbit', expenditureSelected: true } });
    await db.goalConfiguration.create({ data: { userId: user.id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
    await db.dailyExpenditureAggregate.create({ data: { userId: user.id, localDate: new Date('2026-10-23T00:00:00Z'), timezone: 'UTC', provider: 'google_health_fitbit', providerRecordId: 'synthetic-burn', rawTotalDailyExpenditure: 4000, adjustedDailyExpenditure: 3200, adjustmentFactor: 0.8, importedAt: now(), syncStatus: 'ready', isCurrentDay: false } });
    const bank = new PrismaBankHistoryRepository(db, { now });
    await bank.reconcileStoredDay(user, '2026-10-23', 'UTC');
    const before = await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } });
    expect(before).toHaveLength(1);
    const records = await db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } });
    const summary = await bank.getSummary(user.id);
    const opening = await db.bankAccountInitialization.findUnique({ where: { userId: user.id } });
    await expect(repo().update(user, { ...input, authoritativeIntakeProvider: 'fatsecret' })).rejects.toMatchObject({ statusCode: 403 });
    await repo().get(user.id); await repo().getHealthConnections(user.id);
    expect(await bank.getSummary(user.id)).toEqual(summary);
    expect(await db.calorieLedgerTransaction.findMany({ where: { userId: user.id } })).toEqual(before);
    expect(await db.finalizedDailyBankRecord.findMany({ where: { userId: user.id } })).toEqual(records);
    expect(await db.bankAccountInitialization.findUnique({ where: { userId: user.id } })).toEqual(opening);
  });
  it('never resolves an unknown provider as FatSecret or blocks unrelated authority', async () => {
    const user = await account();
    await expect(requirePublicIntakeSource(db, user.id, { provider: 'manual_estimate' }, config)).resolves.toBeUndefined();
    await expect(requirePublicIntakeSource(db, user.id, { provider: 'apple_health', writerId: 'com.cronometer' }, config)).resolves.toBeUndefined();
  });
});
