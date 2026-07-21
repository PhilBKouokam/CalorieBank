import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaBankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { PrismaPlannedTreatRepository } from '../src/modules/planned-treat/planned-treat.repository';

const prisma = new PrismaClient();
const bankRepository = new PrismaBankHistoryRepository(prisma);
const plannedTreatRepository = new PrismaPlannedTreatRepository(prisma);

describe('planned treat PostgreSQL persistence', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates, retrieves, updates, and deletes one active planned treat per user', async () => {
    const user = {
      id: randomUUID(),
      email: `treat-${randomUUID()}@caloriebank.local`,
    };

    await bankRepository.finalizeDailyRecord(user, {
      logDate: '2026-07-19',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 3000,
      goalMode: 'bulk',
      goalAdjustmentCalories: 300,
      importedCalorieIntake: 2500,
      finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
    });

    const created = await plannedTreatRepository.createOrReplaceForUser(user, {
      name: 'Cookies and milk',
      requiredCalories: 1500,
    });

    expect(created).toMatchObject({
      name: 'Cookies and milk',
      requiredCalories: 1500,
      availableBankCalories: 200,
      progressCalories: 200,
      remainingCalories: 1300,
      status: 'saving',
    });

    const replaced = await plannedTreatRepository.createOrReplaceForUser(user, {
      name: 'Pizza night',
      requiredCalories: 100,
      targetDate: '2026-08-01',
    });

    expect(replaced).toMatchObject({
      id: created.id,
      name: 'Pizza night',
      requiredCalories: 100,
      targetDate: '2026-08-01',
      status: 'ready',
      progressPercent: 100,
    });

    const rows = await prisma.plannedTreat.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);

    const fetched = await plannedTreatRepository.getForUser(user.id);
    expect(fetched).toMatchObject({ id: created.id, name: 'Pizza night' });

    await plannedTreatRepository.deleteForUser(user.id);
    expect(await plannedTreatRepository.getForUser(user.id)).toEqual({
      status: 'no_plan',
      plannedTreat: null,
      availableBankCalories: 200,
    });

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('isolates planned treats and ledger-derived balances by user', async () => {
    const firstUser = {
      id: randomUUID(),
      email: `treat-${randomUUID()}@caloriebank.local`,
    };
    const secondUser = {
      id: randomUUID(),
      email: `treat-${randomUUID()}@caloriebank.local`,
    };

    await bankRepository.finalizeDailyRecord(firstUser, {
      logDate: '2026-07-19',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 3000,
      goalMode: 'bulk',
      goalAdjustmentCalories: 300,
      importedCalorieIntake: 2500,
      finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
    });
    await bankRepository.finalizeDailyRecord(secondUser, {
      logDate: '2026-07-19',
      timezone: 'America/Chicago',
      importedTotalDailyExpenditure: 2500,
      goalMode: 'maintain',
      goalAdjustmentCalories: 0,
      importedCalorieIntake: 2100,
      finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
    });

    await plannedTreatRepository.createOrReplaceForUser(firstUser, {
      name: 'Restaurant dinner',
      requiredCalories: 150,
    });
    await plannedTreatRepository.createOrReplaceForUser(secondUser, {
      name: 'Ice cream',
      requiredCalories: 150,
    });

    const firstTreat = await plannedTreatRepository.getForUser(firstUser.id);
    const secondTreat = await plannedTreatRepository.getForUser(secondUser.id);

    expect(firstTreat).toMatchObject({
      name: 'Restaurant dinner',
      availableBankCalories: 200,
      status: 'ready',
    });
    expect(secondTreat).toMatchObject({
      name: 'Ice cream',
      availableBankCalories: -100,
      progressCalories: 0,
      remainingCalories: 150,
      status: 'saving',
    });

    const storedTreat = await prisma.plannedTreat.findFirst({ where: { userId: firstUser.id } });
    expect(storedTreat).not.toHaveProperty('availableBankCalories');

    await prisma.user.deleteMany({ where: { id: { in: [firstUser.id, secondUser.id] } } });
  });
});
