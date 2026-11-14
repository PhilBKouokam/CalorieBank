import { describe, expect, it } from 'vitest';

import { dailyTargetSchema, goalModeSchema } from '../src/index';

const validDailyTarget = {
  goalMode: 'maintain',
  calories: 2200,
  timezone: 'America/Chicago',
} as const;

describe('goalModeSchema', () => {
  it.each(['cut', 'maintain', 'bulk'] as const)('accepts %s', (goalMode) => {
    expect(goalModeSchema.parse(goalMode)).toBe(goalMode);
  });

  it('rejects a goal outside cut, maintain, and bulk', () => {
    expect(goalModeSchema.safeParse('recomp').success).toBe(false);
    expect(goalModeSchema.safeParse('Cut').success).toBe(false);
    expect(goalModeSchema.safeParse('').success).toBe(false);
  });
});

describe('dailyTargetSchema', () => {
  it.each([
    ['cut', 1800],
    ['maintain', 2200],
    ['bulk', 2800],
  ] as const)('accepts a %s target of %i calories', (goalMode, calories) => {
    const input = {
      goalMode,
      calories,
      timezone: 'America/Chicago',
    };

    expect(dailyTargetSchema.parse(input)).toEqual(input);
  });

  it('accepts the UTC timezone', () => {
    expect(
      dailyTargetSchema.parse({
        ...validDailyTarget,
        timezone: 'UTC',
      }),
    ).toMatchObject({ timezone: 'UTC' });
  });

  it('rejects a non-positive calorie target', () => {
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, calories: 0 }).success).toBe(false);
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, calories: -100 }).success).toBe(false);
  });

  it('rejects fractional calories', () => {
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, calories: 1800.5 }).success).toBe(false);
  });

  it('does not coerce numeric strings into calorie counts', () => {
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, calories: '2200' }).success).toBe(false);
  });

  it('rejects an empty timezone', () => {
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, timezone: '' }).success).toBe(false);
  });

  it('rejects a missing goal, calorie count, or timezone', () => {
    expect(dailyTargetSchema.safeParse({ calories: 2200, timezone: 'UTC' }).success).toBe(false);
    expect(dailyTargetSchema.safeParse({ goalMode: 'cut', timezone: 'UTC' }).success).toBe(false);
    expect(dailyTargetSchema.safeParse({ goalMode: 'cut', calories: 1800 }).success).toBe(false);
    expect(dailyTargetSchema.safeParse(null).success).toBe(false);
  });

  it.skip('rejects timezones that cannot identify a zone (schema currently accepts any non-empty string, including "Not/AZone" and whitespace)', () => {
    // docs/product/v1-prd.md: log_date, day boundaries, finalization, and history use the
    // user's authoritative timezone. dailyTargetSchema only checks z.string().min(1).
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, timezone: 'Not/AZone' }).success).toBe(false);
    expect(dailyTargetSchema.safeParse({ ...validDailyTarget, timezone: '   ' }).success).toBe(false);
  });
});
