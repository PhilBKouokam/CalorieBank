import {
  normalizeDailyExpenditureAggregate,
  getLocalDateUtcBounds,
  normalizeDailyStepAggregate,
  normalizeCurrentDayWorkout,
  type ExpenditureProvider,
  type FetchDailyAggregateInput,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyStepAggregate,
  type NormalizedCurrentDayWorkout,
  type StepProvider,
  type WorkoutProvider,
} from '@caloriebank/domain';
import { z } from 'zod';

export const GOOGLE_HEALTH_FITBIT_PROVIDER_ID = 'google_health_fitbit';

const IntegerValueSchema = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/).transform(Number),
]);

const CivilDateSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  day: z.number().int(),
});

export const GoogleHealthDailyRollupSchema = z.object({
  rollupDataPoints: z.array(z.object({
    civilStartTime: z.object({ date: CivilDateSchema }).passthrough(),
    civilEndTime: z.object({ date: CivilDateSchema }).passthrough(),
    totalCalories: z.object({ kcalSum: z.number().nonnegative().finite() }).optional(),
  }).passthrough()).default([]),
});

export const GoogleHealthHourlyRollupSchema = z.object({
  rollupDataPoints: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    totalCalories: z.object({ kcalSum: z.number().nonnegative().finite() }).optional(),
    steps: z.object({ countSum: IntegerValueSchema }).optional(),
  }).passthrough()).default([]),
  nextPageToken: z.string().optional(),
});

const GoogleHealthStepsRollupSchema = z.object({
  rollupDataPoints: z.array(z.object({
    civilStartTime: z.object({ date: CivilDateSchema }).passthrough(),
    steps: z.object({ countSum: IntegerValueSchema }).optional(),
  }).passthrough()).default([]),
});

const GoogleHealthExerciseDataPointSchema = z.object({
  name: z.string().min(1),
  exercise: z.object({
    interval: z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
    }).passthrough(),
    exerciseType: z.string().min(1),
    displayName: z.string().min(1).optional(),
    activeDuration: z.string().regex(/^\d+(?:\.\d+)?s$/).optional(),
    metricsSummary: z.object({
      caloriesKcal: z.number().nonnegative().finite().optional(),
      distanceMillimeters: IntegerValueSchema.optional(),
      steps: IntegerValueSchema.optional(),
    }).passthrough().optional(),
    updateTime: z.string().datetime().optional(),
  }).passthrough(),
}).passthrough();

const GoogleHealthExerciseListSchema = z.object({
  dataPoints: z.array(GoogleHealthExerciseDataPointSchema).default([]),
});

export interface GoogleHealthTotalCaloriesTransport {
  fetchDailyTotalCalories(localDate: string): Promise<unknown>;
  fetchMinuteTotalCalories?(input: { start: Date; end: Date; pageToken?: string }): Promise<unknown>;
}

export interface GoogleHealthStepsTransport {
  fetchDailySteps(localDate: string): Promise<unknown>;
}

export interface GoogleHealthExerciseTransport {
  fetchDailyExercises(localDate: string): Promise<unknown>;
}

