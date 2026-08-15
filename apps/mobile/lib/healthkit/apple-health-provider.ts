import {
  composeTotalDailyExpenditure,
  getCurrentLocalDayWindow,
  normalizeDailyExpenditureAggregate,
  normalizeDailyIntakeAggregate,
  normalizeDailyStepAggregate,
  normalizeCurrentDayWorkout,
  roundCalories,
  type ExpenditureProvider,
  type FetchDailyAggregateInput,
  type IntakeProvider,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyIntakeAggregate,
  type NormalizedDailyStepAggregate,
  type NormalizedCurrentDayWorkout,
  type StepProvider,
  type WorkoutProvider,
} from '@caloriebank/domain';
import type {
  queryStatisticsForQuantity,
  queryWorkoutSamples,
} from '@kingstinct/react-native-healthkit';

export const APPLE_HEALTH_PROVIDER_ID = 'apple_health';
export const APPLE_HEALTH_PROVIDER_LABEL = 'Apple Health';

export const APPLE_HEALTH_QUANTITY_READ_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierStepCount',
] as const;

export const APPLE_HEALTH_READ_TYPES = [
  ...APPLE_HEALTH_QUANTITY_READ_TYPES,
  'HKWorkoutTypeIdentifier',
] as const;

export type HealthKitNativeClient = {
  queryStatisticsForQuantity: typeof queryStatisticsForQuantity;
  queryWorkoutSamples: typeof queryWorkoutSamples;
};

type AppleHealthProviderDependencies = {
  healthKit: HealthKitNativeClient;
  dayStart: Date;
  dayEnd: Date;
  now?: () => Date;
  onDiagnostic?: (diagnostic: AppleHealthNativeQueryDiagnostic) => void;
};

export type AppleHealthNativeQueryDiagnostic = {
  category: 'active_energy' | 'resting_energy' | 'dietary_energy' | 'steps' | 'workouts';
  queryStart: Date;
  queryEnd: Date;
  status: 'success' | 'empty' | 'error';
  sampleCount: number | null;
  normalizedAggregate: number | null;
  error: unknown | null;
};

function reportQuery(
  dependencies: AppleHealthProviderDependencies,
  diagnostic: Omit<AppleHealthNativeQueryDiagnostic, 'queryStart' | 'queryEnd'>,
) {
  dependencies.onDiagnostic?.({
    ...diagnostic,
    queryStart: dependencies.dayStart,
    queryEnd: dependencies.dayEnd,
  });
}

async function cumulativeKilocalories(
  dependencies: AppleHealthProviderDependencies,
  identifier: (typeof APPLE_HEALTH_QUANTITY_READ_TYPES)[number],
  category: AppleHealthNativeQueryDiagnostic['category'],
) {
  try {
    const statistics = await dependencies.healthKit.queryStatisticsForQuantity(
      identifier,
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: dependencies.dayStart,
            endDate: dependencies.dayEnd,
            strictStartDate: true,
            strictEndDate: true,
          },
        },
        unit: 'kcal',
      },
    );
    const value = statistics.sumQuantity?.quantity;
    reportQuery(dependencies, {
      category,
      status: value === undefined ? 'empty' : 'success',
      sampleCount: null,
      normalizedAggregate: value === undefined ? null : roundCalories(value),
      error: null,
    });
    return value;
  } catch (error) {
    reportQuery(dependencies, {
      category,
      status: 'error',
      sampleCount: null,
      normalizedAggregate: null,
      error,
    });
    throw error;
  }
}

const workoutTypeMap: Readonly<
  Record<number, { activityType: NormalizedCurrentDayWorkout['activityType']; displayName: string }>
> = {
  13: { activityType: 'cycling', displayName: 'Cycling' },
  14: { activityType: 'dance', displayName: 'Dance' },
  15: { activityType: 'dance', displayName: 'Dance training' },
  16: { activityType: 'elliptical', displayName: 'Elliptical' },
  20: { activityType: 'strength', displayName: 'Strength training' },
  24: { activityType: 'walking', displayName: 'Hiking' },
  35: { activityType: 'rowing', displayName: 'Rowing' },
  37: { activityType: 'running', displayName: 'Running' },
  44: { activityType: 'stair', displayName: 'Stair climbing' },
  46: { activityType: 'swimming', displayName: 'Swimming' },
  50: { activityType: 'strength', displayName: 'Strength training' },
  52: { activityType: 'walking', displayName: 'Walking' },
  57: { activityType: 'yoga', displayName: 'Yoga' },
  63: { activityType: 'hiit', displayName: 'High intensity interval training' },
  68: { activityType: 'stair', displayName: 'Stairs' },
  73: { activityType: 'hiit', displayName: 'Cardio' },
  77: { activityType: 'dance', displayName: 'Cardio dance' },
  78: { activityType: 'dance', displayName: 'Social dance' },
};

export function normalizeAppleWorkoutActivityType(workoutActivityType: number) {
  return workoutTypeMap[workoutActivityType] ?? {
    activityType: 'other' as const,
    displayName: 'Workout',
  };
}

export class AppleHealthExpenditureProvider implements ExpenditureProvider {
  constructor(private readonly dependencies: AppleHealthProviderDependencies) {}

