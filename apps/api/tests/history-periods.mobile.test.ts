import { describe, expect, it } from 'vitest';
import type { BankHistoryResponse } from '@caloriebank/schemas';
import { historyPeriods, movePeriod, periodBounds, shiftDate } from '../../mobile/lib/history/periods';
const fixture = (days: [string, number][], missing: string[] = []) => ({
  days: days.map(([logDate, dailyBankChange]) => ({ logDate, dailyBankChange })),
  missingDays: missing.map(logDate => ({ logDate })),
} as BankHistoryResponse);

describe('calendar history periods', () => {
  it('uses calendar days, Sunday weeks, leap months and years rather than rolling day counts', () => {
    expect(periodBounds('D', '2024-02-29')).toEqual({ start: '2024-02-29', end: '2024-02-29' });
    expect(periodBounds('W', '2026-11-13')).toEqual({ start: '2026-11-08', end: '2026-11-14' });
    expect(periodBounds('M', '2024-02-29')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(periodBounds('3M', '2026-01-31')).toEqual({ start: '2025-11-01', end: '2026-01-31' });
    expect(periodBounds('Y', '2024-02-29')).toEqual({ start: '2024-01-01', end: '2024-12-31' });
    expect(movePeriod('M', '2026-03-31', -1)).toBe('2026-02-01');
    expect(movePeriod('Y', '2024-02-29', 1)).toBe('2025-02-01');
    expect(shiftDate('2026-03-08', 1)).toBe('2026-03-09');
  });
  it('groups monthly days into clipped weeks, preserving signed totals and missing days', () => {
    const result = historyPeriods(fixture([['2026-11-30', 400], ['2026-11-29', -250], ['2026-11-28', 25], ['2026-10-31', 999]], ['2026-11-27']), 'M', '2026-11-30');
    expect(result.buckets.map(row => [row.start, row.end, row.total, row.missingCount])).toEqual([
      ['2026-11-29', '2026-11-30', 150, 0], ['2026-11-22', '2026-11-28', 25, 1],
    ]);
    expect(result.visible).toHaveLength(4);
  });
  it('keeps a week spanning months together in the three-month view without double counting', () => {
    const result = historyPeriods(fixture([['2026-11-01', 20], ['2026-10-31', 10], ['2026-10-25', -5]]), '3M', '2026-11-12');
    expect(result.buckets.map(row => row.total)).toEqual([20, 5]);
    expect(result.buckets.reduce((sum, row) => sum + (row.total ?? 0), 0)).toBe(25);
  });
  it('groups year by months and All by distinct month/year keys', () => {
    const history = fixture([['2026-11-02', -20], ['2026-11-01', 30], ['2026-10-01', 50], ['2025-11-01', 100]]);
    expect(historyPeriods(history, 'Y', '2026-11-02').buckets.map(row => row.total)).toEqual([10, 50]);
    expect(historyPeriods(history, 'ALL', '2026-11-02').buckets.map(row => row.id)).toEqual(['2026-11-01', '2026-10-01', '2025-11-01']);
  });
  it('never turns missing-only buckets into zero, while retaining real zero-net totals', () => {
    const result = historyPeriods(fixture([['2026-11-01', 20], ['2026-11-02', -20]], ['2026-11-09']), 'M', '2026-11-12');
    expect(result.buckets.map(row => row.total)).toEqual([null, 0]);
    expect(historyPeriods(fixture([]), 'Y', '2026-11-12').buckets).toEqual([]);
  });
});

it('keeps fixed chart dates with null gaps and signed real-zero values', async () => {
  const { historyChart } = await import('../../mobile/lib/history/periods');
  const values = historyChart(fixture([['2026-11-01', 0], ['2026-11-03', -200]]), 'W', '2026-11-03');
  expect(values).toHaveLength(7);
  expect(values.map(point => point.total)).toEqual([0, null, -200, null, null, null, null]);
  expect(historyChart(fixture([]), 'M', '2024-02-10')).toHaveLength(29);
  expect(historyChart(fixture([]), 'Y', '2026-11-01')).toHaveLength(12);
});
