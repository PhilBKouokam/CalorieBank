/** Explicit synthetic localhost check, outside the ordinary API test glob. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { AccountSafetyService } from '../../apps/api/src/modules/account-safety/account-safety.service';
import { PrismaDashboardPreferencesRepository } from '../../apps/api/src/modules/dashboard-preferences/dashboard-preferences.repository';
import { resolveVerifiedClerkIdentity } from '../../apps/api/src/auth/current-user';
import type { ApiEnv } from '../../apps/api/src/env';
import { PrismaSyncSessionRepository } from '../../apps/api/src/modules/today/sync-session.repository';
import { PrismaTodayAggregateRepository } from '../../apps/api/src/modules/today/today.repository';
import { normalizeDailyExpenditureAggregate } from '@caloriebank/domain';
import { GoogleHealthFitbitService } from '../../apps/api/src/modules/google-health/google-health.service';
import { AccountLifecycleCoordinator } from '../../apps/api/src/modules/lifecycle/account-lifecycle.service';
import { localDevelopmentApiEnv } from '../../apps/api/tests/support/test-api-env';

const raw = process.env.TEST_DELETION_DATABASE_URL;
assert(raw, 'TEST_DELETION_DATABASE_URL_REQUIRED');
const url = new URL(raw);
assert(['postgres:', 'postgresql:'].includes(url.protocol));
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert(/^\/caloriebank_test_deletion_[a-z0-9_]+$/.test(url.pathname));
assert(!url.search && !url.hash);
const db = new PrismaClient({ datasources: { db: { url: raw } } });

test('completed deletion must reject a paused stale dashboard request instead of recreating its User', async () => {
  const connection = await db.$queryRaw<{ name: string; host: string | null }[]>`
    SELECT current_database() AS name, host(inet_server_addr()) AS host`;
  assert.equal(connection[0]?.name, url.pathname.slice(1));
  assert(connection[0]?.host === null || ['127.0.0.1', '::1'].includes(connection[0]?.host ?? ''));
  const owner = { id: randomUUID(), email: `deletion-synthetic-${randomUUID()}@example.invalid` };
  const oldSubject = `synthetic-old-${randomUUID()}`, newSubject = `synthetic-new-${randomUUID()}`;
  const cleanupIds: string[] = [owner.id];
  let resume!: () => void, entered!: () => void;
  const paused = new Promise<void>(resolve => { entered = resolve; });
  const released = new Promise<void>(resolve => { resume = resolve; });
  // Pause after request ownership was captured, before the actual repository upsert.
  const requestDb = new Proxy(db, { get(target, key) {
    if (key !== 'user') return Reflect.get(target, key, target);
    return new Proxy(target.user, { get(delegate, method) {
      if (method === 'upsert') return async (...args: Parameters<typeof db.user.upsert>) => {
        entered(); await released; return db.user.upsert(...args);
      };
      if (method === 'updateMany') return async (...args: Parameters<typeof db.user.updateMany>) => {
        entered(); await released; return db.user.updateMany(...args);
      };
      return Reflect.get(delegate, method, delegate);
    } });
  } });
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const identityDeleted: string[] = [];
  try {
    await db.user.create({ data: { ...owner, authProvider: 'clerk', authSubject: oldSubject,
      profile: { create: { timezone: 'UTC', onboardingCompletedAt: new Date('2026-10-20T12:00:00Z') } },
      bankAccountInitialization: { create: {} }, dashboardPreferences: { create: {} } } });
    const staleRequest = new PrismaDashboardPreferencesRepository(requestDb).get(owner)
      .then(() => ({ status: 'fulfilled' as const }), () => ({ status: 'rejected' as const }));
    await paused;
    // Real deletion service and database cascade; external identity/provider ports are synthetic.
    await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined },
      async subject => { identityDeleted.push(subject); }).deleteAccount(owner);
    assert.deepEqual(identityDeleted, [oldSubject]);
    assert.equal(await db.user.findUnique({ where: { id: owner.id } }), null);
    assert.equal(await db.bankAccountInitialization.count({ where: { userId: owner.id } }), 0);
    const replacement = await resolveVerifiedClerkIdentity(db, config, { subject: newSubject, email: owner.email }, async () => ({ subject: newSubject, email: owner.email }));
    cleanupIds.push(replacement.id);
    assert.notEqual(replacement.id, owner.id);
    resume();
    const outcome = await staleRequest;
    const old = await db.user.findUnique({ where: { id: owner.id }, include: { profile: true } });
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: replacement.id } })).authSubject, newSubject);
    if (process.env.REPRO_EXPECT_UNSAFE === '1') {
      assert.equal(outcome.status, 'fulfilled'); assert(old);
      assert.equal(old.authSubject, null); assert.equal(old.authProvider, null);
      assert.equal(old.profile?.onboardingCompletedAt, null);
      assert.equal(await db.bankAccountInitialization.count({ where: { userId: owner.id } }), 0);
      assert.equal(await db.calorieLedgerTransaction.count({ where: { userId: owner.id } }), 0);
      assert.equal(await db.finalizedDailyBankRecord.count({ where: { userId: owner.id } }), 0);
      console.info('CONFIRMED: stale repository request recreates deleted UUID with no authenticated subject or accounting initialization');
    } else {
      assert.equal(outcome.status, 'rejected', 'STALE_REQUEST_MUST_REJECT_AFTER_COMPLETED_DELETION');
      assert.equal(old, null, 'DELETED_USER_MUST_STAY_ABSENT');
    }
  } finally {
    resume();
    await db.user.deleteMany({ where: { id: { in: cleanupIds } } });
    await db.$disconnect();
  }
});

test('deletion intent rejects dashboard, sync-session and ingestion work without changing the account', async () => {
  const owner = { id: randomUUID(), email: `deletion-synthetic-${randomUUID()}@example.invalid` };
  const deletionRequestedAt = new Date('2026-10-21T12:00:00Z');
  try {
    await db.user.create({ data: { ...owner, authProvider: 'clerk', authSubject: `synthetic-${randomUUID()}`,
      profile: { create: { timezone: 'UTC' } }, deletionRequestedAt } });
    const matchesUnavailable = (error: unknown) => error !== null && typeof error === 'object'
      && 'details' in error && (error.details as { code?: string }).code === 'ACCOUNT_UNAVAILABLE';
    await assert.rejects(new PrismaDashboardPreferencesRepository(db).get(owner), matchesUnavailable);
    await assert.rejects(new PrismaSyncSessionRepository(db).start(owner, { provider: 'apple_health', localDate: '2026-10-21',
      timezone: 'UTC', trigger: 'app_foreground', datesQueried: ['2026-10-21'] }, deletionRequestedAt), matchesUnavailable);
    await assert.rejects(new PrismaTodayAggregateRepository(db, { allowSyntheticProviders: false }).upsertExpenditureAggregate(owner,
      normalizeDailyExpenditureAggregate({ userId: owner.id, provider: 'apple_health', providerRecordId: 'synthetic-burn',
        localDate: '2026-10-21', timezone: 'UTC', importedAt: deletionRequestedAt, providerUpdatedAt: deletionRequestedAt, isCurrentDay: true,
        rawTotalDailyExpenditure: 1000, syncStatus: 'ready' })), matchesUnavailable);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).deletionRequestedAt?.toISOString(), deletionRequestedAt.toISOString());
    assert.equal(await db.ingestionSyncSession.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.dailyExpenditureAggregate.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.dashboardPreferences.count({ where: { userId: owner.id } }), 0);
  } finally {
    await db.user.deleteMany({ where: { id: owner.id } }); await db.$disconnect();
  }
});

test('captured subject after completed deletion cannot provision when fresh identity authority rejects it', async () => {
  const identity = { subject: `synthetic-captured-${randomUUID()}`, email: `deletion-synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const cleanupIds: string[] = [];
  try {
    const original = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
    cleanupIds.push(original.id);
    // Resolver-only characterization, not the complete production boundary:
    // production first checks the mapping, then fetches Clerk only if absent.
    // This models a previously captured identity; it does not prove that a
    // post-deletion JWT passes that network check or this production interleaving.
    const capturedIdentity = { ...identity };
    const deletedSubjects: string[] = [];
    await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined },
      async subject => { deletedSubjects.push(subject); }).deleteAccount(original);
    assert.deepEqual(deletedSubjects, [identity.subject]);
    assert.equal(await db.user.findUnique({ where: { id: original.id } }), null);
    // Deliberately unchanged resolver: no re-verification/network/tombstone policy added.
    await assert.rejects(resolveVerifiedClerkIdentity(db, config, capturedIdentity, async () => null),
      (error: unknown) => error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401);
    assert.equal(await db.user.count({ where: { authSubject: identity.subject } }), 0);
  } finally {
    await db.user.deleteMany({ where: { id: { in: cleanupIds } } }); await db.$disconnect();
  }
});

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('deletion lock wins: two independent deleters and a captured identity cannot recreate after identity removal', async () => {
  const identity = { subject: `synthetic-lock-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const entered = barrier(), finish = barrier();
  let exists = true, freshCalls = 0;
  const owner = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
  const revoker = { revokeForAccountDeletion: async () => undefined };
  const remove = async () => { entered.release(); await finish.promise; exists = false; };
  try {
    const deletionA = new AccountSafetyService(db, config, revoker, remove).deleteAccount(owner);
    await entered.promise;
    const deletionB = new AccountSafetyService(db, config, revoker, remove).deleteAccount(owner);
    const stale = assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => { freshCalls++; return exists ? identity : null; }));
    // The different subject must be independent of the held deletion lock.
    const unrelated = { subject: `synthetic-other-${randomUUID()}`, email: identity.email };
    const other = await resolveVerifiedClerkIdentity(db, config, unrelated, async () => unrelated);
    await db.user.deleteMany({ where: { id: other.id } });
    assert.equal(freshCalls, 0, 'fresh identity cannot run outside the held lock');
    finish.release();
    await Promise.all([deletionA, deletionB]);
    await stale;
    assert.equal(await db.user.count({ where: { authSubject: identity.subject } }), 0);
    // Worker-style retry after completed deletion is an idempotent success.
    await new AccountSafetyService(db, config, revoker, remove).deleteAccount(owner);
  } finally { finish.release(); await db.user.deleteMany({ where: { authSubject: identity.subject } }); }
});

test('concurrent provisioning converges; subsequent deletion denies the captured subject while a new subject succeeds', async () => {
  const identity = { subject: `synthetic-provision-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const entered = barrier(), finish = barrier();
  let exists = true;
  const provisioning = resolveVerifiedClerkIdentity(db, config, identity, async () => { entered.release(); await finish.promise; return identity; });
  await entered.promise;
  const waiting = resolveVerifiedClerkIdentity(db, config, identity, async () => { throw new Error('must converge on existing mapping'); });
  try {
    finish.release();
    const owner = await provisioning;
    assert.deepEqual(await waiting, owner);
    await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined }, async () => { exists = false; }).deleteAccount(owner);
    await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => exists ? identity : null));
    const newIdentity = { ...identity, subject: `synthetic-new-${randomUUID()}` };
    const replacement = await resolveVerifiedClerkIdentity(db, config, newIdentity, async () => newIdentity);
    assert.notEqual(replacement.id, owner.id);
    assert.equal(await db.calorieLedgerTransaction.count({ where: { userId: replacement.id } }), 0);
    assert.equal(await db.finalizedDailyBankRecord.count({ where: { userId: replacement.id } }), 0);
    await db.user.deleteMany({ where: { id: replacement.id } });
  } finally { finish.release(); await db.user.deleteMany({ where: { authSubject: identity.subject } }); }
});

test('interrupted local cascade retains intent after remote success; independent worker resumes on identity 404', async () => {
  const identity = { subject: `synthetic-interrupted-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const owner = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
  let exists = true;
  const interrupted = new Proxy(db, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key, target);
    return (operation: (tx: unknown) => Promise<unknown>, options: object) => db.$transaction(tx => operation(new Proxy(tx, { get(transaction, name) {
      if (name !== 'user') return Reflect.get(transaction, name, transaction);
      return new Proxy(transaction.user, { get(delegate, method) {
        if (method === 'deleteMany') return async () => { throw new Error('synthetic interrupted cascade'); };
        return Reflect.get(delegate, method, delegate);
      } });
    } })), options);
  } });
  try {
    await assert.rejects(new AccountSafetyService(interrupted, config, { revokeForAccountDeletion: async () => undefined }, async () => { exists = false; }).deleteAccount(owner));
    assert.equal(exists, false);
    assert((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).deletionRequestedAt);
    await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => identity));
    await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined }, async () => { throw { status: 404 }; }).resumePendingDeletions();
    assert.equal(await db.user.findUnique({ where: { id: owner.id } }), null);
  } finally { await db.user.deleteMany({ where: { id: owner.id } }); }
});

test('fresh identity failure, mismatch and unavailable service never provision a captured subject', async () => {
  const identity = { subject: `synthetic-fail-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => { throw { status: 404 }; }));
  await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => { throw { status: 503 }; }));
  await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => ({ ...identity, subject: 'wrong-subject' })));
  assert.equal(await db.user.count({ where: { authSubject: identity.subject } }), 0);
});

for (const mode of ['intent', 'completed', 'consumed', 'expired'] as const) {
  test(`callback response after deletion ${mode} cannot persist connection or restore account`, async () => {
    const identity = { subject: `synthetic-callback-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
    const config = { ...localDevelopmentApiEnv(), AUTH_MODE: 'clerk' as const, APP_ENV: 'beta' as const,
      GOOGLE_HEALTH_CLIENT_ID: 'synthetic', GOOGLE_HEALTH_CLIENT_SECRET: 'synthetic',
      GOOGLE_HEALTH_REDIRECT_URI: 'https://example.invalid/callback',
      GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64') };
    const owner = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
    const entered = barrier(), finish = barrier();
    let requests = 0;
    const service = new GoogleHealthFitbitService(db, {} as never, config, undefined, async () => {
      requests++;
      if (requests === 1) return Response.json({ access_token: 'synthetic', refresh_token: 'synthetic', expires_in: 3600 });
      entered.release(); await finish.promise;
      return Response.json({ healthUserId: 'synthetic-health-id' });
    });
    try {
      const authorization = await service.createAuthorizationUrl(owner, 'caloriebank://integrations');
      const state = new URL(authorization).searchParams.get('state'); assert(state);
      const callback = assert.rejects(service.completeAuthorization('synthetic-code', state));
      await entered.promise;
      if (mode === 'intent') await db.user.update({ where: { id: owner.id }, data: { deletionRequestedAt: new Date() } });
      else if (mode === 'completed') await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined }, async () => undefined).deleteAccount(owner);
      else await db.googleHealthOAuthAttempt.updateMany({ where: { userId: owner.id }, data: mode === 'consumed' ? { consumedAt: new Date() } : { expiresAt: new Date(0) } });
      finish.release(); await callback;
      assert.equal(await db.googleHealthConnection.count({ where: { userId: owner.id } }), 0);
      assert.equal(await db.user.count({ where: { id: owner.id } }), mode === 'completed' ? 0 : 1);
      assert.equal(await db.calorieLedgerTransaction.count({ where: { userId: owner.id } }), 0);
    } finally { finish.release(); await db.user.deleteMany({ where: { id: owner.id } }); }
  });
}

test('subject lock contention times out without provisioning and is retryable after lock release', async () => {
  const identity = { subject: `synthetic-timeout-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const entered = barrier(), finish = barrier();
  let freshCalls = 0;
  const lock = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1128417100, hashtext(${identity.subject}))::text`;
    entered.release(); await finish.promise;
  }, { timeout: 15_000 });
  try {
    await entered.promise;
    await assert.rejects(resolveVerifiedClerkIdentity(db, config, identity, async () => { freshCalls++; return identity; }));
    assert.equal(freshCalls, 0);
    assert.equal(await db.user.count({ where: { authSubject: identity.subject } }), 0);
    finish.release(); await lock;
    const recovered = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
    await db.user.deleteMany({ where: { id: recovered.id } });
  } finally { finish.release(); await lock; await db.user.deleteMany({ where: { authSubject: identity.subject } }); }
});

test('callback persistence wins: deletion revokes the committed connection then cascades it', async () => {
  const identity = { subject: `synthetic-callback-wins-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { ...localDevelopmentApiEnv(), AUTH_MODE: 'clerk' as const, APP_ENV: 'beta' as const,
    GOOGLE_HEALTH_CLIENT_ID: 'synthetic', GOOGLE_HEALTH_CLIENT_SECRET: 'synthetic',
    GOOGLE_HEALTH_REDIRECT_URI: 'https://example.invalid/callback', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64') };
  const owner = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
  const entered = barrier(), finish = barrier();
  const callbackDb = new Proxy(db, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key, target);
    return (operation: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => operation(new Proxy(tx, { get(transaction, name) {
      if (name !== 'googleHealthConnection') return Reflect.get(transaction, name, transaction);
      return new Proxy(transaction.googleHealthConnection, { get(delegate, method) {
        if (method === 'upsert') return async (...args: Parameters<typeof delegate.upsert>) => {
          const result = await delegate.upsert(...args); entered.release(); await finish.promise; return result;
        };
        return Reflect.get(delegate, method, delegate);
      } });
    } })));
  } });
  let requests = 0, revokedConnectionCount = -1;
  const service = new GoogleHealthFitbitService(callbackDb, {} as never, config, undefined, async () => ++requests === 1
    ? Response.json({ access_token: 'synthetic', refresh_token: 'synthetic', expires_in: 3600 })
    : Response.json({ healthUserId: 'synthetic-health-id' }));
  try {
    const state = new URL(await service.createAuthorizationUrl(owner, 'caloriebank://integrations')).searchParams.get('state'); assert(state);
    const callback = service.completeAuthorization('synthetic', state);
    await entered.promise;
    const deletion = new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => {
      revokedConnectionCount = await db.googleHealthConnection.count({ where: { userId: owner.id } });
    } }, async () => undefined).deleteAccount(owner);
    finish.release(); await Promise.all([callback, deletion]);
    assert.equal(revokedConnectionCount, 1, 'revocation must observe the callback connection committed before intent');
    assert.equal(await db.user.count({ where: { id: owner.id } }), 0);
    assert.equal(await db.googleHealthConnection.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.googleHealthOAuthAttempt.count({ where: { userId: owner.id } }), 0);
  } finally { finish.release(); await db.user.deleteMany({ where: { id: owner.id } }); }
});


test('actual worker selected before completed deletion stops without provider, finalization or notification work', async () => {
  const identity = { subject: `synthetic-worker-${randomUUID()}`, email: `synthetic-${randomUUID()}@example.invalid` };
  const config = { AUTH_MODE: 'clerk', APP_ENV: 'beta' } as ApiEnv;
  const owner = await resolveVerifiedClerkIdentity(db, config, identity, async () => identity);
  await db.userProfile.update({ where: { userId: owner.id }, data: { timezone: 'UTC', onboardingCompletedAt: new Date() } });
  const entered = barrier(), finish = barrier();
  let selectedCount = -1;
  const workerDb = new Proxy(db, { get(target, key) {
    if (key !== 'userProfile') return Reflect.get(target, key, target);
    return new Proxy(target.userProfile, { get(delegate, method) {
      if (method === 'findMany') return async (args: Parameters<typeof delegate.findMany>[0]) => {
        // The actual coordinator query/eligibility predicate is preserved, but
        // constrained to this one synthetic owner so no other fixture can run.
        const profiles = await delegate.findMany({ ...args, where: { AND: [args?.where ?? {}, { userId: owner.id }] } });
        selectedCount = profiles.length; entered.release(); await finish.promise;
        return profiles;
      };
      return Reflect.get(delegate, method, delegate);
    } });
  } });
  const calls: string[] = [];
  const forbidden = (name: string) => async () => { calls.push(name); throw new Error(`unexpected synthetic port: ${name}`); };
  const coordinator = new AccountLifecycleCoordinator(workerDb,
    { getAccountingStartDate: forbidden('bank_history') } as never,
    { execute: forbidden('finalization') } as never,
    { syncRollingWindow: forbidden('fitbit') } as never,
    { syncRollingWindow: forbidden('fatsecret') } as never,
    undefined,
    { reconcileReceipts: async () => undefined, deliverForUser: forbidden('notification') });
  try {
    const job = coordinator.runDueAccounts();
    await entered.promise; assert.equal(selectedCount, 1);
    await new AccountSafetyService(db, config, { revokeForAccountDeletion: async () => undefined }, async () => undefined).deleteAccount(owner);
    assert.equal(await db.user.findUnique({ where: { id: owner.id } }), null);
    finish.release();
    const result = await job;
    assert.equal(result.userCount, 1); assert.equal(result.completedCount, 0); assert.equal(result.failedCount, 1);
    assert.deepEqual(calls, []);
    assert.equal(await db.user.count({ where: { id: owner.id } }), 0);
    assert.equal(await db.dailyExpenditureAggregate.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.dailyIntakeAggregate.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.calorieLedgerTransaction.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.finalizedDailyBankRecord.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.bankAccountInitialization.count({ where: { userId: owner.id } }), 0);
  } finally { finish.release(); await db.user.deleteMany({ where: { id: owner.id } }); }
});
