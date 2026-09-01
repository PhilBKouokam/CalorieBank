import {
  getLocalDateUtcBounds,
  resolveAuthoritativeProviderRecord,
  type FetchDailyAggregateInput,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

import { WHOOP_PROVIDER_ID, WhoopWorkoutProvider } from '../src/modules/whoop/whoop.provider';

const input: FetchDailyAggregateInput = {
  userId: 'user',
  localDate: '2026-08-17',
  timezone: 'America/Chicago',
  isCurrentDay: true,
};

describe('WHOOP provider adapter', () => {
  it('normalizes WHOOP workouts as context and converts official kilojoules to kcal', async () => {
    const provider = new WhoopWorkoutProvider(
      { fetchDailyWorkouts: async () => ({ records: [{
        id: 'ecfc6a15-4661-442f-a9a4-f160dd7afae8',
        updated_at: '2026-08-17T14:35:00.000Z',
        start: '2026-08-17T14:00:00.000Z',
        end: '2026-08-17T14:30:00.000Z',
        sport_name: 'running',
        score_state: 'SCORED',
        score: { kilojoule: 1004.16, distance_meter: 5000 },
      }] }) },
      () => ({ start: new Date('2026-08-17T05:00:00.000Z'), end: new Date('2026-08-18T05:00:00.000Z') }),
      () => new Date('2026-08-17T15:00:00.000Z'),
    );

    await expect(provider.fetchDailyWorkouts(input)).resolves.toEqual([
      expect.objectContaining({
        provider: WHOOP_PROVIDER_ID,
        activityType: 'running',
        durationMinutes: 30,
        totalEnergyBurned: 240,
        totalDistance: 5000,
        distanceUnit: 'm',
      }),
    ]);
  });

  it('does not fabricate workout energy for pending or unscorable records', async () => {
    const provider = new WhoopWorkoutProvider(
      { fetchDailyWorkouts: async () => ({ records: [{
        id: 'ecfc6a15-4661-442f-a9a4-f160dd7afae8',
        updated_at: '2026-08-17T14:35:00.000Z',
        start: '2026-08-17T14:00:00.000Z',
        end: '2026-08-17T14:30:00.000Z',
        sport_name: 'unknown activity',
        score_state: 'PENDING_SCORE',
      }] }) },
      () => ({ start: new Date(), end: new Date() }),
    );
    await expect(provider.fetchDailyWorkouts(input)).resolves.toEqual([
      expect.objectContaining({ activityType: 'other', totalEnergyBurned: null, totalDistance: null }),
    ]);
  });

  it('retrieves every documented WHOOP workout page', async () => {
    const requestedTokens: Array<string | undefined> = [];
    const makeWorkout = (id: string) => ({
      id,
      updated_at: '2026-08-17T14:35:00.000Z',
      start: '2026-08-17T14:00:00.000Z',
      end: '2026-08-17T14:30:00.000Z',
      sport_name: 'walking',
      score_state: 'PENDING_SCORE' as const,
    });
    const provider = new WhoopWorkoutProvider(
      { fetchDailyWorkouts: async (_start, _end, nextToken) => {
        requestedTokens.push(nextToken);
        return nextToken
          ? { records: [makeWorkout('bda1424d-cda8-4e57-b189-b4cbfa7f5c0a')] }
          : {
            records: [makeWorkout('ecfc6a15-4661-442f-a9a4-f160dd7afae8')],
            next_token: 'next-page',
          };
      } },
      () => ({ start: new Date(), end: new Date() }),
    );

    await expect(provider.fetchDailyWorkouts(input)).resolves.toHaveLength(2);
    expect(requestedTokens).toEqual([undefined, 'next-page']);
  });

  it('never adds WHOOP workout energy to authoritative daily expenditure', () => {
    const selected = resolveAuthoritativeProviderRecord([
      { provider: 'google_health_fitbit', calories: 2500 },
      { provider: 'whoop', calories: 600 },
    ], { authoritativeProvider: 'google_health_fitbit', allowFallback: false });
    expect(selected?.calories).toBe(2500);
  });

  it('uses timezone-aware local-day bounds across daylight-saving transitions', () => {
    const spring = getLocalDateUtcBounds('2026-03-08', 'America/Chicago');
    const fall = getLocalDateUtcBounds('2026-11-01', 'America/Chicago');
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * 60 * 60 * 1000);
  });
});
