import {
  BankCalculationError,
  calculateFinalizedDailyBankChange,
  roundCalories,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

describe('finalized daily bank calculation', () => {
  it('calculates a cut day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3625,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2085,
      }),
    ).toEqual({
      adjustedExpenditure: 2900,
      dailyAllowance: 2400,
      dailyBankChange: 315,
    });
  });

  it('calculates a maintain day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 2500,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'maintain',
        goalAdjustmentCalories: 999,
        importedCalorieIntake: 1950,
      }),
    ).toEqual({
      adjustedExpenditure: 2000,
      dailyAllowance: 2000,
      dailyBankChange: 50,
    });
  });

  it('calculates a bulk day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'bulk',
        goalAdjustmentCalories: 300,
        importedCalorieIntake: 2500,
      }),
    ).toEqual({
      adjustedExpenditure: 2400,
      dailyAllowance: 2700,
      dailyBankChange: 200,
    });
  });

  it('allows negative bank results', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 2800,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2500,
      }).dailyBankChange,
    ).toBe(-760);
  });

  it('rounds adjusted expenditure deterministically to the nearest calorie', () => {
    expect(roundCalories(100.4)).toBe(100);
    expect(roundCalories(100.5)).toBe(101);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: -1,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 1.2,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'unsupported' as never,
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);
  });
});
