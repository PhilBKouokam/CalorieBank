import { expect, it } from 'vitest';
import type { TodayResponse } from '@caloriebank/schemas';
import { intakeAdjustmentDescription } from '../../mobile/lib/providers/presentation';
const eaten: TodayResponse['eaten'] = { calories: 2100, source: 'Cronometer', status: 'ready', lastSyncedAt: null, intakeAdjustment: { mode: 'add', calories: 300 } };
it('distinguishes imported calories, additions, replacements and missing evidence', () => {
  expect(intakeAdjustmentDescription(eaten)).toBe('Cronometer + 300 kcal added');
  expect(intakeAdjustmentDescription({ ...eaten, intakeAdjustment: { mode: 'replace', calories: 2500 } })).toBe('Your total for today');
  expect(intakeAdjustmentDescription({ ...eaten, intakeAdjustment: null })).toBeNull();
  expect(intakeAdjustmentDescription({ ...eaten, calories: null })).toBe('Waiting for source calories. Your 300 kcal addition is saved.');
});
