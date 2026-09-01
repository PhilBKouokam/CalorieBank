import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const prisma = new PrismaClient();

describe('resting-burn model persistence', () => {
  afterAll(async () => prisma.$disconnect());

  it('keeps personalized forecasts isolated and leaves accounting untouched', async () => {
    const timezone = 'America/Chicago';
    const now = new Date();
    const localDate = getLocalDateForTimezone(timezone, now);
    const users = [randomUUID(), randomUUID()];
    const repository = new PrismaTodayAggregateRepository(prisma, { allowSyntheticProviders: false, now: () => now });
    try {
      for (const [index, userId] of users.entries()) {
        await prisma.user.create({
          data: {
            id: userId,
            email: `rest-${userId}@caloriebank.local`,
            profile: { create: { timezone } },
            providerSelection: { create: {
              authoritativeExpenditureProvider: 'apple_health',
              authoritativeActivityProvider: 'apple_health',
              authoritativeIntakeProvider: 'fatsecret',
            } },
          },
        });
        await prisma.dailyExpenditureAggregate.create({
          data: {
            userId,
            localDate: new Date(`${localDate}T00:00:00.000Z`),
            timezone,
            provider: 'apple_health',
            providerRecordId: `apple_health:expenditure:${localDate}`,
            activeEnergyCalories: 1_000,
            basalEnergyCalories: 2_000,
            rawTotalDailyExpenditure: 3_000,
            adjustedDailyExpenditure: 2_400,
            adjustmentFactor: 0.8,
            importedAt: now,
            providerUpdatedAt: now,
            syncStatus: 'ready',
            isCurrentDay: true,
          },
        });
        await repository.upsertRestingBurnEstimate!({
          id: userId,
          email: `rest-${userId}@caloriebank.local`,
        }, {
          provider: 'apple_health',
          providerKcalPerHour: index === 0 ? 60 : 90,
          evidenceType: 'provider_resting_energy',
          observationCount: 14,
          lookbackStartDate: '2026-08-01',
          lookbackEndDate: '2026-08-14',
          calculatedAt: now,
        });
      }

      const before = await Promise.all([
        prisma.calorieLedgerTransaction.count({ where: { userId: { in: users } } }),
        prisma.bankCalculationSnapshot.count({ where: { userId: { in: users } } }),
      ]);
      const [todayA, todayB] = await Promise.all([
        repository.getTodayForUser(users[0]!, localDate, timezone),
        repository.getTodayForUser(users[1]!, localDate, timezone),
      ]);
      const after = await Promise.all([
        prisma.calorieLedgerTransaction.count({ where: { userId: { in: users } } }),
        prisma.bankCalculationSnapshot.count({ where: { userId: { in: users } } }),
      ]);

      expect(todayA.restOfDayProjection).toMatchObject({
        status: 'ready', providerKcalPerHour: 60, evidenceType: 'provider_resting_energy',
      });
      expect(todayB.restOfDayProjection).toMatchObject({
        status: 'ready', providerKcalPerHour: 90, evidenceType: 'provider_resting_energy',
      });
      expect(todayA.restOfDayProjection.projectedProviderBurnCalories)
        .not.toBe(todayB.restOfDayProjection.projectedProviderBurnCalories);
      expect(after).toEqual(before);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
  });
});
