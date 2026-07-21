import type {
  ActivePlannedTreatResponse,
  PlannedTreatGetResponse,
  PlannedTreatInput,
} from '@caloriebank/schemas';
import type { PlannedTreat, PrismaClient } from '@prisma/client';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { derivePlannedTreatProgress } from './planned-treat.progress';

export interface PlannedTreatRepository {
  getForUser(userId: string): Promise<PlannedTreatGetResponse>;
  createOrReplaceForUser(
    user: DevelopmentUser,
    input: PlannedTreatInput,
  ): Promise<ActivePlannedTreatResponse>;
  updateForUser(userId: string, input: PlannedTreatInput): Promise<ActivePlannedTreatResponse>;
  deleteForUser(userId: string): Promise<void>;
}

function toDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseOptionalDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function getAvailableBankCalories(db: PrismaClient, userId: string) {
  const ledgerSum = await db.calorieLedgerTransaction.aggregate({
    where: { userId },
    _sum: { amountCalories: true },
  });

  return ledgerSum._sum.amountCalories ?? 0;
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

  async getForUser(userId: string): Promise<PlannedTreatGetResponse> {
    const [treat, availableBankCalories] = await Promise.all([
      this.db.plannedTreat.findUnique({ where: { userId } }),
      getAvailableBankCalories(this.db, userId),
    ]);

    if (!treat) {
      return {
        status: 'no_plan',
        plannedTreat: null,
        availableBankCalories,
      };
    }

    return toResponse(treat, availableBankCalories);
  }

  async createOrReplaceForUser(
    user: DevelopmentUser,
    input: PlannedTreatInput,
  ): Promise<ActivePlannedTreatResponse> {
    const treat = await this.db.$transaction(async (transaction) => {
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

  async updateForUser(userId: string, input: PlannedTreatInput): Promise<ActivePlannedTreatResponse> {
    const existing = await this.db.plannedTreat.findUnique({ where: { userId } });

    if (!existing) {
      throw new AppError('Planned Treat has not been configured.', 404);
    }

    const treat = await this.db.plannedTreat.update({
      where: { userId },
      data: {
        name: input.name,
        requiredCalories: input.requiredCalories,
        targetDate: parseOptionalDate(input.targetDate),
        completedAt: null,
        deletedAt: null,
      },
    });
    const availableBankCalories = await getAvailableBankCalories(this.db, userId);

    return toResponse(treat, availableBankCalories);
  }

  async deleteForUser(userId: string): Promise<void> {
    const existing = await this.db.plannedTreat.findUnique({ where: { userId } });

    if (!existing) {
      return;
    }

    await this.db.plannedTreat.delete({ where: { userId } });
  }
}
