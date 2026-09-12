import type { QualificationReport, SourceIdentity } from '../native-health/evidence';

import { nativeIntakeSourceName } from '@caloriebank/schemas';

export type FoodOrigin = { source: SourceIdentity; displayName: string };

export function foodOriginName(packageId: string): string {
  return nativeIntakeSourceName(packageId);
}

/** Call with a nutrition-only report; activity origins are not food discovery. */
export function discoverFoodOrigins(
  report: QualificationReport,
  connections: readonly { provider: string; status: string }[],
): FoodOrigin[] {
  if (report.readConsistency !== 'stable_read' || report.state !== 'complete' ||
      !report.access.granted.includes('nutrition') ||
      Object.entries(report.counts).some(([category, count]) => category !== 'nutrition' && count > 0)) return [];
  const directFatSecret = connections.some((c) => c.provider === 'fatsecret' && c.status === 'connected');
  return [...new Set(report.origins.map((s) => s.id))]
    .filter((id) => !directFatSecret || id !== 'com.fatsecret.android')
    .map((id): FoodOrigin => ({ source: { namespace: 'android_package', id }, displayName: foodOriginName(id) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.source.id.localeCompare(b.source.id));
}
