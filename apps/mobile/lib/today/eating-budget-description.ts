import type { EatingBudgetResponse } from '@caloriebank/schemas';

/** Explain saved budget inputs, never a local walking what-if draft. */
export function eatingBudgetDescription(budget: EatingBudgetResponse | null): string {
  const signed = budget?.signedGoalAdjustmentCalories;
  const target = budget?.dailyBankTargetCalories ?? 0;
  if (signed == null || !Number.isSafeInteger(signed) || !Number.isSafeInteger(target) || target < 0) {
    return 'Your eating budget isn’t available until your saved goal settings are available.';
  }
  const goal = signed < 0 ? `deficit of ${Math.abs(signed).toLocaleString()} calories`
    : signed > 0 ? `surplus of ${signed.toLocaleString()} calories` : 'maintenance';
  return `Your eating budget is the maximum amount of calories that you can eat while staying on track with your ${goal}${target > 0 ? ` and your daily banking target of ${target.toLocaleString()} calories` : ''}.`;
}
