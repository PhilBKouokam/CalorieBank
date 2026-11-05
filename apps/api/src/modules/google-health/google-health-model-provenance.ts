/** Internal producer version; wire clients retain their existing canonical enum. */
export const GOOGLE_LOW_ACTIVITY_EVIDENCE_V2 = 'historical_low_activity_hours_v2';
type RestingEvidence = 'provider_resting_energy' | 'historical_low_activity_hours' | 'historical_daily_basal';
export function canonicalRestingEvidenceType(value: string): RestingEvidence | null {
  if (value === GOOGLE_LOW_ACTIVITY_EVIDENCE_V2) return 'historical_low_activity_hours';
  return value === 'provider_resting_energy' || value === 'historical_low_activity_hours' || value === 'historical_daily_basal' ? value : null;
}
export function qualifiedRestingModelProvenance(model: { provider: string; evidenceType: string }): boolean {
  if (!canonicalRestingEvidenceType(model.evidenceType)) return false;
  return model.provider !== 'google_health_fitbit' || model.evidenceType !== 'historical_low_activity_hours';
}
export function reusableGoogleLowActivityModel(model: { provider: string; evidenceType: string; calculatedAt: Date; providerKcalPerHour: number; observationCount: number } | null, now: Date): boolean {
  if (!model || model.provider !== 'google_health_fitbit' || model.evidenceType !== GOOGLE_LOW_ACTIVITY_EVIDENCE_V2) return false;
  const age = now.getTime() - model.calculatedAt.getTime();
  return Number.isFinite(age) && age >= 0 && age < 7 * 86_400_000 && Number.isFinite(model.providerKcalPerHour) && model.providerKcalPerHour > 0 && model.observationCount >= 3;
}
