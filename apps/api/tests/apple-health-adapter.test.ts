import type { FetchDailyAggregateInput } from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

import {
  classifyApiRequestFailure,
  isApiAuthenticationReady,
  setApiAccessTokenProvider,
} from '../../mobile/lib/api/client';

import {
  AppleHealthExpenditureProvider,
  AppleHealthIntakeProvider,
  AppleHealthStepProvider,
  AppleHealthWorkoutProvider,
  type HealthKitNativeClient,
  APPLE_HEALTH_READ_TYPES,
} from '../../mobile/lib/healthkit/apple-health-provider';
import {
  resolveKnownFoodTracker,
  type AppleHealthIntakeWriter,
  type AppleHealthSource,
} from '../../mobile/lib/healthkit/apple-health-intake-writers';
import { accountScopedRollingSyncKey } from '../../mobile/lib/healthkit/rolling-sync-policy';
import {
  createHealthKitDiagnosticsSnapshot,
  deriveAppleHealthBurnState,
  deriveAppleHealthPresentationState,
  deriveHealthKitSyncStatus,
  safeHealthKitError,
  type HealthKitQueryDiagnostic,
} from '../../mobile/lib/healthkit/healthkit-diagnostics';

const input: FetchDailyAggregateInput = {
  userId: 'device-user',
  localDate: '2026-07-21',
  timezone: 'America/Chicago',
  isCurrentDay: true,
};
const dayStart = new Date('2026-07-21T05:00:00.000Z');
const dayEnd = new Date('2026-07-22T05:00:00.000Z');
const now = () => new Date('2026-07-21T14:00:00.000Z');
const cronometerSource = {
  name: 'SourceProxy',
  bundleIdentifier: 'CRONOMETER-GOLD',
} as AppleHealthSource;
const cronometerWriter = {
  source: cronometerSource,
  bundleIdentifier: 'CRONOMETER-GOLD',
  displayName: 'Cronometer',
};

function healthKitClient(
  values: Readonly<Record<string, number | Error | undefined>>,
  workouts: readonly object[] = [],
): HealthKitNativeClient {
  const query: HealthKitNativeClient['queryStatisticsForQuantity'] = async (identifier) => {
    const quantity = values[identifier];
    if (quantity instanceof Error) throw quantity;
    return quantity === undefined
      ? { sources: [] }
      : { sources: [], sumQuantity: { quantity, unit: 'kcal' } };
  };

  const queryWorkouts: HealthKitNativeClient['queryWorkoutSamples'] = async () =>
    workouts as Awaited<ReturnType<HealthKitNativeClient['queryWorkoutSamples']>>;
  const queryCollection: HealthKitNativeClient['queryStatisticsCollectionForQuantity'] = async () => [];

  return {
    queryStatisticsForQuantity: query,
    queryStatisticsCollectionForQuantity: queryCollection,
    queryWorkoutSamples: queryWorkouts,
  };
}

