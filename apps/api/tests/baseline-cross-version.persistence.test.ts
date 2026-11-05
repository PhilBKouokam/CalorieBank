import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { todayResponseSchema } from '@caloriebank/schemas';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { GoogleHealthFitbitService } from '../src/modules/google-health/google-health.service';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import { parseApiEnv } from '../src/env';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';
const roots = { old: process.env.CALORIEBANK_COMPAT_OLD_API_ROOT, worker: process.env.CALORIEBANK_COMPAT_OLD_WORKER_ROOT, final: process.env.CALORIEBANK_COMPAT_FINAL_ROOT };
const enabled = Object.values(roots).every(Boolean);
const expected = { old: 'a81630154422d566ca7db87e7daa85ed66c9d021', worker: 'c3ca95a094194feec2a031f229137f0c612d7dc9', final: '4c557a8158e2a212491ced7d7d0052303a68da81' };
const db = new PrismaClient();
afterAll(() => db.$disconnect());
async function loadVersion(key: keyof typeof roots) {
  const root = roots[key]!;
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  expect(sha.startsWith(expected[key])).toBe(true);
  expect(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()).toBe('');
  const reader = await import(`${root}/apps/api/src/modules/today/today.repository.ts`) as { PrismaTodayAggregateRepository: typeof PrismaTodayAggregateRepository };
  const service = await import(`${root}/apps/api/src/modules/google-health/google-health.service.ts`) as { GoogleHealthFitbitService: typeof GoogleHealthFitbitService };
  const schema = await import(`${root}/packages/schemas/src/index.ts`) as { todayResponseSchema: typeof todayResponseSchema };
  return { ...reader, ...service, ...schema };
}
describe.skipIf(!enabled)('exact-source baseline reader/writer transition matrix (synthetic only)', () => {
  it('exercises old, transition and final readers against the same persisted rows and actual public schemas', async () => {
    const old = await loadVersion('old'), final = await loadVersion('final');
    const userId = randomUUID(), now = new Date(), date = now.toISOString().slice(0, 10), localDate = new Date(`${date}T00:00:00Z`), provider = 'google_health_fitbit';
    const options = { allowSyntheticProviders: false, now: () => now };
    const readers = { old: new old.PrismaTodayAggregateRepository(db, options), compat: new PrismaTodayAggregateRepository(db, options), final: new final.PrismaTodayAggregateRepository(db, options) };
    try {
      await db.user.create({ data: { id: userId, email: `compat-${userId}@caloriebank.local`, providerSelection: { create: { authoritativeExpenditureProvider: provider, authoritativeActivityProvider: provider, authoritativeIntakeProvider: 'fatsecret' } } } });
      const session = await db.ingestionSyncSession.create({ data: { userId, provider, localDate, timezone: 'UTC', trigger: 'app_foreground', startedAt: now, completedAt: now, status: 'completed' } });
      const common = { userId, provider, localDate, timezone: 'UTC', importedAt: now, providerUpdatedAt: now, isCurrentDay: true, syncStatus: 'ready' as const, syncSessionId: session.id };
      await db.dailyExpenditureAggregate.create({ data: { ...common, forecastCoverageAt: now, providerRecordId: 'burn', rawTotalDailyExpenditure: 3000, adjustedDailyExpenditure: 2400, adjustmentFactor: .8 } });
      await db.dailyStepAggregate.create({ data: { ...common, providerRecordId: 'steps', totalSteps: 10000 } });
      await db.restingBurnEstimate.create({ data: { userId, provider, providerKcalPerHour: 80, evidenceType: 'historical_low_activity_hours', observationCount: 3, lookbackStartDate: localDate, lookbackEndDate: localDate, calculatedAt: now } });
      for (const tag of ['historical_low_activity_hours', 'historical_low_activity_hours_v2', 'future_unknown']) {
        await db.restingBurnEstimate.update({ where: { userId }, data: { evidenceType: tag } });
        const a = await readers.old.getTodayForUser(userId, date, 'UTC'), b = await readers.compat.getTodayForUser(userId, date, 'UTC'), c = await readers.final.getTodayForUser(userId, date, 'UTC');
        expect(old.todayResponseSchema.safeParse(a).success).toBe(tag === 'historical_low_activity_hours');
        expect(todayResponseSchema.safeParse(b).success).toBe(true);
        expect(final.todayResponseSchema.safeParse(c).success).toBe(true);
        expect(b.restOfDayProjection.status).toBe(tag === 'future_unknown' ? 'insufficient_data' : 'ready');
        expect(c.restOfDayProjection.status).toBe(tag === 'historical_low_activity_hours_v2' ? 'ready' : 'insufficient_data');
        expect(b.burned.raw).toBe(3000); expect(c.burned.raw).toBe(3000);
        if (tag === 'future_unknown') expect(b.restOfDayProjection.projectedAdjustedBurnCalories).toBeNull();
      }
      expect(await db.calorieLedgerTransaction.count({ where: { userId } })).toBe(0);
    } finally { await db.user.deleteMany({ where: { id: userId } }); }
  }, 30_000);

  it.each(['fresh', 'expired', 'race'] as const)('executes the old worker sync baseline producer with %s v2 state', async scenario => {
    const version = await loadVersion('worker');
    const fixture = makeWriterFixture(scenario === 'fresh' ? 'historical_low_activity_hours_v2' : 'historical_low_activity_hours', scenario === 'fresh' ? 0 : 8);
    if (scenario !== 'fresh') fixture.replace('historical_low_activity_hours_v2', 8);
    if (scenario === 'race') fixture.onFetch(() => fixture.replace('historical_low_activity_hours_v2', 0));
    const service = new version.GoogleHealthFitbitService(fixture.db, fixture.repo, fixture.config, undefined, fixture.fetcher, () => fixture.now);
    // Isolate the real sync entry point's model producer; zero daily dates and
    // five retained synthetic workouts avoid unrelated ingestion acquisition.
    await service.syncRollingWindow(fixture.user, fixture.date, 'UTC', true, 0);
    expect(fixture.row().evidenceType).toBe(scenario === 'fresh' ? 'historical_low_activity_hours_v2' : 'historical_low_activity_hours');
    expect(fixture.stored).toHaveBeenCalledTimes(scenario === 'fresh' ? 0 : 1);
    if (scenario === 'fresh') expect(fixture.fetcher).not.toHaveBeenCalled();
  }, 30_000);
  it.each(['compat', 'final', 'failed'] as const)('executes %s producer without pretending reader compatibility qualifies legacy evidence', async scenario => {
    const version = scenario === 'compat' ? { GoogleHealthFitbitService } : await loadVersion('final');
    const fixture = makeWriterFixture('historical_low_activity_hours', scenario === 'compat' ? 8 : 0);
    if (scenario === 'failed') fixture.fail();
    const before = { ...fixture.row() };
    const service = new version.GoogleHealthFitbitService(fixture.db, fixture.repo, fixture.config, undefined, fixture.fetcher, () => fixture.now);
    if (scenario === 'failed') {
      await expect(service.resolveRestingBurnEstimate(fixture.user, fixture.date, 'UTC')).rejects.toThrow('synthetic unavailable');
      expect(fixture.row()).toEqual(before); expect(fixture.stored).not.toHaveBeenCalled();
    } else {
      expect(await service.resolveRestingBurnEstimate(fixture.user, fixture.date, 'UTC')).toBe(true);
      expect(fixture.row().evidenceType).toBe(scenario === 'compat' ? 'historical_low_activity_hours' : 'historical_low_activity_hours_v2');
    }
  }, 30_000);
});
function makeWriterFixture(tag: string, ageDays: number) {
  const now = new Date('2026-11-04T12:00:00Z'), date = '2026-11-04', key = Buffer.alloc(32, 7).toString('base64');
  let row = { provider: 'google_health_fitbit', evidenceType: tag, providerKcalPerHour: 70, observationCount: 3, calculatedAt: new Date(now.getTime() - ageDays * 86400000), lookbackStartDate: now, lookbackEndDate: now };
  let onFetch: (() => void) | undefined, failed = false;
  const connection = { status: 'connected', accessTokenExpiresAt: new Date('2026-11-05T12:00:00Z'), encryptedAccessToken: encryptGoogleHealthSecret('synthetic', key) };
  const fakeDb = {
    providerSelection: { findUnique: vi.fn(async () => ({ authoritativeExpenditureProvider: 'google_health_fitbit' })) },
    googleHealthConnection: { findUnique: vi.fn(async () => connection), update: vi.fn(async () => connection) },
    restingBurnEstimate: { findUnique: vi.fn(async () => row) },
    ingestionSyncSession: { create: vi.fn(async () => ({ id: 'synthetic-session' })), update: vi.fn(async () => ({})) },
    currentDayWorkout: { count: vi.fn(async () => 5) },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  } as unknown as PrismaClient;
  const stored = vi.fn(async (_user: unknown, value: typeof row) => { row = { ...row, ...value }; });
  const repo = { upsertRestingBurnEstimate: stored } as unknown as TodayAggregateRepository;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    if (failed) throw new Error('synthetic unavailable');
    onFetch?.(); onFetch = undefined;
    const url = new URL(String(input)); expect(url.origin).toBe('https://health.googleapis.com');
    if (url.pathname.endsWith('/exercise/dataPoints')) return Response.json({ dataPoints: [] });
    const points = [1, 2, 3].map(hour => ({ startTime: `2026-11-03T0${hour}:00:00Z`, endTime: `2026-11-03T0${hour + 1}:00:00Z`, ...(url.pathname.includes('/total-calories/') ? { totalCalories: { kcalSum: 70 } } : { steps: { countSum: 0 } }) }));
    if (url.pathname.endsWith('/dataPoints:rollUp')) return Response.json({ rollupDataPoints: points });
    throw new Error('Unexpected synthetic transport route');
  }) as unknown as typeof fetch;
  return { now, date, db: fakeDb, repo, stored, fetcher, user: { id: 'synthetic-owner', email: 'synthetic@example.invalid' }, config: parseApiEnv({ NODE_ENV: 'test', GOOGLE_HEALTH_CLIENT_ID: 'synthetic', GOOGLE_HEALTH_CLIENT_SECRET: 'synthetic', GOOGLE_HEALTH_REDIRECT_URI: 'http://localhost/callback', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key }), row: () => row, replace: (evidenceType: string, days: number) => { row = { ...row, evidenceType, calculatedAt: new Date(now.getTime() - days * 86400000) }; }, onFetch: (callback: () => void) => { onFetch = callback; }, fail: () => { failed = true; } };
}
