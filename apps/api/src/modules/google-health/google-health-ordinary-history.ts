import {
  estimateRestingBurnFromLowActivityHours,
  getLocalDateUtcBounds,
  type OrdinaryForecastHistory,
} from '@caloriebank/domain';
import { GoogleHealthExerciseListSchema, GoogleHealthHourlyRollupSchema } from './google-health.provider';

type ExerciseWindow = OrdinaryForecastHistory['exerciseCoverage'];
type Rollup = ReturnType<typeof GoogleHealthHourlyRollupSchema.parse>;
const hourMs = 3_600_000;
const maximumExercisePages = 3;

export type GoogleHealthOrdinaryHistory = {
  history: OrdinaryForecastHistory;
  rawLowActivityTotalKcalPerHour: number | null;
};

/** Maps the same rollup payloads as the existing historical reader, without I/O.
 * Exhaustive-overlap callers and bounded start-window proxies stay distinct.
 * A start-window proxy never attests every session crossing the first boundary. */
export function normalizeGoogleHealthOrdinaryHistory(input: {
  accountId: string;
  sourceId: string;
  timezone: string;
  retrievedAt: Date;
  calories: unknown;
  steps: unknown;
  recordedExercises: {
    coverage: ExerciseWindow;
    intervals: readonly ExerciseWindow[];
    completeForOverlaps: boolean;
    queryKind?: 'start_window';
  };
}): GoogleHealthOrdinaryHistory | null {
  const { accountId, sourceId, timezone, retrievedAt, recordedExercises } = input;
  const calories = GoogleHealthHourlyRollupSchema.safeParse(input.calories);
  const steps = GoogleHealthHourlyRollupSchema.safeParse(input.steps);
  if ((!recordedExercises.completeForOverlaps && recordedExercises.queryKind !== 'start_window') || !calories.success || !steps.success ||
    calories.data.nextPageToken || steps.data.nextPageToken) return null;

  const stepByStart = new Map(steps.data.rollupDataPoints.map(row => [Date.parse(row.startTime), row]));
  if (stepByStart.size !== steps.data.rollupDataPoints.length ||
    new Set(calories.data.rollupDataPoints.map(row => Date.parse(row.startTime))).size !== calories.data.rollupDataPoints.length) return null;
  const hours: OrdinaryForecastHistory['hours'][number][] = [];
  const restHours: Parameters<typeof estimateRestingBurnFromLowActivityHours>[0][number][] = [];
  for (const energy of calories.data.rollupDataPoints) {
    const step = stepByStart.get(Date.parse(energy.startTime));
    // Explicit zero is valid. A missing metric is unknown, even in a returned bucket.
    if (!energy.totalCalories || !step?.steps || Date.parse(step.endTime) !== Date.parse(energy.endTime) ||
      !Number.isSafeInteger(step.steps.countSum)) continue;
    const start = new Date(energy.startTime);
    const end = new Date(energy.endTime);
    const calories = energy.totalCalories.kcalSum;
    hours.push({ start, end, rawTotalKcal: calories, steps: step.steps.countSum, coverage: 'reported_interval', classification: 'unknown' });
    if (end.getTime() - start.getTime() === hourMs) {
      restHours.push({
        calories, steps: step.steps.countSum, observedAt: start,
        overlapsWorkout: recordedExercises.intervals.some(exercise => exercise.start < end && exercise.end > start),
      });
    }
  }
  const rest = estimateRestingBurnFromLowActivityHours(restHours);
  return {
    history: {
      accountId, sourceId, timezone, retrievedAt, basis: 'recorded_sessions_proxy',
      sessionCoverage: recordedExercises.completeForOverlaps ? 'overlaps_complete' : 'start_window_only',
      exerciseCoverage: recordedExercises.coverage, exercises: recordedExercises.intervals, hours,
    },
    rawLowActivityTotalKcalPerHour: rest && rest.observationCount >= 3 ? rest.providerKcalPerHour : null,
  };
}

function civilDateOffset(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Optional qualification acquisition over the documented endpoints. Every call
 * uses the injected bounded transport. Fail closed on incomplete workout paging
 * or a continuation on any one-day hourly rollup. */
export async function readGoogleHealthOrdinaryHistory(input: {
  accountId: string;
  sourceId: string;
  localDate: string;
  timezone: string;
  now: () => Date;
  request: (path: string, init: RequestInit) => Promise<unknown>;
}): Promise<GoogleHealthOrdinaryHistory | null> {
  const { accountId, sourceId, localDate, timezone, request } = input;
  const bounds = Array.from({ length: 5 }, (_, index) =>
    getLocalDateUtcBounds(civilDateOffset(localDate, index - 5), timezone));
  const window = { start: bounds[0]!.start, end: bounds.at(-1)!.end };
  const exercises: ExerciseWindow[] = [];
  const identities = new Set<string>();
  const tokens = new Set<string>();
  let nextPageToken: string | undefined;
  // Query a bounded recent start-window with one prior civil-day buffer.
  // Exhaustion proves only this queried inventory, never every boundary overlap:
  // a long session may have started earlier. Preserve start_window_only metadata.
  // Two upper civil dates accommodate recording/profile offsets.
  const filter = `exercise.interval.civil_start_time >= "${civilDateOffset(localDate, -6)}" AND exercise.interval.civil_start_time < "${civilDateOffset(localDate, 2)}"`;
  for (let page = 0; page < maximumExercisePages; page++) {
    const params = new URLSearchParams({ filter, pageSize: '25', ...(nextPageToken ? { pageToken: nextPageToken } : {}) });
    const payload = GoogleHealthExerciseListSchema.parse(await request(`/users/me/dataTypes/exercise/dataPoints?${params}`, { method: 'GET' }));
    if (payload.dataPoints.length > 25) return null;
    for (const item of payload.dataPoints) {
      const interval = { start: new Date(item.exercise.interval.startTime), end: new Date(item.exercise.interval.endTime) };
      if (identities.has(item.name) || interval.start >= interval.end) return null;
      identities.add(item.name);
      if (interval.start < window.end && interval.end > window.start) exercises.push(interval);
    }
    nextPageToken = payload.nextPageToken;
    if (!nextPageToken) break;
    if (tokens.has(nextPageToken)) return null;
    tokens.add(nextPageToken);
  }
  if (nextPageToken) return null;

  const calories: Rollup['rollupDataPoints'] = [];
  const steps: Rollup['rollupDataPoints'] = [];
  for (const day of bounds) {
    const fetchRollup = async (metric: 'total-calories' | 'steps') => {
      const raw = await request(`/users/me/dataTypes/${metric}/dataPoints:rollUp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: { startTime: day.start.toISOString(), endTime: day.end.toISOString() },
          windowSize: '3600s', dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
        }),
      });
      return GoogleHealthHourlyRollupSchema.parse(raw);
    };
    const [energy, movement] = await Promise.all([fetchRollup('total-calories'), fetchRollup('steps')]);
    if ([energy, movement].some(rollup => rollup.nextPageToken || rollup.rollupDataPoints.length > 25 ||
      rollup.rollupDataPoints.some(row => new Date(row.startTime) < day.start || new Date(row.endTime) > day.end))) return null;
    calories.push(...energy.rollupDataPoints);
    steps.push(...movement.rollupDataPoints);
  }
  return normalizeGoogleHealthOrdinaryHistory({
    accountId, sourceId, timezone, retrievedAt: input.now(),
    calories: { rollupDataPoints: calories }, steps: { rollupDataPoints: steps },
    recordedExercises: { coverage: window, intervals: exercises, completeForOverlaps: false, queryKind: 'start_window' },
  });
}
