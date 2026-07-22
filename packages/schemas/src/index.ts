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
export const workoutActivityTypeSchema = z.enum([
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
]);
export const ingestionSyncTriggerSchema = z.enum([
  'connection',
  'provider_reconnect',
  'app_launch',
  'screen_focus',
  'app_foreground',
  'manual_refresh',
  'scheduled',
  'integration_test',
]);
export const ingestionCategoryStatusSchema = z.enum([
  'not_attempted',
  'ready',
  'unavailable',
  'error',
  'skipped',
]);
export const bankDayProcessingStatusSchema = z.enum([
  'waiting_for_intake',
  'waiting_for_expenditure',
  'waiting_for_provider',
  'waiting_for_sync',
  'waiting_for_required_inputs',
  'provisional',
  'locked',
]);

export const MIN_DAILY_ENERGY_ADJUSTMENT = -2_000;
export const MAX_DAILY_ENERGY_ADJUSTMENT = 2_000;
export const MIN_PLANNED_TREAT_REQUIRED_CALORIES = 1;
export const MAX_PLANNED_TREAT_REQUIRED_CALORIES = 20_000;
export const MAX_PLANNED_TREAT_NAME_LENGTH = 80;
export const TODAY_CARD_ORDER = [
  'availableBank',
  'latestFinalizedContribution',
  'todaySoFar',
  'plannedTreat',
  'steps',
  'workouts',
  'currentGoal',
] as const;

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

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const ingestionProviderSchema = z.enum(['apple_health']);

const ingestionBaseShape = {
  localDate: dateStringSchema,
  timezone: z.string().min(1).max(100).refine(isIanaTimezone, 'Timezone must be a valid IANA name.'),
  provider: ingestionProviderSchema,
  providerUpdatedAt: z.string().datetime(),
  syncSessionId: z.string().uuid().optional(),
} as const;

export const currentDayExpenditureSyncSchema = z
  .object({
    ...ingestionBaseShape,
    rawTotalDailyExpenditure: z.number().int().min(0).max(100_000),
    syncStatus: z.enum(['partial', 'ready']).default('ready'),
    sourceMetadata: z
      .object({
        activeEnergyCalories: z.number().int().min(0).max(100_000),
        basalEnergyCalories: z.number().int().min(0).max(100_000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.sourceMetadata &&
      input.sourceMetadata.activeEnergyCalories + input.sourceMetadata.basalEnergyCalories !==
        input.rawTotalDailyExpenditure
    ) {
      context.addIssue({
        code: 'custom',
        path: ['sourceMetadata'],
        message: 'Active plus basal energy must equal raw total daily expenditure.',
      });
    }
  });

export const currentDayIntakeSyncSchema = z
  .object({
    ...ingestionBaseShape,
    totalCaloriesConsumed: z.number().int().min(0).max(100_000),
  })
  .strict();

export const currentDayStepSyncSchema = z
  .object({
    ...ingestionBaseShape,
    totalSteps: z.number().int().min(0).max(1_000_000),
  })
  .strict();

export const currentDayWorkoutSchema = z
  .object({
    providerWorkoutId: z.string().trim().min(1).max(200),
    activityType: workoutActivityTypeSchema,
    displayName: z.string().trim().min(1).max(100),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationMinutes: z.number().int().positive().max(1_440),
    totalEnergyBurned: z.number().int().min(0).max(100_000).nullable(),
    totalDistance: z.number().nonnegative().max(1_000_000).nullable(),
    distanceUnit: z.string().trim().min(1).max(20).nullable(),
  })
  .strict()
  .superRefine((workout, context) => {
    const startedAt = new Date(workout.startedAt);
    const endedAt = new Date(workout.endedAt);
    if (endedAt <= startedAt) {
      context.addIssue({
        code: 'custom',
        path: ['endedAt'],
        message: 'Workout end time must be after its start time.',
      });
    }
    if (endedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['endedAt'],
        message: 'Workout end time cannot be in the future.',
      });
    }
  });

