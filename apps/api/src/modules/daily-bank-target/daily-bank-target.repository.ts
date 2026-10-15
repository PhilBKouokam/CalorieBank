import { settingTransaction, type SettingsOptions } from '../settings-concurrency/settings-concurrency';
import type { PrismaClient } from '@prisma/client';

export class DailyBankTargetRepository {
  constructor(private readonly db: PrismaClient) {}

  async get(userId: string, options?: SettingsOptions) {
    return settingTransaction(this.db, userId, 'daily-bank-target', false, options, async tx => {
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    return { calories: profile?.dailyBankTargetCalories ?? 0, chosen: Boolean(profile?.dailyBankTargetChosenAt) };
    });
  }

  async update(userId: string, calories: number, options?: SettingsOptions) {
    return settingTransaction(this.db, userId, 'daily-bank-target', true, options, async tx => {
    const data = { dailyBankTargetCalories: calories, dailyBankTargetChosenAt: new Date() };
    const profile = await tx.userProfile.upsert({
      where: { userId }, update: data, create: { userId, ...data },
    });
    return { calories: profile.dailyBankTargetCalories, chosen: true };
    });
  }
}
