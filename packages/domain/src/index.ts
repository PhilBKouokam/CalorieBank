export type BankGoalMode = 'cut' | 'maintain' | 'bulk';

export const V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE = 0.8;
export const MIN_EXPENDITURE_ADJUSTMENT_RATE = 0;
export const MAX_EXPENDITURE_ADJUSTMENT_RATE = 1;
export const PROVISIONAL_CORRECTION_WINDOW_CALENDAR_DAYS = 2;
export const ROLLING_HEALTH_SYNC_CALENDAR_DAYS = 3;
export const OPENING_BANK_LOOKBACK_CALENDAR_DAYS = 7;
export const PROVIDER_IDS = ['apple_health', 'google_health_fitbit', 'garmin', 'whoop', 'fatsecret'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export const BANKING_PROVIDER_IDS = ['apple_health', 'google_health_fitbit'] as const;
export type BankingProviderId = (typeof BANKING_PROVIDER_IDS)[number];
export type ExpenditureCapability = 'full_total' | 'derivable_total' | 'active_only' | 'unavailable';

export type ProviderCapabilities = {
  expenditure: boolean;
  expenditureCapability: ExpenditureCapability;
  intake: boolean;
  steps: boolean;
  workouts: boolean;
  workoutEnergy: boolean;
  workoutDuration: boolean;
  distance: boolean;
  sleep: boolean;
  heartRate: boolean;
  webhooks: boolean;
  historicalBackfill: boolean;
  oauth: boolean;
};

const PROVIDER_CAPABILITY_CATALOG: Readonly<Record<ProviderId, ProviderCapabilities>> = {
  apple_health: {
    expenditure: true,
    expenditureCapability: 'derivable_total',
    intake: true,
    steps: true,
    workouts: true,
    workoutEnergy: true,
    workoutDuration: true,
    distance: true,
    sleep: false,
    heartRate: false,
    webhooks: false,
    historicalBackfill: true,
    oauth: false,
  },
  google_health_fitbit: {
    expenditure: true,
    expenditureCapability: 'full_total',
    intake: false,
    steps: true,
    workouts: true,
    workoutEnergy: true,
    workoutDuration: true,
    distance: true,
    sleep: false,
    heartRate: false,
    webhooks: true,
    historicalBackfill: true,
    oauth: true,
  },
  garmin: {
    expenditure: false,
    expenditureCapability: 'unavailable',
    intake: false,
    steps: true,
    workouts: true,
    workoutEnergy: true,
    workoutDuration: true,
    distance: true,
    sleep: true,
    heartRate: true,
    webhooks: true,
    historicalBackfill: true,
    oauth: true,
  },
  whoop: {
    expenditure: false,
    expenditureCapability: 'unavailable',
    intake: false,
    steps: false,
    workouts: true,
    workoutEnergy: true,
    workoutDuration: true,
    distance: true,
    sleep: true,
    heartRate: true,
    webhooks: true,
    historicalBackfill: true,
    oauth: true,
  },
  fatsecret: {
    expenditure: false,
    expenditureCapability: 'unavailable',
    intake: true,
    steps: false,
    workouts: false,
    workoutEnergy: false,
    workoutDuration: false,
    distance: false,
    sleep: false,
    heartRate: false,
    webhooks: false,
    historicalBackfill: true,
    oauth: true,
  },
};

export function getProviderCapabilities(provider: ProviderId): ProviderCapabilities {
  return PROVIDER_CAPABILITY_CATALOG[provider];
}

export function canProvideAuthoritativeExpenditure(provider: ProviderId) {
  const capability = getProviderCapabilities(provider).expenditureCapability;
  return capability === 'full_total' || capability === 'derivable_total';
}

export type ProviderSelectionPolicy = {
  authoritativeProvider: string;
  fallbackProvider?: string;
  allowFallback: boolean;
};

export function resolveAuthoritativeProviderRecord<T extends { provider: string }>(
  records: readonly T[],
  policy: ProviderSelectionPolicy,
): T | null {
  const authoritative = records.find(
    (record) => record.provider === policy.authoritativeProvider,
  );
  if (authoritative) return authoritative;
  if (!policy.allowFallback || !policy.fallbackProvider) return null;
  return records.find((record) => record.provider === policy.fallbackProvider) ?? null;
}

export type BankContributionStatus = 'open' | 'provisional' | 'locked';

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

export type ConsumerBankBalances = {
  effectiveBankBalanceCalories: number;
  availableBankCalories: number;
  recoveryCalories: number;
};

export function deriveConsumerBankBalances(effectiveBankBalanceCalories: number): ConsumerBankBalances {
  if (!Number.isInteger(effectiveBankBalanceCalories)) {
    throw new BankCalculationError('effectiveBankBalanceCalories must be an integer.');
  }

  return {
    effectiveBankBalanceCalories,
    availableBankCalories: Math.max(0, effectiveBankBalanceCalories),
    recoveryCalories: Math.max(0, -effectiveBankBalanceCalories),
  };
}

export function calculateOpeningEffectiveBalance(dailyBankChanges: readonly number[]) {
  for (const dailyBankChange of dailyBankChanges) {
    if (!Number.isInteger(dailyBankChange)) {
      throw new BankCalculationError('Opening Bank daily changes must be integers.');
    }
  }
  const historicalOpeningNetCalories = dailyBankChanges.reduce((sum, value) => sum + value, 0);
  return {
    historicalOpeningNetCalories,
    openingEffectiveBalanceCalories: Math.max(0, historicalOpeningNetCalories),
  };
}

export function getPreviousCompletedLocalDates(
  currentLocalDate: string,
  count = OPENING_BANK_LOOKBACK_CALENDAR_DAYS,
) {
  assertDateOnly(currentLocalDate, 'currentLocalDate');
  if (!Number.isInteger(count) || count < 0) {
    throw new BankCalculationError('count must be a nonnegative integer.');
  }
  const [year, month, day] = currentLocalDate.split('-').map(Number);
  const dates: string[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const date = new Date(Date.UTC(year!, month! - 1, day! - offset));
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export type CurrentDayAdjustedExpenditureInput = {
  rawImportedExpenditureCalories: number;
  expenditureAdjustmentRate: number;
};

export type IngestionSyncStatus =
  | 'unavailable'
  | 'not_connected'
  | 'syncing'
  | 'partial'
  | 'stale'
  | 'ready'
  | 'error';

export type FetchDailyAggregateInput = {
  userId: string;
  localDate: string;
  timezone: string;
  isCurrentDay: boolean;
};

export type NormalizedDailyExpenditureAggregate = {
  userId: string;
  localDate: string;
  timezone: string;
  provider: string;
  providerRecordId: string;
  activeEnergyCalories?: number;
  basalEnergyCalories?: number;
  rawTotalDailyExpenditure: number;
  adjustedDailyExpenditure: number;
  adjustmentFactor: number;
  importedAt: Date;
  providerUpdatedAt: Date | null;
  syncStatus: IngestionSyncStatus;
  isCurrentDay: boolean;
  syncSessionId?: string;
};

export type NormalizedDailyIntakeAggregate = {
  userId: string;
  localDate: string;
  timezone: string;
  provider: string;
  providerRecordId: string;
  totalCaloriesConsumed: number;
  writerBundleIdentifier?: string;
  writerDisplayName?: string;
  importedAt: Date;
  providerUpdatedAt: Date | null;
  syncStatus: IngestionSyncStatus;
  isCurrentDay: boolean;
  syncSessionId?: string;
};

export interface ExpenditureProvider {
  fetchDailyExpenditureAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyExpenditureAggregate | null>;
}

export type IntakeProviderCapabilities = {
  dailyAggregate: true;
  rollingWindow: boolean;
  directConnection: boolean;
};

export interface IntakeProvider {
  readonly providerId: string;
  readonly capabilities: IntakeProviderCapabilities;
  fetchDailyCalorieIntakeAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyIntakeAggregate | null>;
}

export type NormalizedDailyStepAggregate = {
  userId: string;
  localDate: string;
  timezone: string;
  provider: string;
  providerRecordId: string;
  totalSteps: number;
  importedAt: Date;
  providerUpdatedAt: Date | null;
  syncStatus: IngestionSyncStatus;
  isCurrentDay: boolean;
  syncSessionId?: string;
};

export const WORKOUT_ACTIVITY_TYPES = [
  'walking',
  'running',
  'cycling',
  'dance',
  'strength',
  'hiit',
  'swimming',
  'yoga',
  'elliptical',
  'rowing',
  'stair',
  'other',
] as const;

export type NormalizedWorkoutActivityType = (typeof WORKOUT_ACTIVITY_TYPES)[number];

export type NormalizedCurrentDayWorkout = {
  userId: string;
  localDate: string;
  timezone: string;
  provider: string;
  providerWorkoutId: string;
  activityType: NormalizedWorkoutActivityType;
  displayName: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  totalEnergyBurned: number | null;
  totalSteps?: number | null;
  totalDistance: number | null;
  distanceUnit: string | null;
  importedAt: Date;
  providerUpdatedAt: Date | null;
  syncStatus: IngestionSyncStatus;
  isCurrentDay: boolean;
  syncSessionId?: string;
};

export interface StepProvider {
  fetchDailyStepAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyStepAggregate | null>;
}

export interface WorkoutProvider {
  fetchDailyWorkouts(
    input: FetchDailyAggregateInput,
  ): Promise<readonly NormalizedCurrentDayWorkout[]>;
}

export type DailyExpenditureNormalizationInput = Omit<
  NormalizedDailyExpenditureAggregate,
  'adjustedDailyExpenditure' | 'adjustmentFactor'
> & {
  adjustmentFactor?: number;
};

export type DailyIntakeNormalizationInput = NormalizedDailyIntakeAggregate;

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

function assertDateOnly(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BankCalculationError(`${fieldName} must use YYYY-MM-DD format.`);
  }
}

function assertPositiveFiniteNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BankCalculationError(`${fieldName} must be a positive finite number.`);
  }
}