describe('Apple Health provider adapters', () => {
  it('requests the exact active and basal energy quantity identifiers', () => {
    expect(APPLE_HEALTH_READ_TYPES).toContain('HKQuantityTypeIdentifierActiveEnergyBurned');
    expect(APPLE_HEALTH_READ_TYPES).toContain('HKQuantityTypeIdentifierBasalEnergyBurned');
  });

  it('uses only physically verified bundle aliases and never guesses an ambiguous tracker', () => {
    const writer = {
      ...cronometerWriter,
      sourceName: 'SourceProxy',
      totalCalories: 2354,
    } satisfies AppleHealthIntakeWriter;
    expect(resolveKnownFoodTracker('cronometer', [writer])).toBe(writer);
    expect(resolveKnownFoodTracker('myfitnesspal', [writer])).toBeNull();
  });

  it('does not consider a protected request ready before the active account token getter is bound', () => {
    setApiAccessTokenProvider(null, { ready: false, activeSessionPresent: false });
    expect(isApiAuthenticationReady('clerk')).toBe(false);
    setApiAccessTokenProvider(async () => 'current-session-token', { ready: true, activeSessionPresent: true });
    expect(isApiAuthenticationReady('clerk')).toBe(true);
    setApiAccessTokenProvider(null);
  });

  it('namespaces local HealthKit sync state by authenticated account', () => {
    const keyA = accountScopedRollingSyncKey('caloriebank.apple-health.upload-fingerprints.v1', 'user_A');
    const keyB = accountScopedRollingSyncKey('caloriebank.apple-health.upload-fingerprints.v1', 'user_B');
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('account:user_A');
    expect(keyB).toContain('account:user_B');
  });

  it('classifies expected aborts separately from network failures and timeouts', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(classifyApiRequestFailure(abort)).toBe('cancelled');
    expect(classifyApiRequestFailure(abort, true)).toBe('timeout');
    expect(classifyApiRequestFailure(new TypeError('Network request failed'))).toBe('network');
  });

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

  it('never treats a single HealthKit energy component as total expenditure', async () => {
    const provider = new AppleHealthExpenditureProvider({
      healthKit: healthKitClient({ HKQuantityTypeIdentifierBasalEnergyBurned: 1400 }),
      dayStart,
      dayEnd,
      now,
    });

    await expect(provider.fetchDailyExpenditureAggregate(input)).resolves.toBeNull();
  });

  it('distinguishes never-refreshed, empty-burn, ready, and failed burn states', () => {
    expect(deriveAppleHealthBurnState('not_connected', null)).toBe('needs_refresh');
    const empty = createHealthKitDiagnosticsSnapshot({
      lastSyncCompletedAt: new Date().toISOString(),
      overallSyncResult: 'partial',
      queries: [
        { category: 'active_energy', localDate: '2026-08-31', queryStart: dayStart.toISOString(), queryEnd: dayEnd.toISOString(), status: 'empty', sampleCount: null, normalizedAggregate: null, error: null },
        { category: 'resting_energy', localDate: '2026-08-31', queryStart: dayStart.toISOString(), queryEnd: dayEnd.toISOString(), status: 'empty', sampleCount: null, normalizedAggregate: null, error: null },
        { category: 'dietary_energy', localDate: '2026-08-31', queryStart: dayStart.toISOString(), queryEnd: dayEnd.toISOString(), status: 'success', sampleCount: null, normalizedAggregate: 1577, error: null },
      ],
    });
    expect(deriveAppleHealthBurnState('connected', empty)).toBe('no_burn_data');
    expect(deriveAppleHealthBurnState('connected', empty)).not.toBe('needs_refresh');
    const ready = createHealthKitDiagnosticsSnapshot({
      ...empty,
      queries: empty.queries.map((query) => query.category === 'dietary_energy' ? query : {
        ...query, status: 'success' as const, normalizedAggregate: 600,
      }),
    });
    expect(deriveAppleHealthBurnState('connected', ready)).toBe('ready');
    expect(deriveAppleHealthBurnState('connected', createHealthKitDiagnosticsSnapshot({
      ...empty, overallSyncResult: 'failure',
    }))).toBe('refresh_failed');
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
      intakeWriter: cronometerWriter,
    });

    await expect(provider.fetchDailyCalorieIntakeAggregate(input)).resolves.toMatchObject({
      provider: 'apple_health',
      totalCaloriesConsumed: 1500,
      writerBundleIdentifier: 'CRONOMETER-GOLD',
      writerDisplayName: 'Cronometer',
      syncStatus: 'ready',
    });
  });

  it('requires a selected writer and filters dietary statistics to that source', async () => {
    const filters: unknown[] = [];
    const client = healthKitClient({ HKQuantityTypeIdentifierDietaryEnergyConsumed: 2354 });
    const originalQuery = client.queryStatisticsForQuantity;
    client.queryStatisticsForQuantity = async (...args) => {
      filters.push(args[2]?.filter);
      return originalQuery(...args);
    };

    const withoutWriter = new AppleHealthIntakeProvider({ healthKit: client, dayStart, dayEnd, now });
    await expect(withoutWriter.fetchDailyCalorieIntakeAggregate(input)).resolves.toBeNull();
    expect(filters).toHaveLength(0);

    const selectedWriter = new AppleHealthIntakeProvider({
      healthKit: client, dayStart, dayEnd, now, intakeWriter: cronometerWriter,
    });
    await expect(selectedWriter.fetchDailyCalorieIntakeAggregate(input)).resolves.toMatchObject({
      totalCaloriesConsumed: 2354,
      writerBundleIdentifier: 'CRONOMETER-GOLD',
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({ sources: [cronometerSource] });
  });

  it('returns no intake aggregate when HealthKit has no dietary energy samples', async () => {
    const provider = new AppleHealthIntakeProvider({
      healthKit: healthKitClient({}),
      dayStart,
      dayEnd,
      now,
      intakeWriter: cronometerWriter,
    });

    await expect(provider.fetchDailyCalorieIntakeAggregate(input)).resolves.toBeNull();
  });

  it('keeps successful authorization connected when dietary energy and workouts are empty', () => {
    const queries: HealthKitQueryDiagnostic[] = [
      {
        category: 'dietary_energy', localDate: input.localDate, queryStart: dayStart.toISOString(),
        queryEnd: dayEnd.toISOString(), status: 'empty', sampleCount: null,
        normalizedAggregate: null, error: null,
      },
      {
        category: 'workouts', localDate: input.localDate, queryStart: dayStart.toISOString(),
        queryEnd: dayEnd.toISOString(), status: 'empty', sampleCount: 0,
        normalizedAggregate: null, error: null,
      },
    ];
    const diagnostics = createHealthKitDiagnosticsSnapshot({
      healthKitAvailable: true,
      authorizationRequest: 'completed',
      queries,
      overallSyncResult: deriveHealthKitSyncStatus(queries, {
        status: 'success', attemptedCount: 0, completedCount: 0, pendingCount: 0,
        failedCategories: [], items: [],
      }),
    });

    expect(deriveAppleHealthPresentationState('connected', diagnostics)).toBe('connected_partial');
    expect(deriveAppleHealthPresentationState('connected', diagnostics)).not.toBe('not_connected');
  });

  it('reports a failed category without poisoning independently readable categories', async () => {
    const client = healthKitClient({
      HKQuantityTypeIdentifierDietaryEnergyConsumed: 1500,
      HKQuantityTypeIdentifierStepCount: new Error('Step query unavailable'),
    });
    const intake = new AppleHealthIntakeProvider({
      healthKit: client, dayStart, dayEnd, now, intakeWriter: cronometerWriter,
    });
    const steps = new AppleHealthStepProvider({ healthKit: client, dayStart, dayEnd, now });

    await expect(intake.fetchDailyCalorieIntakeAggregate(input)).resolves.toMatchObject({
      totalCaloriesConsumed: 1500,
    });
    await expect(steps.fetchDailyStepAggregate(input)).rejects.toThrow('Step query unavailable');
  });

  it('keeps intake, steps, and workouts available when expenditure components are empty', async () => {
    const client = healthKitClient({
      HKQuantityTypeIdentifierDietaryEnergyConsumed: 1500,
      HKQuantityTypeIdentifierStepCount: 7200,
    }, [{
      uuid: 'workout-1',
      workoutActivityType: 52,
      startDate: dayStart,
      endDate: new Date(dayStart.getTime() + 30 * 60 * 1000),
      duration: { quantity: 1800, unit: 's' },
    }]);

    const [expenditure, intake, steps, workouts] = await Promise.all([
      new AppleHealthExpenditureProvider({ healthKit: client, dayStart, dayEnd, now })
        .fetchDailyExpenditureAggregate(input),
      new AppleHealthIntakeProvider({
        healthKit: client, dayStart, dayEnd, now, intakeWriter: cronometerWriter,
      })
        .fetchDailyCalorieIntakeAggregate(input),
      new AppleHealthStepProvider({ healthKit: client, dayStart, dayEnd, now })
        .fetchDailyStepAggregate(input),
      new AppleHealthWorkoutProvider({ healthKit: client, dayStart, dayEnd, now })
        .fetchDailyWorkouts(input),
    ]);

    expect(expenditure).toBeNull();
    expect(intake?.totalCaloriesConsumed).toBe(1500);
    expect(steps?.totalSteps).toBe(7200);
    expect(workouts).toHaveLength(1);
  });

  it('records only safe query metadata and never serializes native sample payloads', async () => {
    const diagnostics: object[] = [];
    const provider = new AppleHealthIntakeProvider({
      healthKit: healthKitClient({ HKQuantityTypeIdentifierDietaryEnergyConsumed: 1200 }),
      dayStart,
      dayEnd,
      now,
      intakeWriter: cronometerWriter,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await provider.fetchDailyCalorieIntakeAggregate(input);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      category: 'dietary_energy', status: 'success', normalizedAggregate: 1200,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('samples');
    expect(JSON.stringify(diagnostics)).not.toContain('sourceRevision');
    expect(safeHealthKitError(new Error('Native query failed')).message).toBe('Native query failed');
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