function civilDate(value: { year: number; month: number; day: number }) {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

/** Complete bounded pagination, explicit zero support, no interpolation over gaps.
 * Failure of this optional planning query must not discard daily accounting evidence.
 */
export async function fetchMinuteExpenditureEvidence(transport: GoogleHealthTotalCaloriesTransport, input: FetchDailyAggregateInput, now: Date) {
  if (!transport.fetchMinuteTotalCalories) return null;
  const bounds = getLocalDateUtcBounds(input.localDate, input.timezone);
  const end = new Date(Math.min(now.getTime(), bounds.end.getTime()));
  if (end <= bounds.start) return null;
  const tokens = new Set<string>();
  const intervals = new Map<string, { end: Date; calories: number }>();
  let pageToken: string | undefined;
  try {
    for (let page = 0; page < 100; page++) {
      const payload = GoogleHealthHourlyRollupSchema.parse(await transport.fetchMinuteTotalCalories({ start: bounds.start, end, ...(pageToken ? { pageToken } : {}) }));
      for (const point of payload.rollupDataPoints) {
        if (!point.totalCalories) continue; // A missing interval is not an explicit zero.
        const start = new Date(point.startTime);
        const pointEnd = new Date(point.endTime);
        if (start < bounds.start || pointEnd > end || pointEnd <= start || pointEnd.getTime() - start.getTime() > 60000) return null;
        const key = point.startTime;
        const prior = intervals.get(key);
        if (prior && (prior.end.getTime() !== pointEnd.getTime() || prior.calories !== point.totalCalories.kcalSum)) return null;
        intervals.set(key, { end: pointEnd, calories: point.totalCalories.kcalSum });
      }
      pageToken = payload.nextPageToken;
      if (!pageToken) {
        const ordered = [...intervals.entries()].sort(([a], [b]) => a.localeCompare(b));
        if (ordered.some(([start], index) => index > 0 && new Date(start) < ordered[index - 1]![1].end)) return null;
        return ordered.length ? { horizon: ordered[ordered.length - 1]![1].end, calories: ordered.reduce((sum, [, point]) => sum + point.calories, 0) } : null;
      }
      if (tokens.has(pageToken)) return null;
      tokens.add(pageToken);
    }
  } catch { return null; }
  return null;
}

export class GoogleHealthFitbitExpenditureProvider implements ExpenditureProvider {
  constructor(
    private readonly transport: GoogleHealthTotalCaloriesTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchDailyExpenditureAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyExpenditureAggregate | null> {
    const minuteEvidence = input.isCurrentDay ? await fetchMinuteExpenditureEvidence(this.transport, input, this.now()) : null;
    const payload = GoogleHealthDailyRollupSchema.parse(
      await this.transport.fetchDailyTotalCalories(input.localDate),
    );
    const point = payload.rollupDataPoints.find(
      (candidate) => civilDate(candidate.civilStartTime.date) === input.localDate,
    );
    if (!point?.totalCalories) return null;

    const importedAt = this.now();
    return normalizeDailyExpenditureAggregate({
      ...input,
      provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      providerRecordId: `${GOOGLE_HEALTH_FITBIT_PROVIDER_ID}:expenditure:${input.localDate}`,
      rawTotalDailyExpenditure: Math.round(point.totalCalories.kcalSum),
      importedAt,
      // Compatibility timestamp for ingestion ordering, NOT measured coverage.
      providerUpdatedAt: importedAt,
      // This aggregate API supplies no verified cumulative coverage watermark.
      forecastCoverageAt: null,
      retrievedAt: importedAt,
      // Same source family and matching aggregate; still only reported bucket metadata.
      reportedIntervalEndAt: minuteEvidence && Math.round(minuteEvidence.calories) === Math.round(point.totalCalories.kcalSum)
        ? minuteEvidence.horizon : null,
      syncStatus: 'ready',
    });
  }
}

export class GoogleHealthFitbitStepProvider implements StepProvider {
  constructor(
    private readonly transport: GoogleHealthStepsTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchDailyStepAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyStepAggregate | null> {
    const payload = GoogleHealthStepsRollupSchema.parse(
      await this.transport.fetchDailySteps(input.localDate),
    );
    const point = payload.rollupDataPoints.find(
      (candidate) => civilDate(candidate.civilStartTime.date) === input.localDate,
    );
    if (!point?.steps) return null;
    const importedAt = this.now();
    return normalizeDailyStepAggregate({
      ...input,
      provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
      providerRecordId: `${GOOGLE_HEALTH_FITBIT_PROVIDER_ID}:steps:${input.localDate}`,
      totalSteps: point.steps.countSum,
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
    });
  }
}

function workoutActivityType(value: string): NormalizedCurrentDayWorkout['activityType'] {
  const normalized = value.toUpperCase();
  if (normalized.includes('WALK')) return 'walking';
  if (normalized.includes('RUN')) return 'running';
  if (normalized.includes('BIK') || normalized.includes('CYCL')) return 'cycling';
  if (normalized.includes('DANC')) return 'dance';
  if (normalized.includes('STRENGTH') || normalized.includes('WEIGHT')) return 'strength';
  if (normalized.includes('INTERVAL') || normalized.includes('HIIT')) return 'hiit';
  if (normalized.includes('SWIM')) return 'swimming';
  if (normalized.includes('YOGA')) return 'yoga';
  if (normalized.includes('ELLIPTICAL')) return 'elliptical';
  if (normalized.includes('ROW')) return 'rowing';
  if (normalized.includes('STAIR')) return 'stair';
  return 'other';
}

function displayActivityType(value: string) {
  return value.toLowerCase().split('_').map((part) =>
    part.length > 0 ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part,
  ).join(' ');
}

function durationMinutes(duration: string | undefined, startedAt: Date, endedAt: Date) {
  const seconds = duration ? Number(duration.slice(0, -1)) : (endedAt.getTime() - startedAt.getTime()) / 1000;
  return Math.max(1, Math.round(seconds / 60));
}

export class GoogleHealthFitbitWorkoutProvider implements WorkoutProvider {
  constructor(
    private readonly transport: GoogleHealthExerciseTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchDailyWorkouts(
    input: FetchDailyAggregateInput,
  ): Promise<readonly NormalizedCurrentDayWorkout[]> {
    const payload = GoogleHealthExerciseListSchema.parse(
      await this.transport.fetchDailyExercises(input.localDate),
    );
    const importedAt = this.now();
    return payload.dataPoints.map((point) => {
      const startedAt = new Date(point.exercise.interval.startTime);
      const endedAt = new Date(point.exercise.interval.endTime);
      const calories = point.exercise.metricsSummary?.caloriesKcal;
      const distance = point.exercise.metricsSummary?.distanceMillimeters;
      const steps = point.exercise.metricsSummary?.steps;
      return normalizeCurrentDayWorkout({
        ...input,
        provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
        providerWorkoutId: point.name,
        activityType: workoutActivityType(point.exercise.exerciseType),
        displayName: point.exercise.displayName ?? displayActivityType(point.exercise.exerciseType),
        startedAt,
        endedAt,
        durationMinutes: durationMinutes(point.exercise.activeDuration, startedAt, endedAt),
        totalEnergyBurned: calories === undefined ? null : Math.round(calories),
        totalSteps: steps ?? null,
        totalDistance: distance === undefined ? null : distance / 1_000_000,
        distanceUnit: distance === undefined ? null : 'km',
        importedAt,
        providerUpdatedAt: point.exercise.updateTime ? new Date(point.exercise.updateTime) : importedAt,
        syncStatus: 'ready',
      });
    });
  }
}
