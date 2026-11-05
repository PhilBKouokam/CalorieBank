/** Read-only current-day guidance. No persistence, provider fetches or finalized accounting. */
import { calculateBurnToStepPlan, getLocalDateUtcBounds, walkingMidnightFeasibility, V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE } from './index';
import { adjustedIntakeCalories } from './intake-adjustment';

export type BudgetIdentity = { accountId: string; sourceId: string; localDate: string; timezone: string };
export type BudgetContext = {
  accountId: string; expenditureSourceId: string; intakeSourceId: string;
  localDate: string; timezone: string; now: Date;
  signedGoalAdjustmentCalories: number; dailyBankTargetCalories: number;
};
export type BudgetExpenditure = BudgetIdentity & {
  semantic: 'accumulated' | 'verified_full_day_estimate' | 'unknown';
  rawProviderCalories: number;
  coverage: 'verified' | 'unverified'; coverageAt: Date; planningExpiresAt: Date;
  /** Existing qualified model's raw provider units; never rounded display values. */
  remainingRest: { rawProviderCalories: number; from: Date; through: Date; qualified: boolean } | null;
};
export type BudgetIntake = BudgetIdentity & {
  semantic: 'observed_current_day_intake' | 'estimated_total_day_intake' | 'unknown';
  calories: number | null;
  /** Observed intake requires a separately approved adapter coverage/SLA. Fetch time is insufficient. */
  coverage: { verified: boolean; policyId: string; through: Date; expiresAt: Date } | null;
  correction: (BudgetIdentity & { mode: 'add' | 'replace'; calories: number }) | null;
};
export type BudgetComparison = { kind: 'remaining_today' | 'estimated_day_difference'; calories: number };
export type EatingBudgetResult =
  | { status: 'unavailable'; reason: 'invalid_context' | 'missing_expenditure' | 'identity_mismatch' | 'unverified_coverage' | 'stale_expenditure' | 'unsupported_semantic' | 'invalid_rest' | 'invalid_value' }
  | { status: 'ready' | 'non_positive'; estimated: true; totalCalories: number; rawProjectedProviderCalories: number;
      comparison: BudgetComparison | null; comparisonUnavailable: boolean; comparisonExpiresAt: Date | null; expiresAt: Date };

const finiteDate = (date: Date) => date instanceof Date && Number.isFinite(date.getTime());
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const whole = (value: number) => Number.isSafeInteger(value) && value >= 0;
const identityMatches = (a: BudgetIdentity, c: BudgetContext, source: string) =>
  a.accountId === c.accountId && a.sourceId === source && a.localDate === c.localDate && a.timezone === c.timezone;
const sameIdentity = (a: BudgetIdentity, b: BudgetIdentity) =>
  a.accountId === b.accountId && a.sourceId === b.sourceId && a.localDate === b.localDate && a.timezone === b.timezone;

function contextBounds(c: BudgetContext) {
  if (!c.accountId || !c.expenditureSourceId || !c.intakeSourceId || !finiteDate(c.now) ||
    !Number.isSafeInteger(c.signedGoalAdjustmentCalories) || !whole(c.dailyBankTargetCalories) || c.dailyBankTargetCalories > 2000) return null;
  try {
    const bounds = getLocalDateUtcBounds(c.localDate, c.timezone);
    return c.now >= bounds.start && c.now < bounds.end ? bounds : null;
  } catch { return null; }
}

export function resolveBudgetIntakeComparison(c: BudgetContext, total: number, input: BudgetIntake | null): BudgetComparison | null {
  if (!contextBounds(c) || !Number.isSafeInteger(total)) return null;
  if (!input || !identityMatches(input, c, c.intakeSourceId) || (input.semantic !== 'observed_current_day_intake' && input.semantic !== 'estimated_total_day_intake')) return null;
  let semantic = input.semantic;
  if (input.calories !== null && !whole(input.calories)) return null;
  if (input.correction && ((input.correction.mode !== 'add' && input.correction.mode !== 'replace') || !sameIdentity(input, input.correction) || !whole(input.correction.calories) || input.correction.calories > 100000)) return null;
  let calories: number | null;
  try { calories = adjustedIntakeCalories(input.calories, input.correction); } catch { return null; }
  if (calories === null || !whole(calories)) return null;
  // Repository's replacement semantic is estimated whole-day, even for a connected tracker.
  if (input.correction?.mode === 'replace') semantic = 'estimated_total_day_intake';
  if (semantic === 'observed_current_day_intake') {
    const coverage = input.coverage;
    const bounds = contextBounds(c);
    if (!coverage?.verified || !coverage.policyId || !bounds || !finiteDate(coverage.through) || !finiteDate(coverage.expiresAt) ||
      coverage.through < bounds.start || coverage.through > c.now || coverage.expiresAt <= c.now ||
      coverage.expiresAt <= coverage.through || coverage.expiresAt > bounds.end) return null;
  }
  const difference = total - calories;
  if (!Number.isSafeInteger(difference)) return null;
  return { kind: semantic === 'observed_current_day_intake' ? 'remaining_today' : 'estimated_day_difference', calories: difference };
}

