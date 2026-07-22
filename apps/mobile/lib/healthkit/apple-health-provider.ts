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
};

async function cumulativeKilocalories(
  healthKit: HealthKitNativeClient,
  identifier: (typeof APPLE_HEALTH_QUANTITY_READ_TYPES)[number],
  dayStart: Date,
  dayEnd: Date,
) {
  const statistics = await healthKit.queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
    filter: {
      date: {
        startDate: dayStart,
        endDate: dayEnd,
        strictStartDate: true,
        strictEndDate: true,
      },
    },
    unit: 'kcal',
  });

  return statistics.sumQuantity?.quantity;
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
    const [activeEnergy, basalEnergy] = await Promise.all([
      cumulativeKilocalories(
        this.dependencies.healthKit,
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        this.dependencies.dayStart,
        this.dependencies.dayEnd,
      ),
      cumulativeKilocalories(
        this.dependencies.healthKit,
        'HKQuantityTypeIdentifierBasalEnergyBurned',
        this.dependencies.dayStart,
        this.dependencies.dayEnd,
      ),
    ]);

    if (activeEnergy === undefined && basalEnergy === undefined) return null;

    const composed = composeTotalDailyExpenditure(activeEnergy ?? 0, basalEnergy ?? 0);
    const importedAt = this.dependencies.now?.() ?? new Date();

    return normalizeDailyExpenditureAggregate({
      ...input,
      provider: APPLE_HEALTH_PROVIDER_ID,
      providerRecordId: `${APPLE_HEALTH_PROVIDER_ID}:expenditure:${input.localDate}`,
      ...composed,
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: activeEnergy !== undefined && basalEnergy !== undefined ? 'ready' : 'partial',
    });
  }
}

export class AppleHealthIntakeProvider implements IntakeProvider {
  constructor(private readonly dependencies: AppleHealthProviderDependencies) {}

  async fetchDailyCalorieIntakeAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyIntakeAggregate | null> {
    const dietaryEnergy = await cumulativeKilocalories(
      this.dependencies.healthKit,
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      this.dependencies.dayStart,
      this.dependencies.dayEnd,
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
    const statistics = await this.dependencies.healthKit.queryStatisticsForQuantity(
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
    if (statistics.sumQuantity?.quantity === undefined) return null;

    const importedAt = this.dependencies.now?.() ?? new Date();
    return normalizeDailyStepAggregate({
      ...input,
      provider: APPLE_HEALTH_PROVIDER_ID,
      providerRecordId: `${APPLE_HEALTH_PROVIDER_ID}:steps:${input.localDate}`,
      totalSteps: roundCalories(statistics.sumQuantity.quantity),
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
    const workouts = await this.dependencies.healthKit.queryWorkoutSamples({
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
