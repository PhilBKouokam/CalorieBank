import { describe, expect, it } from 'vitest';

import { calculateProjectedBankChange } from '../src/index';

/**
 * docs/product/v1-prd.md projected day, before finalization:
 * projected_bank_change = daily_target_calories + eligible_manual_activity_calories - calories_consumed_so_far
 *
 * The same subtraction is the finalized bank_change. A negative result is an overage.
 * The PRD allows a negative balance and does not clamp logging or the result at zero.
 */
describe('calculateProjectedBankChange', () => {
  it('projects a deposit when intake is under the daily target', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2000,
        caloriesConsumed: 1500,
      }),
    ).toBe(500);
  });

  it('projects zero when intake matches the target and no activity is logged', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2000,
        caloriesConsumed: 2000,
      }),
    ).toBe(0);
  });

  it('projects a negative change when intake is over the eligible allowance', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2000,
        caloriesConsumed: 2600,
      }),
    ).toBe(-600);
  });

  it('treats omitted activity calories as zero', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 1800,
        caloriesConsumed: 1700,
      }),
    ).toBe(
      calculateProjectedBankChange({
        dailyTargetCalories: 1800,
        caloriesConsumed: 1700,
        eligibleActivityCalories: 0,
      }),
    );
  });

  it('adds eligible manual activity calories to the allowance', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2000,
        caloriesConsumed: 2200,
        eligibleActivityCalories: 300,
      }),
    ).toBe(100);
  });

  it('lets activity calories turn an overage into a deposit', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2000,
        caloriesConsumed: 2500,
        eligibleActivityCalories: 800,
      }),
    ).toBe(300);
  });

  it('counts a day with no food as a deposit of the full eligible allowance', () => {
    expect(
      calculateProjectedBankChange({
        dailyTargetCalories: 2100,
        caloriesConsumed: 0,
        eligibleActivityCalories: 150,
      }),
    ).toBe(2250);
  });
});
