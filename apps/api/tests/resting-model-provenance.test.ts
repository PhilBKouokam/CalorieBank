import { describe, expect, it } from 'vitest';
import { canonicalRestingEvidenceType, qualifiedRestingModelProvenance, reusableGoogleLowActivityModel, GOOGLE_LOW_ACTIVITY_EVIDENCE_V2 } from '../src/modules/google-health/google-health-model-provenance';
const now = new Date('2026-11-04T12:00:00Z');
const model = { provider: 'google_health_fitbit', evidenceType: GOOGLE_LOW_ACTIVITY_EVIDENCE_V2, calculatedAt: now, providerKcalPerHour: 70, observationCount: 3 };
describe('versioned baseline evidence', () => {
  it('reuses only current qualified Google production evidence within its cache age', () => {
    expect(reusableGoogleLowActivityModel(model, now)).toBe(true);
    for (const evidenceType of ['historical_low_activity_hours', 'historical_low_activity_hours_v3', 'unknown']) expect(reusableGoogleLowActivityModel({ ...model, evidenceType }, now)).toBe(false);
    expect(reusableGoogleLowActivityModel(model, new Date(now.getTime() + 7 * 86400000))).toBe(false);
    expect(reusableGoogleLowActivityModel(model, new Date(now.getTime() - 1))).toBe(false);
  });
  it('maps the internal version to the old wire enum and fails closed on unknown strings', () => {
    expect(canonicalRestingEvidenceType(GOOGLE_LOW_ACTIVITY_EVIDENCE_V2)).toBe('historical_low_activity_hours');
    expect(canonicalRestingEvidenceType('unknown')).toBeNull();
    expect(qualifiedRestingModelProvenance({ ...model, evidenceType: 'historical_low_activity_hours' })).toBe(false);
    expect(qualifiedRestingModelProvenance({ ...model, evidenceType: 'unknown' })).toBe(false);
    expect(qualifiedRestingModelProvenance({ provider: 'apple_health', evidenceType: 'historical_low_activity_hours' })).toBe(true);
    expect(qualifiedRestingModelProvenance({ provider: 'apple_health', evidenceType: 'provider_resting_energy' })).toBe(true);
  });
});
