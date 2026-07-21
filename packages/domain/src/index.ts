export type BankGoalMode = 'cut' | 'maintain' | 'bulk';

export const V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE = 0.8;
export const MIN_EXPENDITURE_ADJUSTMENT_RATE = 0;
export const MAX_EXPENDITURE_ADJUSTMENT_RATE = 1;

export type FinalizedDailyBankCalculationInput = {
  importedTotalDailyExpenditure: number;
  expenditureAdjustmentRate: number;
  goalMode: BankGoalMode;
  goalAdjustmentCalories: number;
  importedCalorieIntake: number;
};

export type FinalizedDailyBankCalculationResult = {
  adjustedExpenditure: number;
  dailyAllowance: number;
  dailyBankChange: number;
};

export class BankCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankCalculationError';
  }
}

function assertNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new BankCalculationError(`${fieldName} must be a non-negative integer.`);
  }
}

function assertAdjustmentRate(value: number) {
  if (
    !Number.isFinite(value) ||
    value < MIN_EXPENDITURE_ADJUSTMENT_RATE ||
    value > MAX_EXPENDITURE_ADJUSTMENT_RATE
  ) {
    throw new BankCalculationError('expenditureAdjustmentRate must be between 0 and 1.');
  }
}

export function roundCalories(value: number) {
  if (!Number.isFinite(value)) {
    throw new BankCalculationError('calorie value must be finite.');
  }

  return Math.round(value);
}

export function calculateFinalizedDailyBankChange({
  importedTotalDailyExpenditure,
  expenditureAdjustmentRate,
  goalMode,
  goalAdjustmentCalories,
  importedCalorieIntake,
}: FinalizedDailyBankCalculationInput): FinalizedDailyBankCalculationResult {
  assertNonNegativeInteger(importedTotalDailyExpenditure, 'importedTotalDailyExpenditure');
  assertNonNegativeInteger(importedCalorieIntake, 'importedCalorieIntake');
  assertNonNegativeInteger(goalAdjustmentCalories, 'goalAdjustmentCalories');
  assertAdjustmentRate(expenditureAdjustmentRate);

  const adjustedExpenditure = roundCalories(importedTotalDailyExpenditure * expenditureAdjustmentRate);
  let dailyAllowance: number;

  if (goalMode === 'cut') {
    dailyAllowance = adjustedExpenditure - goalAdjustmentCalories;
  } else if (goalMode === 'maintain') {
    dailyAllowance = adjustedExpenditure;
  } else if (goalMode === 'bulk') {
    dailyAllowance = adjustedExpenditure + goalAdjustmentCalories;
  } else {
    throw new BankCalculationError('goalMode is unsupported.');
  }

  return {
    adjustedExpenditure,
    dailyAllowance,
    dailyBankChange: dailyAllowance - importedCalorieIntake,
  };
}
