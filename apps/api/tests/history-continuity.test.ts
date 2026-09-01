import { describe, expect, it } from 'vitest';

import {
  classifyCompletedDayGap,
  completedLocalDates,
  continuityMessage,
} from '../src/modules/bank-history/history-continuity';

describe('completed-day continuity', () => {
  it('enumerates every completed date from the accounting boundary and excludes today', () => {
    expect(completedLocalDates('2026-08-21', '2026-08-29')).toEqual([
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
    ]);
  });

  it('does not include dates before the accounting boundary', () => {
    expect(completedLocalDates('2026-08-21', '2026-08-23')).toEqual([
      '2026-08-21',
      '2026-08-22',
    ]);
  });

  it('uses calendar dates continuously across daylight-saving changes', () => {
    expect(completedLocalDates('2026-10-31', '2026-11-03')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('does not classify a calculated zero-contribution day as missing', () => {
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: true,
      hasBurnData: true,
      hasFoodData: true,
      burnQueried: true,
      foodQueried: true,
      syncFailed: false,
    })).toBeNull();
  });

  it('distinguishes never-queried dates from queried missing inputs', () => {
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: false,
      hasBurnData: false,
      hasFoodData: false,
      burnQueried: false,
      foodQueried: false,
      syncFailed: false,
    })).toBe('unprocessed');
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: false,
      hasBurnData: false,
      hasFoodData: true,
      burnQueried: true,
      foodQueried: true,
      syncFailed: false,
    })).toBe('missing_burn_data');
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: false,
      hasBurnData: true,
      hasFoodData: false,
      burnQueried: true,
      foodQueried: true,
      syncFailed: false,
    })).toBe('missing_food_data');
  });

  it('surfaces provider failures ahead of missing-data classifications', () => {
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: false,
      hasBurnData: false,
      hasFoodData: false,
      burnQueried: true,
      foodQueried: true,
      syncFailed: true,
    })).toBe('sync_failed');
  });

  it('keeps complete but uncalculated inputs explicit', () => {
    expect(classifyCompletedDayGap({
      hasCalculatedRecord: false,
      hasBurnData: true,
      hasFoodData: true,
      burnQueried: true,
      foodQueried: true,
      syncFailed: false,
    })).toBe('unprocessed');
  });

  it('uses concise consumer messages without fake calorie values', () => {
    expect(continuityMessage('missing_burn_data')).toBe('Calorie-burn data is unavailable.');
    expect(continuityMessage('missing_food_data')).toBe('Food data is unavailable.');
    expect(continuityMessage('unprocessed')).not.toContain('0 kcal');
  });
});
