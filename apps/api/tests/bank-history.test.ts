import type {
  BankHistoryDayDetailResponse,
  BankHistoryRange,
  BankHistoryResponse,
  BankSummaryResponse,
} from '@caloriebank/schemas';
import { deriveConsumerBankBalances } from '@caloriebank/domain';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { localDevelopmentApiEnv } from './support/test-api-env';
import type {
  BankHistoryRepository,
  PostProvisionalDailyBankRecordInput,
} from '../src/modules/bank-history/bank-history.repository';
import type { DevelopmentUser } from '../src/modules/goal-configuration/goal-configuration.repository';

class MemoryBankHistoryRepository implements BankHistoryRepository {
  constructor(private readonly details: BankHistoryDayDetailResponse[] = []) {}

  async postProvisionalDailyRecord(
    _user: DevelopmentUser,
    _input: PostProvisionalDailyBankRecordInput,
  ): Promise<BankHistoryDayDetailResponse> {
    throw new Error('Not implemented in route tests.');
  }

  async reconcileStoredDay() {
    return { outcome: 'not_ready' as const, detail: null };
  }

  async lockExpired() {
    return 0;
  }

  async lockExpiredDates() {
    return [];
  }

  async initializeOpeningBank() {
    return { outcome: 'not_applicable' as const, accountingStartsOn: null, openingEffectiveBalanceCalories: 0 };
  }

  async getAccountingStartDate() {
    return null;
  }

  async getSummary(): Promise<BankSummaryResponse> {
    const ordered = [...this.details].sort((a, b) => b.logDate.localeCompare(a.logDate));
    const balances = deriveConsumerBankBalances(
      this.details.reduce((sum, day) => sum + day.dailyBankChange, 0),
    );
    return {
      ...balances,
      openingBankStatus: 'initialized',
      openingBankCalories: 0,
      latestFinalizedDate: ordered[0]?.logDate ?? null,
      latestCompletedDate: ordered[0]?.logDate ?? null,
      latestDailyBankChange: ordered[0]?.dailyBankChange ?? null,
      latestOriginalDailyBankChange: ordered[0]?.originalDailyBankChange ?? null,
      latestContributionStatus: ordered[0]?.status ?? null,
      latestLocksAt: ordered[0]?.locksAt ?? null,
      latestCorrectionCount: ordered[0]?.correctionCount ?? 0,
      finalizedDayCount: this.details.length,
    };
  }

  async getHistory(_userId: string, range: BankHistoryRange): Promise<BankHistoryResponse> {
    const summary = await this.getSummary();
    const ordered = [...this.details].sort((a, b) => b.logDate.localeCompare(a.logDate));

    return {
      range,
      startDate: ordered.at(-1)?.logDate ?? null,
      endDate: ordered[0]?.logDate ?? null,
      effectiveBankBalanceCalories: summary.effectiveBankBalanceCalories,
      availableBankCalories: summary.availableBankCalories,
      recoveryCalories: summary.recoveryCalories,
      openingBankStatus: summary.openingBankStatus,
      openingBankCalories: summary.openingBankCalories,
      rangeNetChangeCalories: summary.effectiveBankBalanceCalories,
      days: ordered.map((day) => ({
        provenance: 'finalized' as const,
        logDate: day.logDate,
        dailyBankChange: day.dailyBankChange,
        originalDailyBankChange: day.originalDailyBankChange,
        status: day.status,
        locksAt: day.locksAt,
        correctionCount: day.correctionCount,
        goalMode: day.goalMode,
        finalizedAt: day.finalizedAt,
      })),
      missingDays: [],
      finalizedDays: ordered.map((day) => ({
        provenance: 'finalized' as const,
        logDate: day.logDate,
        dailyBankChange: day.dailyBankChange,
        originalDailyBankChange: day.originalDailyBankChange,
        status: day.status,
        locksAt: day.locksAt,
        correctionCount: day.correctionCount,
        goalMode: day.goalMode,
        finalizedAt: day.finalizedAt,
      })),
    };
  }

  async getHealthHistoryDiagnostics(_userId: string, dates: string[]) {
    return {
      dates: dates.map((localDate) => ({
        localDate,
        intakeAggregatePresent: false,
        expenditureAggregatePresent: true,
        appleHealthIntakeAggregatePresent: false,
        appleHealthExpenditureAggregatePresent: false,
        historicalState: 'waiting_for_intake' as const,
      })),
    };
  }

  async getOpeningBankDetail() {
    return {
      status: 'initialized' as const,
      openingBankCalories: 0,
      historicalOpeningNetCalories: 0,
      eligibleDayCount: 0,
      lookbackStartDate: null,
      lookbackEndDate: null,
      accountingStartsOn: null,
      calculationDays: [],
    };
  }

