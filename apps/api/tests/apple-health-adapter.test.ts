import type { FetchDailyAggregateInput } from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

import {
  AppleHealthExpenditureProvider,
  AppleHealthIntakeProvider,
  AppleHealthStepProvider,
  AppleHealthWorkoutProvider,
  type HealthKitNativeClient,
} from '../../mobile/lib/healthkit/apple-health-provider';

const input: FetchDailyAggregateInput = {
  userId: 'device-user',
  localDate: '2026-07-21',
  timezone: 'America/Chicago',
  isCurrentDay: true,
};
const dayStart = new Date('2026-07-21T05:00:00.000Z');
const dayEnd = new Date('2026-07-22T05:00:00.000Z');
const now = () => new Date('2026-07-21T14:00:00.000Z');

function healthKitClient(
  values: Readonly<Record<string, number | undefined>>,
  workouts: readonly object[] = [],
): HealthKitNativeClient {
  const query: HealthKitNativeClient['queryStatisticsForQuantity'] = async (identifier) => {
    const quantity = values[identifier];
    return quantity === undefined
      ? { sources: [] }
      : { sources: [], sumQuantity: { quantity, unit: 'kcal' } };
  };

  const queryWorkouts: HealthKitNativeClient['queryWorkoutSamples'] = async () =>
    workouts as Awaited<ReturnType<HealthKitNativeClient['queryWorkoutSamples']>>;

  return { queryStatisticsForQuantity: query, queryWorkoutSamples: queryWorkouts };
}

describe('Apple Health provider adapters', () => {
  it('normalizes active plus basal energy and applies the adjustment once', async () => {
    const provider = new AppleHealthExpenditureProvider({
      healthKit: healthKitClient({
        HKQuantityTypeIdentifierActiveEnergyBurned: 600,
        HKQuantityTypeIdentifierBasalEnergyBurned: 1400,
      }),
      dayStart,
      dayEnd,
      now,
    });

    const aggregate = await provider.fetchDailyExpenditureAggregate(input);
    expect(aggregate).toMatchObject({
      provider: 'apple_health',
      activeEnergyCalories: 600,
      basalEnergyCalories: 1400,
      rawTotalDailyExpenditure: 2000,
      adjustedDailyExpenditure: 1600,
      adjustmentFactor: 0.8,
      syncStatus: 'ready',
    });
  });

  it('keeps expenditure available as partial when only one component is readable', async () => {
    const provider = new AppleHealthExpenditureProvider({
      healthKit: healthKitClient({ HKQuantityTypeIdentifierBasalEnergyBurned: 1400 }),
      dayStart,
      dayEnd,
      now,
    });

    await expect(provider.fetchDailyExpenditureAggregate(input)).resolves.toMatchObject({
      rawTotalDailyExpenditure: 1400,
      adjustedDailyExpenditure: 1120,
      syncStatus: 'partial',
    });
  });

  it('returns no aggregate when HealthKit has no expenditure samples', async () => {
    const provider = new AppleHealthExpenditureProvider({
      healthKit: healthKitClient({}),
      dayStart,
      dayEnd,
      now,
    });

    await expect(provider.fetchDailyExpenditureAggregate(input)).resolves.toBeNull();
  });

  it('normalizes dietary energy independently from expenditure', async () => {
    const provider = new AppleHealthIntakeProvider({
      healthKit: healthKitClient({ HKQuantityTypeIdentifierDietaryEnergyConsumed: 1499.6 }),
      dayStart,
      dayEnd,
      now,
    });

    await expect(provider.fetchDailyCalorieIntakeAggregate(input)).resolves.toMatchObject({
      provider: 'apple_health',
      totalCaloriesConsumed: 1500,
      syncStatus: 'ready',
    });
  });

  it('returns no intake aggregate when HealthKit has no dietary energy samples', async () => {
    const provider = new AppleHealthIntakeProvider({
      healthKit: healthKitClient({}),
      dayStart,
      dayEnd,
      now,
    });

    await expect(provider.fetchDailyCalorieIntakeAggregate(input)).resolves.toBeNull();
  });

  it('normalizes cumulative steps without estimating calories', async () => {
    const provider = new AppleHealthStepProvider({
      healthKit: healthKitClient({ HKQuantityTypeIdentifierStepCount: 7542.4 }),
      dayStart,
      dayEnd,
      now,
    });

    const aggregate = await provider.fetchDailyStepAggregate(input);
    expect(aggregate).toMatchObject({ provider: 'apple_health', totalSteps: 7542 });
    expect(aggregate).not.toHaveProperty('calories');
  });

  it('normalizes workouts and maps unknown activity types to Other', async () => {
    const provider = new AppleHealthWorkoutProvider({
      healthKit: healthKitClient({}, [
        {
          uuid: 'walk-1',
          workoutActivityType: 52,
          startDate: new Date('2026-07-21T12:00:00.000Z'),
          endDate: new Date('2026-07-21T12:42:00.000Z'),
          duration: { quantity: 2520, unit: 's' },
          totalEnergyBurned: { quantity: 238.4, unit: 'kcal' },
        },
        {
          uuid: 'unknown-1',
          workoutActivityType: 9999,
          startDate: new Date('2026-07-21T10:00:00.000Z'),
          endDate: new Date('2026-07-21T10:30:00.000Z'),
          duration: { quantity: 1800, unit: 's' },
        },
      ]),
      dayStart,
      dayEnd,
      now,
    });

    const workouts = await provider.fetchDailyWorkouts(input);
    expect(workouts[0]).toMatchObject({
      providerWorkoutId: 'walk-1',
      activityType: 'walking',
      displayName: 'Walking',
      durationMinutes: 42,
      totalEnergyBurned: 238,
    });
    expect(workouts[1]).toMatchObject({ activityType: 'other', displayName: 'Workout' });
  });
});
