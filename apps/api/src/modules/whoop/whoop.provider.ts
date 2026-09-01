import {
  normalizeCurrentDayWorkout,
  type FetchDailyAggregateInput,
  type NormalizedCurrentDayWorkout,
  type WorkoutProvider,
} from '@caloriebank/domain';
import { z } from 'zod';

export const WHOOP_PROVIDER_ID = 'whoop';

const WhoopWorkoutSchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  sport_name: z.string().min(1),
  score_state: z.enum(['SCORED', 'PENDING_SCORE', 'UNSCORABLE']),
  score: z.object({
    kilojoule: z.number().nonnegative().finite(),
    distance_meter: z.number().nonnegative().finite().optional(),
  }).passthrough().optional(),
}).passthrough();

const WhoopWorkoutCollectionSchema = z.object({
  records: z.array(WhoopWorkoutSchema).default([]),
  next_token: z.string().optional(),
});

export interface WhoopWorkoutTransport {
  fetchDailyWorkouts(start: Date, end: Date, nextToken?: string): Promise<unknown>;
}

function activityType(name: string): NormalizedCurrentDayWorkout['activityType'] {
  const value = name.toLowerCase();
  if (value.includes('walk')) return 'walking';
  if (value.includes('run')) return 'running';
  if (value.includes('cycl') || value.includes('bike')) return 'cycling';
  if (value.includes('dance')) return 'dance';
  if (value.includes('strength') || value.includes('weight')) return 'strength';
  if (value.includes('hiit') || value.includes('interval')) return 'hiit';
  if (value.includes('swim')) return 'swimming';
  if (value.includes('yoga')) return 'yoga';
  if (value.includes('elliptical')) return 'elliptical';
  if (value.includes('row')) return 'rowing';
  if (value.includes('stair')) return 'stair';
  return 'other';
}

function displayName(value: string) {
  return value.split(/[_\s-]+/).filter(Boolean).map((part) =>
    `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`,
  ).join(' ');
}

export class WhoopWorkoutProvider implements WorkoutProvider {
  constructor(
    private readonly transport: WhoopWorkoutTransport,
    private readonly getBounds: (input: FetchDailyAggregateInput) => { start: Date; end: Date },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchDailyWorkouts(input: FetchDailyAggregateInput) {
    const bounds = this.getBounds(input);
    const records: z.infer<typeof WhoopWorkoutSchema>[] = [];
    let nextToken: string | undefined;
    do {
      const payload = WhoopWorkoutCollectionSchema.parse(
        await this.transport.fetchDailyWorkouts(bounds.start, bounds.end, nextToken),
      );
      records.push(...payload.records);
      nextToken = payload.next_token;
    } while (nextToken);
    const importedAt = this.now();
    return records.map((workout) => {
      const startedAt = new Date(workout.start);
      const endedAt = new Date(workout.end);
      return normalizeCurrentDayWorkout({
        ...input,
        provider: WHOOP_PROVIDER_ID,
        providerWorkoutId: workout.id,
        activityType: activityType(workout.sport_name),
        displayName: displayName(workout.sport_name),
        startedAt,
        endedAt,
        durationMinutes: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)),
        totalEnergyBurned: workout.score_state === 'SCORED' && workout.score
          ? Math.round(workout.score.kilojoule / 4.184)
          : null,
        totalSteps: null,
        totalDistance: workout.score?.distance_meter ?? null,
        distanceUnit: workout.score?.distance_meter === undefined ? null : 'm',
        importedAt,
        providerUpdatedAt: new Date(workout.updated_at),
        syncStatus: 'ready',
      });
    });
  }
}