function assertNonEmptyString(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new BankCalculationError(`${fieldName} is required.`);
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

function localDateParts(value: string) {
  assertDateOnly(value, 'logDate');
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) throw new BankCalculationError('logDate is invalid.');
  return { year, month, day };
}

function zonedMidnightUtc(year: number, month: number, day: number, timezone: string) {
  let candidate = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const representedYear = parts.year;
    const representedMonth = parts.month;
    const representedDay = parts.day;
    const representedHour = parts.hour;
    const representedMinute = parts.minute;
    const representedSecond = parts.second;
    if (
      representedYear === undefined ||
      representedMonth === undefined ||
      representedDay === undefined ||
      representedHour === undefined ||
      representedMinute === undefined ||
      representedSecond === undefined
    ) {
      throw new BankCalculationError('timezone could not be resolved.');
    }
    const representedAsUtc = Date.UTC(
      representedYear,
      representedMonth - 1,
      representedDay,
      representedHour,
      representedMinute,
      representedSecond,
    );
    candidate -= representedAsUtc - Date.UTC(year, month - 1, day);
  }

  return new Date(candidate);
}

export function getLocalDateUtcBounds(localDate: string, timezone: string) {
  assertNonEmptyString(timezone, 'timezone');
  const { year, month, day } = localDateParts(localDate);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedMidnightUtc(year, month, day, timezone),
    end: zonedMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone),
  };
}

