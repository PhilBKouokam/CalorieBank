import { settingTransaction, type SettingsOptions } from '../settings-concurrency/settings-concurrency';
import { requireExistingRequestAccount } from '../../auth/existing-account';
import {
  INITIAL_GOAL_EFFECTIVE_FROM,
  selectGoalActiveOnDate,
} from '@caloriebank/domain';
import type {
  AdjustmentSource,
  GoalConfigurationInput,
  GoalConfigurationResponse,
  GoalMode,
} from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getLocalDateForTimezone } from '../today/today.time';

export type DevelopmentUser = {
  id: string;
  email: string;
};

export interface GoalConfigurationRepository {
  findByUserId(userId: string, options?: SettingsOptions): Promise<GoalConfigurationResponse | null>;
  upsertForUser(
    user: DevelopmentUser,
    input: GoalConfigurationInput,
    options?: SettingsOptions,
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

  async findByUserId(userId: string, options?: SettingsOptions): Promise<GoalConfigurationResponse | null> {
    return settingTransaction(this.db, userId, 'fitness-goal', false, options, async tx => {
      const configuration = await tx.goalConfiguration.findUnique({ where: { userId } });
      return configuration ? toResponse(configuration) : null;
    });
  }

  async upsertForUser(
    user: DevelopmentUser,
    input: GoalConfigurationInput,
    options?: SettingsOptions,
  ): Promise<GoalConfigurationResponse> {
    const configuration = await settingTransaction(this.db, user.id, 'fitness-goal', true, options, async (transaction) => {
      await requireExistingRequestAccount(transaction, user);

      const saved = await transaction.goalConfiguration.upsert({
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
      await appendGoalVersion(transaction, user.id, input);
      return saved;
    });

    return toResponse(configuration);
  }
}

function sameGoal(
  version: {
    goalMode: string;
    dailyEnergyAdjustment: number;
    adjustmentSource: string;
    desiredWeeklyWeightChange: number | null;
  },
  input: GoalConfigurationInput,
) {
  return version.goalMode === input.goalMode
    && version.dailyEnergyAdjustment === input.dailyEnergyAdjustment
    && version.adjustmentSource === input.adjustmentSource
    && version.desiredWeeklyWeightChange === (input.desiredWeeklyWeightChange ?? null);
}

/** Append a version. The first saved goal covers earlier dates; an edit starts today. */
async function appendGoalVersion(
  transaction: Prisma.TransactionClient,
  userId: string,
  input: GoalConfigurationInput,
) {
  const [profile, versions] = await Promise.all([
    transaction.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
    transaction.goalConfigurationVersion.findMany({
      where: { userId },
      orderBy: [{ effectiveFrom: 'asc' }, { recordedAt: 'asc' }],
    }),
  ]);
  const today = getLocalDateForTimezone(profile?.timezone || 'UTC');
  const effectiveFrom = versions.length === 0 ? INITIAL_GOAL_EFFECTIVE_FROM : today;
  const active = selectGoalActiveOnDate(versions.map((version) => ({
    effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10),
    recordedAt: version.recordedAt,
    goalMode: version.goalMode,
    dailyEnergyAdjustment: version.dailyEnergyAdjustment,
    adjustmentSource: version.adjustmentSource,
    desiredWeeklyWeightChange: version.desiredWeeklyWeightChange?.toNumber() ?? null,
  })), today);
  if (active && sameGoal(active, input)) return;
  await transaction.goalConfigurationVersion.create({
    data: {
      userId,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
      goalMode: input.goalMode,
      dailyEnergyAdjustment: input.dailyEnergyAdjustment,
      adjustmentSource: input.adjustmentSource,
      desiredWeeklyWeightChange: input.desiredWeeklyWeightChange ?? null,
      recordedAt: new Date(),
    },
  });
}
