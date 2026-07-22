import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  calculateFinalizedDailyBankChange,
  getBankContributionStatus,
  getProvisionalLockAt,
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
import { createHash } from 'node:crypto';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

export type PostProvisionalDailyBankRecordInput = {
  logDate: string;
  timezone: string;
  importedTotalDailyExpenditure: number;
  expenditureAdjustmentRate?: number;
  goalMode: BankGoalMode;
  goalAdjustmentCalories: number;
  importedCalorieIntake: number;
  finalizedAt?: Date;
  expenditureProvider?: string;
  expenditureProviderRecordId?: string;
  intakeProvider?: string;
  intakeProviderRecordId?: string;
  triggerSyncSessionId?: string;
};

export type ReconciliationResult =
  | { outcome: 'open' | 'not_ready' | 'locked' | 'unchanged'; detail: BankHistoryDayDetailResponse | null }
  | { outcome: 'posted' | 'corrected'; detail: BankHistoryDayDetailResponse };

type RecordWithSnapshots = Prisma.FinalizedDailyBankRecordGetPayload<{
  include: { calculationSnapshots: { orderBy: { version: 'asc' } } };
}>;

type CalculationInputs = {
  importedTotalDailyExpenditure: number;
  expenditureAdjustmentRate: number;
  goalMode: BankGoalMode;
  goalAdjustmentCalories: number;
  importedCalorieIntake: number;
  expenditureProvider: string;
  expenditureProviderRecordId: string;
  intakeProvider: string;
  intakeProviderRecordId: string;
  triggerSyncSessionId: string | null;
};

export interface BankHistoryRepository {
  postProvisionalDailyRecord(
    user: DevelopmentUser,
    input: PostProvisionalDailyBankRecordInput,
  ): Promise<BankHistoryDayDetailResponse>;
  reconcileStoredDay(
    user: DevelopmentUser,
    logDate: string,
    timezone: string,
    triggerSyncSessionId?: string,
  ): Promise<ReconciliationResult>;
  lockExpired(userId: string): Promise<number>;
  lockExpiredDates(userId: string, syncSessionId?: string): Promise<string[]>;
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

function apiStatus(status: 'PROVISIONAL' | 'LOCKED' | 'OPEN') {
  return status === 'PROVISIONAL' ? 'provisional' as const : 'locked' as const;
}

function snapshotReason(reason: 'INITIAL_POSTING' | 'PROVIDER_CORRECTION') {
  return reason === 'INITIAL_POSTING' ? 'initial_posting' as const : 'provider_correction' as const;
}

function toDetail(record: RecordWithSnapshots): BankHistoryDayDetailResponse {
  const latest = record.calculationSnapshots.at(-1);
  return {
    logDate: toDateOnly(record.logDate),
    timezone: record.timezone,
    importedTotalDailyExpenditure:
      latest?.importedTotalDailyExpenditure ?? record.importedTotalDailyExpenditure,
    expenditureAdjustmentRate:
      latest?.expenditureAdjustmentRate.toNumber() ?? record.expenditureAdjustmentRate.toNumber(),
    adjustedExpenditure: latest?.adjustedExpenditure ?? record.adjustedExpenditure,
    goalMode: (latest?.goalMode ?? record.goalMode) as GoalMode,
    goalAdjustmentCalories: latest?.goalAdjustmentCalories ?? record.goalAdjustmentCalories,
    importedCalorieIntake: latest?.importedCalorieIntake ?? record.importedCalorieIntake,
    dailyAllowance: latest?.dailyAllowance ?? record.dailyAllowance,
    dailyBankChange: record.effectiveDailyBankChange,
    originalDailyBankChange: record.originalDailyBankChange,
    effectiveDailyBankChange: record.effectiveDailyBankChange,
    status: apiStatus(record.status),
    locksAt: record.lockAt.toISOString(),
    lockedAt: record.lockedAt?.toISOString() ?? null,
    correctionCount: record.correctionCount,
    finalizedAt: record.finalizedAt.toISOString(),
    versions: record.calculationSnapshots.map((snapshot) => ({
      version: snapshot.version,
      reason: snapshotReason(snapshot.reason),
      dailyBankChange: snapshot.dailyBankChange,
      correctionDelta: snapshot.correctionDelta,
      importedTotalDailyExpenditure: snapshot.importedTotalDailyExpenditure,
      importedCalorieIntake: snapshot.importedCalorieIntake,
      expenditureProvider: snapshot.expenditureProvider,
      intakeProvider: snapshot.intakeProvider,
      createdAt: snapshot.createdAt.toISOString(),
    })),
  };
}

function toDaySummary(record: RecordWithSnapshots) {
  return {
    logDate: toDateOnly(record.logDate),
    dailyBankChange: record.effectiveDailyBankChange,
    originalDailyBankChange: record.originalDailyBankChange,
    status: apiStatus(record.status),
    locksAt: record.lockAt.toISOString(),
    correctionCount: record.correctionCount,
    goalMode: record.goalMode as GoalMode,
    finalizedAt: record.finalizedAt.toISOString(),
  } satisfies BankHistoryDaySummary;
}

function startDateForRange(range: BankHistoryRange, endDate: string, earliestDate: string | null) {
  if (range === 'ALL') return earliestDate;
  const date = parseLogDate(endDate);
  const daysBack = { D: 0, W: 6, M: 30, '3M': 91, Y: 364 }[range];
  date.setUTCDate(date.getUTCDate() - daysBack);
  return toDateOnly(date);
}

function inputFingerprint(input: CalculationInputs) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        importedTotalDailyExpenditure: input.importedTotalDailyExpenditure,
        expenditureAdjustmentRate: input.expenditureAdjustmentRate,
        goalMode: input.goalMode,
        goalAdjustmentCalories: input.goalAdjustmentCalories,
        importedCalorieIntake: input.importedCalorieIntake,
        expenditureProvider: input.expenditureProvider,
        expenditureProviderRecordId: input.expenditureProviderRecordId,
        intakeProvider: input.intakeProvider,
        intakeProviderRecordId: input.intakeProviderRecordId,
      }),
    )
    .digest('hex');
}

