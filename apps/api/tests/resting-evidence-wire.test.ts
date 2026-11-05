import { describe, expect, it } from 'vitest';
import { canonicalRestingEvidenceType } from '../src/modules/today/resting-evidence-wire';
import { todayResponseSchema } from '@caloriebank/schemas';
describe('reader-only baseline transition', () => {
  it.each(['provider_resting_energy', 'historical_low_activity_hours', 'historical_daily_basal'] as const)('preserves known transitional %s evidence', value => {
    expect(canonicalRestingEvidenceType(value)).toBe(value);
  });
  it('maps the internal corrected producer tag to the old wire enum, not the producer itself', () => {
    expect(canonicalRestingEvidenceType('historical_low_activity_hours_v2')).toBe('historical_low_activity_hours');
    expect(todayResponseSchema.shape.restOfDayProjection.shape.evidenceType.safeParse('historical_low_activity_hours_v2').success).toBe(false);
    expect(todayResponseSchema.shape.restOfDayProjection.shape.evidenceType.safeParse(canonicalRestingEvidenceType('historical_low_activity_hours_v2')).success).toBe(true);
  });
  it('unknown future evidence is not a numeric qualification', () => {
    expect(canonicalRestingEvidenceType('historical_low_activity_hours_v3')).toBeNull();
    expect(canonicalRestingEvidenceType('unknown')).toBeNull();
  });
});