export function calculateEatingBudget(context: BudgetContext, expenditure: BudgetExpenditure | null, intake: BudgetIntake | null = null): EatingBudgetResult {
  const bounds = contextBounds(context);
  if (!bounds) return { status: 'unavailable', reason: 'invalid_context' };
  if (!expenditure) return { status: 'unavailable', reason: 'missing_expenditure' };
  if (!identityMatches(expenditure, context, context.expenditureSourceId)) return { status: 'unavailable', reason: 'identity_mismatch' };
  if (expenditure.semantic !== 'accumulated' && expenditure.semantic !== 'verified_full_day_estimate') return { status: 'unavailable', reason: 'unsupported_semantic' };
  if (expenditure.coverage !== 'verified' || !finiteDate(expenditure.coverageAt) || expenditure.coverageAt < bounds.start || expenditure.coverageAt > context.now) return { status: 'unavailable', reason: 'unverified_coverage' };
  if (!finiteDate(expenditure.planningExpiresAt)) return { status: 'unavailable', reason: 'stale_expenditure' };
  const expiresAt = new Date(Math.min(expenditure.coverageAt.getTime() + 30 * 60000, expenditure.planningExpiresAt.getTime(), bounds.end.getTime()));
  if (context.now >= expiresAt) return { status: 'unavailable', reason: 'stale_expenditure' };
  if (!nonnegative(expenditure.rawProviderCalories)) return { status: 'unavailable', reason: 'invalid_value' };
  let rest = 0;
  if (expenditure.semantic === 'accumulated') {
    const r = expenditure.remainingRest;
    if (!r?.qualified || !nonnegative(r.rawProviderCalories) || !finiteDate(r.from) || !finiteDate(r.through) ||
      r.from.getTime() !== expenditure.coverageAt.getTime() || r.through.getTime() !== bounds.end.getTime()) return { status: 'unavailable', reason: 'invalid_rest' };
    rest = r.rawProviderCalories;
  } else if (expenditure.remainingRest !== null) return { status: 'unavailable', reason: 'invalid_rest' };
  const rawProjectedProviderCalories = expenditure.rawProviderCalories + rest;
  const totalCalories = Math.round(V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE * rawProjectedProviderCalories) + context.signedGoalAdjustmentCalories - context.dailyBankTargetCalories;
  if (!nonnegative(rawProjectedProviderCalories) || !Number.isSafeInteger(totalCalories)) return { status: 'unavailable', reason: 'invalid_value' };
  const comparison = resolveBudgetIntakeComparison(context, totalCalories, intake);
  return { status: totalCalories > 0 ? 'ready' : 'non_positive', estimated: true, totalCalories, rawProjectedProviderCalories,
    comparison, comparisonUnavailable: comparison === null,
    comparisonExpiresAt: comparison === null ? null : new Date(Math.min(expiresAt.getTime(), comparison.kind === 'remaining_today' ? intake!.coverage!.expiresAt.getTime() : expiresAt.getTime())), expiresAt };
}

export type EatPlanningModel = BudgetIdentity & {
  qualified: boolean; providerCaloriesPerAdditionalStep: number; currentSteps: number; currentStepsAt: Date;
  stepsPerMinute: number | null;
};
export type EatPlan =
  | { status: 'unavailable'; reason: 'budget_unavailable' | 'invalid_model' | 'invalid_target' | 'unknown_time' | 'insufficient_time' }
  | { status: 'ready'; hypothetical: true; totalIntakeCalories: number; totalSteps: number; additionalSteps: number; expiresAt: Date };