export type StepWhatIfProjectionInput = {
  currentSteps: number;
  hypotheticalSteps: number;
  providerCaloriesPerStep: number;
  adjustedBurnSoFarCalories: number;
  adjustmentFactor: number;
};

export type StepWhatIfProjection = {
  providerCaloriesPer1000Steps: number;
  adjustedCaloriesPer1000Steps: number;
  currentAdjustedStepContributionCalories: number;
  nonStepAdjustedBurnBaselineCalories: number;
  hypotheticalAdjustedStepContributionCalories: number;
  predictedAdjustedTotalBurnCalories: number;
};

function roundEstimateToTen(value: number) {
  return Math.round(value / 10) * 10;
}

export function calculateStepWhatIfProjection(
  input: StepWhatIfProjectionInput,
): StepWhatIfProjection {
  assertNonNegativeInteger(input.currentSteps, 'currentSteps');
  assertNonNegativeInteger(input.hypotheticalSteps, 'hypotheticalSteps');
  assertNonNegativeInteger(input.adjustedBurnSoFarCalories, 'adjustedBurnSoFarCalories');
  if (!Number.isFinite(input.providerCaloriesPerStep) || input.providerCaloriesPerStep <= 0) {
    throw new BankCalculationError('providerCaloriesPerStep must be a positive finite number.');
  }
  if (!Number.isFinite(input.adjustmentFactor) || input.adjustmentFactor < 0 || input.adjustmentFactor > 1) {
    throw new BankCalculationError('adjustmentFactor must be between 0 and 1.');
  }
  const adjustedCaloriesPerStep = input.providerCaloriesPerStep * input.adjustmentFactor;
  const currentAdjustedContribution = input.currentSteps * adjustedCaloriesPerStep;
  const nonStepBaseline = Math.max(0, input.adjustedBurnSoFarCalories - currentAdjustedContribution);
  const hypotheticalContribution = input.hypotheticalSteps * adjustedCaloriesPerStep;
  return {
    providerCaloriesPer1000Steps: Math.round(input.providerCaloriesPerStep * 1_000),
    adjustedCaloriesPer1000Steps: Math.round(adjustedCaloriesPerStep * 1_000),
    currentAdjustedStepContributionCalories: roundEstimateToTen(currentAdjustedContribution),
    nonStepAdjustedBurnBaselineCalories: roundEstimateToTen(nonStepBaseline),
    hypotheticalAdjustedStepContributionCalories: roundEstimateToTen(hypotheticalContribution),
    predictedAdjustedTotalBurnCalories: roundEstimateToTen(nonStepBaseline + hypotheticalContribution),
  };
}

