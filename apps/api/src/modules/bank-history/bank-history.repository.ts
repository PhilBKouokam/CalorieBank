import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  calculateFinalizedDailyBankChange,
  type BankGoalMode,
} from '@caloriebank/domain';
import type {
  BankHistoryDayDetailResponse,
  BankHistoryDaySummary,
  BankHistoryRange,
  BankHistoryResponse,
  BankSummaryResponse,
  GoalMode,
} from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

export type FinalizeDailyBankRecordInput = {
  logDate: string;
  timezone: string;
  importedTotalDailyExpenditure: number;
  expenditureAdjustmentRate?: number;
  goalMode: BankGoalMode;
  goalAdjustmentCalories: number;
  importedCalorieIntake: number;
  finalizedAt?: Date;
};

type FinalizedRecord = {
  id: string;
  userId: string;
  logDate: Date;
  timezone: string;
  importedTotalDailyExpenditure: number;
  expenditureAdjustmentRate: Prisma.Decimal;
  adjustedExpenditure: number;
  goalMode: string;
  goalAdjustmentCalories: number;
  importedCalorieIntake: number;
  dailyAllowance: number;
  dailyBankChange: number;
  finalizedAt: Date;
  createdAt: Date;
};

export interface BankHistoryRepository {
  finalizeDailyRecord(
    user: DevelopmentUser,
    input: FinalizeDailyBankRecordInput,
  ): Promise<BankHistoryDayDetailResponse>;
  getSummary(userId: string): Promise<BankSummaryResponse>;
  getHistory(userId: string, range: BankHistoryRange): Promise<BankHistoryResponse>;
  getDayDetail(userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null>;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseLogDate(logDate: string) {
  return new Date(`${logDate}T00:00:00.000Z`);
}

function toDetail(record: FinalizedRecord): BankHistoryDayDetailResponse {
  return {
    logDate: toDateOnly(record.logDate),
    timezone: record.timezone,
    importedTotalDailyExpenditure: record.importedTotalDailyExpenditure,
    expenditureAdjustmentRate: record.expenditureAdjustmentRate.toNumber(),
    adjustedExpenditure: record.adjustedExpenditure,
    goalMode: record.goalMode as GoalMode,
    goalAdjustmentCalories: record.goalAdjustmentCalories,
    importedCalorieIntake: record.importedCalorieIntake,
    dailyAllowance: record.dailyAllowance,
    dailyBankChange: record.dailyBankChange,
    finalizedAt: record.finalizedAt.toISOString(),
  };
}

function toDaySummary(record: Pick<FinalizedRecord, 'logDate' | 'dailyBankChange' | 'goalMode' | 'finalizedAt'>) {
  return {
    logDate: toDateOnly(record.logDate),
    dailyBankChange: record.dailyBankChange,
    goalMode: record.goalMode as GoalMode,
    finalizedAt: record.finalizedAt.toISOString(),
  } satisfies BankHistoryDaySummary;
}

function startDateForRange(range: BankHistoryRange, endDate: string, earliestDate: string | null) {
  if (range === 'ALL') return earliestDate;

  const date = parseLogDate(endDate);
  const daysBack = {
    D: 0,
    W: 6,
    M: 30,
    '3M': 91,
    Y: 364,
  }[range];

  date.setUTCDate(date.getUTCDate() - daysBack);
  return toDateOnly(date);
}

export class PrismaBankHistoryRepository implements BankHistoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async finalizeDailyRecord(
    user: DevelopmentUser,
    input: FinalizeDailyBankRecordInput,
  ): Promise<BankHistoryDayDetailResponse> {
    const existing = await this.db.finalizedDailyBankRecord.findUnique({
      where: {
        userId_logDate: {
          userId: user.id,
          logDate: parseLogDate(input.logDate),
        },
      },
    });

    if (existing) {
      return toDetail(existing);
    }

    const expenditureAdjustmentRate =
      input.expenditureAdjustmentRate ?? V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE;
    const calculated = calculateFinalizedDailyBankChange({
      importedTotalDailyExpenditure: input.importedTotalDailyExpenditure,
      expenditureAdjustmentRate,
      goalMode: input.goalMode,
      goalAdjustmentCalories: input.goalAdjustmentCalories,
      importedCalorieIntake: input.importedCalorieIntake,
    });
    const logDate = parseLogDate(input.logDate);
    const idempotencyKey = `daily-finalization:${user.id}:${input.logDate}`;

    const record = await this.db.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: {
          id: user.id,
          email: user.email,
          profile: { create: { timezone: input.timezone } },
        },
      });

