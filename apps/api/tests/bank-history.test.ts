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
  FinalizeDailyBankRecordInput,
} from '../src/modules/bank-history/bank-history.repository';
import type { DevelopmentUser } from '../src/modules/goal-configuration/goal-configuration.repository';

class MemoryBankHistoryRepository implements BankHistoryRepository {
  constructor(private readonly details: BankHistoryDayDetailResponse[] = []) {}

  async finalizeDailyRecord(
    _user: DevelopmentUser,
    _input: FinalizeDailyBankRecordInput,
  ): Promise<BankHistoryDayDetailResponse> {
    throw new Error('Not implemented in route tests.');
  }

  async getSummary(): Promise<BankSummaryResponse> {
    const ordered = [...this.details].sort((a, b) => b.logDate.localeCompare(a.logDate));
    return {
      availableBankCalories: this.details.reduce((sum, day) => sum + day.dailyBankChange, 0),
      latestFinalizedDate: ordered[0]?.logDate ?? null,
      latestDailyBankChange: ordered[0]?.dailyBankChange ?? null,
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
  finalizedAt: '2026-07-20T05:30:00.000Z',
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
  });

  it('returns 404 for unknown date', async () => {
    await request(createApp(undefined, { bankHistoryRepository: new MemoryBankHistoryRepository([detail]) }))
      .get('/v1/me/bank-history/2026-07-18')
      .expect(404);
  });
});