export function suggestNextStepTarget(currentSteps: number) {
  assertNonNegativeInteger(currentSteps, 'currentSteps');
  const nextMultiple = (Math.floor(currentSteps / 5_000) + 1) * 5_000;
  return nextMultiple - currentSteps > 2_500 ? nextMultiple : nextMultiple + 5_000;
}

export function calculateStepToBurnPlan(input: {
  currentSteps: number;
  targetSteps: number;
  providerCaloriesPerStep: number;
  projectedProviderBurnAtRest: number;
  adjustmentFactor: number;
}) {
  assertNonNegativeInteger(input.currentSteps, 'currentSteps');
  assertNonNegativeInteger(input.targetSteps, 'targetSteps');
  assertNonNegativeInteger(input.projectedProviderBurnAtRest, 'projectedProviderBurnAtRest');
  assertPositiveFiniteNumber(input.providerCaloriesPerStep, 'providerCaloriesPerStep');
  if (!Number.isFinite(input.adjustmentFactor) || input.adjustmentFactor < 0 || input.adjustmentFactor > 1) {
    throw new BankCalculationError('adjustmentFactor must be between 0 and 1.');
  }
  const additionalSteps = Math.max(0, input.targetSteps - input.currentSteps);
  const additionalProviderCalories = additionalSteps * input.providerCaloriesPerStep;
  const projectedProviderBurn = input.projectedProviderBurnAtRest + additionalProviderCalories;
  return {
    additionalSteps,
    additionalProviderCalories: roundEstimateToTen(additionalProviderCalories),
    projectedProviderBurnCalories: roundEstimateToTen(projectedProviderBurn),
    projectedAdjustedBurnCalories: roundEstimateToTen(
      projectedProviderBurn * input.adjustmentFactor,
    ),
  };
}

