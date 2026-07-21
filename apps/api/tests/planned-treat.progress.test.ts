import { describe, expect, it } from 'vitest';

import { derivePlannedTreatProgress } from '../src/modules/planned-treat/planned-treat.progress';

describe('planned treat progress', () => {
  it('shows zero progress for a zero bank', () => {
    expect(derivePlannedTreatProgress(0, 1500)).toEqual({
      progressCalories: 0,
      remainingCalories: 1500,
      progressRatio: 0,
      progressPercent: 0,
      status: 'saving',
    });
  });

  it('shows zero progress for a negative bank', () => {
    expect(derivePlannedTreatProgress(-200, 1500)).toMatchObject({
      progressCalories: 0,
      remainingCalories: 1500,
      progressRatio: 0,
      progressPercent: 0,
      status: 'saving',
    });
  });

  it('derives partial progress', () => {
    expect(derivePlannedTreatProgress(305, 1500)).toEqual({
      progressCalories: 305,
      remainingCalories: 1195,
      progressRatio: 305 / 1500,
      progressPercent: 20,
      status: 'saving',
    });
  });

  it('marks the treat ready at the exact requirement', () => {
    expect(derivePlannedTreatProgress(1500, 1500)).toMatchObject({
      progressCalories: 1500,
      remainingCalories: 0,
      progressRatio: 1,
      progressPercent: 100,
      status: 'ready',
    });
  });

  it('caps visual progress when the bank exceeds the requirement', () => {
    expect(derivePlannedTreatProgress(1650, 1500)).toEqual({
      progressCalories: 1650,
      remainingCalories: 0,
      progressRatio: 1,
      progressPercent: 100,
      status: 'ready',
    });
  });
});
