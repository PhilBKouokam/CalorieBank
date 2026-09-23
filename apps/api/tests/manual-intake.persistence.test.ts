import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { intakeCapabilityBoundary } from '../src/security/intake-capability';
import { errorHandler } from '../src/errors';
import { createManualIntakeRouter } from '../src/modules/manual-intake/manual-intake.routes';
import { createProviderSelectionRouter } from '../src/modules/provider-selection/provider-selection.routes';
import { createHealthConnectionsRouter } from '../src/modules/provider-selection/health-connections.routes';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';
import { createTodayRouter } from '../src/modules/today/today.routes';
import { createBankHistoryRouter } from '../src/modules/bank-history/bank-history.routes';
import { openingImportDates } from '../src/modules/bank-history/opening-bank-import';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { ManualIntakeRepository, resolveManualIntake } from '../src/modules/manual-intake/manual-intake.repository';
import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { resolveIntakeAuthority } from '../src/modules/provider-selection/intake-authority';
import { PrismaOnboardingRepository } from '../src/modules/onboarding/onboarding.repository';
import { createOnboardingRouter } from '../src/modules/onboarding/onboarding.routes';
import { AccountLifecycleCoordinator } from '../src/modules/lifecycle/account-lifecycle.service';
import { createAccountLifecycleRouter } from '../src/modules/lifecycle/account-lifecycle.routes';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.includes('test')) {
  throw new Error('Manual persistence tests require a dedicated localhost TEST_DATABASE_URL.');
}
const db = new PrismaClient({ datasourceUrl: url });
const ids: string[] = [];
async function account() {
  const id = randomUUID(); ids.push(id);
  await db.user.create({ data: { id, email: `${id}@test.local`, profile: { create: { timezone: 'America/Chicago' } } } });
  return id;
}
const date = (value: string) => new Date(`${value}T00:00:00Z`);