export function calculateBurnToStepPlan(input: {
  currentSteps: number;
  targetActualBurnCalories: number;
  providerCaloriesPerStep: number;
  projectedProviderBurnAtRest: number;
  adjustmentFactor: number;
}) {
  assertNonNegativeInteger(input.currentSteps, 'currentSteps');
  assertNonNegativeInteger(input.targetActualBurnCalories, 'targetActualBurnCalories');
  assertNonNegativeInteger(input.projectedProviderBurnAtRest, 'projectedProviderBurnAtRest');
  assertPositiveFiniteNumber(input.providerCaloriesPerStep, 'providerCaloriesPerStep');
  if (!Number.isFinite(input.adjustmentFactor) || input.adjustmentFactor <= 0 || input.adjustmentFactor > 1) {
    throw new BankCalculationError('adjustmentFactor must be greater than zero and at most one.');
  }
  const requiredProviderBurnCalories =
    input.targetActualBurnCalories / input.adjustmentFactor;
  const additionalProviderCaloriesNeeded =
    requiredProviderBurnCalories - input.projectedProviderBurnAtRest;
  if (additionalProviderCaloriesNeeded <= 0) {
    return {
      alreadyOnTrack: true,
      requiredProviderBurnCalories: roundEstimateToTen(requiredProviderBurnCalories),
      additionalProviderCaloriesNeeded: 0,
      totalDailyStepsNeeded: input.currentSteps,
      remainingSteps: 0,
    };
  }
  const additionalSteps = additionalProviderCaloriesNeeded / input.providerCaloriesPerStep;
  const totalDailyStepsNeeded = Math.max(
    input.currentSteps,
    Math.round((input.currentSteps + additionalSteps) / 100) * 100,
  );
  return {
    alreadyOnTrack: false,
    requiredProviderBurnCalories: roundEstimateToTen(requiredProviderBurnCalories),
    additionalProviderCaloriesNeeded: roundEstimateToTen(additionalProviderCaloriesNeeded),
    totalDailyStepsNeeded,
    remainingSteps: Math.max(
      0,
      Math.round((totalDailyStepsNeeded - input.currentSteps) / 100) * 100,
    ),
  };
}

export type RestEnergyHistoryDay = {
  localDate: string;
  timezone: string;
  basalEnergyCalories: number;
};

export function calculateAdjustedRestCaloriesPerHour(
  days: readonly RestEnergyHistoryDay[],
  adjustmentFactor: number,
) {
  if (!Number.isFinite(adjustmentFactor) || adjustmentFactor < 0 || adjustmentFactor > 1) {
    throw new BankCalculationError('adjustmentFactor must be between 0 and 1.');
  }
  if (days.length === 0) return null;
  const totals = days.reduce((sum, day) => {
    assertNonNegativeInteger(day.basalEnergyCalories, 'basalEnergyCalories');
    const bounds = getLocalDateUtcBounds(day.localDate, day.timezone);
    return {
      calories: sum.calories + day.basalEnergyCalories,
      hours: sum.hours + (bounds.end.getTime() - bounds.start.getTime()) / 3_600_000,
    };
  }, { calories: 0, hours: 0 });
  if (totals.hours <= 0) return null;
  return Math.round((totals.calories / totals.hours) * adjustmentFactor);
}

export function getRemainingLocalDayMinutes(localDate: string, timezone: string, now: Date) {
  const bounds = getLocalDateUtcBounds(localDate, timezone);
  return Math.max(0, Math.round((bounds.end.getTime() - now.getTime()) / 60_000));
}

export function calculateRestOfDayBurnProjection(input: {
  providerBurnSoFarCalories: number;
  providerRestCaloriesPerHour: number;
  remainingMinutes: number;
  adjustmentFactor: number;
}) {
  assertNonNegativeInteger(input.providerBurnSoFarCalories, 'providerBurnSoFarCalories');
  assertPositiveFiniteNumber(input.providerRestCaloriesPerHour, 'providerRestCaloriesPerHour');
  assertNonNegativeInteger(input.remainingMinutes, 'remainingMinutes');
  if (!Number.isFinite(input.adjustmentFactor) || input.adjustmentFactor < 0 || input.adjustmentFactor > 1) {
    throw new BankCalculationError('adjustmentFactor must be between 0 and 1.');
  }
  const provider = input.providerBurnSoFarCalories +
    input.providerRestCaloriesPerHour * (input.remainingMinutes / 60);
  return {
    projectedProviderBurnCalories: roundEstimateToTen(provider),
    projectedAdjustedBurnCalories: roundEstimateToTen(provider * input.adjustmentFactor),
  };
}

