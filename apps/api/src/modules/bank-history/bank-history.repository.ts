import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  calculateOpeningEffectiveBalance,
  calculateFinalizedDailyBankChange,
  deriveConsumerBankBalances,
  getBankContributionStatus,
  getPreviousCompletedLocalDates,
  getProvisionalLockAt,
  resolveAuthoritativeProviderRecord,
  type BankGoalMode,
} from '@caloriebank/domain';
import type {
  BankHistoryDayDetailResponse,
  BankHistoryDaySummary,
  BankHistoryRange,
  BankHistoryResponse,
  BankSummaryResponse,
  OpeningBankDetailResponse,
  GoalMode,
  HistoricalSourceMutation,
  HistoricalSourceMutationResponse,
  HistoricalSourceOptionsResponse,
  HealthHistoryDiagnosticResponse,
} from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { readProviderSelection } from '../provider-selection/provider-selection.repository';
import { readOpeningImportState } from './opening-bank-import';
import { AppError } from '../../errors';
import { getLocalDateForTimezone } from '../today/today.time';
import {
  consumerProviderName,
  hasCompletedDayQueryEvidence,
  historicalOptionId,
  resolveDaySourceAuthority,
  type HistoricalRole,
} from './day-source-authority';
import {
  classifyCompletedDayGap,
  completedLocalDates,
  continuityMessage,
} from './history-continuity';

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
  intakeSourceDisplayName?: string | null;
  intakeWriterBundleIdentifier?: string | null;
  triggerSyncSessionId?: string;
};

export type ReconciliationResult =
  | { outcome: 'open' | 'not_ready' | 'excluded' | 'locked' | 'unchanged'; detail: BankHistoryDayDetailResponse | null }
  | { outcome: 'posted' | 'corrected'; detail: BankHistoryDayDetailResponse };

export type OpeningBankInitializationResult = {
  outcome: 'waiting_for_opening_data' | 'no_history' | 'initialized' | 'already_initialized' | 'not_applicable';
  accountingStartsOn: string | null;
  openingEffectiveBalanceCalories: number;
};

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
  intakeSourceDisplayName: string | null;
  intakeWriterBundleIdentifier: string | null;
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
  initializeOpeningBank(
    user: DevelopmentUser,
    currentLocalDate: string,
    timezone: string,
  ): Promise<OpeningBankInitializationResult>;
  getAccountingStartDate(userId: string): Promise<string | null>;
  getSummary(userId: string): Promise<BankSummaryResponse>;
  getHistory(userId: string, range: BankHistoryRange): Promise<BankHistoryResponse>;
  getHealthHistoryDiagnostics?(userId: string, dates: string[]): Promise<HealthHistoryDiagnosticResponse>;
  getOpeningBankDetail(userId: string): Promise<OpeningBankDetailResponse>;
  getDayDetail(userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null>;
  getHistoricalSourceOptions?(userId: string, logDate: string): Promise<HistoricalSourceOptionsResponse>;
  setHistoricalSource?(
    user: DevelopmentUser,
    logDate: string,
    role: 'expenditure' | 'intake',
    input: HistoricalSourceMutation,
  ): Promise<HistoricalSourceMutationResponse>;
  prepareForGoalChange?(user: DevelopmentUser): Promise<{ ready: boolean; unresolvedDates: string[] }>;
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
    provenance: 'finalized',
    startingBalanceFloorApplied: false,
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
      intakeSourceDisplayName: snapshot.intakeSourceDisplayName,
      createdAt: snapshot.createdAt.toISOString(),
    })),
  };
}

