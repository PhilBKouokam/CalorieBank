import type { DashboardPreferencesResponse } from '@caloriebank/schemas';
/** New primary planning surface is not the old inferred plain-Steps card.
 * Preserve deliberate customization without writing or migrating server records. */
export function walkingPlanVisible(preferences: Pick<DashboardPreferencesResponse,'showSteps'|'stepsVisibilitySource'> | null) {
  return preferences?.stepsVisibilitySource==='explicit'?preferences.showSteps:true;
}
