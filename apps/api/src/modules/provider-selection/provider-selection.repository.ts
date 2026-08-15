import type { ProviderSelectionInput, ProviderSelectionResponse } from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { BankHistoryRepository } from '../bank-history/bank-history.repository';
import { AppError } from '../../errors';

export const DEFAULT_EXPENDITURE_PROVIDER = 'apple_health';
export const DEFAULT_INTAKE_PROVIDER = 'apple_health';

export type ProviderSelectionRecord = {
  authoritativeExpenditureProvider: string;
  authoritativeIntakeProvider: string;
  allowExpenditureFallback: boolean;
};

export interface ProviderSelectionRepository {
  get(userId: string): Promise<ProviderSelectionResponse>;
  update(user: DevelopmentUser, input: ProviderSelectionInput): Promise<ProviderSelectionResponse>;
}

export async function readProviderSelection(
  db: Pick<PrismaClient, 'providerSelection'>,
  userId: string,
): Promise<ProviderSelectionRecord> {
  return (
    (await db.providerSelection.findUnique({ where: { userId } })) ?? {
      authoritativeExpenditureProvider: DEFAULT_EXPENDITURE_PROVIDER,
      authoritativeIntakeProvider: DEFAULT_INTAKE_PROVIDER,
      allowExpenditureFallback: false,
    }
  );
}

export class PrismaProviderSelectionRepository implements ProviderSelectionRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly bankHistory: BankHistoryRepository,
  ) {}

  private async response(userId: string): Promise<ProviderSelectionResponse> {
    const [selection, fitbit, appleExpenditure, appleIntake] = await Promise.all([
      readProviderSelection(this.db, userId),
      this.db.fitbitConnection.findUnique({ where: { userId } }),
      this.db.dailyExpenditureAggregate.findFirst({
        where: { userId, provider: 'apple_health' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.dailyIntakeAggregate.findFirst({
        where: { userId, provider: 'apple_health' },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const fitbitStatus = fitbit?.status === 'connected' ? 'connected' : fitbit ? 'needs_attention' : 'not_connected';
    const expenditureReady = selection.authoritativeExpenditureProvider === 'fitbit'
      ? fitbit?.status === 'connected'
      : Boolean(appleExpenditure);
    return {
      expenditure: {
        authoritativeProvider: selection.authoritativeExpenditureProvider as 'apple_health' | 'fitbit',
        displayName: selection.authoritativeExpenditureProvider === 'fitbit' ? 'Fitbit' : 'Apple Health',
        status: expenditureReady ? 'ready' : selection.authoritativeExpenditureProvider === 'fitbit' ? fitbitStatus : 'unavailable',
        fallbackActive: false,
      },
      intake: {
        authoritativeProvider: 'apple_health',
        displayName: 'Apple Health',
        status: appleIntake ? 'ready' : 'unavailable',
      },
      connectedProviders: [
        {
          provider: 'apple_health',
          displayName: 'Apple Health',
          status: appleExpenditure || appleIntake ? 'connected' : 'not_connected',
          lastSyncedAt: [appleExpenditure?.updatedAt, appleIntake?.updatedAt]
            .filter((value): value is Date => Boolean(value))
            .sort((left, right) => right.getTime() - left.getTime())[0]?.toISOString() ?? null,
        },
        {
          provider: 'fitbit',
          displayName: 'Fitbit',
          status: fitbitStatus,
          lastSyncedAt: fitbit?.lastSyncedAt?.toISOString() ?? null,
        },
      ],
    };
  }

  get(userId: string) {
    return this.response(userId);
  }

  async update(user: DevelopmentUser, input: ProviderSelectionInput) {
    if (input.authoritativeExpenditureProvider === 'fitbit') {
      const fitbit = await this.db.fitbitConnection.findUnique({ where: { userId: user.id } });
      if (!fitbit || fitbit.status !== 'connected') {
        throw new AppError('Connect Fitbit before selecting it for calorie burn.', 409);
      }
    }
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email },
    });
    await this.db.providerSelection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        authoritativeExpenditureProvider: input.authoritativeExpenditureProvider,
        authoritativeIntakeProvider: input.authoritativeIntakeProvider,
      },
      update: {
        authoritativeExpenditureProvider: input.authoritativeExpenditureProvider,
        authoritativeIntakeProvider: input.authoritativeIntakeProvider,
        allowExpenditureFallback: false,
        selectedAt: new Date(),
      },
    });

    const provisional = await this.db.finalizedDailyBankRecord.findMany({
      where: { userId: user.id, status: 'PROVISIONAL' },
      select: { logDate: true, timezone: true },
    });
    for (const record of provisional) {
      await this.bankHistory.reconcileStoredDay(
        user,
        record.logDate.toISOString().slice(0, 10),
        record.timezone,
      );
    }
    return this.response(user.id);
  }
}
