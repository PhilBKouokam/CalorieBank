import { z } from 'zod';

export const goalModeSchema = z.enum(['cut', 'maintain', 'bulk']);
export const adjustmentSourceSchema = z.enum(['manual_calories', 'estimated_weight_rate']);
export const bankHistoryRangeSchema = z.enum(['D', 'W', 'M', '3M', 'Y', 'ALL']);
export const plannedTreatStatusSchema = z.enum(['no_plan', 'saving', 'ready']);
export const activityEstimationMethodSchema = z.enum(['population_model', 'wearable_history']);
export const activityOpportunityDeliveryEligibilitySchema = z.enum(['eligible', 'blocked']);
export const activityOpportunityNotificationCategorySchema = z.enum(['personalized_activity_opportunity']);
export const todaySoFarDataFreshnessStatusSchema = z.enum([
  'unavailable',
  'not_connected',
  'syncing',
  'partial',
  'stale',
  'ready',
  'error',
]);

export const MIN_DAILY_ENERGY_ADJUSTMENT = -2_000;
export const MAX_DAILY_ENERGY_ADJUSTMENT = 2_000;
export const MIN_PLANNED_TREAT_REQUIRED_CALORIES = 1;
export const MAX_PLANNED_TREAT_REQUIRED_CALORIES = 20_000;
export const MAX_PLANNED_TREAT_NAME_LENGTH = 80;

export const estimatedWeightRateOptions = {
  cut: [
    { desiredWeeklyWeightChange: 0.5, dailyEnergyAdjustment: -250 },
    { desiredWeeklyWeightChange: 1.0, dailyEnergyAdjustment: -500 },
    { desiredWeeklyWeightChange: 1.5, dailyEnergyAdjustment: -750 },
    { desiredWeeklyWeightChange: 2.0, dailyEnergyAdjustment: -1000 },
  ],
  bulk: [
    { desiredWeeklyWeightChange: 0.5, dailyEnergyAdjustment: 250 },
    { desiredWeeklyWeightChange: 1.0, dailyEnergyAdjustment: 500 },
  ],
  maintain: [],
} as const;

function matchesEstimatedWeightRate(goalMode: GoalMode, dailyEnergyAdjustment: number, desiredWeeklyWeightChange: number) {
  return estimatedWeightRateOptions[goalMode].some(
    (option) =>
      option.dailyEnergyAdjustment === dailyEnergyAdjustment &&
      option.desiredWeeklyWeightChange === desiredWeeklyWeightChange,
  );
}

const goalConfigurationShape = {
  goalMode: goalModeSchema,
  dailyEnergyAdjustment: z
    .number()
    .int()
    .min(MIN_DAILY_ENERGY_ADJUSTMENT)
    .max(MAX_DAILY_ENERGY_ADJUSTMENT),
  adjustmentSource: adjustmentSourceSchema,
} as const;

function validateGoalConfiguration(
  input: {
    goalMode: GoalMode;
    dailyEnergyAdjustment: number;
    adjustmentSource: AdjustmentSource;
    desiredWeeklyWeightChange?: number | null | undefined;
  },
  context: z.RefinementCtx,
) {
  if (input.goalMode === 'cut' && input.dailyEnergyAdjustment >= 0) {
    context.addIssue({
      code: 'custom',
      path: ['dailyEnergyAdjustment'],
      message: 'Cut requires a negative daily energy adjustment.',
    });
  }

  if (input.goalMode === 'maintain' && input.dailyEnergyAdjustment !== 0) {
    context.addIssue({
      code: 'custom',
      path: ['dailyEnergyAdjustment'],
      message: 'Maintain requires a zero daily energy adjustment.',
    });
  }

  if (input.goalMode === 'bulk' && input.dailyEnergyAdjustment <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['dailyEnergyAdjustment'],
      message: 'Bulk requires a positive daily energy adjustment.',
    });
  }

  if (input.adjustmentSource === 'estimated_weight_rate') {
    if (input.desiredWeeklyWeightChange === undefined || input.desiredWeeklyWeightChange === null) {
      context.addIssue({
        code: 'custom',
        path: ['desiredWeeklyWeightChange'],
        message: 'Estimated weight-rate adjustments require a weekly weight-change value.',
      });
      return;
    }

    if (!matchesEstimatedWeightRate(input.goalMode, input.dailyEnergyAdjustment, input.desiredWeeklyWeightChange)) {
      context.addIssue({
        code: 'custom',
        path: ['desiredWeeklyWeightChange'],
        message: 'Estimated weight-rate adjustment must match an approved V1 option.',
      });
    }
  }

  if (input.goalMode === 'maintain' && input.adjustmentSource === 'estimated_weight_rate') {
    context.addIssue({
      code: 'custom',
      path: ['adjustmentSource'],
      message: 'Maintain does not support estimated weight-rate adjustment.',
    });
  }
}