      const finalizedRecord = await transaction.finalizedDailyBankRecord.create({
        data: {
          userId: user.id,
          logDate,
          timezone: input.timezone,
          importedTotalDailyExpenditure: input.importedTotalDailyExpenditure,
          expenditureAdjustmentRate,
          adjustedExpenditure: calculated.adjustedExpenditure,
          goalMode: input.goalMode,
          goalAdjustmentCalories: input.goalAdjustmentCalories,
          importedCalorieIntake: input.importedCalorieIntake,
          dailyAllowance: calculated.dailyAllowance,
          dailyBankChange: calculated.dailyBankChange,
          finalizedAt: input.finalizedAt ?? new Date(),
        },
      });

      await transaction.calorieLedgerTransaction.create({
        data: {
          userId: user.id,
          logDate,
          type: 'daily_finalization',
          amountCalories: finalizedRecord.dailyBankChange,
          sourceType: 'finalized_daily_bank_record',
          sourceId: finalizedRecord.id,
          idempotencyKey,
          description: `Finalized bank result for ${input.logDate}`,
        },
      });

      return finalizedRecord;
    });

    return toDetail(record);
  }

  async getSummary(userId: string): Promise<BankSummaryResponse> {
    const [ledgerSum, latest, count] = await Promise.all([
      this.db.calorieLedgerTransaction.aggregate({
        where: { userId },
        _sum: { amountCalories: true },
      }),
      this.db.finalizedDailyBankRecord.findFirst({
        where: { userId },
        orderBy: { logDate: 'desc' },
      }),
      this.db.finalizedDailyBankRecord.count({ where: { userId } }),
    ]);

    return {
      availableBankCalories: ledgerSum._sum.amountCalories ?? 0,
      latestFinalizedDate: latest ? toDateOnly(latest.logDate) : null,
      latestDailyBankChange: latest?.dailyBankChange ?? null,
      finalizedDayCount: count,
    };
  }

  async getHistory(userId: string, range: BankHistoryRange): Promise<BankHistoryResponse> {
    const summary = await this.getSummary(userId);
    const earliest = await this.db.finalizedDailyBankRecord.findFirst({
      where: { userId },
      orderBy: { logDate: 'asc' },
      select: { logDate: true },
    });

    if (!summary.latestFinalizedDate) {
      return {
        range,
        startDate: null,
        endDate: null,
        availableBankCalories: summary.availableBankCalories,
        rangeNetChangeCalories: 0,
        finalizedDays: [],
      };
    }

    const startDate = startDateForRange(
      range,
      summary.latestFinalizedDate,
      earliest ? toDateOnly(earliest.logDate) : null,
    );
    const endDate = summary.latestFinalizedDate;
    const records = await this.db.finalizedDailyBankRecord.findMany({
      where: {
        userId,
        logDate: {
          ...(startDate ? { gte: parseLogDate(startDate) } : {}),
          lte: parseLogDate(endDate),
        },
      },
      orderBy: { logDate: 'desc' },
    });

    return {
      range,
      startDate,
      endDate,
      availableBankCalories: summary.availableBankCalories,
      rangeNetChangeCalories: records.reduce((sum, record) => sum + record.dailyBankChange, 0),
      finalizedDays: records.map(toDaySummary),
    };
  }

  async getDayDetail(userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null> {
    const record = await this.db.finalizedDailyBankRecord.findUnique({
      where: {
        userId_logDate: {
          userId,
          logDate: parseLogDate(logDate),
        },
      },
    });

    return record ? toDetail(record) : null;
  }
}