export const currentDayWorkoutSyncSchema = z
  .object({
    ...ingestionBaseShape,
    workouts: z.array(currentDayWorkoutSchema).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    const seen = new Set<string>();
    input.workouts.forEach((workout, index) => {
      if (seen.has(workout.providerWorkoutId)) {
        context.addIssue({
          code: 'custom',
          path: ['workouts', index, 'providerWorkoutId'],
          message: 'Workout identifiers must be unique within a sync.',
        });
      }
      seen.add(workout.providerWorkoutId);
    });
  });

export const ingestionSyncSessionStartSchema = z
  .object({
    localDate: dateStringSchema,
    timezone: z.string().min(1).max(100).refine(isIanaTimezone, 'Timezone must be a valid IANA name.'),
    provider: ingestionProviderSchema,
    trigger: ingestionSyncTriggerSchema,
    appVersion: z.string().trim().min(1).max(40).optional(),
    providerAdapterVersion: z.string().trim().min(1).max(40).optional(),
    datesQueried: z.array(dateStringSchema).max(3).default([]),
  })
  .strict();

export const ingestionSyncSessionCompleteSchema = z
  .object({
    expenditureStatus: ingestionCategoryStatusSchema,
    intakeStatus: ingestionCategoryStatusSchema,
    stepsStatus: ingestionCategoryStatusSchema,
    workoutsStatus: ingestionCategoryStatusSchema,
    recordsImported: z.number().int().nonnegative().max(1_000),
    recordsUpdated: z.number().int().nonnegative().max(1_000),
    recordsSkipped: z.number().int().nonnegative().max(1_000),
    warningCount: z.number().int().nonnegative().max(1_000),
    errorCode: z.string().trim().min(1).max(80).nullable().optional(),
    datesUploaded: z.array(dateStringSchema).max(3).default([]),
    datesSkipped: z.array(dateStringSchema).max(3).default([]),
    errors: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  })
  .strict();

export const ingestionSyncSessionResponseSchema = z.object({
  id: z.string().uuid(),
  timezone: z.string().min(1),
  trigger: ingestionSyncTriggerSchema,
  status: z.enum(['started', 'partially_completed', 'completed', 'failed']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  datesQueried: z.array(dateStringSchema),
  datesUploaded: z.array(dateStringSchema),
  datesSkipped: z.array(dateStringSchema),
  datesReconciled: z.array(dateStringSchema),
  datesLocked: z.array(dateStringSchema),
  waitingDates: z.array(
    z.object({ date: dateStringSchema, status: bankDayProcessingStatusSchema }),
  ),
  durationMs: z.number().int().nonnegative().nullable(),
});

export const ingestionSyncResultSchema = z.object({
  result: z.enum(['created', 'updated', 'unchanged', 'ignored_stale']),
});

export const workoutSyncResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative().default(0),
});

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

const todaySourceStatusSchema = todaySoFarDataFreshnessStatusSchema;

export const todayResponseSchema = z.object({
  date: dateStringSchema,
  timezone: z.string().min(1),
  isCurrentDay: z.literal(true),
  dataFreshness: todaySoFarDataFreshnessStatusSchema,
  burned: z.object({
    adjusted: z.number().int().nonnegative().nullable(),
    raw: z.number().int().nonnegative().nullable(),
    adjustmentFactor: z.number().min(0).max(1),
    source: z.string().min(1).nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    status: todaySourceStatusSchema,
  }),
  eaten: z.object({
    calories: z.number().int().nonnegative().nullable(),
    source: z.string().min(1).nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    status: todaySourceStatusSchema,
  }),
  steps: z.object({
    count: z.number().int().nonnegative().nullable(),
    source: z.string().min(1).nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    status: todaySourceStatusSchema,
  }),
  workouts: z.object({
    items: z.array(
      z.object({
        id: z.string().uuid(),
        activityType: workoutActivityTypeSchema,
        displayName: z.string().min(1),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
        durationMinutes: z.number().int().positive(),
        totalEnergyBurned: z.number().int().nonnegative().nullable(),
        source: z.string().min(1),
      }),
    ),
    totalCount: z.number().int().nonnegative(),
    source: z.string().min(1).nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    status: todaySourceStatusSchema,
  }),
});

