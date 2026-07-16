export type BankTransactionKind = 'deposit' | 'withdrawal' | 'adjustment';

export type DailyBankInputs = {
  dailyTargetCalories: number;
  caloriesConsumed: number;
  eligibleActivityCalories?: number;
};

export function calculateProjectedBankChange({
  dailyTargetCalories,
  caloriesConsumed,
  eligibleActivityCalories = 0,
}: DailyBankInputs): number {
  return dailyTargetCalories + eligibleActivityCalories - caloriesConsumed;
}