export const goalConfigurationInputSchema = z
  .object({
    ...goalConfigurationShape,
    desiredWeeklyWeightChange: z.number().positive().max(2).optional(),
  })
  .superRefine(validateGoalConfiguration);

export const goalConfigurationResponseSchema = z
  .object({
    ...goalConfigurationShape,
    desiredWeeklyWeightChange: z.number().positive().max(2).nullable(),
    userId: z.string().uuid(),
    updatedAt: z.string().datetime(),
  })
  .superRefine(validateGoalConfiguration);

export type GoalMode = z.infer<typeof goalModeSchema>;
export type AdjustmentSource = z.infer<typeof adjustmentSourceSchema>;
export type GoalConfigurationInput = z.infer<typeof goalConfigurationInputSchema>;
export type GoalConfigurationResponse = z.infer<typeof goalConfigurationResponseSchema>;
export type BankHistoryRange = z.infer<typeof bankHistoryRangeSchema>;
export type PlannedTreatStatus = z.infer<typeof plannedTreatStatusSchema>;

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const plannedTreatInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PLANNED_TREAT_NAME_LENGTH),
  requiredCalories: z
    .number()
    .int()
    .min(MIN_PLANNED_TREAT_REQUIRED_CALORIES)
    .max(MAX_PLANNED_TREAT_REQUIRED_CALORIES),
  targetDate: dateStringSchema.nullable().optional(),
});

export const todaySoFarAwarenessSchema = z.object({
  localDate: dateStringSchema,
  timezone: z.string().min(1),
  adjustedExpenditureCalories: z.number().int().nonnegative().nullable(),
  rawImportedExpenditureCalories: z.number().int().nonnegative().nullable(),
  expenditureAdjustmentRate: z.number().min(0).max(1),
  expenditureSource: z.string().min(1).nullable(),
  expenditureLastSyncedAt: z.string().datetime().nullable(),
  importedCalorieIntake: z.number().int().nonnegative().nullable(),
  intakeSource: z.string().min(1).nullable(),
  intakeLastSyncedAt: z.string().datetime().nullable(),
  dataFreshnessStatus: todaySoFarDataFreshnessStatusSchema,
  isCurrentDay: z.literal(true),
  isPartial: z.literal(true),
});

export const todayDashboardVisibilityPreferencesSchema = z.object({
  availableBank: z.literal(true).default(true),
  plannedTreat: z.boolean().default(true),
  todaySoFar: z.boolean().default(false),
  yesterday: z.boolean().default(true),
  currentGoal: z.boolean().default(true),
  emergencyBank: z.boolean().default(false),
  connectionStatus: z.boolean().default(false),
});

