import type { TodayResponse } from '@caloriebank/schemas';
/** A coefficient and quiet projection are one versioned planning input. */
export function selectQuietWalkingForecast(today: TodayResponse, now: Date) {
  const q=today.steps.quietWalkingForecast, r=today.restOfDayProjection;
  if (!q || q.status!=='ready' || r.status!=='ready' || r.evidenceType!=='historical_low_activity_hours' ||
    q.baselineModelVersion!==r.modelVersion || q.baselineProviderKcalPerHour!==r.providerKcalPerHour ||
    q.rawProjectedBurnBeforeWalking!==r.unroundedProjectedProviderBurnCalories ||
    q.planningAnchorAt!==r.planningAnchorAt || q.localDate!==today.date || q.timezone!==today.timezone || q.source!==today.steps.source ||
    Date.parse(q.expiresAt)<=now.getTime()) return null;
  return q;
}
