/** Reader-only rollout bridge. This does not qualify legacy producers or mint v2 rows. */
export function canonicalRestingEvidenceType(value: string): 'provider_resting_energy' | 'historical_low_activity_hours' | 'historical_daily_basal' | null {
  if (value === 'historical_low_activity_hours_v2') return 'historical_low_activity_hours';
  return value === 'provider_resting_energy' || value === 'historical_low_activity_hours' || value === 'historical_daily_basal' ? value : null;
}
