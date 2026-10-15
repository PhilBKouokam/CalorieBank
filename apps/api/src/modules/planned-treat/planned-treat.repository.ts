import { settingTransaction, type SettingsOptions } from '../settings-concurrency/settings-concurrency';
import type {
  ActivePlannedTreatResponse,
  PlannedTreatGetResponse,
  PlannedTreatInput,
} from '@caloriebank/schemas';
import { deriveConsumerBankBalances } from '@caloriebank/domain';
import type { PlannedTreat, Prisma, PrismaClient } from '@prisma/client';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { derivePlannedTreatProgress } from './planned-treat.progress';

export interface PlannedTreatRepository {
  getForUser(userId: string, options?: SettingsOptions): Promise<PlannedTreatGetResponse>;
  createOrReplaceForUser(
    user: DevelopmentUser,
    input: PlannedTreatInput,
    options?: SettingsOptions,
  ): Promise<ActivePlannedTreatResponse>;
  updateForUser(userId: string, input: PlannedTreatInput, options?: SettingsOptions): Promise<ActivePlannedTreatResponse>;
  deleteForUser(userId: string, options?: SettingsOptions): Promise<void>;
}

function toDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseOptionalDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function getAvailableBankCalories(db: Prisma.TransactionClient, userId: string) {
  const [ledgerSum, initialization] = await Promise.all([
    db.calorieLedgerTransaction.aggregate({
      where: { userId },
      _sum: { amountCalories: true },
    }),
    db.bankAccountInitialization.findUnique({
      where: { userId },
      select: { openingEffectiveBalanceCalories: true },
    }),
  ]);

  return deriveConsumerBankBalances(
    (initialization?.openingEffectiveBalanceCalories ?? 0) +
      (ledgerSum._sum.amountCalories ?? 0),
  ).availableBankCalories;
}

function toResponse(
  treat: PlannedTreat,
  availableBankCalories: number,
): ActivePlannedTreatResponse {
  const progress = derivePlannedTreatProgress(availableBankCalories, treat.requiredCalories);

  return {
    id: treat.id,
    name: treat.name,
    requiredCalories: treat.requiredCalories,
    targetDate: toDateOnly(treat.targetDate),
    availableBankCalories,
    ...progress,
    createdAt: treat.createdAt.toISOString(),
    updatedAt: treat.updatedAt.toISOString(),
  };
}

export class PrismaPlannedTreatRepository implements PlannedTreatRepository {
  constructor(private readonly db: PrismaClient) {}

  async getForUser(userId: string, options?: SettingsOptions): Promise<PlannedTreatGetResponse> {
    return settingTransaction(this.db, userId, 'banking-goal', false, options, async tx => {
    const [treat, availableBankCalories] = await Promise.all([
      tx.plannedTreat.findUnique({ where: { userId } }),
      getAvailableBankCalories(tx, userId),
    ]);

    if (!treat) {
      return {
        status: 'no_plan',
        plannedTreat: null,
        availableBankCalories,
      };
    }

    return toResponse(treat, availableBankCalories);
    });
  }

  async createOrReplaceForUser(
    user: DevelopmentUser,
    input: PlannedTreatInput,
    options?: SettingsOptions,
  ): Promise<ActivePlannedTreatResponse> {
    const treat = await settingTransaction(this.db, user.id, 'banking-goal', true, options, async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: {
          id: user.id,
          email: user.email,
          profile: { create: {} },
        },
      });

      return transaction.plannedTreat.upsert({
        where: { userId: user.id },
        update: {
          name: input.name,
          requiredCalories: input.requiredCalories,
          targetDate: parseOptionalDate(input.targetDate),
          completedAt: null,
          deletedAt: null,
        },
        create: {
          userId: user.id,
          name: input.name,
          requiredCalories: input.requiredCalories,
          targetDate: parseOptionalDate(input.targetDate),
        },
      });
    });
    const availableBankCalories = await getAvailableBankCalories(this.db, user.id);

    return toResponse(treat, availableBankCalories);
  }

  async updateForUser(userId: string, input: PlannedTreatInput, options?: SettingsOptions): Promise<ActivePlannedTreatResponse> {
    return settingTransaction(this.db, userId, 'banking-goal', true, options, async tx => {
    const existing = await tx.plannedTreat.findUnique({ where: { userId } });

    if (!existing) {
      throw new AppError('Planned Treat has not been configured.', 404);
    }

    const treat = await tx.plannedTreat.update({
      where: { userId },
      data: {
        name: input.name,
        requiredCalories: input.requiredCalories,
        targetDate: parseOptionalDate(input.targetDate),
        completedAt: null,
        deletedAt: null,
      },
    });
    const availableBankCalories = await getAvailableBankCalories(tx, userId);

    return toResponse(treat, availableBankCalories);
    });
  }

  async deleteForUser(userId: string, options?: SettingsOptions): Promise<void> {
    return settingTransaction(this.db, userId, 'banking-goal', true, options, async tx => {
    const existing = await tx.plannedTreat.findUnique({ where: { userId } });

    if (!existing) {
      return;
    }

    await tx.plannedTreat.delete({ where: { userId } });
    });
  }
}
