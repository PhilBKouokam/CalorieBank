import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { env } from '../src/env';
import type { BankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import type { DevelopmentUser } from '../src/modules/goal-configuration/goal-configuration.repository';
import { FatSecretService } from '../src/modules/fatsecret/fatsecret.service';
import { GoogleHealthFitbitService } from '../src/modules/google-health/google-health.service';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import {
  HEALTH_CONNECTION_OPTION_IDS,
  PrismaProviderSelectionRepository,
} from '../src/modules/provider-selection/provider-selection.repository';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';

const timezone = 'America/Chicago';
const localDate = new Date('2026-08-27T00:00:00.000Z');

async function seedAccount(prisma: PrismaClient) {
  const id = randomUUID();
  const key = Buffer.alloc(32, 33).toString('base64');
  await prisma.user.create({ data: { id, email: `${id}@test.local` } });
  await prisma.providerSelection.create({ data: {
    userId: id,
    authoritativeExpenditureProvider: 'google_health_fitbit',
    authoritativeActivityProvider: 'google_health_fitbit',
    authoritativeIntakeProvider: 'apple_health',
    appleHealthIntakeWriterBundleId: 'verified-writer',
    appleHealthIntakeWriterDisplayName: 'Cronometer',
  } });
  await prisma.googleHealthConnection.create({ data: {
    userId: id,
    encryptedAccessToken: encryptGoogleHealthSecret('access', key),
    encryptedRefreshToken: encryptGoogleHealthSecret('refresh', key),
    accessTokenExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
    status: 'connected',
  } });
  await prisma.externalProviderConnection.create({ data: {
    userId: id,
    provider: 'fatsecret',
    encryptedAccessToken: 'encrypted-access',
    encryptedTokenSecret: 'encrypted-secret',
    authProtocol: 'oauth1',
    status: 'connected',
  } });
  await prisma.dailyExpenditureAggregate.createMany({ data: [
    {
      userId: id, localDate, timezone, provider: 'google_health_fitbit',
      providerRecordId: 'fitbit:2026-08-27', rawTotalDailyExpenditure: 3000,
      adjustedDailyExpenditure: 2400, adjustmentFactor: 0.8, importedAt: new Date(),
      syncStatus: 'ready', isCurrentDay: true,
    },
    {
      userId: id, localDate, timezone, provider: 'apple_health',
      providerRecordId: 'apple:2026-08-27', rawTotalDailyExpenditure: 2800,
      adjustedDailyExpenditure: 2240, adjustmentFactor: 0.8, importedAt: new Date(),
      syncStatus: 'ready', isCurrentDay: true,
    },
  ] });
  await prisma.dailyIntakeAggregate.createMany({ data: [
    {
      userId: id, localDate, timezone, provider: 'apple_health',
      providerRecordId: 'apple-intake:2026-08-27', totalCaloriesConsumed: 1800,
      writerBundleIdentifier: 'verified-writer', writerDisplayName: 'Cronometer',
      importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true,
    },
    {
      userId: id, localDate, timezone, provider: 'fatsecret',
      providerRecordId: 'fatsecret:2026-08-27', totalCaloriesConsumed: 1750,
      importedAt: new Date(), syncStatus: 'ready', isCurrentDay: true,
    },
  ] });
  return { id, key, user: { id, email: `${id}@test.local` } };
}

describe('health connection role semantics', () => {
  it('separates selected roles from connected alternatives without exposing internal provenance', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    const reconciled: string[] = [];
    const repository = new PrismaProviderSelectionRepository(prisma, {
      reconcileStoredDay: async (_user: DevelopmentUser, date: string) => {
        reconciled.push(date);
        return { outcome: 'not_ready', detail: null };
      },
    } as unknown as BankHistoryRepository);
    try {
      const initial = await repository.getHealthConnections(account.id);
      expect(initial.burned.selected).toMatchObject({ label: 'Fitbit', status: 'connected' });
      expect(initial.burned.alternatives).toEqual([
        expect.objectContaining({ label: 'Apple Health', status: 'connected', deviceManaged: true }),
      ]);
      expect(initial.eaten.selected).toMatchObject({ label: 'Cronometer', transportLabel: 'Apple Health' });
      expect(initial.eaten.alternatives).toEqual([expect.objectContaining({ label: 'FatSecret' })]);
      expect(JSON.stringify(initial)).not.toContain('verified-writer');
      expect(JSON.stringify(initial)).not.toContain('google_health_fitbit');

      const appleBurn = await repository.selectBurned(account.user, HEALTH_CONNECTION_OPTION_IDS.burnedAppleHealth);
      expect(appleBurn.burned.selected?.label).toBe('Apple Health');
      await expect(prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
        .resolves.toMatchObject({
          authoritativeExpenditureProvider: 'apple_health',
          authoritativeActivityProvider: 'apple_health',
          authoritativeIntakeProvider: 'apple_health',
        });

      await repository.selectEaten(account.user, HEALTH_CONNECTION_OPTION_IDS.eatenFatSecret);
      await expect(prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
        .resolves.toMatchObject({
          authoritativeIntakeProvider: 'fatsecret',
          appleHealthIntakeWriterBundleId: 'verified-writer',
        });
      const restored = await repository.selectEaten(
        account.user,
        HEALTH_CONNECTION_OPTION_IDS.eatenAppleHealthWriter,
      );
      expect(restored.eaten.selected).toMatchObject({ label: 'Cronometer', transportLabel: 'Apple Health' });
      expect(reconciled).toEqual([]);
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });

  it('maps broken selected credentials to needs attention without falling back', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    const repository = new PrismaProviderSelectionRepository(prisma, {} as BankHistoryRepository);
    try {
      await prisma.googleHealthConnection.update({
        where: { userId: account.id },
        data: { status: 'needs_reconnect', lastErrorCode: 'access_revoked' },
      });
      const result = await repository.getHealthConnections(account.id);
      expect(result.burned.selected).toMatchObject({
        label: 'Fitbit', status: 'needs_attention', primaryAction: 'reconnect',
      });
      expect(result.burned.selected?.label).not.toBe('Apple Health');
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });

  it('keeps known Apple Health sources visible but unselectable until account data is refreshed', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    const repository = new PrismaProviderSelectionRepository(prisma, {} as BankHistoryRepository);
    try {
      await prisma.dailyExpenditureAggregate.deleteMany({
        where: { userId: account.id, provider: 'apple_health' },
      });
      const result = await repository.getHealthConnections(account.id);
      expect(result.burned.alternatives).toEqual([
        expect.objectContaining({
          label: 'Apple Health',
          status: 'no_data',
          primaryAction: 'refresh_apple_health',
        }),
      ]);
      expect(result.burned.canChange).toBe(false);
      await expect(repository.selectBurned(
        account.user,
        HEALTH_CONNECTION_OPTION_IDS.burnedAppleHealth,
      )).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });
});

describe('selected provider disconnect guards', () => {
  it('rejects selected Fitbit without revoking credentials or changing authority', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    let revokeCalls = 0;
    const service = new GoogleHealthFitbitService(
      prisma,
      {} as TodayAggregateRepository,
      { ...env, GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: account.key },
      undefined,
      async () => { revokeCalls += 1; return new Response(null, { status: 200 }); },
    );
    try {
      await expect(service.disconnect(account.user)).rejects.toMatchObject({
        statusCode: 409,
        details: { code: 'SELECTED_SOURCE_MUST_CHANGE_FIRST', role: 'burned' },
      });
      expect(revokeCalls).toBe(0);
      await expect(prisma.googleHealthConnection.count({ where: { userId: account.id } })).resolves.toBe(1);
      await expect(prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
        .resolves.toMatchObject({ authoritativeExpenditureProvider: 'google_health_fitbit' });
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });

  it('disconnects Fitbit after a switch while preserving aggregates and historical overrides', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    await prisma.providerSelection.update({
      where: { userId: account.id },
      data: { authoritativeExpenditureProvider: 'apple_health', authoritativeActivityProvider: 'apple_health' },
    });
    await prisma.historicalSourceAuthorityOverride.create({ data: {
      userId: account.id, localDate, role: 'EXPENDITURE', provider: 'google_health_fitbit',
    } });
    const service = new GoogleHealthFitbitService(
      prisma,
      {} as TodayAggregateRepository,
      { ...env, GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: account.key },
      undefined,
      async () => new Response(null, { status: 200 }),
    );
    try {
      await service.disconnect(account.user);
      await expect(prisma.googleHealthConnection.count({ where: { userId: account.id } })).resolves.toBe(0);
      await expect(prisma.dailyExpenditureAggregate.count({
        where: { userId: account.id, provider: 'google_health_fitbit' },
      })).resolves.toBe(1);
      await expect(prisma.historicalSourceAuthorityOverride.count({ where: { userId: account.id } }))
        .resolves.toBe(1);
      await expect(prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
        .resolves.toMatchObject({ authoritativeExpenditureProvider: 'apple_health' });
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });

  it('guards selected FatSecret and disconnects it only after intake switches away', async () => {
    const prisma = new PrismaClient();
    const account = await seedAccount(prisma);
    const service = new FatSecretService(prisma, {} as TodayAggregateRepository, env);
    try {
      await prisma.providerSelection.update({
        where: { userId: account.id }, data: { authoritativeIntakeProvider: 'fatsecret' },
      });
      await expect(service.disconnect(account.user)).rejects.toMatchObject({
        statusCode: 409,
        details: { code: 'SELECTED_SOURCE_MUST_CHANGE_FIRST', role: 'eaten' },
      });
      await expect(prisma.externalProviderConnection.count({ where: { userId: account.id } }))
        .resolves.toBe(1);

      await prisma.providerSelection.update({
        where: { userId: account.id }, data: { authoritativeIntakeProvider: 'apple_health' },
      });
      await service.disconnect(account.user);
      await expect(prisma.externalProviderConnection.count({ where: { userId: account.id } }))
        .resolves.toBe(0);
      await expect(prisma.dailyIntakeAggregate.count({
        where: { userId: account.id, provider: 'fatsecret' },
      })).resolves.toBe(1);
      await expect(prisma.providerSelection.findUniqueOrThrow({ where: { userId: account.id } }))
        .resolves.toMatchObject({
          authoritativeIntakeProvider: 'apple_health',
          appleHealthIntakeWriterBundleId: 'verified-writer',
        });
    } finally {
      await prisma.user.deleteMany({ where: { id: account.id } });
      await prisma.$disconnect();
    }
  });
});
