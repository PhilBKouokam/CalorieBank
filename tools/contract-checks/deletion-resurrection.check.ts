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
    const replacement = await resolveVerifiedClerkIdentity(db, config, { subject: newSubject, email: owner.email });
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