export const dashboardPreferencesShape = {
  showLatestFinalizedContribution: z.boolean().default(true),
  showTodaySoFar: z.boolean().default(true),
  showPlannedTreat: z.boolean().default(true),
  showSteps: z.boolean().default(true),
  showWorkouts: z.boolean().default(true),
  showCurrentGoal: z.boolean().default(true),
} as const;

export const dashboardPreferencesResponseSchema = z.object({
  ...dashboardPreferencesShape,
  updatedAt: z.string().datetime(),
});

export const dashboardPreferencesPatchSchema = z.object({
  showLatestFinalizedContribution: z.boolean().optional(),
  showTodaySoFar: z.boolean().optional(),
  showPlannedTreat: z.boolean().optional(),
  showSteps: z.boolean().optional(),
  showWorkouts: z.boolean().optional(),
  showCurrentGoal: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required.');

export const todayDashboardVisibilityPreferencesSchema = z.object({
  availableBank: z.literal(true).default(true),
  ...dashboardPreferencesShape,
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
  latestOriginalDailyBankChange: z.number().int().nullable(),
  latestContributionStatus: z.enum(['provisional', 'locked']).nullable(),
  latestLocksAt: z.string().datetime().nullable(),
  latestCorrectionCount: z.number().int().nonnegative(),
  finalizedDayCount: z.number().int().nonnegative(),
});

export const bankHistoryDaySummarySchema = z.object({
  logDate: dateStringSchema,
  dailyBankChange: z.number().int(),
  originalDailyBankChange: z.number().int(),
  status: z.enum(['provisional', 'locked']),
  locksAt: z.string().datetime(),
  correctionCount: z.number().int().nonnegative(),
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
  originalDailyBankChange: z.number().int(),
  effectiveDailyBankChange: z.number().int(),
  status: z.enum(['provisional', 'locked']),
  locksAt: z.string().datetime(),
  lockedAt: z.string().datetime().nullable(),
  correctionCount: z.number().int().nonnegative(),
  finalizedAt: z.string().datetime(),
  versions: z.array(
    z.object({
      version: z.number().int().positive(),
      reason: z.enum(['initial_posting', 'provider_correction']),
      dailyBankChange: z.number().int(),
      correctionDelta: z.number().int(),
      importedTotalDailyExpenditure: z.number().int().nonnegative(),
      importedCalorieIntake: z.number().int().nonnegative(),
      expenditureProvider: z.string().min(1),
      intakeProvider: z.string().min(1),
      createdAt: z.string().datetime(),
    }),
  ),
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
export type IngestionCategoryStatus = z.infer<typeof ingestionCategoryStatusSchema>;
export type IngestionSyncTrigger = z.infer<typeof ingestionSyncTriggerSchema>;
export type TodaySoFarAwareness = z.infer<typeof todaySoFarAwarenessSchema>;
export type TodayResponse = z.infer<typeof todayResponseSchema>;
export type IngestionProvider = z.infer<typeof ingestionProviderSchema>;
export type CurrentDayExpenditureSync = z.infer<typeof currentDayExpenditureSyncSchema>;
export type CurrentDayIntakeSync = z.infer<typeof currentDayIntakeSyncSchema>;
export type CurrentDayStepSync = z.infer<typeof currentDayStepSyncSchema>;
export type CurrentDayWorkoutSync = z.infer<typeof currentDayWorkoutSyncSchema>;
export type IngestionSyncResult = z.infer<typeof ingestionSyncResultSchema>;
export type WorkoutSyncResult = z.infer<typeof workoutSyncResultSchema>;
export type IngestionSyncSessionStart = z.infer<typeof ingestionSyncSessionStartSchema>;
export type IngestionSyncSessionComplete = z.infer<typeof ingestionSyncSessionCompleteSchema>;
export type IngestionSyncSessionResponse = z.infer<typeof ingestionSyncSessionResponseSchema>;
export type DashboardPreferencesResponse = z.infer<typeof dashboardPreferencesResponseSchema>;
export type DashboardPreferencesPatch = z.infer<typeof dashboardPreferencesPatchSchema>;
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
