import type { FetchDailyAggregateInput } from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

import {
  FatSecretIntakeProvider,
  fatSecretDateIntToLocalDate,
  localDateToFatSecretDateInt,
} from '../src/modules/fatsecret/fatsecret.provider';

const input = (localDate: string): FetchDailyAggregateInput => ({
  userId: 'user', localDate, timezone: 'America/Chicago', isCurrentDay: localDate === '2026-08-17',
});

describe('FatSecret diary normalization', () => {
  it('converts civil dates without timezone or DST shifts', () => {
    for (const date of ['2024-02-29', '2026-03-08', '2026-11-01', '2027-01-01']) {
      expect(fatSecretDateIntToLocalDate(localDateToFatSecretDateInt(date))).toBe(date);
    }
  });

  it('fetches each diary month once and normalizes only requested daily totals', async () => {
    const calls: number[] = [];
    const provider = new FatSecretIntakeProvider({
      fetchMonthlyDiary: async (date) => {
        calls.push(date);
        return { month: { day: [
          { date_int: String(localDateToFatSecretDateInt('2026-08-17')), calories: '1731.4' },
          { date_int: String(localDateToFatSecretDateInt('2026-08-16')), calories: '2500' },
        ] } };
      },
    }, () => new Date('2026-08-17T18:00:00.000Z'));
    const aggregates = await provider.fetchRollingDailyCalorieIntakeAggregates([
      input('2026-08-17'), input('2026-08-16'), input('2026-08-15'),
    ]);
    expect(calls).toHaveLength(1);
    expect(aggregates).toEqual([
      expect.objectContaining({ provider: 'fatsecret', totalCaloriesConsumed: 1731 }),
      expect.objectContaining({ provider: 'fatsecret', totalCaloriesConsumed: 2500 }),
      null,
    ]);
  });

  it('treats an omitted day as unavailable rather than zero', async () => {
    const provider = new FatSecretIntakeProvider({ fetchMonthlyDiary: async () => ({ month: {} }) });
    await expect(provider.fetchDailyCalorieIntakeAggregate(input('2026-08-17'))).resolves.toBeNull();
  });

  it('rejects malformed or negative diary calories', async () => {
    for (const calories of ['not-a-number', '-1']) {
      const provider = new FatSecretIntakeProvider({ fetchMonthlyDiary: async () => ({ month: { day: [{
        date_int: String(localDateToFatSecretDateInt('2026-08-17')), calories,
      }] } }) });
      await expect(provider.fetchDailyCalorieIntakeAggregate(input('2026-08-17'))).rejects.toThrow(
        'invalid daily calories',
      );
    }
  });
});