describe('manual estimate persistence', () => {
  afterEach(async () => { await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
  afterAll(async () => { await db.$disconnect(); });
  it('resolves applicable usual history, explicit zero, reset and tomorrow without fabricating older intake', async () => {
    const id = await account();
    let now = new Date('2026-09-23T18:00:00Z');
    const repo = new ManualIntakeRepository(db, true, () => now);
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    expect(await resolveManualIntake(db, id, date('2026-09-22'))).toBeNull();
    const zero = await repo.mutate(id, { operation: 'today', calories: 0, expectedRevision: 1, localDate: '2026-09-23' });
    expect(zero).toMatchObject({ value: { calories: 0 }, usualCalories: 2500, overridden: true });
    await repo.mutate(id, { operation: 'reset', expectedRevision: 2, localDate: '2026-09-23' });
    expect(await resolveManualIntake(db, id, date('2026-09-23'))).toMatchObject({ value: { calories: 2500 }, overridden: false });
    now = new Date('2026-09-24T18:00:00Z');
    await repo.mutate(id, { operation: 'usual', calories: 2700, expectedRevision: 3, localDate: '2026-09-24' });
    expect(await resolveManualIntake(db, id, date('2026-09-23'))).toMatchObject({ value: { calories: 2500 } });
    expect(await resolveManualIntake(db, id, date('2026-09-25'))).toMatchObject({ value: { calories: 2700, semanticKind: 'estimated_total_day_intake' } });
    expect(await db.dailyIntakeAggregate.count({ where: { userId: id } })).toBe(0);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
  });
  it('preserves override when usual changes and never carries the override forward', async () => {
    const id = await account(), repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-23T18:00:00Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' });
    await repo.mutate(id, { operation: 'usual', calories: 2700, expectedRevision: 2, localDate: '2026-09-23' });
    expect(await resolveManualIntake(db, id, date('2026-09-23'))).toMatchObject({ value: { calories: 2900 }, usualCalories: 2700 });
    expect(await resolveManualIntake(db, id, date('2026-09-24'))).toMatchObject({ value: { calories: 2700 }, overridden: false });
  });
  it('converges duplicate saves and rejects stale or competing different edits', async () => {
    const id = await account(), repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-23T18:00:00Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    const input = { operation: 'today' as const, calories: 2900, expectedRevision: 1, localDate: '2026-09-23' };
    const results = await Promise.all([repo.mutate(id, input), repo.mutate(id, input)]);
    expect(results.map((r) => r.revision)).toEqual([2, 2]);
    expect(await db.manualIntakeOverride.count({ where: { userId: id } })).toBe(1);
    await expect(repo.mutate(id, { ...input, calories: 2700 })).rejects.toMatchObject({ statusCode: 409 });
    expect(await resolveManualIntake(db, id, date('2026-09-23'))).toMatchObject({ value: { calories: 2900 } });
  });
  it('holds new selection without partial state, but disabling enrollment preserves existing edits', async () => {
    const id = await account(), now = () => new Date('2026-09-23T18:00:00Z');
    const input = { operation: 'select' as const, calories: 2500, expectedRevision: 0, selectionRevision: null };
    await expect(new ManualIntakeRepository(db, false, now).mutate(id, input)).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.manualEstimateBoundary.count({ where: { userId: id } })).toBe(0);
    expect(await db.intakeAuthorityBoundary.count({ where: { userId: id } })).toBe(0);
    await new ManualIntakeRepository(db, true, now).mutate(id, input);
    await new ManualIntakeRepository(db, false, now).mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' });
  });
  it('isolates accounts and cascades all manual metadata on deletion', async () => {
    const id = await account(), other = await account(), repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-23T18:00:00Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' });
    expect(await resolveManualIntake(db, other, date('2026-09-23'))).toBeNull();
    await db.user.delete({ where: { id } });
    for (const count of await Promise.all([
      db.manualIntakeState.count({ where: { userId: id } }), db.manualEstimateBoundary.count({ where: { userId: id } }),
      db.manualIntakeOverride.count({ where: { userId: id } }), db.intakeAuthorityBoundary.count({ where: { userId: id } }),
    ])) expect(count).toBe(0);
  });
  it.each([['maintain', 0, 500], ['cut', -300, 200], ['bulk', 300, 800]] as const)('feeds Today and snapshots completed manual intake through existing %s accounting exactly once', async (goalMode, adjustment, contribution) => {
    const id = await account(), repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-23T18:00:00Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' });
    const today = await new PrismaTodayAggregateRepository(db).getTodayForUser(id, '2026-09-23', 'America/Chicago');
    expect(today.eaten).toMatchObject({ calories: 2900, source: 'CalorieBank estimate', estimateKind: 'today', authoritative: { semanticKind: 'estimated_total_day_intake' } });
    await db.providerSelection.update({ where: { userId: id }, data: { authoritativeExpenditureProvider: 'google_health_fitbit', expenditureSelected: true } });
    await db.goalConfiguration.create({ data: { userId: id, goalMode, adjustmentSource: 'manual_calories', dailyEnergyAdjustment: adjustment } });
    await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date('2026-09-23'), timezone: 'America/Chicago', provider: 'google_health_fitbit', providerRecordId: 'burn', rawTotalDailyExpenditure: 4250, adjustedDailyExpenditure: 3400, adjustmentFactor: 0.8, importedAt: new Date('2026-09-24T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-24T12:00:00Z') });
    await Promise.all([bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago'), bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago')]);
    expect(await db.bankCalculationSnapshot.findMany({ where: { userId: id } })).toMatchObject([{ intakeProvider: 'manual_estimate', importedCalorieIntake: 2900, dailyBankChange: contribution }]);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(1);
    expect((await new PrismaTodayAggregateRepository(db).getTodayForUser(id, '2026-09-24', 'America/Chicago')).eaten.calories).toBe(2500);
    await new ManualIntakeRepository(db, true, () => new Date('2026-09-24T18:00:00Z')).mutate(id, { operation: 'usual', calories: 2700, expectedRevision: 2, localDate: '2026-09-24' });
    await bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago');
    expect(await db.bankCalculationSnapshot.count({ where: { userId: id } })).toBe(1);
    const app = express(); app.use(intakeCapabilityBoundary); app.use(createBankHistoryRouter(bank, user)); app.use(errorHandler);
    // Current selection no longer manual; the historical snapshot still requires capability.
    await db.providerSelection.update({ where: { userId: id }, data: { authoritativeIntakeProvider: 'fatsecret' } });
    for (const route of ['/bank-history?range=ALL', '/bank-history/2026-09-23', '/bank-history/2026-09-23/sources']) {
      const rejected = await request(app).get(route).expect(426);
      expect(rejected.text).not.toContain('manual_estimate');
      await request(app).get(route).set('x-caloriebank-capabilities', 'intake-authority-v2').expect(200);
    }
    const sourceApp = express(); sourceApp.use(express.json()); sourceApp.use(intakeCapabilityBoundary);
    sourceApp.use(createProviderSelectionRouter(new PrismaProviderSelectionRepository(db, bank), user)); sourceApp.use(errorHandler);
    const providerBefore = await db.providerSelection.findUnique({ where: { userId: id } });
    await request(sourceApp).put('/').send({ selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriter: { bundleIdentifier: 'com.cronometer.ios', displayName: 'Cronometer' } }).expect(426);
    expect(await db.providerSelection.findUnique({ where: { userId: id } })).toEqual(providerBefore);
  });
  it('protects real persisted manual records on actual read and write routers', async () => {
    const id = await account(), user = await db.user.findUniqueOrThrow({ where: { id } });
    const repo = new ManualIntakeRepository(db, true);
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    const bank = new PrismaBankHistoryRepository(db), providers = new PrismaProviderSelectionRepository(db, bank);
    // This incomplete account returns before provider work. Empty services make
    // any unexpected provider invocation fail instead of hiding it in a mock.
    type Dependencies = ConstructorParameters<typeof AccountLifecycleCoordinator>;
    const lifecycle = new AccountLifecycleCoordinator(db, bank, {} as Dependencies[2], {} as Dependencies[3], {} as Dependencies[4]);
    const app = express(); app.use(express.json()); app.use(intakeCapabilityBoundary);
    app.use('/manual', createManualIntakeRouter(db, user, true));
    app.use('/selection', createProviderSelectionRouter(providers, user));
    app.use('/connections', createHealthConnectionsRouter(providers, user));
    app.use('/onboarding', createOnboardingRouter(new PrismaOnboardingRepository(db, providers, bank), user));
    app.use('/lifecycle', createAccountLifecycleRouter(lifecycle, user));
    app.use(createTodayRouter(new PrismaTodayAggregateRepository(db), user));
    app.use(errorHandler);
    for (const route of ['/manual', '/selection', '/connections', '/today', '/onboarding']) {
      const blocked = await request(app).get(route).expect(426);
      expect(blocked.body.error.details.code).toBe('UPDATE_REQUIRED');
      expect(blocked.text).not.toContain('manual_estimate');
      await request(app).get(route).set('x-caloriebank-capabilities', 'intake-authority-v2').expect(200);
    }
    const before = await db.providerSelection.findUnique({ where: { userId: id } });
    await request(app).put('/manual').send({ operation: 'usual', calories: 3000, expectedRevision: 1, localDate: '2026-09-23' }).expect(426);
    await request(app).put('/selection').send({ selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriter: { bundleIdentifier: 'com.example.tracker', displayName: 'Tracker' } }).expect(426);
    await request(app).put('/connections/eaten').send({ optionId: 'eaten-fatsecret-v1' }).expect(426);
    await request(app).put('/connections/burned').send({ optionId: 'burned-fitbit-v1' }).expect(426);
    const profileBefore = await db.userProfile.findUniqueOrThrow({ where: { userId: id } });
    await request(app).post('/lifecycle/foreground').send({ timezone: 'Asia/Tokyo' }).expect(426);
    expect(await db.userProfile.findUniqueOrThrow({ where: { userId: id } })).toEqual(profileBefore);
    expect(await db.providerSelection.findUnique({ where: { userId: id } })).toEqual(before);
    expect((await db.manualEstimateBoundary.findFirstOrThrow({ where: { userId: id } })).calories).toBe(2500);
    await request(app).post('/lifecycle/foreground').set('x-caloriebank-capabilities', 'intake-authority-v2').send({ timezone: 'Asia/Tokyo' }).expect(200);
    const traveled = await request(app).get('/today?timezone=Pacific/Honolulu').set('x-caloriebank-capabilities', 'intake-authority-v2').expect(200);
    expect(traveled.body.date).toBe(getLocalDateForTimezone('Asia/Tokyo'));
    expect(traveled.body.eaten.authoritative.localDate).toBe(getLocalDateForTimezone('Asia/Tokyo'));
  });
  it.each([
    ['2026-03-08T07:59:00Z', '2026-03-08'], ['2026-03-08T08:01:00Z', '2026-03-08'],
    ['2026-11-01T06:59:00Z', '2026-11-01'], ['2026-11-01T07:01:00Z', '2026-11-01'],
    ['2026-09-24T04:59:59Z', '2026-09-23'], ['2026-09-24T05:00:01Z', '2026-09-24'],
  ])('uses the canonical local date across midnight/DST at %s', async (instant, localDate) => {
    const id = await account(), repo = new ManualIntakeRepository(db, true, () => new Date(instant));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate });
    expect((await db.manualIntakeOverride.findFirstOrThrow({ where: { userId: id } })).localDate.toISOString().slice(0, 10)).toBe(localDate);
  });
  it('rejects yesterday edits after midnight and prevents timezone backtracking from rewriting preferences', async () => {
    const id = await account(); let now = new Date('2026-09-24T04:59:00Z');
    const repo = new ManualIntakeRepository(db, true, () => now);
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    now = new Date('2026-09-24T05:01:00Z');
    await expect(repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' })).rejects.toMatchObject({ details: { code: 'MANUAL_DATE_CHANGED' } });
    await repo.mutate(id, { operation: 'usual', calories: 2700, expectedRevision: 1, localDate: '2026-09-24' });
    await db.userProfile.update({ where: { userId: id }, data: { timezone: 'America/Los_Angeles' } });
    await expect(repo.mutate(id, { operation: 'usual', calories: 2800, expectedRevision: 2, localDate: '2026-09-23' })).rejects.toMatchObject({ details: { code: 'MANUAL_DATE_CLOSED' } });
    expect(await resolveManualIntake(db, id, date('2026-09-23'))).toMatchObject({ value: { calories: 2500 } });
  });
  it('enforces database bounds, ownership and unique date evidence', async () => {
    const id = await account();
    const data = { userId: id, effectiveFrom: date('2026-09-23'), calories: 2500, revision: 1, timezone: 'UTC' };
    await expect(db.manualEstimateBoundary.create({ data: { ...data, calories: 0 } })).rejects.toThrow();
    await expect(db.manualEstimateBoundary.create({ data: { ...data, userId: randomUUID() } })).rejects.toThrow();
    await db.manualEstimateBoundary.create({ data });
    await expect(db.manualEstimateBoundary.create({ data })).rejects.toThrow();
    await expect(db.manualIntakeOverride.create({ data: { userId: id, localDate: date('2026-09-23'), calories: -1, revision: 1, timezone: 'UTC' } })).rejects.toThrow();
  });
  it('initializes fresh manual Opening Bank at zero without fabricated intake or ledger history', async () => {
    const id = await account();
    await db.bankAccountInitialization.create({ data: { userId: id } });
    await db.goalConfiguration.create({ data: { userId: id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
    const repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-23T18:00:00Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await db.providerSelection.update({ where: { userId: id }, data: { expenditureSelected: true, authoritativeExpenditureProvider: 'google_health_fitbit', updatedAt: new Date('2026-09-23T18:00:00Z') } });
    await db.ingestionSyncSession.create({ data: { userId: id, provider: 'google_health_fitbit', localDate: date('2026-09-23'), timezone: 'America/Chicago', trigger: 'connection', status: 'completed', expenditureStatus: 'ready', intakeStatus: 'skipped', startedAt: new Date('2026-09-23T18:01:00Z'), completedAt: new Date('2026-09-23T18:02:00Z'), datesQueried: openingImportDates('2026-09-23') } });
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-23T18:03:00Z') });
    expect(await bank.initializeOpeningBank(user, '2026-09-23', 'America/Chicago')).toMatchObject({ outcome: 'initialized', accountingStartsOn: '2026-09-23', openingEffectiveBalanceCalories: 0 });
    expect(await db.openingBankCalculationDay.count({ where: { userId: id } })).toBe(0);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: id } })).toBe(0);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
    expect(await db.manualIntakeOverride.count({ where: { userId: id } })).toBe(0);
    // No Today read, daily confirmation or mobile intake upload is needed.
    await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date('2026-09-23'), timezone: 'America/Chicago', provider: 'google_health_fitbit', providerRecordId: 'unopened-day-burn', rawTotalDailyExpenditure: 2500, adjustedDailyExpenditure: 2000, adjustmentFactor: 0.8, importedAt: new Date('2026-09-24T08:00:00Z'), syncStatus: 'ready', isCurrentDay: false } });
    const nextDay = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-24T12:00:00Z') });
    await nextDay.reconcileStoredDay(user, '2026-09-23', 'America/Chicago');
    await nextDay.reconcileStoredDay(user, '2026-09-23', 'America/Chicago');
    expect(await db.bankCalculationSnapshot.findMany({ where: { userId: id } })).toMatchObject([{ intakeProvider: 'manual_estimate', importedCalorieIntake: 2500, dailyBankChange: -500 }]);
    expect(await nextDay.getSummary(id)).toMatchObject({ availableBankCalories: 0, recoveryCalories: 500 });
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(1);
    expect(await db.manualIntakeOverride.count({ where: { userId: id } })).toBe(0);
  });
  it('leaves manual authority intact when a new provider cannot be established', async () => {
    const id = await account(), user = await db.user.findUniqueOrThrow({ where: { id } });
    await new ManualIntakeRepository(db, true).mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    const selection = await db.providerSelection.findUnique({ where: { userId: id } });
    const periods = await db.intakeAuthorityBoundary.findMany({ where: { userId: id } });
    const providers = new PrismaProviderSelectionRepository(db, new PrismaBankHistoryRepository(db));
    await expect(providers.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'fatsecret' })).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.providerSelection.findUnique({ where: { userId: id } })).toEqual(selection);
    expect(await db.intakeAuthorityBoundary.findMany({ where: { userId: id } })).toEqual(periods);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
  });
  it('serializes an edit against finalization with a coherent value and ledger outcome', async () => {
    const id = await account(), repo = new ManualIntakeRepository(db, true, () => new Date('2026-09-24T04:59:59Z'));
    await repo.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    await db.providerSelection.update({ where: { userId: id }, data: { authoritativeExpenditureProvider: 'google_health_fitbit', expenditureSelected: true } });
    await db.goalConfiguration.create({ data: { userId: id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
    await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date('2026-09-23'), timezone: 'America/Chicago', provider: 'google_health_fitbit', providerRecordId: 'race-burn', rawTotalDailyExpenditure: 4250, adjustedDailyExpenditure: 3400, adjustmentFactor: 0.8, importedAt: new Date('2026-09-24T05:00:01Z'), syncStatus: 'ready', isCurrentDay: false } });
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-24T05:00:02Z') });
    const outcomes = await Promise.allSettled([
      repo.mutate(id, { operation: 'today', calories: 2900, expectedRevision: 1, localDate: '2026-09-23' }),
      bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago'),
    ]);
    expect(outcomes[1]?.status).toBe('fulfilled');
    const snapshot = await db.bankCalculationSnapshot.findFirstOrThrow({ where: { userId: id } });
    expect(snapshot.intakeProvider).toBe('manual_estimate');
    expect(snapshot.importedCalorieIntake).toBe(outcomes[0]?.status === 'fulfilled' ? 2900 : 2500);
    expect(snapshot.dailyBankChange).toBe(3400 - snapshot.importedCalorieIntake);
    await expect(repo.mutate(id, { operation: 'today', calories: 3100, expectedRevision: 2, localDate: '2026-09-23' })).rejects.toMatchObject({ details: { code: 'MANUAL_DATE_CLOSED' } });
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(1);
  });
  it.each(['manual_to_provider', 'provider_to_manual'] as const)('keeps source and calories coherent during %s finalization race', async (direction) => {
    const id = await account(), user = await db.user.findUniqueOrThrow({ where: { id } });
    const beforeMidnight = () => new Date('2026-09-24T04:59:59Z');
    const bank = new PrismaBankHistoryRepository(db, { now: () => new Date('2026-09-24T05:00:02Z') });
    const providers = new PrismaProviderSelectionRepository(db, bank, beforeMidnight);
    const manual = new ManualIntakeRepository(db, true, beforeMidnight);
    await db.externalProviderConnection.create({ data: { userId: id, provider: 'fatsecret', status: 'connected', encryptedAccessToken: 'test' } });
    const input = { selectionRole: 'eaten' as const, authoritativeExpenditureProvider: 'google_health_fitbit' as const, authoritativeIntakeProvider: 'fatsecret' as const };
    if (direction === 'manual_to_provider') await manual.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: null });
    else await providers.update(user, input);
    await db.providerSelection.update({ where: { userId: id }, data: { authoritativeExpenditureProvider: 'google_health_fitbit', expenditureSelected: true } });
    await db.goalConfiguration.create({ data: { userId: id, goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 } });
    await db.dailyExpenditureAggregate.create({ data: { userId: id, localDate: date('2026-09-23'), timezone: 'America/Chicago', provider: 'google_health_fitbit', providerRecordId: 'switch-race-burn', rawTotalDailyExpenditure: 4250, adjustedDailyExpenditure: 3400, adjustmentFactor: 0.8, importedAt: new Date('2026-09-24T05:00:01Z'), syncStatus: 'ready', isCurrentDay: false } });
    await db.dailyIntakeAggregate.create({ data: { userId: id, localDate: date('2026-09-23'), timezone: 'America/Chicago', provider: 'fatsecret', providerRecordId: 'switch-race-intake', totalCaloriesConsumed: 1800, importedAt: new Date('2026-09-24T05:00:01Z'), syncStatus: 'ready', isCurrentDay: false } });
    const selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
    const outcomes = await Promise.allSettled([
      direction === 'manual_to_provider' ? providers.update(user, input) : manual.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: selection.updatedAt.toISOString() }),
      bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago'),
    ]);
    expect(outcomes[1]?.status).toBe('fulfilled');
    const snapshot = await db.bankCalculationSnapshot.findFirstOrThrow({ where: { userId: id } });
    const switched = outcomes[0]?.status === 'fulfilled';
    const provider = (direction === 'manual_to_provider') === switched ? 'fatsecret' : 'manual_estimate';
    expect(snapshot.intakeProvider).toBe(provider);
    expect(snapshot.importedCalorieIntake).toBe(provider === 'manual_estimate' ? 2500 : 1800);
    expect(snapshot.dailyBankChange).toBe(3400 - snapshot.importedCalorieIntake);
    await bank.reconcileStoredDay(user, '2026-09-23', 'America/Chicago');
    expect(await db.bankCalculationSnapshot.count({ where: { userId: id } })).toBe(1);
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(1);
  });
  it.each(['apple_health', 'health_connect', 'fatsecret'] as const)('switches manual ↔ %s without summation or historical authority leakage', async (provider) => {
    const id = await account(), user = await db.user.findUniqueOrThrow({ where: { id } });
    let now = new Date('2026-09-23T18:00:00Z');
    const manual = new ManualIntakeRepository(db, true, () => now);
    const bank = new PrismaBankHistoryRepository(db, { now: () => now });
    const providers = new PrismaProviderSelectionRepository(db, bank, () => now);
    const writer = 'com.cronometer.android.gold';
    await db.externalProviderConnection.create({ data: { userId: id, provider: 'fatsecret', status: 'connected', encryptedAccessToken: 'test' } });
    const input = { selectionRole: 'eaten' as const, authoritativeExpenditureProvider: 'apple_health' as const, authoritativeIntakeProvider: provider,
      ...(provider === 'apple_health' ? { appleHealthIntakeWriter: { bundleIdentifier: 'com.cronometer.ios', displayName: 'Cronometer' } } : {}),
      ...(provider === 'health_connect' ? { nativeIntakeSource: { namespace: 'android_package' as const, id: writer } } : {}),
    };
    await providers.update(user, input);
    now = new Date('2026-09-24T18:00:00Z');
    let selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
    await manual.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 0, selectionRevision: selection.updatedAt.toISOString() });
    await db.dailyIntakeAggregate.create({ data: { userId: id, provider, localDate: date('2026-09-24'), timezone: 'America/Chicago', providerRecordId: 'provider-evidence', totalCaloriesConsumed: 1800, isCurrentDay: true, syncStatus: 'ready', importedAt: now,
      writerBundleIdentifier: provider === 'apple_health' ? 'com.cronometer.ios' : null,
      writerDisplayName: provider === 'apple_health' ? 'Cronometer' : null,
      sourceId: provider === 'health_connect' ? writer : '', sourceDisplayName: 'Cronometer' } });
    const today = new PrismaTodayAggregateRepository(db);
    expect((await today.getTodayForUser(id, '2026-09-24', 'America/Chicago')).eaten.calories).toBe(2500);
    await providers.update(user, input);
    expect((await today.getTodayForUser(id, '2026-09-24', 'America/Chicago')).eaten.calories).toBe(1800);
    selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
    await manual.mutate(id, { operation: 'select', calories: 2500, expectedRevision: 1, selectionRevision: selection.updatedAt.toISOString() });
    expect((await today.getTodayForUser(id, '2026-09-24', 'America/Chicago')).eaten.calories).toBe(2500);
    now = new Date('2026-09-26T18:00:00Z');
    await providers.update(user, input);
    selection = await db.providerSelection.findUniqueOrThrow({ where: { userId: id } });
    expect(await resolveIntakeAuthority(db, id, date('2026-09-23'), selection)).toMatchObject({ provider });
    for (const day of ['2026-09-24', '2026-09-25']) expect(await resolveIntakeAuthority(db, id, date(day), selection)).toMatchObject({ provider: 'manual_estimate', writerId: null, sourceId: null });
    expect(await resolveIntakeAuthority(db, id, date('2026-09-26'), selection)).toMatchObject({ provider,
      writerId: provider === 'apple_health' ? 'com.cronometer.ios' : null, sourceId: provider === 'health_connect' ? writer : null });
    expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
    expect(await db.dailyIntakeAggregate.count({ where: { userId: id } })).toBe(1);
  });
});