export type LowActivityRestObservation = {
  calories: number;
  steps: number;
  overlapsWorkout: boolean;
  observedAt: Date;
};

export function estimateRestingBurnFromLowActivityHours(
  observations: readonly LowActivityRestObservation[],
  maximumStepsPerHour = 100,
) {
  const eligible = observations
    .filter((item) =>
      Number.isFinite(item.calories) && item.calories > 0 &&
      Number.isInteger(item.steps) && item.steps >= 0 && item.steps <= maximumStepsPerHour &&
      !item.overlapsWorkout,
    )
    .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  if (eligible.length === 0) return null;
  const sortedCalories = eligible.map((item) => item.calories).sort((left, right) => left - right);
  const middle = Math.floor(sortedCalories.length / 2);
  const median = sortedCalories.length % 2 === 0
    ? (sortedCalories[middle - 1]! + sortedCalories[middle]!) / 2
    : sortedCalories[middle]!;
  return {
    providerKcalPerHour: median,
    observationCount: eligible.length,
    lookbackStartDate: eligible[0]!.observedAt,
    lookbackEndDate: eligible.at(-1)!.observedAt,
  };
}

export function selectRestingBurnLookback(
  windows: readonly {
    days: number;
    observations: readonly LowActivityRestObservation[];
  }[],
  minimumObservations = 3,
) {
  for (const window of windows) {
    const estimate = estimateRestingBurnFromLowActivityHours(window.observations);
    if (estimate && estimate.observationCount >= minimumObservations) {
      return { ...estimate, lookbackDays: window.days };
    }
  }
  return null;
}

export function estimateRestingBurnFromDailyBasal(
  days: readonly RestEnergyHistoryDay[],
) {
  if (days.length === 0) return null;
  const rates = days.map((day) => {
    assertNonNegativeInteger(day.basalEnergyCalories, 'basalEnergyCalories');
    const bounds = getLocalDateUtcBounds(day.localDate, day.timezone);
    return day.basalEnergyCalories /
      ((bounds.end.getTime() - bounds.start.getTime()) / 3_600_000);
  }).filter((rate) => rate > 0).sort((left, right) => left - right);
  if (rates.length === 0) return null;
  const middle = Math.floor(rates.length / 2);
  return {
    providerKcalPerHour: rates.length % 2 === 0
      ? (rates[middle - 1]! + rates[middle]!) / 2
      : rates[middle]!,
    observationCount: rates.length,
  };
}

export function getProvisionalLockAt(logDate: string, timezone: string) {
  assertNonEmptyString(timezone, 'timezone');
  const { year, month, day } = localDateParts(logDate);
  const lockDate = new Date(Date.UTC(year, month - 1, day + 3));
  return zonedMidnightUtc(
    lockDate.getUTCFullYear(),
    lockDate.getUTCMonth() + 1,
    lockDate.getUTCDate(),
    timezone,
  );
}

export function getBankContributionStatus(
  logDate: string,
  timezone: string,
  now: Date,
): BankContributionStatus {
  const { year, month, day } = localDateParts(logDate);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const opensAt = zonedMidnightUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    timezone,
  );
  if (now.getTime() < opensAt.getTime()) return 'open';
  return now.getTime() >= getProvisionalLockAt(logDate, timezone).getTime()
    ? 'locked'
    : 'provisional';
}

export function calculateAdjustedCurrentDayExpenditure({
  rawImportedExpenditureCalories,
  expenditureAdjustmentRate,
}: CurrentDayAdjustedExpenditureInput) {
  assertNonNegativeInteger(rawImportedExpenditureCalories, 'rawImportedExpenditureCalories');
  assertAdjustmentRate(expenditureAdjustmentRate);

  return roundCalories(rawImportedExpenditureCalories * expenditureAdjustmentRate);
}