function toDaySummary(record: RecordWithSnapshots) {
  return {
    provenance: 'finalized',
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

type OpeningDayWithInitialization = Prisma.OpeningBankCalculationDayGetPayload<{
  include: { initialization: true };
}>;

function openingDaySummary(day: OpeningDayWithInitialization): BankHistoryDaySummary {
  const finalizedAt = day.initialization.initializedAt ?? day.createdAt;
  return {
    provenance: 'opening',
    logDate: toDateOnly(day.logDate),
    dailyBankChange: day.dailyBankChange,
    originalDailyBankChange: day.dailyBankChange,
    status: 'locked',
    locksAt: finalizedAt.toISOString(),
    correctionCount: 0,
    goalMode: day.goalMode as GoalMode,
    finalizedAt: finalizedAt.toISOString(),
  };
}

function openingDayDetail(day: OpeningDayWithInitialization): BankHistoryDayDetailResponse {
  const finalizedAt = day.initialization.initializedAt ?? day.createdAt;
  return {
    provenance: 'opening',
    startingBalanceFloorApplied: (day.initialization.historicalOpeningNetCalories ?? 0) <= 0,
    logDate: toDateOnly(day.logDate),
    timezone: day.timezone,
    importedTotalDailyExpenditure: day.importedTotalDailyExpenditure,
    expenditureAdjustmentRate: day.expenditureAdjustmentRate.toNumber(),
    adjustedExpenditure: day.adjustedExpenditure,
    goalMode: day.goalMode as GoalMode,
    goalAdjustmentCalories: day.goalAdjustmentCalories,
    importedCalorieIntake: day.importedCalorieIntake,
    dailyAllowance: day.dailyAllowance,
    dailyBankChange: day.dailyBankChange,
    originalDailyBankChange: day.dailyBankChange,
    effectiveDailyBankChange: day.dailyBankChange,
    status: 'locked',
    locksAt: finalizedAt.toISOString(),
    lockedAt: finalizedAt.toISOString(),
    correctionCount: 0,
    finalizedAt: finalizedAt.toISOString(),
    versions: [{
      version: 1,
      reason: 'initial_posting',
      dailyBankChange: day.dailyBankChange,
      correctionDelta: day.dailyBankChange,
      importedTotalDailyExpenditure: day.importedTotalDailyExpenditure,
      importedCalorieIntake: day.importedCalorieIntake,
      expenditureProvider: day.expenditureProvider,
      intakeProvider: day.intakeProvider,
      intakeSourceDisplayName: day.intakeSourceDisplayName,
      createdAt: day.createdAt.toISOString(),
    }],
  };
}

function startDateForRange(range: BankHistoryRange, endDate: string, earliestDate: string | null) {
  if (range === 'ALL') return earliestDate;
  const date = parseLogDate(endDate);
  const daysBack = { D: 0, W: 6, M: 30, '3M': 91, Y: 364 }[range];
  date.setUTCDate(date.getUTCDate() - daysBack);
  return toDateOnly(date);
}

function inputFingerprint(input: CalculationInputs, previousVersion: number) {
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
        intakeSourceDisplayName: input.intakeSourceDisplayName ?? null,
        intakeWriterBundleIdentifier: input.intakeWriterBundleIdentifier ?? null,
        previousVersion,
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

  private async continuityMissingDays(userId: string, range: BankHistoryRange) {
    const initialization = await this.db.bankAccountInitialization.findUnique({
      where: { userId },
      select: { accountingStartsOn: true, timezone: true },
    });
    if (!initialization?.accountingStartsOn || !initialization.timezone) return [];

    const accountingStartsOn = toDateOnly(initialization.accountingStartsOn);
    const currentLocalDate = getLocalDateForTimezone(initialization.timezone, this.now());
    const yesterday = completedLocalDates(accountingStartsOn, currentLocalDate).at(-1) ?? null;
    if (!yesterday) return [];
    const rangeStart = startDateForRange(range, yesterday, accountingStartsOn) ?? accountingStartsOn;
    const expectedDates = completedLocalDates(accountingStartsOn, currentLocalDate)
      .filter((date) => date >= rangeStart);
    const recoverableDates = new Set(
      completedLocalDates(accountingStartsOn, currentLocalDate).slice(-8),
    );
    if (expectedDates.length === 0) return [];

    const dateValues = expectedDates.map(parseLogDate);
    const [finalized, opening, processing, sessions, selection] = await Promise.all([
      this.db.finalizedDailyBankRecord.findMany({
        where: { userId, logDate: { in: dateValues } },
        select: { logDate: true },
      }),
      this.db.openingBankCalculationDay.findMany({
        where: { userId, logDate: { in: dateValues } },
        select: { logDate: true },
      }),
      this.db.bankDayProcessingState.findMany({
        where: { userId, logDate: { in: dateValues } },
      }),
      this.db.ingestionSyncSession.findMany({
        where: { userId, datesQueried: { isEmpty: false } },
        orderBy: { startedAt: 'desc' },
      }),
      readProviderSelection(this.db, userId),
    ]);
    const calculated = new Set([...finalized, ...opening].map((record) => toDateOnly(record.logDate)));
    const processingByDate = new Map(processing.map((state) => [toDateOnly(state.logDate), state]));

    const missing = [];
    for (const logDate of expectedDates) {
      if (calculated.has(logDate)) continue;
      const authority = await resolveDaySourceAuthority(
        this.db,
        userId,
        parseLogDate(logDate),
        initialization.timezone,
      );
      const expenditureProvider = authority.expenditureOverride?.provider
        ?? selection.authoritativeExpenditureProvider;
      const intakeProvider = authority.intakeOverride?.provider
        ?? selection.authoritativeIntakeProvider;
      const burnSessions = sessions.filter((session) =>
        session.provider === expenditureProvider && session.datesQueried.includes(logDate));
      const foodSessions = sessions.filter((session) =>
        session.provider === intakeProvider && session.datesQueried.includes(logDate));
      const state = processingByDate.get(logDate);
      const syncFailed = Boolean(state?.lastErrorCode)
        || burnSessions.some((session) => session.status === 'failed' || session.expenditureStatus === 'error')
        || foodSessions.some((session) => session.status === 'failed' || session.intakeStatus === 'error');
      const status = classifyCompletedDayGap({
        hasCalculatedRecord: false,
        hasBurnData: Boolean(authority.selectedExpenditure),
        hasFoodData: Boolean(authority.selectedIntake),
        burnQueried: burnSessions.length > 0,
        foodQueried: foodSessions.length > 0,
        syncFailed,
      });
      if (!status) continue;
      missing.push({
        logDate,
        status,
        message: continuityMessage(status),
        canRetry: recoverableDates.has(logDate)
          && (status !== 'waiting_for_data' || !state?.nextRetryAt || state.nextRetryAt <= this.now()),
      });
      console.warn(JSON.stringify({
        component: 'bank_history',
        event: 'history_gap_detected',
        localDate: logDate,
        missingRole: !authority.selectedExpenditure
          ? 'burned'
          : !authority.selectedIntake ? 'eaten' : 'calculation',
        recoverable: recoverableDates.has(logDate),
        reasonCode: status,
      }));
      if (!recoverableDates.has(logDate)) {
        console.warn(JSON.stringify({
          component: 'bank_history',
          event: 'history_gap_unresolved',
          localDate: logDate,
          reasonCode: 'outside_supported_refresh_window',
        }));
      }
    }
    return missing.sort((a, b) => b.logDate.localeCompare(a.logDate));
  }

  private async recoverStoredContinuityGaps(userId: string) {
    const [initialization, user, goal] = await Promise.all([
      this.db.bankAccountInitialization.findUnique({ where: { userId } }),
      this.db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      this.db.goalConfiguration.findUnique({ where: { userId } }),
    ]);
    if (!initialization?.accountingStartsOn || !initialization.timezone || !user || !goal) return;
    // Without goal-version history, late posting is safe only when the configured goal has never changed.
    if (goal.updatedAt.getTime() !== goal.createdAt.getTime()) return;

    const currentLocalDate = getLocalDateForTimezone(initialization.timezone, this.now());
    const candidates = completedLocalDates(toDateOnly(initialization.accountingStartsOn), currentLocalDate)
      .slice(-8);
    for (const logDate of candidates) {
      const date = parseLogDate(logDate);
      const [calculated, opening] = await Promise.all([
        this.db.finalizedDailyBankRecord.findUnique({
          where: { userId_logDate: { userId, logDate: date } }, select: { id: true },
        }),
        this.db.openingBankCalculationDay.findUnique({
          where: { userId_logDate: { userId, logDate: date } }, select: { id: true },
        }),
      ]);
      if (calculated || opening) continue;
      const authority = await resolveDaySourceAuthority(
        this.db,
        userId,
        date,
        initialization.timezone,
      );
      if (!authority.selectedExpenditure || !authority.selectedIntake) continue;
      console.info(JSON.stringify({
        component: 'bank_history',
        event: 'history_gap_recovery_started',
        localDate: logDate,
      }));
      try {
        const result = await this.reconcileStoredDay(user, logDate, initialization.timezone);
        console.info(JSON.stringify({
          component: 'bank_history',
          event: 'history_gap_recovery_completed',
          localDate: logDate,
          outcome: result.outcome,
        }));
      } catch (error) {
        console.warn(JSON.stringify({
          component: 'bank_history',
          event: 'history_gap_recovery_failed',
          localDate: logDate,
          reasonCode: error instanceof Error ? error.name : 'unknown',
        }));
      }
    }
  }

  async getAccountingStartDate(userId: string) {
    const initialization = await this.db.bankAccountInitialization.findUnique({
      where: { userId },
      select: { accountingStartsOn: true },
    });
    return initialization?.accountingStartsOn ? toDateOnly(initialization.accountingStartsOn) : null;
  }

  async initializeOpeningBank(
    user: DevelopmentUser,
    currentLocalDate: string,
    timezone: string,
  ): Promise<OpeningBankInitializationResult> {
    const startedAt = Date.now();
    const result: OpeningBankInitializationResult = await this.db.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}), hashtext('opening-bank'))`;
      const initialization = await transaction.bankAccountInitialization.findUnique({
        where: { userId: user.id },
      });

      // Accounts without an initialization row predate this policy and retain their ledger unchanged.
      if (!initialization) {
        return {
          outcome: 'not_applicable',
          accountingStartsOn: null,
          openingEffectiveBalanceCalories: 0,
        };
      }
      if (initialization.status === 'INITIALIZED') {
        return {
          outcome: 'already_initialized',
          accountingStartsOn: initialization.accountingStartsOn
            ? toDateOnly(initialization.accountingStartsOn)
            : null,
          openingEffectiveBalanceCalories: initialization.openingEffectiveBalanceCalories ?? 0,
        };
      }
      if (initialization.accountingStartsOn) {
        const accountingStartsOn = toDateOnly(initialization.accountingStartsOn);
        if (currentLocalDate <= accountingStartsOn) {
          return {
            outcome: 'no_history',
            accountingStartsOn,
            openingEffectiveBalanceCalories: 0,
          };
        }
        await transaction.bankAccountInitialization.update({
          where: { userId: user.id },
          data: {
            status: 'INITIALIZED',
            historicalOpeningNetCalories: 0,
            openingEffectiveBalanceCalories: 0,
            eligibleDayCount: 0,
            initializedAt: this.now(),
          },
        });
        return {
          outcome: 'initialized',
          accountingStartsOn,
          openingEffectiveBalanceCalories: 0,
        };
      }

      const openingImport = await readOpeningImportState(transaction, user.id, currentLocalDate);
      if (!openingImport.complete) {
        return {
          outcome: 'waiting_for_opening_data',
          accountingStartsOn: null,
          openingEffectiveBalanceCalories: 0,
        };
      }

      const dates = getPreviousCompletedLocalDates(currentLocalDate);
      const [goal, expenditureRecords, intakeRecords, selection] = await Promise.all([
        transaction.goalConfiguration.findUnique({ where: { userId: user.id } }),
        transaction.dailyExpenditureAggregate.findMany({
          where: {
            userId: user.id,
            localDate: { gte: parseLogDate(dates.at(-1)!), lte: parseLogDate(dates[0]!) },
            ...(this.options.allowSyntheticProviders ? {} : { provider: { not: 'development' } }),
          },
          orderBy: { updatedAt: 'desc' },
        }),
        transaction.dailyIntakeAggregate.findMany({
          where: {
            userId: user.id,
            localDate: { gte: parseLogDate(dates.at(-1)!), lte: parseLogDate(dates[0]!) },
            ...(this.options.allowSyntheticProviders ? {} : { provider: { not: 'development' } }),
          },
          orderBy: { updatedAt: 'desc' },
        }),
        readProviderSelection(transaction, user.id),
      ]);

      if (!goal) {
        this.logOpeningInitialization({ userId: user.id, currentLocalDate, outcome: 'waiting_for_opening_data', eligibleDateCount: 0, missingByDate: dates.map((date) => ({ date, missing: ['goal'] })) });
        return {
          outcome: 'waiting_for_opening_data',
          accountingStartsOn: null,
          openingEffectiveBalanceCalories: 0,
        };
      }

      const usableStatuses = new Set(['ready', 'stale', 'partial']);
      const calculationDays: Array<{
        logDate: string;
        timezone: string;
        importedTotalDailyExpenditure: number;
        expenditureAdjustmentRate: number;
        adjustedExpenditure: number;
        goalMode: BankGoalMode;
        goalAdjustmentCalories: number;
        importedCalorieIntake: number;
        dailyAllowance: number;
        dailyBankChange: number;
        expenditureProvider: string;
        expenditureProviderRecordId: string;
        intakeProvider: string;
        intakeProviderRecordId: string;
        intakeSourceDisplayName: string | null;
      }> = [];
      const missingByDate: Array<{ date: string; missing: string[] }> = [];

      for (const logDate of dates) {
        const date = parseLogDate(logDate);
        const dailyExpenditure = expenditureRecords.filter(
          (record) => toDateOnly(record.localDate) === logDate && usableStatuses.has(record.syncStatus),
        );
        const dailyIntake = intakeRecords.filter((record) =>
          toDateOnly(record.localDate) === logDate &&
          usableStatuses.has(record.syncStatus) &&
          (record.provider !== 'apple_health' || (
            selection.appleHealthIntakeWriterBundleId !== null &&
            record.writerBundleIdentifier === selection.appleHealthIntakeWriterBundleId
          )),
        );
        const syntheticExpenditure =
          this.options.allowSyntheticProviders &&
          dailyExpenditure.length > 0 &&
          dailyExpenditure.every((record) => record.provider === 'development');
        const syntheticIntake =
          this.options.allowSyntheticProviders &&
          dailyIntake.length > 0 &&
          dailyIntake.every((record) => record.provider === 'development');
        const expenditure = resolveAuthoritativeProviderRecord(dailyExpenditure, {
          authoritativeProvider: syntheticExpenditure
            ? 'development'
            : selection.authoritativeExpenditureProvider,
          fallbackProvider: 'apple_health',
          allowFallback: selection.allowExpenditureFallback,
        });
        const intake = resolveAuthoritativeProviderRecord(dailyIntake, {
          authoritativeProvider: syntheticIntake ? 'development' : selection.authoritativeIntakeProvider,
          allowFallback: false,
        });
        const missing: string[] = [];
        if (!expenditure) missing.push('authoritative_expenditure');
        if (!intake) missing.push('authoritative_intake');
        if (expenditure && intake && expenditure.timezone !== intake.timezone) missing.push('timezone_mismatch');
        if (missing.length > 0) {
          missingByDate.push({ date: logDate, missing });
          continue;
        }

        const resolvedExpenditure = expenditure!;
        const resolvedIntake = intake!;
        const goalMode = goal.goalMode as BankGoalMode;
        const goalAdjustmentCalories = Math.abs(goal.dailyEnergyAdjustment);
        const calculation = calculateFinalizedDailyBankChange({
          importedTotalDailyExpenditure: resolvedExpenditure.rawTotalDailyExpenditure,
          expenditureAdjustmentRate: resolvedExpenditure.adjustmentFactor.toNumber(),
          goalMode,
          goalAdjustmentCalories,
          importedCalorieIntake: resolvedIntake.totalCaloriesConsumed,
        });
        calculationDays.push({
          logDate: toDateOnly(date),
          timezone: resolvedExpenditure.timezone,
          importedTotalDailyExpenditure: resolvedExpenditure.rawTotalDailyExpenditure,
          expenditureAdjustmentRate: resolvedExpenditure.adjustmentFactor.toNumber(),
          adjustedExpenditure: calculation.adjustedExpenditure,
          goalMode,
          goalAdjustmentCalories,
          importedCalorieIntake: resolvedIntake.totalCaloriesConsumed,
          dailyAllowance: calculation.dailyAllowance,
          dailyBankChange: calculation.dailyBankChange,
          expenditureProvider: resolvedExpenditure.provider,
          expenditureProviderRecordId: resolvedExpenditure.providerRecordId,
          intakeProvider: resolvedIntake.provider,
          intakeProviderRecordId: resolvedIntake.providerRecordId,
          intakeSourceDisplayName: resolvedIntake.provider === 'apple_health'
            ? resolvedIntake.writerDisplayName
            : resolvedIntake.provider === 'fatsecret' ? 'FatSecret' : null,
        });
      }

      if (calculationDays.length === 0) {
        await transaction.bankAccountInitialization.update({
          where: { userId: user.id },
          data: {
            accountingStartsOn: parseLogDate(currentLocalDate),
            timezone,
            lookbackStartDate: parseLogDate(dates.at(-1)!),
            lookbackEndDate: parseLogDate(dates[0]!),
          },
        });
        this.logOpeningInitialization({ userId: user.id, currentLocalDate, outcome: 'no_history', eligibleDateCount: 0, missingByDate, accountingStartsOn: currentLocalDate });
        return {
          outcome: 'no_history',
          accountingStartsOn: currentLocalDate,
          openingEffectiveBalanceCalories: 0,
        };
      }

      const opening = calculateOpeningEffectiveBalance(
        calculationDays.map((day) => day.dailyBankChange),
      );
      await transaction.openingBankCalculationDay.createMany({
        data: calculationDays.map(({ logDate, ...day }) => ({
          userId: user.id,
          logDate: parseLogDate(logDate),
          ...day,
        })),
        skipDuplicates: true,
      });
      await transaction.bankAccountInitialization.update({
        where: { userId: user.id },
        data: {
          status: 'INITIALIZED',
          historicalOpeningNetCalories: opening.historicalOpeningNetCalories,
          openingEffectiveBalanceCalories: opening.openingEffectiveBalanceCalories,
          eligibleDayCount: calculationDays.length,
          lookbackStartDate: parseLogDate(dates.at(-1)!),
          lookbackEndDate: parseLogDate(dates[0]!),
          accountingStartsOn: parseLogDate(currentLocalDate),
          timezone,
          initializedAt: this.now(),
        },
      });
      this.logOpeningInitialization({ userId: user.id, currentLocalDate, outcome: 'initialized', eligibleDateCount: calculationDays.length, missingByDate, openingEffectiveBalanceCalories: opening.openingEffectiveBalanceCalories, accountingStartsOn: currentLocalDate });
      return {
        outcome: 'initialized',
        accountingStartsOn: currentLocalDate,
        openingEffectiveBalanceCalories: opening.openingEffectiveBalanceCalories,
      };
    });
    if (process.env.APP_ENV === 'local') {
      console.info(JSON.stringify({ component: 'opening_bank', event: 'initialization_complete', outcome: result.outcome, elapsedMs: Date.now() - startedAt, accountingStartsOn: result.accountingStartsOn, openingEffectiveBalanceCalories: result.openingEffectiveBalanceCalories }));
    }
    return result;
  }

  private logOpeningInitialization(input: {
    userId: string;
    currentLocalDate: string;
    outcome: OpeningBankInitializationResult['outcome'];
    eligibleDateCount: number;
    missingByDate: Array<{ date: string; missing: string[] }>;
    openingEffectiveBalanceCalories?: number;
    accountingStartsOn?: string;
  }) {
    if (process.env.APP_ENV !== 'local') return;
    console.info(JSON.stringify({
      component: 'opening_bank',
      event: 'initialization_evaluated',
      userSuffix: input.userId.slice(-8),
      currentLocalDate: input.currentLocalDate,
      initializationAttempted: true,
      initializationStatus: input.outcome,
      eligibleDateCount: input.eligibleDateCount,
      missingByDate: input.missingByDate,
      openingEffectiveBalanceCalories: input.openingEffectiveBalanceCalories ?? null,
      accountingStartsOn: input.accountingStartsOn ?? null,
    }));
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
    // A source can legitimately return to inputs used by an older version. Including the
    // transition baseline keeps that restoration distinct while immediate retries remain
    // idempotent because their correction delta is already zero.
    const fingerprint = inputFingerprint(inputs, existing?.currentVersion ?? 0);

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
        intakeSourceDisplayName: input.intakeSourceDisplayName ?? null,
        intakeWriterBundleIdentifier: input.intakeWriterBundleIdentifier ?? null,
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
      const initialization = await transaction.bankAccountInitialization.findUnique({
        where: { userId: user.id },
      });
      if (initialization?.status === 'WAITING_FOR_OPENING_DATA') {
        return { outcome: 'not_ready', detail: null };
      }
      if (initialization?.accountingStartsOn && date < initialization.accountingStartsOn) {
        return { outcome: 'excluded', detail: null };
      }
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
      const [goal, authority] = await Promise.all([
        transaction.goalConfiguration.findUnique({ where: { userId: user.id } }),
        this.options.allowSyntheticProviders
          ? null
          : resolveDaySourceAuthority(transaction, user.id, date, timezone),
      ]);
      let expenditure = authority?.selectedExpenditure?.record ?? null;
      let intake = authority?.selectedIntake?.record ?? null;
      if (this.options.allowSyntheticProviders) {
        const [expenditureRecords, intakeRecords, selection] = await Promise.all([
          transaction.dailyExpenditureAggregate.findMany({ where: { userId: user.id, localDate: date, ...providerFilter } }),
          transaction.dailyIntakeAggregate.findMany({ where: { userId: user.id, localDate: date, ...providerFilter } }),
          readProviderSelection(transaction, user.id),
        ]);
        expenditure = resolveAuthoritativeProviderRecord(expenditureRecords, {
          authoritativeProvider: expenditureRecords.every((record) => record.provider === 'development')
            ? 'development' : selection.authoritativeExpenditureProvider,
          fallbackProvider: 'apple_health', allowFallback: selection.allowExpenditureFallback,
        });
        intake = resolveAuthoritativeProviderRecord(intakeRecords, {
          authoritativeProvider: intakeRecords.every((record) => record.provider === 'development')
            ? 'development' : selection.authoritativeIntakeProvider,
          allowFallback: false,
        });
      }
      if (!expenditure || !intake || (!goal && !existing)) {
        return { outcome: 'not_ready', detail: existing ? toDetail(await this.recordWithSnapshots(transaction, existing.id)) : null };
      }

      if (!existing && !this.options.allowSyntheticProviders) {
        const [expenditureComplete, intakeComplete] = await Promise.all([
          hasCompletedDayQueryEvidence(transaction, {
            userId: user.id,
            localDate: logDate,
            timezone,
            provider: expenditure.provider,
            role: 'EXPENDITURE',
            aggregateImportedAt: expenditure.importedAt,
            aggregateWasCurrentDay: expenditure.isCurrentDay,
          }),
          hasCompletedDayQueryEvidence(transaction, {
            userId: user.id,
            localDate: logDate,
            timezone,
            provider: intake.provider,
            role: 'INTAKE',
            aggregateImportedAt: intake.importedAt,
            aggregateWasCurrentDay: intake.isCurrentDay,
          }),
        ]);
        if (!expenditureComplete || !intakeComplete) {
          console.info(JSON.stringify({
            component: 'account_lifecycle',
            event: 'completed_day_incomplete_query_rejected',
            userSuffix: user.id.slice(-8),
            localDate: logDate,
            missingRoles: [
              ...(!expenditureComplete ? ['burned'] : []),
              ...(!intakeComplete ? ['eaten'] : []),
            ],
          }));
          return { outcome: 'not_ready', detail: null };
        }
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
          intakeSourceDisplayName: intake.provider === 'apple_health'
            ? intake.writerDisplayName
            : intake.provider === 'fatsecret' ? 'FatSecret' : null,
          intakeWriterBundleIdentifier: intake.provider === 'apple_health'
            ? intake.writerBundleIdentifier
            : null,
          triggerSyncSessionId:
            triggerSyncSessionId ?? expenditure.syncSessionId ?? intake.syncSessionId ?? null,
        },
        processedAt,
        true,
      );
    });
  }

  async prepareForGoalChange(user: DevelopmentUser) {
    await this.recoverStoredContinuityGaps(user.id);
    const initialization = await this.db.bankAccountInitialization.findUnique({ where: { userId: user.id } });
    if (!initialization?.accountingStartsOn || !initialization.timezone) {
      return { ready: true, unresolvedDates: [] };
    }
    const currentLocalDate = getLocalDateForTimezone(initialization.timezone, this.now());
    const dates = completedLocalDates(toDateOnly(initialization.accountingStartsOn), currentLocalDate).slice(-8);
    const records = await this.db.finalizedDailyBankRecord.findMany({
      where: { userId: user.id, logDate: { in: dates.map(parseLogDate) } },
      select: { logDate: true },
    });
    const completed = new Set(records.map((record) => toDateOnly(record.logDate)));
    const unresolvedDates = dates.filter((date) => !completed.has(date));
    return { ready: unresolvedDates.length === 0, unresolvedDates };
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
    const [ledgerSum, latest, count, initialization, latestOpeningDay] = await Promise.all([
      this.db.calorieLedgerTransaction.aggregate({ where: { userId }, _sum: { amountCalories: true } }),
      this.db.finalizedDailyBankRecord.findFirst({ where: { userId }, orderBy: { logDate: 'desc' } }),
      this.db.finalizedDailyBankRecord.count({ where: { userId } }),
      this.db.bankAccountInitialization.findUnique({ where: { userId } }),
      this.db.openingBankCalculationDay.findFirst({
        where: { userId }, orderBy: { logDate: 'desc' }, include: { initialization: true },
      }),
    ]);
    const openingBankCalories = initialization?.openingEffectiveBalanceCalories ?? 0;
    const effectiveBankBalanceCalories = openingBankCalories + (ledgerSum._sum.amountCalories ?? 0);
    const balances = deriveConsumerBankBalances(effectiveBankBalanceCalories);
    const latestIsOpening = Boolean(
      latestOpeningDay && (!latest || latestOpeningDay.logDate > latest.logDate),
    );
    const latestCompletedDate = latestIsOpening
      ? toDateOnly(latestOpeningDay!.logDate)
      : latest ? toDateOnly(latest.logDate) : latestOpeningDay ? toDateOnly(latestOpeningDay.logDate) : null;
    const openingFinalizedAt = latestOpeningDay?.initialization.initializedAt ?? latestOpeningDay?.createdAt ?? null;
    return {
      ...balances,
      openingBankStatus:
        initialization?.status === 'WAITING_FOR_OPENING_DATA'
          ? 'waiting_for_opening_data'
          : 'initialized',
      openingBankCalories,
      latestFinalizedDate: latest ? toDateOnly(latest.logDate) : null,
      latestCompletedDate,
      latestDailyBankChange: latestIsOpening
        ? latestOpeningDay!.dailyBankChange
        : latest?.effectiveDailyBankChange ?? latestOpeningDay?.dailyBankChange ?? null,
      latestOriginalDailyBankChange: latestIsOpening
        ? latestOpeningDay!.dailyBankChange
        : latest?.originalDailyBankChange ?? latestOpeningDay?.dailyBankChange ?? null,
      latestContributionStatus: latestIsOpening || (!latest && latestOpeningDay)
        ? 'locked'
        : latest ? apiStatus(latest.status) : null,
      latestLocksAt: latestIsOpening || (!latest && latestOpeningDay)
        ? openingFinalizedAt?.toISOString() ?? null
        : latest?.lockAt.toISOString() ?? null,
      latestCorrectionCount: latestIsOpening ? 0 : latest?.correctionCount ?? 0,
      finalizedDayCount: count,
    };
  }

  async getHealthHistoryDiagnostics(
    userId: string,
    localDates: string[],
  ): Promise<HealthHistoryDiagnosticResponse> {
    const dates = localDates.map(parseLogDate);
    const [initialization, finalized, opening, processing] = await Promise.all([
      this.db.bankAccountInitialization.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      this.db.finalizedDailyBankRecord.findMany({
        where: { userId, logDate: { in: dates } },
        select: { logDate: true },
      }),
      this.db.openingBankCalculationDay.findMany({
        where: { userId, logDate: { in: dates } },
        select: { logDate: true },
      }),
      this.db.bankDayProcessingState.findMany({
        where: { userId, logDate: { in: dates } },
        select: { logDate: true, lastErrorCode: true },
      }),
    ]);
    const calculated = new Set([...finalized, ...opening].map((item) => toDateOnly(item.logDate)));
    const processingByDate = new Map(processing.map((item) => [toDateOnly(item.logDate), item]));

    return {
      dates: await Promise.all(localDates.map(async (localDate) => {
        const authority = initialization?.timezone
          ? await resolveDaySourceAuthority(this.db, userId, parseLogDate(localDate), initialization.timezone)
          : null;
        const intakeAggregatePresent = Boolean(authority?.selectedIntake);
        const expenditureAggregatePresent = Boolean(authority?.selectedExpenditure);
        const failed = Boolean(processingByDate.get(localDate)?.lastErrorCode);
        return {
          localDate,
          intakeAggregatePresent,
          expenditureAggregatePresent,
          historicalState: calculated.has(localDate)
            ? 'finalized' as const
            : failed
              ? 'failed' as const
              : !intakeAggregatePresent
                ? 'waiting_for_intake' as const
                : !expenditureAggregatePresent
                  ? 'waiting_for_burn' as const
                  : 'ready' as const,
        };
      })),
    };
  }

  async getHistory(userId: string, range: BankHistoryRange): Promise<BankHistoryResponse> {
    await this.recoverStoredContinuityGaps(userId);
    const summary = await this.getSummary(userId);
    const missingDays = await this.continuityMissingDays(userId, range);
    const [earliestFinalized, earliestOpening] = await Promise.all([
      this.db.finalizedDailyBankRecord.findFirst({
        where: { userId }, orderBy: { logDate: 'asc' }, select: { logDate: true },
      }),
      this.db.openingBankCalculationDay.findFirst({
        where: { userId }, orderBy: { logDate: 'asc' }, select: { logDate: true },
      }),
    ]);
    if (!summary.latestCompletedDate) {
      return {
        range,
        startDate: null,
        endDate: null,
        effectiveBankBalanceCalories: summary.effectiveBankBalanceCalories,
        availableBankCalories: summary.availableBankCalories,
        recoveryCalories: summary.recoveryCalories,
        openingBankStatus: summary.openingBankStatus,
        openingBankCalories: summary.openingBankCalories,
        rangeNetChangeCalories: 0,
        days: [],
        missingDays,
        finalizedDays: [],
      };
    }
    const earliestDate = [earliestFinalized?.logDate, earliestOpening?.logDate]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const startDate = startDateForRange(
      range,
      summary.latestCompletedDate,
      earliestDate ? toDateOnly(earliestDate) : null,
    );
    const [records, openingDays] = await Promise.all([
      this.db.finalizedDailyBankRecord.findMany({
        where: {
          userId,
          logDate: {
            ...(startDate ? { gte: parseLogDate(startDate) } : {}),
            lte: parseLogDate(summary.latestCompletedDate),
          },
        },
        orderBy: { logDate: 'desc' },
        include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
      }),
      this.db.openingBankCalculationDay.findMany({
        where: {
          userId,
          logDate: {
            ...(startDate ? { gte: parseLogDate(startDate) } : {}),
            lte: parseLogDate(summary.latestCompletedDate),
          },
        },
        orderBy: { logDate: 'desc' },
        include: { initialization: true },
      }),
    ]);
    const finalizedDays = records.map(toDaySummary);
    const days = [...finalizedDays, ...openingDays.map(openingDaySummary)]
      .sort((a, b) => b.logDate.localeCompare(a.logDate));
    return {
      range,
      startDate,
      endDate: summary.latestCompletedDate,
      effectiveBankBalanceCalories: summary.effectiveBankBalanceCalories,
      availableBankCalories: summary.availableBankCalories,
      recoveryCalories: summary.recoveryCalories,
      openingBankStatus: summary.openingBankStatus,
      openingBankCalories: summary.openingBankCalories,
      rangeNetChangeCalories: days.reduce((sum, day) => sum + day.dailyBankChange, 0),
      days,
      missingDays,
      finalizedDays,
    };
  }

  async getOpeningBankDetail(userId: string): Promise<OpeningBankDetailResponse> {
    const initialization = await this.db.bankAccountInitialization.findUnique({
      where: { userId },
      include: { calculationDays: { orderBy: { logDate: 'asc' } } },
    });
    const waiting = initialization?.status === 'WAITING_FOR_OPENING_DATA';
    return {
      status: waiting ? 'waiting_for_opening_data' : 'initialized',
      openingBankCalories: initialization?.openingEffectiveBalanceCalories ?? 0,
      historicalOpeningNetCalories: initialization?.historicalOpeningNetCalories ?? null,
      eligibleDayCount: initialization?.eligibleDayCount ?? 0,
      lookbackStartDate: initialization?.lookbackStartDate ? toDateOnly(initialization.lookbackStartDate) : null,
      lookbackEndDate: initialization?.lookbackEndDate ? toDateOnly(initialization.lookbackEndDate) : null,
      accountingStartsOn: initialization?.accountingStartsOn ? toDateOnly(initialization.accountingStartsOn) : null,
      calculationDays: (initialization?.calculationDays ?? []).map((day) => ({
        logDate: toDateOnly(day.logDate),
        importedTotalDailyExpenditure: day.importedTotalDailyExpenditure,
        expenditureAdjustmentRate: day.expenditureAdjustmentRate.toNumber(),
        adjustedExpenditure: day.adjustedExpenditure,
        goalMode: day.goalMode as GoalMode,
        goalAdjustmentCalories: day.goalAdjustmentCalories,
        importedCalorieIntake: day.importedCalorieIntake,
        dailyBankChange: day.dailyBankChange,
      })),
    };
  }

  private async sourceOptionsInTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
    logDate: string,
  ): Promise<HistoricalSourceOptionsResponse> {
    const date = parseLogDate(logDate);
    const opening = await transaction.openingBankCalculationDay.findUnique({
      where: { userId_logDate: { userId, logDate: date } },
    });
    if (opening) {
      const expenditure = {
        id: historicalOptionId(userId, logDate, 'EXPENDITURE', opening.expenditureProvider, null),
        label: consumerProviderName(opening.expenditureProvider),
      };
      const intake = {
        id: historicalOptionId(userId, logDate, 'INTAKE', opening.intakeProvider, null),
        label: consumerProviderName(opening.intakeProvider, opening.intakeSourceDisplayName),
      };
      return {
        logDate,
        expenditure: { selected: expenditure, options: [expenditure], canChange: false, revision: 0, readOnlyReason: 'opening_bank' },
        intake: { selected: intake, options: [intake], canChange: false, revision: 0, readOnlyReason: 'opening_bank' },
      };
    }

    const record = await transaction.finalizedDailyBankRecord.findUnique({
      where: { userId_logDate: { userId, logDate: date } },
      include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
    });
    if (!record) throw new AppError('Completed bank day was not found.', 404, { code: 'BANK_DAY_NOT_FOUND' });
    const authority = await resolveDaySourceAuthority(transaction, userId, date, record.timezone);
    const latest = record.calculationSnapshots.at(-1);
    if (!latest) throw new AppError('Completed bank day has no calculation provenance.', 409, { code: 'BANK_DAY_PROVENANCE_MISSING' });
    const changeable = record.status === 'PROVISIONAL' && this.now() < record.lockAt;

    // A global role change may not yet have usable data for this date. Until it does,
    // the latest effective snapshot remains the unchanged role's accounting authority.
    const selectedExpenditureCandidate = authority.selectedExpenditure
      ?? authority.expenditure.find((item) =>
        item.provider === latest.expenditureProvider
        && item.record.providerRecordId === latest.expenditureProviderRecordId,
      );
    const selectedExpenditure = selectedExpenditureCandidate
      ? { id: selectedExpenditureCandidate.optionId, label: selectedExpenditureCandidate.label }
      : {
          id: historicalOptionId(userId, logDate, 'EXPENDITURE', latest.expenditureProvider, null),
          label: consumerProviderName(latest.expenditureProvider),
        };
    const selectedIntakeCandidate = authority.selectedIntake
      ?? authority.intake.find((item) =>
        item.provider === latest.intakeProvider
        && item.record.providerRecordId === latest.intakeProviderRecordId
        && item.writerBundleIdentifier === latest.intakeWriterBundleIdentifier,
      );
    const selectedIntake = selectedIntakeCandidate
      ? { id: selectedIntakeCandidate.optionId, label: selectedIntakeCandidate.label }
      : {
          id: historicalOptionId(userId, logDate, 'INTAKE', latest.intakeProvider, latest.intakeWriterBundleIdentifier),
          label: consumerProviderName(latest.intakeProvider, latest.intakeSourceDisplayName),
        };
    const expenditureOptions = authority.expenditure.map((item) => ({ id: item.optionId, label: item.label }));
    const intakeOptions = authority.intake.map((item) => ({ id: item.optionId, label: item.label }));
    const effectiveInputsAvailable = Boolean(selectedExpenditureCandidate && selectedIntakeCandidate);
    const expenditureCanChange = changeable && effectiveInputsAvailable
      && expenditureOptions.some((item) => item.id !== selectedExpenditure.id);
    const intakeCanChange = changeable && effectiveInputsAvailable
      && intakeOptions.some((item) => item.id !== selectedIntake.id);
    const readOnlyReason = changeable ? 'no_alternative' as const : 'locked' as const;

    return {
      logDate,
      expenditure: {
        selected: selectedExpenditure,
        options: changeable ? expenditureOptions : [selectedExpenditure],
        canChange: expenditureCanChange,
        revision: authority.expenditureOverride?.revision ?? 0,
        readOnlyReason: expenditureCanChange ? null : readOnlyReason,
      },
      intake: {
        selected: selectedIntake,
        options: changeable ? intakeOptions : [selectedIntake],
        canChange: intakeCanChange,
        revision: authority.intakeOverride?.revision ?? 0,
        readOnlyReason: intakeCanChange ? null : readOnlyReason,
      },
    };
  }

  async getHistoricalSourceOptions(userId: string, logDate: string) {
    const sources = await this.db.$transaction((transaction) =>
      this.sourceOptionsInTransaction(transaction, userId, logDate));
    console.info(JSON.stringify({
      event: 'historical_source_options_resolved',
      date: logDate,
      expenditureOptionCount: sources.expenditure.options.length,
      intakeOptionCount: sources.intake.options.length,
    }));
    return sources;
  }

  async setHistoricalSource(
    user: DevelopmentUser,
    logDate: string,
    role: 'expenditure' | 'intake',
    input: HistoricalSourceMutation,
  ): Promise<HistoricalSourceMutationResponse> {
    const dbRole: HistoricalRole = role === 'expenditure' ? 'EXPENDITURE' : 'INTAKE';
    return this.db.$transaction(async (transaction) => {
      await this.lockDay(transaction, user.id, logDate);
      const date = parseLogDate(logDate);
      const priorRequest = await transaction.historicalSourceOverrideRequest.findUnique({
        where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: input.idempotencyKey } },
      });
      if (priorRequest) {
        if (priorRequest.localDate.getTime() !== date.getTime() || priorRequest.role !== dbRole || priorRequest.optionId !== input.optionId) {
          throw new AppError('That retry key was already used for another source change.', 409, { code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        const day = await this.recordWithSnapshots(transaction, (
          await transaction.finalizedDailyBankRecord.findUniqueOrThrow({ where: { userId_logDate: { userId: user.id, logDate: date } } })
        ).id);
        return { sources: await this.sourceOptionsInTransaction(transaction, user.id, logDate), day: toDetail(day) };
      }
      const opening = await transaction.openingBankCalculationDay.findUnique({ where: { userId_logDate: { userId: user.id, logDate: date } } });
      if (opening) throw new AppError('Opening Bank days cannot be changed.', 409, { code: 'DAY_NO_LONGER_CHANGEABLE' });
      const record = await transaction.finalizedDailyBankRecord.findUnique({ where: { userId_logDate: { userId: user.id, logDate: date } } });
      if (!record) throw new AppError('Completed bank day was not found.', 404, { code: 'BANK_DAY_NOT_FOUND' });
      if (record.status !== 'PROVISIONAL' || this.now() >= record.lockAt) {
        throw new AppError('This completed day can no longer be changed.', 409, { code: 'DAY_NO_LONGER_CHANGEABLE' });
      }
      const authority = await resolveDaySourceAuthority(transaction, user.id, date, record.timezone);
      const [globalSelection, latestSnapshot] = await Promise.all([
        readProviderSelection(transaction, user.id),
        transaction.bankCalculationSnapshot.findFirst({
          where: { finalizedDailyBankRecordId: record.id },
          orderBy: { version: 'desc' },
        }),
      ]);
      const candidate = dbRole === 'EXPENDITURE'
        ? authority.expenditure.find((item) => item.optionId === input.optionId)
        : authority.intake.find((item) => item.optionId === input.optionId);
      if (!candidate) {
        const knownMissingOptionIds = dbRole === 'EXPENDITURE'
          ? [
              historicalOptionId(user.id, logDate, dbRole, 'google_health_fitbit', null),
              historicalOptionId(user.id, logDate, dbRole, 'apple_health', null),
            ]
          : [historicalOptionId(user.id, logDate, dbRole, 'fatsecret', null)];
        const appleWriter = globalSelection.appleHealthIntakeWriterBundleId
          ?? latestSnapshot?.intakeWriterBundleIdentifier
          ?? null;
        if (
          dbRole === 'INTAKE'
          && appleWriter
          && input.optionId === historicalOptionId(user.id, logDate, dbRole, 'apple_health', appleWriter)
        ) {
          throw new AppError('Apple Health food-tracker data is no longer available for this day.', 409, {
            code: 'APPLE_HEALTH_WRITER_UNAVAILABLE',
          });
        }
        if (knownMissingOptionIds.includes(input.optionId)) {
          const provider = dbRole === 'EXPENDITURE'
            ? input.optionId === historicalOptionId(user.id, logDate, dbRole, 'google_health_fitbit', null)
              ? 'google_health_fitbit'
              : 'apple_health'
            : 'fatsecret';
          const aggregate = dbRole === 'EXPENDITURE'
            ? await transaction.dailyExpenditureAggregate.findFirst({ where: { userId: user.id, localDate: date, provider } })
            : await transaction.dailyIntakeAggregate.findFirst({ where: { userId: user.id, localDate: date, provider } });
          if (aggregate && aggregate.timezone !== record.timezone) {
            throw new AppError('That source uses a different local day.', 409, { code: 'TIMEZONE_MISMATCH' });
          }
          if (aggregate) {
            throw new AppError('That source data is not complete enough to use.', 409, {
              code: 'SOURCE_DATA_NOT_USABLE',
            });
          }
          throw new AppError('That source has no calorie data for this day.', 409, {
            code: 'SOURCE_NO_DATA_FOR_DATE',
          });
        }
        throw new AppError('That source option is no longer available.', 409, {
          code: 'UNKNOWN_SOURCE_OPTION',
        });
      }
      console.info(JSON.stringify({
        event: 'historical_source_override_requested',
        date: logDate,
        role,
        requestedProvider: candidate.provider,
        currentOverrideProvider: (dbRole === 'EXPENDITURE' ? authority.expenditureOverride : authority.intakeOverride)?.provider ?? null,
        globalProvider: dbRole === 'EXPENDITURE'
          ? globalSelection.authoritativeExpenditureProvider
          : globalSelection.authoritativeIntakeProvider,
        currentEffectiveSnapshotProvider: dbRole === 'EXPENDITURE'
          ? latestSnapshot?.expenditureProvider ?? null
          : latestSnapshot?.intakeProvider ?? null,
      }));
      const currentOverride = dbRole === 'EXPENDITURE' ? authority.expenditureOverride : authority.intakeOverride;
      const currentRevision = currentOverride?.revision ?? 0;
      if (input.expectedRevision !== currentRevision) {
        throw new AppError('This source choice changed on another request.', 409, { code: 'STALE_SELECTION' });
      }
      const writer = candidate.kind === 'intake' ? candidate.writerBundleIdentifier : null;
      await transaction.historicalSourceAuthorityOverride.upsert({
        where: { userId_localDate_role: { userId: user.id, localDate: date, role: dbRole } },
        create: { userId: user.id, localDate: date, role: dbRole, provider: candidate.provider, intakeWriterBundleIdentifier: writer, revision: 1 },
        update: { provider: candidate.provider, intakeWriterBundleIdentifier: writer, revision: { increment: 1 } },
      });
      console.info(JSON.stringify({
        event: 'historical_source_override_persisted',
        date: logDate,
        role,
        persistedProvider: candidate.provider,
        overrideDeletedOrUpserted: 'upserted',
      }));
      const resolved = await resolveDaySourceAuthority(transaction, user.id, date, record.timezone);
      const expenditure = resolved.selectedExpenditure?.record
        ?? (dbRole === 'INTAKE'
          ? resolved.expenditure.find((item) =>
            item.provider === latestSnapshot?.expenditureProvider
            && item.record.providerRecordId === latestSnapshot.expenditureProviderRecordId,
          )?.record
          : undefined);
      const intake = resolved.selectedIntake?.record
        ?? (dbRole === 'EXPENDITURE'
          ? resolved.intake.find((item) =>
            item.provider === latestSnapshot?.intakeProvider
            && item.record.providerRecordId === latestSnapshot.intakeProviderRecordId
            && item.writerBundleIdentifier === latestSnapshot.intakeWriterBundleIdentifier,
          )?.record
          : undefined);
      if (!expenditure || !intake) {
        throw new AppError('The source data changed after the selector was loaded.', 409, {
          code: 'OPTION_STATE_CHANGED',
        });
      }
      console.info(JSON.stringify({
        event: 'historical_source_authority_resolved',
        date: logDate,
        expenditureProvider: expenditure.provider,
        expenditureResolutionSource: resolved.expenditureOverride ? 'override' : 'global',
        intakeProvider: intake.provider,
        intakeResolutionSource: resolved.intakeOverride ? 'override' : 'global',
      }));
      const oldEffectiveContribution = record.effectiveDailyBankChange;
      const result = await this.postOrReconcile(transaction, user, logDate, record.timezone, {
        importedTotalDailyExpenditure: expenditure.rawTotalDailyExpenditure,
        expenditureAdjustmentRate: record.expenditureAdjustmentRate.toNumber(),
        goalMode: record.goalMode as BankGoalMode,
        goalAdjustmentCalories: record.goalAdjustmentCalories,
        importedCalorieIntake: intake.totalCaloriesConsumed,
        expenditureProvider: expenditure.provider,
        expenditureProviderRecordId: expenditure.providerRecordId,
        intakeProvider: intake.provider,
        intakeProviderRecordId: intake.providerRecordId,
        intakeSourceDisplayName: intake.provider === 'apple_health' ? intake.writerDisplayName : intake.provider === 'fatsecret' ? 'FatSecret' : null,
        intakeWriterBundleIdentifier: intake.provider === 'apple_health' ? intake.writerBundleIdentifier : null,
        triggerSyncSessionId: expenditure.syncSessionId ?? intake.syncSessionId ?? null,
      }, this.now(), true);
      if (!result.detail) throw new AppError('The completed day could not be recalculated.', 409, { code: 'HISTORICAL_SOURCE_RECALCULATION_FAILED' });
      const latestResultSnapshot = result.detail.versions.at(-1);
      console.info(JSON.stringify({
        event: 'historical_source_reconciliation_result',
        date: logDate,
        role,
        oldEffectiveContribution,
        recalculatedContribution: result.detail.effectiveDailyBankChange,
        correctionDelta: result.detail.effectiveDailyBankChange - oldEffectiveContribution,
        snapshotCreated: result.detail.versions.length > record.currentVersion,
        snapshotProvider: dbRole === 'EXPENDITURE'
          ? latestResultSnapshot?.expenditureProvider ?? null
          : latestResultSnapshot?.intakeProvider ?? null,
      }));
      await transaction.historicalSourceOverrideRequest.create({
        data: { userId: user.id, idempotencyKey: input.idempotencyKey, localDate: date, role: dbRole, optionId: input.optionId },
      });
      const sources = await this.sourceOptionsInTransaction(transaction, user.id, logDate);
      console.info(JSON.stringify({
        event: result.outcome === 'unchanged' ? 'historical_source_override_noop' : 'historical_source_override_applied',
        date: logDate,
        role,
        provider: candidate.provider,
        version: result.detail.versions.at(-1)?.version ?? null,
        correctionDelta: result.detail.versions.at(-1)?.correctionDelta ?? 0,
      }));
      return { sources, day: result.detail };
    });
  }

  async getDayDetail(userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null> {
    await this.lockExpired(userId);
    const record = await this.db.finalizedDailyBankRecord.findUnique({
      where: { userId_logDate: { userId, logDate: parseLogDate(logDate) } },
      include: { calculationSnapshots: { orderBy: { version: 'asc' } } },
    });
    if (record) return toDetail(record);
    const openingDay = await this.db.openingBankCalculationDay.findUnique({
      where: { userId_logDate: { userId, logDate: parseLogDate(logDate) } },
      include: { initialization: true },
    });
    return openingDay ? openingDayDetail(openingDay) : null;
  }
}
