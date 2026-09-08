import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { BankSummaryResponse, ProviderSelectionInput } from '@caloriebank/schemas';
import { PrismaProviderSelectionRepository } from '../src/modules/provider-selection/provider-selection.repository';
import { deriveOnboardingStatus } from '../src/modules/onboarding/onboarding.repository';
import type { BankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';

const burns = ['apple_health', 'google_health_fitbit'] as const;
const foods = ['FatSecret direct', 'Cronometer', 'MyFitnessPal', 'Lose It!', 'MacroFactor', 'Detected food app'] as const;
const bank = { openingBankStatus: 'waiting_for_opening_data', openingBankCalories: 0 } as BankSummaryResponse;

describe('persisted independent source matrix', () => {
  for (const burn of burns) for (const food of foods) {
    it(`${burn} x ${food}: selection, navigation, switching, preparation and reload`, async () => {
      const db = new PrismaClient();
      const id = randomUUID();
      const user = { id, email: `${id}@test.local` };
      const repo = new PrismaProviderSelectionRepository(db, { reconcileStoredDay: async () => { throw new Error('No accounting should run for this fresh account'); } } as unknown as BankHistoryRepository);
      try {
        await db.user.create({ data: user });
        await db.googleHealthConnection.create({ data: { userId: id, status: 'connected', encryptedAccessToken: 'test', encryptedRefreshToken: 'test', accessTokenExpiresAt: new Date('2030-01-01') } });
        await db.externalProviderConnection.create({ data: { userId: id, provider: 'fatsecret', status: 'connected', encryptedAccessToken: 'test', encryptedTokenSecret: 'test', authProtocol: 'oauth1' } });
        await db.ingestionSyncSession.create({ data: { userId: id, provider: 'apple_health', localDate: new Date('2026-09-08'), timezone: 'America/Chicago', trigger: 'integration_test', startedAt: new Date(), completedAt: new Date(), status: 'completed', expenditureStatus: 'unavailable' } });
        const status = async (goal = false) => deriveOnboardingStatus({
          welcomeCompleted: true, completed: false, providerSelection: await repo.get(id), goalConfigured: goal,
          bankSummary: bank, preparation: { expenditure: 'complete', intake: 'complete', history: 'preparing' },
        });
        expect((await status()).stage).toBe('calories_burned');
        const burnInput: ProviderSelectionInput = { selectionRole: 'burned', authoritativeExpenditureProvider: burn, authoritativeActivityProvider: burn, authoritativeIntakeProvider: 'apple_health' };
        await repo.update(user, burnInput);
        expect((await status()).stage).toBe('calories_eaten');
        expect((await status()).intake.connected).toBe(false);
        const foodInput: ProviderSelectionInput = {
          selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeActivityProvider: 'apple_health',
          authoritativeIntakeProvider: food === 'FatSecret direct' ? 'fatsecret' : 'apple_health',
          ...(food !== 'FatSecret direct' ? { appleHealthIntakeWriter: { bundleIdentifier: `test.${food}`, displayName: food } } : {}),
        };
        await repo.update(user, foodInput);
        expect((await status()).stage).toBe('goal');
        expect((await status()).expenditure.readiness).toBe('connected_waiting_for_data');
        expect((await status()).intake.readiness).toBe('connected_waiting_for_data');
        expect((await status()).intake.displayName).toBe(food === 'FatSecret direct' ? 'FatSecret' : food);
        const selected = await repo.get(id);
        expect(selected.expenditure.authoritativeProvider).toBe(burn);
        // Repeated Back/Forward/Edit/focus/remount reads are not selection writes.
        for (let read = 0; read < 8; read++) expect(await repo.get(id)).toEqual(selected);
        const otherBurn = burn === 'apple_health' ? 'google_health_fitbit' : 'apple_health';
        await repo.update(user, { ...burnInput, authoritativeExpenditureProvider: otherBurn, authoritativeActivityProvider: otherBurn });
        expect((await repo.get(id)).intake).toEqual(selected.intake);
        await repo.update(user, { ...foodInput, authoritativeIntakeProvider: 'fatsecret' });
        expect((await repo.get(id)).expenditure.authoritativeProvider).toBe(otherBurn);
        await repo.update(user, foodInput);
        expect((await status(true)).stage).toBe('preparing_bank');
        expect((await status(true)).intake.displayName).not.toMatch(/Choose a food tracker/);
        const localDate = new Date('2026-09-08T00:00:00Z');
        await db.dailyExpenditureAggregate.create({ data: {
          userId: id, localDate, timezone: 'America/Chicago', provider: otherBurn,
          providerRecordId: `${id}:burn`, rawTotalDailyExpenditure: 2000,
          adjustedDailyExpenditure: 1600, adjustmentFactor: 0.8,
          importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true,
        } });
        await db.dailyIntakeAggregate.create({ data: {
          userId: id, localDate, timezone: 'America/Chicago', provider: foodInput.authoritativeIntakeProvider,
          providerRecordId: `${id}:intake`, totalCaloriesConsumed: 1000,
          ...(foodInput.appleHealthIntakeWriter ? { writerBundleIdentifier: foodInput.appleHealthIntakeWriter.bundleIdentifier, writerDisplayName: food } : {}),
          importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true,
        } });
        expect((await status(true)).expenditure.readiness).toBe('ready');
        expect((await status(true)).intake.readiness).toBe('ready');
        if (food === 'FatSecret direct') {
          await db.externalProviderConnection.update({ where: { userId_provider: { userId: id, provider: 'fatsecret' } }, data: { status: 'needs_reconnect' } });
          expect((await status(true)).stage).toBe('calories_eaten');
          expect((await status(true)).intake.readiness).toBe('needs_attention');
          await db.externalProviderConnection.update({ where: { userId_provider: { userId: id, provider: 'fatsecret' } }, data: { status: 'connected' } });
          expect((await status(true)).stage).toBe('preparing_bank');
        }
        const noHistory = deriveOnboardingStatus({ welcomeCompleted: true, completed: false, providerSelection: await repo.get(id), goalConfigured: true, bankSummary: bank, preparation: { expenditure: 'complete', intake: 'complete', history: 'no_history' } });
        expect(noHistory.stage).toBe('ready');
        expect(await db.calorieLedgerTransaction.count({ where: { userId: id } })).toBe(0);
      } finally { await db.user.deleteMany({ where: { id } }); await db.$disconnect(); }
    });
  }

  it('selects direct FatSecret with no Apple Health permission, samples or sync and tolerates concurrent burn writes', async () => {
    const db = new PrismaClient(); const id = randomUUID(); const user = { id, email: `${id}@test.local` };
    const repo = new PrismaProviderSelectionRepository(db, {} as BankHistoryRepository);
    try {
      await db.user.create({ data: user });
      await db.externalProviderConnection.create({ data: { userId: id, provider: 'fatsecret', encryptedAccessToken: 'test', status: 'connected' } });
      await Promise.all([
        repo.update(user, { selectionRole: 'eaten', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'fatsecret' }),
        repo.update(user, { selectionRole: 'burned', authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'apple_health' }),
      ]);
      const result = await repo.get(id);
      expect(result.intake).toMatchObject({ selected: true, authoritativeProvider: 'fatsecret' });
      expect(result.expenditure.selected).toBe(true);
      expect(await db.ingestionSyncSession.count({ where: { userId: id } })).toBe(0);
    } finally { await db.user.deleteMany({ where: { id } }); await db.$disconnect(); }
  });
});
