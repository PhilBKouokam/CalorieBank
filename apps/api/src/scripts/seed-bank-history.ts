import { prisma } from '../db/client';
import { env } from '../env';
import { PrismaBankHistoryRepository } from '../modules/bank-history/bank-history.repository';

const repository = new PrismaBankHistoryRepository(prisma);
const developmentUser = {
  id: env.DEV_USER_ID,
  email: env.DEV_USER_EMAIL,
};

const seedDays = [
  {
    logDate: '2026-07-15',
    timezone: 'America/Chicago',
    importedTotalDailyExpenditure: 3125,
    goalMode: 'cut' as const,
    goalAdjustmentCalories: 500,
    importedCalorieIntake: 1500,
    finalizedAt: new Date('2026-07-16T05:30:00.000Z'),
  },
  {
    logDate: '2026-07-16',
    timezone: 'America/Chicago',
    importedTotalDailyExpenditure: 3625,
    goalMode: 'cut' as const,
    goalAdjustmentCalories: 500,
    importedCalorieIntake: 2085,
    finalizedAt: new Date('2026-07-17T05:30:00.000Z'),
  },
  {
    logDate: '2026-07-17',
    timezone: 'America/Chicago',
    importedTotalDailyExpenditure: 2800,
    goalMode: 'cut' as const,
    goalAdjustmentCalories: 500,
    importedCalorieIntake: 2500,
    finalizedAt: new Date('2026-07-18T05:30:00.000Z'),
  },
  {
    logDate: '2026-07-18',
    timezone: 'America/Chicago',
    importedTotalDailyExpenditure: 2500,
    goalMode: 'maintain' as const,
    goalAdjustmentCalories: 0,
    importedCalorieIntake: 1950,
    finalizedAt: new Date('2026-07-19T05:30:00.000Z'),
  },
  {
    logDate: '2026-07-19',
    timezone: 'America/Chicago',
    importedTotalDailyExpenditure: 3000,
    goalMode: 'bulk' as const,
    goalAdjustmentCalories: 300,
    importedCalorieIntake: 2500,
    finalizedAt: new Date('2026-07-20T05:30:00.000Z'),
  },
];

async function main() {
  for (const day of seedDays) {
    const finalized = await repository.finalizeDailyRecord(developmentUser, day);
    console.log(
      `${finalized.logDate}: ${finalized.goalMode} ${finalized.dailyBankChange >= 0 ? '+' : ''}${finalized.dailyBankChange} kcal`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