export function composeTotalDailyExpenditure(activeEnergyCalories: number, basalEnergyCalories: number) {
  if (!Number.isFinite(activeEnergyCalories) || activeEnergyCalories < 0) {
    throw new BankCalculationError('activeEnergyCalories must be a non-negative finite number.');
  }

  if (!Number.isFinite(basalEnergyCalories) || basalEnergyCalories < 0) {
    throw new BankCalculationError('basalEnergyCalories must be a non-negative finite number.');
  }

  const roundedActiveEnergyCalories = roundCalories(activeEnergyCalories);
  const roundedBasalEnergyCalories = roundCalories(basalEnergyCalories);

  return {
    activeEnergyCalories: roundedActiveEnergyCalories,
    basalEnergyCalories: roundedBasalEnergyCalories,
    rawTotalDailyExpenditure: roundedActiveEnergyCalories + roundedBasalEnergyCalories,
  };
}

export function getCurrentLocalDayWindow(now = new Date()) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = [
    dayStart.getFullYear(),
    String(dayStart.getMonth() + 1).padStart(2, '0'),
    String(dayStart.getDate()).padStart(2, '0'),
  ].join('-');

  return { dayStart, dayEnd, timezone, localDate };
}

export type LocalDayWindow = ReturnType<typeof getCurrentLocalDayWindow>;

export function getRollingLocalDayWindows(
  now = new Date(),
  dayCount = ROLLING_HEALTH_SYNC_CALENDAR_DAYS,
): LocalDayWindow[] {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 31) {
    throw new BankCalculationError('dayCount must be an integer between 1 and 31.');
  }

  return Array.from({ length: dayCount }, (_, offset) => {
    const localDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12);
    return getCurrentLocalDayWindow(localDay);
  });
}

export function normalizeDailyExpenditureAggregate({
  userId,
  localDate,
  timezone,
  provider,
  providerRecordId,
  activeEnergyCalories,
  basalEnergyCalories,
  rawTotalDailyExpenditure,
  adjustmentFactor = V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  importedAt,
  providerUpdatedAt,
  syncStatus,
  isCurrentDay,
  syncSessionId,
}: DailyExpenditureNormalizationInput): NormalizedDailyExpenditureAggregate {
  assertNonEmptyString(userId, 'userId');
  assertDateOnly(localDate, 'localDate');
  assertNonEmptyString(timezone, 'timezone');
  assertNonEmptyString(provider, 'provider');
  assertNonEmptyString(providerRecordId, 'providerRecordId');
  if (activeEnergyCalories !== undefined) {
    assertNonNegativeInteger(activeEnergyCalories, 'activeEnergyCalories');
  }
  if (basalEnergyCalories !== undefined) {
    assertNonNegativeInteger(basalEnergyCalories, 'basalEnergyCalories');
  }
  if (
    activeEnergyCalories !== undefined &&
    basalEnergyCalories !== undefined &&
    activeEnergyCalories + basalEnergyCalories !== rawTotalDailyExpenditure
  ) {
    throw new BankCalculationError(
      'activeEnergyCalories plus basalEnergyCalories must equal rawTotalDailyExpenditure.',
    );
  }
  assertNonNegativeInteger(rawTotalDailyExpenditure, 'rawTotalDailyExpenditure');
  assertAdjustmentRate(adjustmentFactor);

  return {
    userId,
    localDate,
    timezone,
    provider,
    providerRecordId,
    ...(activeEnergyCalories !== undefined ? { activeEnergyCalories } : {}),
    ...(basalEnergyCalories !== undefined ? { basalEnergyCalories } : {}),
    rawTotalDailyExpenditure,
    adjustedDailyExpenditure: calculateAdjustedCurrentDayExpenditure({
      rawImportedExpenditureCalories: rawTotalDailyExpenditure,
      expenditureAdjustmentRate: adjustmentFactor,
    }),
    adjustmentFactor,
    importedAt,
    providerUpdatedAt,
    syncStatus,
    isCurrentDay,
    ...(syncSessionId ? { syncSessionId } : {}),
  };
}