function validModel(c: BudgetContext, expenditure: BudgetExpenditure | null, model: EatPlanningModel) {
  return identityMatches(model, c, c.expenditureSourceId) && model.qualified && whole(model.currentSteps) &&
    finiteDate(model.currentStepsAt) && expenditure !== null && model.currentStepsAt.getTime() === expenditure.coverageAt.getTime() &&
    Number.isFinite(model.providerCaloriesPerAdditionalStep) && model.providerCaloriesPerAdditionalStep > 0;
}
function finishPlan(c: BudgetContext, budget: Exclude<EatingBudgetResult, { status: 'unavailable' }>, model: EatPlanningModel, totalSteps: number): EatPlan {
  const additionalSteps = Math.max(0, totalSteps - model.currentSteps);
  const feasibility = walkingMidnightFeasibility({ remainingSteps: additionalSteps, stepsPerMinute: model.stepsPerMinute, localDate: c.localDate, timezone: c.timezone, now: c.now });
  if (feasibility !== 'fits') return { status: 'unavailable', reason: feasibility === 'unknown' ? 'unknown_time' : 'insufficient_time' };
  const totalIntakeCalories = Math.round(V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE * (budget.rawProjectedProviderCalories + additionalSteps * model.providerCaloriesPerAdditionalStep)) + c.signedGoalAdjustmentCalories - c.dailyBankTargetCalories;
  if (!Number.isSafeInteger(totalIntakeCalories) || totalIntakeCalories <= 0) return { status: 'unavailable', reason: 'invalid_target' };
  return { status: 'ready', hypothetical: true, totalIntakeCalories, totalSteps, additionalSteps, expiresAt: new Date(budget.expiresAt) };
}

/** Direction B: target is total-day steps, never added a second time to provider totals. */
export function planIntakeForSteps(context: BudgetContext, expenditure: BudgetExpenditure | null, model: EatPlanningModel, targetTotalSteps: number): EatPlan {
  const budget = calculateEatingBudget(context, expenditure);
  if (budget.status === 'unavailable') return { status: 'unavailable', reason: 'budget_unavailable' };
  if (!validModel(context, expenditure, model)) return { status: 'unavailable', reason: 'invalid_model' };
  if (!whole(targetTotalSteps)) return { status: 'unavailable', reason: 'invalid_target' };
  return finishPlan(context, budget, model, Math.max(model.currentSteps, targetTotalSteps));
}

/** Direction A: desired intake is a total-day hypothetical value, not an additional meal. */
export function planStepsForIntake(context: BudgetContext, expenditure: BudgetExpenditure | null, model: EatPlanningModel, targetTotalIntakeCalories: number): EatPlan {
  const budget = calculateEatingBudget(context, expenditure);
  if (budget.status === 'unavailable') return { status: 'unavailable', reason: 'budget_unavailable' };
  if (!validModel(context, expenditure, model)) return { status: 'unavailable', reason: 'invalid_model' };
  if (!whole(targetTotalIntakeCalories)) return { status: 'unavailable', reason: 'invalid_target' };
  const requiredAdjustedBurn = targetTotalIntakeCalories - context.signedGoalAdjustmentCalories + context.dailyBankTargetCalories;
  if (!Number.isSafeInteger(requiredAdjustedBurn)) return { status: 'unavailable', reason: 'invalid_target' };
  const steps = calculateBurnToStepPlan({ currentSteps: model.currentSteps, targetActualBurnCalories: Math.max(0, requiredAdjustedBurn),
    providerCaloriesPerStep: model.providerCaloriesPerAdditionalStep, projectedProviderBurnAtRest: budget.rawProjectedProviderCalories, adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE });
  if (!whole(steps.totalDailyStepsNeeded)) return { status: 'unavailable', reason: 'invalid_target' };
  const result = finishPlan(context, budget, model, steps.totalDailyStepsNeeded);
  if (result.status === 'ready' && result.totalIntakeCalories < targetTotalIntakeCalories) return { status: 'unavailable', reason: 'invalid_target' };
  return result;
}

/** Whole-day ESTIMATE from the already-adjusted projection shown by CalorieBank.
 * No observed food subtraction, Available Bank use, or second expenditure factor. */
export function calculateProjectedEatingBudget(input:{projectedAdjustedBurnCalories:number;signedGoalAdjustmentCalories:number;dailyBankTargetCalories:number}){
 const {projectedAdjustedBurnCalories:burn,signedGoalAdjustmentCalories:goal,dailyBankTargetCalories:target}=input;
 if(!Number.isSafeInteger(burn)||burn<0||!Number.isSafeInteger(goal)||!Number.isSafeInteger(target)||target<0||target>2000)return {status:'unavailable' as const,reason:'invalid_projected_budget_input'};
 const totalCalories=burn+goal-target;
 if(!Number.isSafeInteger(totalCalories))return {status:'unavailable' as const,reason:'invalid_projected_budget_input'};
 return {status:totalCalories>0?'ready' as const:'non_positive' as const,totalCalories,projectedAdjustedBurnCalories:burn};
}