export const activityOpportunityCandidateSchema = z.object({
  opportunityId: z.string().uuid(),
  userId: z.string().uuid(),
  plannedTreatId: z.string().uuid(),
  activityCode: z.string().min(1),
  activityDisplayName: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  estimatedLowCalories: z.number().int().nonnegative(),
  estimatedHighCalories: z.number().int().nonnegative(),
  estimationMethod: activityEstimationMethodSchema,
  estimationModelVersion: z.string().min(1),
  remainingTreatCalories: z.number().int().nonnegative(),
  plannedTreatDate: dateStringSchema.nullable(),
  hoursUntilPlannedTreat: z.number().nonnegative().nullable(),
  opportunityReasonCodes: z.array(z.string().min(1)),
  opportunityScore: z.number().min(0).max(1).nullable(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  notificationCategory: activityOpportunityNotificationCategorySchema,
  suggestedTitle: z.string().min(1),
  suggestedBody: z.string().min(1),
  deliveryEligibility: activityOpportunityDeliveryEligibilitySchema,
  blockedReason: z.string().min(1).nullable(),
  deduplicationKey: z.string().min(1),
}).superRefine((input, context) => {
  if (input.estimatedLowCalories > input.estimatedHighCalories) {
    context.addIssue({
      code: 'custom',
      path: ['estimatedLowCalories'],
      message: 'Estimated low calories cannot exceed estimated high calories.',
    });
  }
});

export const bankSummaryResponseSchema = z.object({
  availableBankCalories: z.number().int(),
  latestFinalizedDate: dateStringSchema.nullable(),
  latestDailyBankChange: z.number().int().nullable(),
  finalizedDayCount: z.number().int().nonnegative(),
});

export const bankHistoryDaySummarySchema = z.object({
  logDate: dateStringSchema,
  dailyBankChange: z.number().int(),
  goalMode: goalModeSchema,
  finalizedAt: z.string().datetime(),
});

export const bankHistoryResponseSchema = z.object({
  range: bankHistoryRangeSchema,
  startDate: dateStringSchema.nullable(),
  endDate: dateStringSchema.nullable(),
  availableBankCalories: z.number().int(),
  rangeNetChangeCalories: z.number().int(),
  finalizedDays: z.array(bankHistoryDaySummarySchema),
});

export const bankHistoryDayDetailResponseSchema = z.object({
  logDate: dateStringSchema,
  timezone: z.string().min(1),
  importedTotalDailyExpenditure: z.number().int().nonnegative(),
  expenditureAdjustmentRate: z.number().min(0).max(1),
  adjustedExpenditure: z.number().int().nonnegative(),
  goalMode: goalModeSchema,
  goalAdjustmentCalories: z.number().int().nonnegative(),
  importedCalorieIntake: z.number().int().nonnegative(),
  dailyAllowance: z.number().int(),
  dailyBankChange: z.number().int(),
  finalizedAt: z.string().datetime(),
});

export const activePlannedTreatResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(MAX_PLANNED_TREAT_NAME_LENGTH),
  requiredCalories: z.number().int().min(MIN_PLANNED_TREAT_REQUIRED_CALORIES),
  targetDate: dateStringSchema.nullable(),
  availableBankCalories: z.number().int(),
  progressCalories: z.number().int().nonnegative(),
  remainingCalories: z.number().int().nonnegative(),
  progressRatio: z.number().min(0).max(1),
  progressPercent: z.number().int().min(0).max(100),
  status: z.enum(['saving', 'ready']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const noActivePlannedTreatResponseSchema = z.object({
  status: z.literal('no_plan'),
  plannedTreat: z.null(),
  availableBankCalories: z.number().int(),
});

export const plannedTreatGetResponseSchema = z.union([
  activePlannedTreatResponseSchema,
  noActivePlannedTreatResponseSchema,
]);

export type BankSummaryResponse = z.infer<typeof bankSummaryResponseSchema>;
export type BankHistoryDaySummary = z.infer<typeof bankHistoryDaySummarySchema>;
export type BankHistoryResponse = z.infer<typeof bankHistoryResponseSchema>;
export type BankHistoryDayDetailResponse = z.infer<typeof bankHistoryDayDetailResponseSchema>;
export type PlannedTreatInput = z.infer<typeof plannedTreatInputSchema>;
export type ActivePlannedTreatResponse = z.infer<typeof activePlannedTreatResponseSchema>;
export type NoActivePlannedTreatResponse = z.infer<typeof noActivePlannedTreatResponseSchema>;
export type PlannedTreatGetResponse = z.infer<typeof plannedTreatGetResponseSchema>;
export type TodaySoFarDataFreshnessStatus = z.infer<typeof todaySoFarDataFreshnessStatusSchema>;
export type TodaySoFarAwareness = z.infer<typeof todaySoFarAwarenessSchema>;
export type TodayDashboardVisibilityPreferences = z.infer<
  typeof todayDashboardVisibilityPreferencesSchema
>;
export type ActivityEstimationMethod = z.infer<typeof activityEstimationMethodSchema>;
export type ActivityOpportunityCandidate = z.infer<typeof activityOpportunityCandidateSchema>;

export function getGoalModeLabel(goalMode: GoalMode) {
  return `${goalMode.charAt(0).toUpperCase()}${goalMode.slice(1)}`;
}

export function getAdjustmentSummaryLabel(goalMode: GoalMode) {
  if (goalMode === 'cut') return 'Daily Deficit';
  if (goalMode === 'bulk') return 'Daily Surplus';
  return 'Maintenance';
}

export function getAdjustmentSourceLabel(adjustmentSource: AdjustmentSource) {
  return adjustmentSource === 'manual_calories' ? 'Manual calories' : 'Estimated weight rate';
}

export function formatGoalAdjustmentMagnitude(configuration: Pick<GoalConfigurationResponse, 'dailyEnergyAdjustment'>) {
  return `${Math.abs(configuration.dailyEnergyAdjustment).toLocaleString()} kcal`;
}

export function formatWeeklyWeightChange(value: number | null | undefined) {
  return value ? `${value.toFixed(1)} lb/week` : 'Not set';
}
