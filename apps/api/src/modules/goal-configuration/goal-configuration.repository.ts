import type {
  AdjustmentSource,
  GoalConfigurationInput,
  GoalConfigurationResponse,
  GoalMode,
} from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';

export type DevelopmentUser = {
  id: string;
  email: string;
};

export interface GoalConfigurationRepository {
  findByUserId(userId: string): Promise<GoalConfigurationResponse | null>;
  upsertForUser(
    user: DevelopmentUser,
    input: GoalConfigurationInput,
  ): Promise<GoalConfigurationResponse>;
}

function toOptionalNumber(value: Prisma.Decimal | null): number | null {
  return value ? value.toNumber() : null;
}

function toResponse(configuration: {
  userId: string;
  goalMode: string;
  dailyEnergyAdjustment: number;
  adjustmentSource: string;
  desiredWeeklyWeightChange: Prisma.Decimal | null;
  updatedAt: Date;
}): GoalConfigurationResponse {
  return {
    userId: configuration.userId,
    goalMode: configuration.goalMode as GoalMode,
    dailyEnergyAdjustment: configuration.dailyEnergyAdjustment,
    adjustmentSource: configuration.adjustmentSource as AdjustmentSource,
    desiredWeeklyWeightChange: toOptionalNumber(configuration.desiredWeeklyWeightChange),
    updatedAt: configuration.updatedAt.toISOString(),
  };
}

export class PrismaGoalConfigurationRepository implements GoalConfigurationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByUserId(userId: string): Promise<GoalConfigurationResponse | null> {
    const configuration = await this.db.goalConfiguration.findUnique({ where: { userId } });
    return configuration ? toResponse(configuration) : null;
  }

  async upsertForUser(
    user: DevelopmentUser,
    input: GoalConfigurationInput,
  ): Promise<GoalConfigurationResponse> {
    const configuration = await this.db.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: {
          id: user.id,
          email: user.email,
          profile: { create: {} },
        },
      });

      return transaction.goalConfiguration.upsert({
        where: { userId: user.id },
        update: {
          goalMode: input.goalMode,
          dailyEnergyAdjustment: input.dailyEnergyAdjustment,
          adjustmentSource: input.adjustmentSource,
          desiredWeeklyWeightChange: input.desiredWeeklyWeightChange ?? null,
        },
        create: {
          userId: user.id,
          goalMode: input.goalMode,
          dailyEnergyAdjustment: input.dailyEnergyAdjustment,
          adjustmentSource: input.adjustmentSource,
          desiredWeeklyWeightChange: input.desiredWeeklyWeightChange ?? null,
        },
      });
    });

    return toResponse(configuration);
  }
}
