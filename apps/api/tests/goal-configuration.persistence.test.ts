import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaGoalConfigurationRepository } from '../src/modules/goal-configuration/goal-configuration.repository';

const prisma = new PrismaClient();
const repository = new PrismaGoalConfigurationRepository(prisma);

describe('goal configuration PostgreSQL persistence', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists and retrieves a goal configuration through PostgreSQL', async () => {
    const user = {
      id: randomUUID(),
      email: `goal-${randomUUID()}@caloriebank.local`,
    };

    const saved = await repository.upsertForUser(user, {
      goalMode: 'bulk',
      dailyEnergyAdjustment: 500,
      adjustmentSource: 'estimated_weight_rate',
      desiredWeeklyWeightChange: 1,
    });

    const retrieved = await repository.findByUserId(user.id);

    expect(retrieved).toEqual(saved);
    expect(retrieved).toMatchObject({
      userId: user.id,
      goalMode: 'bulk',
      dailyEnergyAdjustment: 500,
      adjustmentSource: 'estimated_weight_rate',
      desiredWeeklyWeightChange: 1,
    });

    await prisma.user.delete({ where: { id: user.id } });
  });
});
