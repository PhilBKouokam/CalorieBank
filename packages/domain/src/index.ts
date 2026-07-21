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

export type CurrentDayAdjustedExpenditureInput = {
  rawImportedExpenditureCalories: number;
  expenditureAdjustmentRate: number;
};

export type ActivityCalorieEstimateInput = {
  activityCode: string;
  durationMinutes: number;
  bodyWeightKg: number;
  lowCaloriesPerKgHour: number;
  highCaloriesPerKgHour: number;
  estimationMethod: 'population_model' | 'wearable_history';
  modelVersion: string;
};

export type ActivityCalorieEstimate = {
  activityCode: string;
  durationMinutes: number;
  estimatedLowCalories: number;
  estimatedHighCalories: number;
  estimationMethod: 'population_model' | 'wearable_history';
  modelVersion: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  explanatoryLabel: string;
};

export type ActivityOpportunityEligibilityInput = {
  notificationsEnabled: boolean;
  activityNudgesEnabled: boolean;
  quietHoursActive: boolean;
  frequencyCapReached: boolean;
  duplicateRecentlySent: boolean;
  hasMatchingExplicitActivityPreference: boolean;
  plannedTreatReady: boolean;
  remainingTreatCalories: number;
  currentAt: Date;
  plannedTreatAt: Date | null;
};

export type ActivityOpportunityEligibility = {
  deliveryEligibility: 'eligible' | 'blocked';
  blockedReason: string | null;
  opportunityReasonCodes: string[];
  expiresAt: Date | null;
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

function assertPositiveFiniteNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BankCalculationError(`${fieldName} must be a positive finite number.`);
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

export function calculateAdjustedCurrentDayExpenditure({
  rawImportedExpenditureCalories,
  expenditureAdjustmentRate,
}: CurrentDayAdjustedExpenditureInput) {
  assertNonNegativeInteger(rawImportedExpenditureCalories, 'rawImportedExpenditureCalories');
  assertAdjustmentRate(expenditureAdjustmentRate);

  return roundCalories(rawImportedExpenditureCalories * expenditureAdjustmentRate);
}

export function estimateActivityCalorieRange({
  activityCode,
  durationMinutes,
  bodyWeightKg,
  lowCaloriesPerKgHour,
  highCaloriesPerKgHour,
  estimationMethod,
  modelVersion,
}: ActivityCalorieEstimateInput): ActivityCalorieEstimate {
  if (!activityCode.trim()) {
    throw new BankCalculationError('activityCode is required.');
  }

  assertPositiveFiniteNumber(durationMinutes, 'durationMinutes');
  assertPositiveFiniteNumber(bodyWeightKg, 'bodyWeightKg');
  assertPositiveFiniteNumber(lowCaloriesPerKgHour, 'lowCaloriesPerKgHour');
  assertPositiveFiniteNumber(highCaloriesPerKgHour, 'highCaloriesPerKgHour');

  if (lowCaloriesPerKgHour > highCaloriesPerKgHour) {
    throw new BankCalculationError('lowCaloriesPerKgHour cannot exceed highCaloriesPerKgHour.');
  }

  if (!modelVersion.trim()) {
    throw new BankCalculationError('modelVersion is required.');
  }

  if (estimationMethod !== 'population_model' && estimationMethod !== 'wearable_history') {
    throw new BankCalculationError('estimationMethod is unsupported.');
  }

  const hours = durationMinutes / 60;
  const estimatedLowCalories = roundCalories(bodyWeightKg * hours * lowCaloriesPerKgHour);
  const estimatedHighCalories = roundCalories(bodyWeightKg * hours * highCaloriesPerKgHour);

  return {
    activityCode,
    durationMinutes,
    estimatedLowCalories,
    estimatedHighCalories,
    estimationMethod,
    modelVersion,
    confidenceLevel: estimationMethod === 'wearable_history' ? 'medium' : 'low',
    explanatoryLabel: 'estimated range',
  };
}

export function calculateRemainingTreatGapFromAvailableBank(
  availableBankCalories: number,
  requiredCalories: number,
) {
  assertNonNegativeInteger(requiredCalories, 'requiredCalories');

  if (!Number.isInteger(availableBankCalories)) {
    throw new BankCalculationError('availableBankCalories must be an integer.');
  }

  return Math.max(requiredCalories - Math.max(availableBankCalories, 0), 0);
}

export function evaluateActivityOpportunityEligibility({
  notificationsEnabled,
  activityNudgesEnabled,
  quietHoursActive,
  frequencyCapReached,
  duplicateRecentlySent,
  hasMatchingExplicitActivityPreference,
  plannedTreatReady,
  remainingTreatCalories,
  currentAt,
  plannedTreatAt,
}: ActivityOpportunityEligibilityInput): ActivityOpportunityEligibility {
  assertNonNegativeInteger(remainingTreatCalories, 'remainingTreatCalories');

  const blockedReason =
    (!notificationsEnabled && 'notifications_disabled') ||
    (!activityNudgesEnabled && 'activity_nudges_disabled') ||
    (quietHoursActive && 'quiet_hours') ||
    (frequencyCapReached && 'frequency_cap_reached') ||
    (duplicateRecentlySent && 'duplicate_recently_sent') ||
    (!hasMatchingExplicitActivityPreference && 'no_matching_explicit_activity_preference') ||
    (plannedTreatReady && 'planned_treat_ready') ||
    (remainingTreatCalories === 0 && 'no_remaining_treat_gap') ||
    (!plannedTreatAt && 'missing_planned_treat_time') ||
    (plannedTreatAt && plannedTreatAt <= currentAt && 'planned_treat_passed') ||
    null;

  if (blockedReason) {
    return {
      deliveryEligibility: 'blocked',
      blockedReason,
      opportunityReasonCodes: [],
      expiresAt: plannedTreatAt,
    };
  }

  return {
    deliveryEligibility: 'eligible',
    blockedReason: null,
    opportunityReasonCodes: [
      'active_planned_treat',
      'remaining_gap',
      'matching_explicit_activity_preference',
      'allowed_notification_window',
    ],
    expiresAt: plannedTreatAt,
  };
}

export function buildActivityOpportunityBody({
  remainingTreatCalories,
  plannedTreatName,
  activityDisplayName,
  durationMinutes,
  estimatedLowCalories,
  estimatedHighCalories,
}: {
  remainingTreatCalories: number;
  plannedTreatName: string;
  activityDisplayName: string;
  durationMinutes: number;
  estimatedLowCalories: number;
  estimatedHighCalories: number;
}) {
  assertNonNegativeInteger(remainingTreatCalories, 'remainingTreatCalories');
  assertNonNegativeInteger(estimatedLowCalories, 'estimatedLowCalories');
  assertNonNegativeInteger(estimatedHighCalories, 'estimatedHighCalories');

  if (estimatedLowCalories > estimatedHighCalories) {
    throw new BankCalculationError('estimatedLowCalories cannot exceed estimatedHighCalories.');
  }

  return `You're about ${remainingTreatCalories.toLocaleString()} kcal from ${plannedTreatName}. Based on your profile, a ${durationMinutes}-minute ${activityDisplayName} session may burn around ${estimatedLowCalories.toLocaleString()}-${estimatedHighCalories.toLocaleString()} kcal.`;
}
