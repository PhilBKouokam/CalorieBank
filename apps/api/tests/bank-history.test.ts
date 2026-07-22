import type {
  BankHistoryDayDetailResponse,
  BankHistoryRange,
  BankHistoryResponse,
  BankSummaryResponse,
} from '@caloriebank/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
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

  async getSummary(): Promise<BankSummaryResponse> {
    const ordered = [...this.details].sort((a, b) => b.logDate.localeCompare(a.logDate));
    return {
      availableBankCalories: this.details.reduce((sum, day) => sum + day.dailyBankChange, 0),
      latestFinalizedDate: ordered[0]?.logDate ?? null,
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
      availableBankCalories: summary.availableBankCalories,
      rangeNetChangeCalories: summary.availableBankCalories,
      finalizedDays: ordered.map((day) => ({
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

  async getDayDetail(_userId: string, logDate: string): Promise<BankHistoryDayDetailResponse | null> {
    return this.details.find((detail) => detail.logDate === logDate) ?? null;
  }
}

const detail: BankHistoryDayDetailResponse = {
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
      expenditureProvider: 'apple_health',
      intakeProvider: 'apple_health',
      createdAt: '2026-07-20T05:30:00.000Z',
    },
  ],
};

describe('bank history API', () => {
  it('returns summary with no data', async () => {
    const response = await request(
      createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository() }),
    )
      .get('/v1/me/bank-summary')
      .expect(200);

    expect(response.body).toEqual({
      availableBankCalories: 0,
      latestFinalizedDate: null,
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
      createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }),
    )
      .get('/v1/me/bank-summary')
      .expect(200);

    expect(response.body).toMatchObject({
      availableBankCalories: 200,
      latestFinalizedDate: '2026-07-19',
      latestDailyBankChange: 200,
      latestOriginalDailyBankChange: 200,
      latestContributionStatus: 'provisional',
      latestCorrectionCount: 0,
      finalizedDayCount: 1,
    });
  });

  it('validates history range', async () => {
    await request(createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository() }))
      .get('/v1/me/bank-history?range=BAD')
      .expect(400);
  });

  it('returns ordered history', async () => {
    const response = await request(
      createApp(undefined, {
        bankHistoryRepository: new MemoryBankHistoryRepository([
          { ...detail, logDate: '2026-07-18', dailyBankChange: 50 },
          detail,
        ]),
      }),
    )
      .get('/v1/me/bank-history?range=ALL')
      .expect(200);

    expect(response.body.finalizedDays.map((day: { logDate: string }) => day.logDate)).toEqual([
      '2026-07-19',
      '2026-07-18',
    ]);
  });

  it('returns selected-day detail', async () => {
    const response = await request(
      createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }),
    )
      .get('/v1/me/bank-history/2026-07-19')
      .expect(200);

    expect(response.body).toEqual(detail);
    expect(response.body.versions).toHaveLength(1);
  });

  it('returns 404 for unknown date', async () => {
    await request(createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }))
      .get('/v1/me/bank-history/2026-07-18')
      .expect(404);
  });
});
