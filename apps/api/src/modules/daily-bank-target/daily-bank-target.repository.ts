import type { PrismaClient } from '@prisma/client';

export class DailyBankTargetRepository {
  constructor(private readonly db: PrismaClient) {}

  async get(userId: string) {
    const profile = await this.db.userProfile.findUnique({ where: { userId } });
    return { calories: profile?.dailyBankTargetCalories ?? 0, chosen: Boolean(profile?.dailyBankTargetChosenAt) };
  }

  async update(userId: string, calories: number) {
    const data = { dailyBankTargetCalories: calories, dailyBankTargetChosenAt: new Date() };
    const profile = await this.db.userProfile.upsert({
      where: { userId }, update: data, create: { userId, ...data },
    });
    return { calories: profile.dailyBankTargetCalories, chosen: true };
  }
}