  async fetchDailyExpenditureAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyExpenditureAggregate | null> {
    const [activeResult, basalResult] = await Promise.allSettled([
      cumulativeKilocalories(
        this.dependencies,
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'active_energy',
      ),
      cumulativeKilocalories(
        this.dependencies,
        'HKQuantityTypeIdentifierBasalEnergyBurned',
        'resting_energy',
      ),
    ]);

    if (activeResult.status === 'rejected' || basalResult.status === 'rejected') {
      throw new Error('One or more Apple Health expenditure queries failed.');
    }
    const activeEnergy = activeResult.value;
    const basalEnergy = basalResult.value;

    // CalorieBank's fallback expenditure is a total, so neither component is optional.
    // An incomplete HealthKit result remains unavailable instead of becoming active-only burn.
    if (activeEnergy === undefined || basalEnergy === undefined) return null;

    const composed = composeTotalDailyExpenditure(activeEnergy, basalEnergy);
    const importedAt = this.dependencies.now?.() ?? new Date();

    return normalizeDailyExpenditureAggregate({
      ...input,
      provider: APPLE_HEALTH_PROVIDER_ID,
      providerRecordId: `${APPLE_HEALTH_PROVIDER_ID}:expenditure:${input.localDate}`,
      ...composed,
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
    });
  }
}

export class AppleHealthIntakeProvider implements IntakeProvider {
  constructor(private readonly dependencies: AppleHealthProviderDependencies) {}

  async fetchDailyCalorieIntakeAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyIntakeAggregate | null> {
    const dietaryEnergy = await cumulativeKilocalories(
      this.dependencies,
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      'dietary_energy',
    );

    if (dietaryEnergy === undefined) return null;

    const importedAt = this.dependencies.now?.() ?? new Date();
    return normalizeDailyIntakeAggregate({
      ...input,
      provider: APPLE_HEALTH_PROVIDER_ID,
      providerRecordId: `${APPLE_HEALTH_PROVIDER_ID}:intake:${input.localDate}`,
      totalCaloriesConsumed: roundCalories(dietaryEnergy),
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
    });
  }
}

export class AppleHealthStepProvider implements StepProvider {
  constructor(private readonly dependencies: AppleHealthProviderDependencies) {}

  async fetchDailyStepAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyStepAggregate | null> {
    let statistics;
    try {
      statistics = await this.dependencies.healthKit.queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        {
          filter: {
            date: {
              startDate: this.dependencies.dayStart,
              endDate: this.dependencies.dayEnd,
              strictStartDate: true,
              strictEndDate: true,
            },
          },
          unit: 'count',
        },
      );
    } catch (error) {
      reportQuery(this.dependencies, {
        category: 'steps', status: 'error', sampleCount: null, normalizedAggregate: null, error,
      });
      throw error;
    }
    const stepCount = statistics.sumQuantity?.quantity;
    reportQuery(this.dependencies, {
      category: 'steps',
      status: stepCount === undefined ? 'empty' : 'success',
      sampleCount: null,
      normalizedAggregate: stepCount === undefined ? null : roundCalories(stepCount),
      error: null,
    });
    if (stepCount === undefined) return null;

    const importedAt = this.dependencies.now?.() ?? new Date();
    return normalizeDailyStepAggregate({
      ...input,
      provider: APPLE_HEALTH_PROVIDER_ID,
      providerRecordId: `${APPLE_HEALTH_PROVIDER_ID}:steps:${input.localDate}`,
      totalSteps: roundCalories(stepCount),
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
    });
  }
}

export class AppleHealthWorkoutProvider implements WorkoutProvider {
  constructor(private readonly dependencies: AppleHealthProviderDependencies) {}

  async fetchDailyWorkouts(
    input: FetchDailyAggregateInput,
  ): Promise<readonly NormalizedCurrentDayWorkout[]> {
    let workouts;
    try {
      workouts = await this.dependencies.healthKit.queryWorkoutSamples({
        filter: {
          date: {
            startDate: this.dependencies.dayStart,
            endDate: this.dependencies.dayEnd,
            strictStartDate: true,
            strictEndDate: true,
          },
        },
        limit: 100,
        ascending: false,
      });
    } catch (error) {
      reportQuery(this.dependencies, {
        category: 'workouts', status: 'error', sampleCount: null, normalizedAggregate: null, error,
      });
      throw error;
    }
    reportQuery(this.dependencies, {
      category: 'workouts',
      status: workouts.length === 0 ? 'empty' : 'success',
      sampleCount: workouts.length,
      normalizedAggregate: null,
      error: null,
    });
    const importedAt = this.dependencies.now?.() ?? new Date();

    return workouts.map((workout) => {
      const normalizedType = normalizeAppleWorkoutActivityType(workout.workoutActivityType);
      const elapsedMinutes = Math.max(
        1,
        Math.round((workout.endDate.getTime() - workout.startDate.getTime()) / 60_000),
      );
      const durationMinutes =
        workout.duration.unit === 's'
          ? Math.max(1, Math.round(workout.duration.quantity / 60))
          : elapsedMinutes;

      return normalizeCurrentDayWorkout({
        ...input,
        provider: APPLE_HEALTH_PROVIDER_ID,
        providerWorkoutId: workout.uuid,
        ...normalizedType,
        startedAt: workout.startDate,
        endedAt: workout.endDate,
        durationMinutes,
        totalEnergyBurned:
          workout.totalEnergyBurned?.quantity === undefined
            ? null
            : roundCalories(workout.totalEnergyBurned.quantity),
        totalDistance: workout.totalDistance?.quantity ?? null,
        distanceUnit: workout.totalDistance?.unit ?? null,
        importedAt,
        providerUpdatedAt: importedAt,
        syncStatus: 'ready',
      });
    });
  }
}

export { getCurrentLocalDayWindow };