export class PrismaBankHistoryRepository implements BankHistoryRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly options: {
      now?: () => Date;
      allowSyntheticProviders?: boolean;
    } = {},
  ) {}

  private now() {
    return this.options.now?.() ?? new Date();
  }

  private async lockDay(transaction: Prisma.TransactionClient, userId: string, logDate: string) {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${logDate}))`;
  }

  private async recordWithSnapshots(transaction: Prisma.TransactionClient, id: string) {
    return transaction.finalizedDailyBankRecord.findUniqueOrThrow({
      where: { id },
      include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
    });
  }

  private async postOrReconcile(
    transaction: Prisma.TransactionClient,
    user: DevelopmentUser,
    logDate: string,
    timezone: string,
    inputs: CalculationInputs,
    processedAt: Date,
    alreadyLocked = false,
  ): Promise<ReconciliationResult> {
    if (!alreadyLocked) await this.lockDay(transaction, user.id, logDate);
    const date = parseLogDate(logDate);
    const existing = await transaction.finalizedDailyBankRecord.findUnique({
      where: { userId_logDate: { userId: user.id, logDate: date } },
    });

    if (existing?.status === 'LOCKED' || (existing && processedAt >= existing.lockAt)) {
      if (existing.status !== 'LOCKED') {
        await transaction.finalizedDailyBankRecord.update({
          where: { id: existing.id },
          data: {
            status: 'LOCKED',
            lockedAt: processedAt,
            lockedBySyncSessionId: inputs.triggerSyncSessionId,
          },
        });
      }
      return {
        outcome: 'locked',
        detail: toDetail(await this.recordWithSnapshots(transaction, existing.id)),
      };
    }

    const calculation = calculateFinalizedDailyBankChange(inputs);
    const fingerprint = inputFingerprint(inputs);

    if (!existing) {
      const lockAt = getProvisionalLockAt(logDate, timezone);
      const lifecycle = getBankContributionStatus(logDate, timezone, processedAt);
      if (lifecycle === 'open') return { outcome: 'open', detail: null };
      const status = lifecycle === 'locked' ? 'LOCKED' : 'PROVISIONAL';
      const record = await transaction.finalizedDailyBankRecord.create({
        data: {
          userId: user.id,
          logDate: date,
          timezone,
          importedTotalDailyExpenditure: inputs.importedTotalDailyExpenditure,
          expenditureAdjustmentRate: inputs.expenditureAdjustmentRate,
          adjustedExpenditure: calculation.adjustedExpenditure,
          goalMode: inputs.goalMode,
          goalAdjustmentCalories: inputs.goalAdjustmentCalories,
          importedCalorieIntake: inputs.importedCalorieIntake,
          dailyAllowance: calculation.dailyAllowance,
          dailyBankChange: calculation.dailyBankChange,
          originalDailyBankChange: calculation.dailyBankChange,
          effectiveDailyBankChange: calculation.dailyBankChange,
          status,
          correctionCount: 0,
          currentVersion: 1,
          lockAt,
          lockedAt: status === 'LOCKED' ? processedAt : null,
          lockedBySyncSessionId: status === 'LOCKED' ? inputs.triggerSyncSessionId : null,
          finalizedAt: processedAt,
        },
      });
      const snapshot = await transaction.bankCalculationSnapshot.create({
        data: {
          finalizedDailyBankRecordId: record.id,
          userId: user.id,
          version: 1,
          reason: 'INITIAL_POSTING',
          ...inputs,
          triggerSyncSessionId: inputs.triggerSyncSessionId,
          adjustedExpenditure: calculation.adjustedExpenditure,
          dailyAllowance: calculation.dailyAllowance,
          dailyBankChange: calculation.dailyBankChange,
          correctionDelta: calculation.dailyBankChange,
          inputFingerprint: fingerprint,
        },
      });
      await transaction.calorieLedgerTransaction.create({
        data: {
          userId: user.id,
          logDate: date,
          type: 'daily_finalization',
          amountCalories: calculation.dailyBankChange,
          sourceType: 'finalized_daily_bank_record',
          sourceId: record.id,
          calculationSnapshotId: snapshot.id,
          idempotencyKey: `provisional-posting:${user.id}:${logDate}`,
          description: `Initial bank contribution for ${logDate}`,
        },
      });
      return { outcome: 'posted', detail: toDetail(await this.recordWithSnapshots(transaction, record.id)) };
    }

    const correctionDelta = calculation.dailyBankChange - existing.effectiveDailyBankChange;
    if (correctionDelta === 0) {
      return { outcome: 'unchanged', detail: toDetail(await this.recordWithSnapshots(transaction, existing.id)) };
    }

    const duplicate = await transaction.bankCalculationSnapshot.findUnique({
      where: {
        finalizedDailyBankRecordId_inputFingerprint: {
          finalizedDailyBankRecordId: existing.id,
          inputFingerprint: fingerprint,
        },
      },
    });
    if (duplicate) {
      return { outcome: 'unchanged', detail: toDetail(await this.recordWithSnapshots(transaction, existing.id)) };
    }

    const version = existing.currentVersion + 1;
    const snapshot = await transaction.bankCalculationSnapshot.create({
      data: {
        finalizedDailyBankRecordId: existing.id,
        userId: user.id,
        version,
        reason: 'PROVIDER_CORRECTION',
        ...inputs,
        triggerSyncSessionId: inputs.triggerSyncSessionId,
        adjustedExpenditure: calculation.adjustedExpenditure,
        dailyAllowance: calculation.dailyAllowance,
        dailyBankChange: calculation.dailyBankChange,
        correctionDelta,
        inputFingerprint: fingerprint,
      },
    });
    await transaction.calorieLedgerTransaction.create({
      data: {
        userId: user.id,
        logDate: date,
        type: 'adjustment',
        amountCalories: correctionDelta,
        sourceType: 'finalized_daily_bank_record',
        sourceId: existing.id,
        calculationSnapshotId: snapshot.id,
        idempotencyKey: `provider-correction:${existing.id}:v${version}:${fingerprint}`,
        description: `Provider correction for ${logDate}`,
      },
    });
    await transaction.finalizedDailyBankRecord.update({
      where: { id: existing.id },
      data: {
        effectiveDailyBankChange: calculation.dailyBankChange,
        correctionCount: { increment: 1 },
        currentVersion: version,
      },
    });
    return { outcome: 'corrected', detail: toDetail(await this.recordWithSnapshots(transaction, existing.id)) };
  }

  async postProvisionalDailyRecord(
    user: DevelopmentUser,
    input: PostProvisionalDailyBankRecordInput,
  ) {
    const processedAt = input.finalizedAt ?? this.now();
    const result = await this.db.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: { id: user.id, email: user.email, profile: { create: { timezone: input.timezone } } },
      });
      return this.postOrReconcile(
        transaction,
        user,
        input.logDate,
        input.timezone,
        {
          importedTotalDailyExpenditure: input.importedTotalDailyExpenditure,
          expenditureAdjustmentRate:
            input.expenditureAdjustmentRate ?? V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
          goalMode: input.goalMode,
          goalAdjustmentCalories: input.goalAdjustmentCalories,
          importedCalorieIntake: input.importedCalorieIntake,
          expenditureProvider: input.expenditureProvider ?? 'development_seed',
          expenditureProviderRecordId:
            input.expenditureProviderRecordId ?? `development:expenditure:${input.logDate}`,
          intakeProvider: input.intakeProvider ?? 'development_seed',
          intakeProviderRecordId: input.intakeProviderRecordId ?? `development:intake:${input.logDate}`,
          triggerSyncSessionId: input.triggerSyncSessionId ?? null,
        },
        processedAt,
      );
    });
    if (!result.detail) throw new Error('The current calendar day cannot be posted to the bank.');
    return result.detail;
  }

  async reconcileStoredDay(
    user: DevelopmentUser,
    logDate: string,
    timezone: string,
    triggerSyncSessionId?: string,
  ): Promise<ReconciliationResult> {
    const processedAt = this.now();
    return this.db.$transaction(async (transaction) => {
      await this.lockDay(transaction, user.id, logDate);
      const date = parseLogDate(logDate);
      const lifecycle = getBankContributionStatus(logDate, timezone, processedAt);
      const existing = await transaction.finalizedDailyBankRecord.findUnique({
        where: { userId_logDate: { userId: user.id, logDate: date } },
      });
      if (lifecycle === 'open') return { outcome: 'open', detail: null };
      if (existing?.status === 'LOCKED' || (existing && processedAt >= existing.lockAt)) {
        if (existing.status !== 'LOCKED') {
          await transaction.finalizedDailyBankRecord.update({
            where: { id: existing.id },
            data: {
              status: 'LOCKED',
              lockedAt: processedAt,
              lockedBySyncSessionId: triggerSyncSessionId ?? null,
            },
          });
        }
        return {
          outcome: 'locked',
          detail: toDetail(await this.recordWithSnapshots(transaction, existing.id)),
        };
      }

      const providerFilter = this.options.allowSyntheticProviders
        ? {}
        : { provider: { not: 'development' } };
      const [expenditure, intake, goal] = await Promise.all([
        transaction.dailyExpenditureAggregate.findFirst({
          where: { userId: user.id, localDate: date, ...providerFilter },
          orderBy: { updatedAt: 'desc' },
        }),
        transaction.dailyIntakeAggregate.findFirst({
          where: { userId: user.id, localDate: date, ...providerFilter },
          orderBy: { updatedAt: 'desc' },
        }),
        transaction.goalConfiguration.findUnique({ where: { userId: user.id } }),
      ]);
      if (!expenditure || !intake || (!goal && !existing)) {
        return { outcome: 'not_ready', detail: existing ? toDetail(await this.recordWithSnapshots(transaction, existing.id)) : null };
      }

      const goalMode = (existing?.goalMode ?? goal?.goalMode) as BankGoalMode;
      const goalAdjustmentCalories = existing
        ? existing.goalAdjustmentCalories
        : Math.abs(goal?.dailyEnergyAdjustment ?? 0);
      return this.postOrReconcile(
        transaction,
        user,
        logDate,
        timezone,
        {
          importedTotalDailyExpenditure: expenditure.rawTotalDailyExpenditure,
          expenditureAdjustmentRate:
            existing?.expenditureAdjustmentRate.toNumber() ?? expenditure.adjustmentFactor.toNumber(),
          goalMode,
          goalAdjustmentCalories,
          importedCalorieIntake: intake.totalCaloriesConsumed,
          expenditureProvider: expenditure.provider,
          expenditureProviderRecordId: expenditure.providerRecordId,
          intakeProvider: intake.provider,
          intakeProviderRecordId: intake.providerRecordId,
          triggerSyncSessionId:
            triggerSyncSessionId ?? expenditure.syncSessionId ?? intake.syncSessionId ?? null,
        },
        processedAt,
        true,
      );
    });
  }

  async lockExpired(userId: string) {
    return (await this.lockExpiredDates(userId)).length;
  }

  async lockExpiredDates(userId: string, syncSessionId?: string) {
    const processedAt = this.now();
    return this.db.$transaction(async (transaction) => {
      const candidates = await transaction.finalizedDailyBankRecord.findMany({
        where: { userId, status: 'PROVISIONAL', lockAt: { lte: processedAt } },
        select: { id: true, logDate: true },
        orderBy: { logDate: 'asc' },
      });
      if (candidates.length === 0) return [];
      await transaction.finalizedDailyBankRecord.updateMany({
        where: { id: { in: candidates.map((candidate) => candidate.id) }, status: 'PROVISIONAL' },
        data: {
          status: 'LOCKED',
          lockedAt: processedAt,
          ...(syncSessionId ? { lockedBySyncSessionId: syncSessionId } : {}),
        },
      });
      return candidates.map((candidate) => toDateOnly(candidate.logDate));
    });
  }

  async getSummary(userId: string): Promise<BankSummaryResponse> {
    await this.lockExpired(userId);
    const [ledgerSum, latest, count] = await Promise.all([
      this.db.calorieLedgerTransaction.aggregate({ where: { userId }, _sum: { amountCalories: true } }),
      this.db.finalizedDailyBankRecord.findFirst({ where: { userId }, orderBy: { logDate: 'desc' } }),
      this.db.finalizedDailyBankRecord.count({ where: { userId } }),
    ]);
    return {
      availableBankCalories: ledgerSum._sum.amountCalories ?? 0,
      latestFinalizedDate: latest ? toDateOnly(latest.logDate) : null,
      latestDailyBankChange: latest?.effectiveDailyBankChange ?? null,
      latestOriginalDailyBankChange: latest?.originalDailyBankChange ?? null,
      latestContributionStatus: latest ? apiStatus(latest.status) : null,
      latestLocksAt: latest?.lockAt.toISOString() ?? null,
      latestCorrectionCount: latest?.correctionCount ?? 0,
      finalizedDayCount: count,
    };
  }

  async getHistory(userId: string, range: BankHistoryRange): Promise<BankHistoryResponse> {
    const summary = await this.getSummary(userId);
    const earliest = await this.db.finalizedDailyBankRecord.findFirst({
      where: { userId }, orderBy: { logDate: 'asc' }, select: { logDate: true },
    });
    if (!summary.latestFinalizedDate) {
      return { range, startDate: null, endDate: null, availableBankCalories: summary.availableBankCalories, rangeNetChangeCalories: 0, finalizedDays: [] };
    }
    const startDate = startDateForRange(
      range,
      summary.latestFinalizedDate,
      earliest ? toDateOnly(earliest.logDate) : null,
    );
    const records = await this.db.finalizedDailyBankRecord.findMany({
      where: {
        userId,
        logDate: {
          ...(startDate ? { gte: parseLogDate(startDate) } : {}),
          lte: parseLogDate(summary.latestFinalizedDate),
        },
      },
      orderBy: { logDate: 'desc' },
      include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
    });
    return {
      range,
      startDate,
      endDate: summary.latestFinalizedDate,
      availableBankCalories: summary.availableBankCalories,
      rangeNetChangeCalories: records.reduce((sum, record) => sum + record.effectiveDailyBankChange, 0),
      finalizedDays: records.map(toDaySummary),
    };
  }

  async getDayDetail(userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null> {
    await this.lockExpired(userId);
    const record = await this.db.finalizedDailyBankRecord.findUnique({
      where: { userId_logDate: { userId, logDate: parseLogDate(logDate) } },
      include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
    });
    return record ? toDetail(record) : null;
  }
}
