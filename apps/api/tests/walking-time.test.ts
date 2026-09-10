import { describe, expect, it } from 'vitest';
import { estimateWalkingTime, type WalkingTimeSample } from '@caloriebank/domain';

const context = { provider: 'apple_health', now: new Date('2026-09-10T12:00:00Z') };
const walk = (id: string, overrides: Partial<WalkingTimeSample> = {}): WalkingTimeSample => ({
  id, provider: context.provider, activityType: 'walking',
  startedAt: new Date('2026-09-09T12:00:00Z'), durationMinutes: 20, steps: 2_000,
  ...overrides,
});
const samples = [walk('a'), walk('b')];

describe('walking-time planning, independent of calorie accounting', () => {
  it.each([[20, 1, 20], [25, 1, 25], [30, 2, 15], [50, 2, 25],
    [60, 3, 20], [75, 3, 25], [90, 4, 23], [100, 4, 25]])(
    '%i minutes uses %i sessions of about %i minutes', (minutes, count, session) => {
      expect(estimateWalkingTime(minutes * 100, samples, context)).toMatchObject({
        totalMinutes: minutes, sessionCount: count, minutesPerSession: session,
      });
    },
  );
  it('uses the median rather than one unusual walk', () => {
    expect(estimateWalkingTime(6_000, [...samples, walk('c', { steps: 4_000 })], context))
      .toMatchObject({ sampleCount: 3, stepsPerMinute: 100, totalMinutes: 60 });
  });
  it('uses the newest five unique valid walks', () => {
    const history = Array.from({ length: 6 }, (_, index) => walk(String(index), {
      startedAt: new Date(`2026-09-0${index + 1}T12:00:00Z`),
      steps: index === 0 ? 400 : 2_000,
    }));
    expect(estimateWalkingTime(6_000, [...history, history[5]!], context))
      .toMatchObject({ sampleCount: 5, stepsPerMinute: 100 });
  });
  it.each([
    { activityType: 'running' }, { activityType: 'cycling' }, { activityType: 'boxing' },
    { durationMinutes: 0 }, { durationMinutes: -1 }, { steps: 0 }, { steps: Infinity },
    { steps: 100_000 }, { steps: 1 }, { provider: 'google_health_fitbit' },
    { startedAt: new Date('2026-01-01') }, { startedAt: new Date('2027-01-01') },
    { startedAt: new Date('2026-09-10T11:59:00Z') },
    { startedAt: new Date('invalid') },
  ])('excludes invalid or unrelated evidence: %j', (overrides) => {
    expect(estimateWalkingTime(6_000, [walk('a'), walk('b', overrides)], context)).toBeNull();
  });
  it('does not treat duplicate samples as sufficient evidence', () => {
    expect(estimateWalkingTime(6_000, [walk('a'), walk('a')], context)).toBeNull();
    expect(estimateWalkingTime(6_000, [], context)).toBeNull();
  });
  it.each([0, -1, NaN, Infinity, 1_000_000])('omits unusable remaining steps: %s', (steps) => {
    expect(estimateWalkingTime(steps, samples, context)).toBeNull();
  });
  it('preserves the 25-minute maximum across fractional boundaries', () => {
    for (let steps = 1; steps <= 20_000; steps += 17) {
      const result = estimateWalkingTime(steps, samples, context)!;
      expect(result.sessionCount).toBe(Math.ceil(result.totalMinutes / 25));
      expect(result.minutesPerSession).toBeLessThanOrEqual(25);
      expect(result.minutesPerSession).toBeGreaterThan(0);
    }
  });
});