export function normalizeDailyIntakeAggregate({
  userId,
  localDate,
  timezone,
  provider,
  providerRecordId,
  totalCaloriesConsumed,
  writerBundleIdentifier,
  writerDisplayName,
  importedAt,
  providerUpdatedAt,
  syncStatus,
  isCurrentDay,
  syncSessionId,
}: DailyIntakeNormalizationInput): NormalizedDailyIntakeAggregate {
  assertNonEmptyString(userId, 'userId');
  assertDateOnly(localDate, 'localDate');
  assertNonEmptyString(timezone, 'timezone');
  assertNonEmptyString(provider, 'provider');
  assertNonEmptyString(providerRecordId, 'providerRecordId');
  assertNonNegativeInteger(totalCaloriesConsumed, 'totalCaloriesConsumed');
  if (writerBundleIdentifier !== undefined) assertNonEmptyString(writerBundleIdentifier, 'writerBundleIdentifier');
  if (writerDisplayName !== undefined) assertNonEmptyString(writerDisplayName, 'writerDisplayName');

  return {
    userId,
    localDate,
    timezone,
    provider,
    providerRecordId,
    totalCaloriesConsumed,
    ...(writerBundleIdentifier ? { writerBundleIdentifier } : {}),
    ...(writerDisplayName ? { writerDisplayName } : {}),
    importedAt,
    providerUpdatedAt,
    syncStatus,
    isCurrentDay,
    ...(syncSessionId ? { syncSessionId } : {}),
  };
}

export function normalizeDailyStepAggregate(
  aggregate: NormalizedDailyStepAggregate,
): NormalizedDailyStepAggregate {
  assertNonEmptyString(aggregate.userId, 'userId');
  assertDateOnly(aggregate.localDate, 'localDate');
  assertNonEmptyString(aggregate.timezone, 'timezone');
  assertNonEmptyString(aggregate.provider, 'provider');
  assertNonEmptyString(aggregate.providerRecordId, 'providerRecordId');
  assertNonNegativeInteger(aggregate.totalSteps, 'totalSteps');

  return aggregate;
}

export function normalizeWorkoutActivityType(value: string): NormalizedWorkoutActivityType {
  return (WORKOUT_ACTIVITY_TYPES as readonly string[]).includes(value)
    ? (value as NormalizedWorkoutActivityType)
    : 'other';
}

export function normalizeCurrentDayWorkout(
  workout: NormalizedCurrentDayWorkout,
): NormalizedCurrentDayWorkout {
  assertNonEmptyString(workout.userId, 'userId');
  assertDateOnly(workout.localDate, 'localDate');
  assertNonEmptyString(workout.timezone, 'timezone');
  assertNonEmptyString(workout.provider, 'provider');
  assertNonEmptyString(workout.providerWorkoutId, 'providerWorkoutId');
  assertNonEmptyString(workout.displayName, 'displayName');
  assertPositiveFiniteNumber(workout.durationMinutes, 'durationMinutes');

  if (workout.endedAt <= workout.startedAt) {
    throw new BankCalculationError('Workout end time must be after its start time.');
  }
  if (workout.totalEnergyBurned !== null) {
    assertNonNegativeInteger(workout.totalEnergyBurned, 'totalEnergyBurned');
  }
  if (workout.totalSteps !== null && workout.totalSteps !== undefined) {
    assertNonNegativeInteger(workout.totalSteps, 'totalSteps');
  }
  if (workout.totalDistance !== null && (!Number.isFinite(workout.totalDistance) || workout.totalDistance < 0)) {
    throw new BankCalculationError('totalDistance must be a non-negative finite number.');
  }

  return {
    ...workout,
    totalSteps: workout.totalSteps ?? null,
    activityType: normalizeWorkoutActivityType(workout.activityType),
    durationMinutes: Math.round(workout.durationMinutes),
  };
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