  async getDayDetail(_userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null> {
    return this.details.find((detail) => detail.logDate === logDate) ?? null;
  }
}

const detail: BankHistoryDayDetailResponse = {
  provenance: 'finalized',
  startingBalanceFloorApplied: false,
  logDate: '2026-07-19',
  timezone: 'America/Chicago',
  importedTotalDailyExpenditure: 3000,
  expenditureAdjustmentRate: 0.8,
  adjustedExpenditure: 2400,
  goalMode: 'bulk',
  goalAdjustmentCalories: 300,
  importedCalorieIntake: 2500,
  dailyAllowance: 2700,
  dailyBankChange: 200,
  originalDailyBankChange: 200,
  effectiveDailyBankChange: 200,
  status: 'provisional',
  locksAt: '2026-07-23T05:00:00.000Z',
  lockedAt: null,
  correctionCount: 0,
  finalizedAt: '2026-07-20T05:30:00.000Z',
  versions: [
    {
      version: 1,
      reason: 'initial_posting',
      dailyBankChange: 200,
      correctionDelta: 200,
      importedTotalDailyExpenditure: 3000,
      importedCalorieIntake: 2500,
      intakeSourceDisplayName: null,
      expenditureProvider: 'apple_health',
      intakeProvider: 'apple_health',
      createdAt: '2026-07-20T05:30:00.000Z',
    },
  ],
};

describe('bank history API', () => {
  it('returns summary with no data', async () => {
    const response = await request(
      createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository() }),
    )
      .get('/v1/me/bank-summary')
      .expect(200);

    expect(response.body).toEqual({
      effectiveBankBalanceCalories: 0,
      availableBankCalories: 0,
      recoveryCalories: 0,
      openingBankStatus: 'initialized',
      openingBankCalories: 0,
      latestFinalizedDate: null,
      latestCompletedDate: null,
      latestDailyBankChange: null,
      latestOriginalDailyBankChange: null,
      latestContributionStatus: null,
      latestLocksAt: null,
      latestCorrectionCount: 0,
      finalizedDayCount: 0,
    });
  });

  it('returns summary with seeded data', async () => {
    const response = await request(
      createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }),
    )
      .get('/v1/me/bank-summary')
      .expect(200);

    expect(response.body).toMatchObject({
      effectiveBankBalanceCalories: 200,
      availableBankCalories: 200,
      recoveryCalories: 0,
      latestFinalizedDate: '2026-07-19',
      latestDailyBankChange: 200,
      latestOriginalDailyBankChange: 200,
      latestContributionStatus: 'provisional',
      latestCorrectionCount: 0,
      finalizedDayCount: 1,
    });
  });

  it('returns truthful negative effective balance as nonnegative Recovery presentation', async () => {
    const negative = {
      ...detail,
      dailyBankChange: -900,
      originalDailyBankChange: -900,
      effectiveDailyBankChange: -900,
    };
    const response = await request(
      createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository([negative]) }),
    )
      .get('/v1/me/bank-summary')
      .expect(200);

    expect(response.body).toMatchObject({
      effectiveBankBalanceCalories: -900,
      availableBankCalories: 0,
      recoveryCalories: 900,
    });
  });

  it('validates history range', async () => {
    await request(createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository() }))
      .get('/v1/me/bank-history?range=BAD')
      .expect(400);
  });

  it('returns Opening Bank provenance separately from ordinary completed days', async () => {
    const response = await request(createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository() }))
      .get('/v1/me/bank-opening')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'initialized',
      openingBankCalories: 0,
      eligibleDayCount: 0,
      calculationDays: [],
    });
  });

  it('returns ordered history', async () => {
    const response = await request(
      createApp(localDevelopmentApiEnv(), {
        bankHistoryRepository: new MemoryBankHistoryRepository([
          { ...detail, logDate: '2026-07-18', dailyBankChange: 50 },
          detail,
        ]),
      }),
    )
      .get('/v1/me/bank-history?range=ALL')
      .expect(200);

    expect(response.body.days.map((day: { logDate: string }) => day.logDate)).toEqual([
      '2026-07-19',
      '2026-07-18',
    ]);
  });

  it('returns selected-day detail', async () => {
    const response = await request(
      createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }),
    )
      .get('/v1/me/bank-history/2026-07-19')
      .expect(200);

    expect(response.body).toEqual(detail);
    expect(response.body.versions).toHaveLength(1);
  });

  it('returns authenticated safe per-date HealthKit server evidence', async () => {
    const response = await request(
      createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository() }),
    )
      .get('/v1/me/bank-history-diagnostics?dates=2026-09-01')
      .expect(200);

    expect(response.body).toEqual({
      dates: [{
        localDate: '2026-09-01',
        intakeAggregatePresent: false,
        expenditureAggregatePresent: true,
        appleHealthIntakeAggregatePresent: false,
        appleHealthExpenditureAggregatePresent: false,
        historicalState: 'waiting_for_intake',
      }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/email|token|bundle|calories/i);
  });

  it('returns 404 for unknown date', async () => {
    await request(createApp(localDevelopmentApiEnv(), { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }))
      .get('/v1/me/bank-history/2026-07-18')
      .expect(404);
  });
});
