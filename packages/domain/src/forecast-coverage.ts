import { getLocalDateUtcBounds } from './index';

export type ForecastEvidence = {
  provider: string;
  localDate: string;
  timezone: string;
  rawTotalDailyExpenditure: number;
  activeEnergyCalories?: number | null;
  basalEnergyCalories?: number | null;
  forecastCoverageAt?: Date | null;
};

/** Retention is not a claim that unchanged totals prove new coverage. */
export function resolveForecastCoverage(previous: ForecastEvidence | null, incoming: ForecastEvidence, retrievedAt: Date): Date | null {
  const bounds = getLocalDateUtcBounds(incoming.localDate, incoming.timezone);
  const valid = (date: Date) => Number.isFinite(date.getTime()) && date >= bounds.start && date <= bounds.end && date <= retrievedAt;
  if (incoming.forecastCoverageAt) return valid(incoming.forecastCoverageAt) ? incoming.forecastCoverageAt : null;
  if (previous?.forecastCoverageAt && valid(previous.forecastCoverageAt) &&
    previous.provider === incoming.provider && previous.localDate === incoming.localDate && previous.timezone === incoming.timezone &&
    previous.rawTotalDailyExpenditure === incoming.rawTotalDailyExpenditure &&
    (previous.activeEnergyCalories ?? null) === (incoming.activeEnergyCalories ?? null) &&
    (previous.basalEnergyCalories ?? null) === (incoming.basalEnergyCalories ?? null)) {
    return previous.forecastCoverageAt;
  }
  return null;
}

/** Exact deadline duration: rounded day minutes are not a feasibility clock. */
export function walkingMidnightFeasibility(input: {
  remainingSteps: number; stepsPerMinute: number | null; localDate: string; timezone: string; now: Date;
}): 'fits' | 'insufficient_time' | 'unknown' {
  if (!Number.isFinite(input.remainingSteps) || input.remainingSteps < 0) return 'unknown';
  if (input.remainingSteps === 0) return 'fits';
  const pace = input.stepsPerMinute;
  if (pace === null || !Number.isFinite(pace) || pace < 10 || pace > 250) return 'unknown';
  const { start, end } = getLocalDateUtcBounds(input.localDate, input.timezone);
  if (!Number.isFinite(input.now.getTime()) || input.now < start) return 'unknown';
  return input.remainingSteps / pace <= Math.max(0, (end.getTime() - input.now.getTime()) / 60000)
    ? 'fits' : 'insufficient_time';
}

export type PlanningAnchorKind = 'verified_coverage' | 'sample_horizon' | 'reported_interval' | 'retrieval_assumption';
export type PlanningEvidence = ForecastEvidence & {
  retrievedAt?: Date | null;
  activeSampleEndAt?: Date | null;
  basalSampleEndAt?: Date | null;
  reportedIntervalEndAt?: Date | null;
};
export type PersistedPlanningEvidence = PlanningEvidence & {
  planningAnchorAt?: Date | null;
  planningExpiresAt?: Date | null;
  planningProgressAt?: Date | null;
  planningAnchorKind?: string | null;
};

/** An assumption is useful for planning, never proof of complete provider synchronization.
 * Neither a changed calorie value nor a successful fetch renews its lifetime.
 * Progress is a high-water mark so replaying an older correction cannot renew it later.
 */
export function resolvePlanningEvidence(previous: PersistedPlanningEvidence | null, incoming: PlanningEvidence, receivedAt: Date) {
  const { start, end } = getLocalDateUtcBounds(incoming.localDate, incoming.timezone);
  const retrievedAt = incoming.retrievedAt ?? receivedAt;
  const valid = (date: Date) => Number.isFinite(date.getTime()) && date >= start && date <= end && date <= retrievedAt;
  const rawDates = [incoming.forecastCoverageAt, incoming.activeSampleEndAt, incoming.basalSampleEndAt, incoming.reportedIntervalEndAt];
  const invalid = !valid(retrievedAt) || retrievedAt > receivedAt || rawDates.some(date => date != null && !valid(date));
  const sampleDates = [incoming.activeSampleEndAt, incoming.basalSampleEndAt].filter((date): date is Date => date != null && valid(date));
  const sample = sampleDates.length ? new Date(Math.max(...sampleDates.map(date => date.getTime()))) : null;
  const temporal = incoming.forecastCoverageAt ?? sample ?? incoming.reportedIntervalEndAt ?? null;
  const kind: PlanningAnchorKind = incoming.forecastCoverageAt ? 'verified_coverage' : sample ? 'sample_horizon' : incoming.reportedIntervalEndAt ? 'reported_interval' : 'retrieval_assumption';
  const sameIdentity = previous?.provider === incoming.provider && previous.localDate === incoming.localDate;
  const prior = sameIdentity ? previous : null;
  const priorAnchor = prior?.planningAnchorAt ?? prior?.forecastCoverageAt ?? null;
  const priorExpiry = prior?.planningExpiresAt ?? (priorAnchor ? new Date(priorAnchor.getTime() + 30 * 60000) : null);
  const priorProgress = prior?.planningProgressAt ?? prior?.forecastCoverageAt ?? null;
  const unchanged = prior?.timezone === incoming.timezone && prior.rawTotalDailyExpenditure === incoming.rawTotalDailyExpenditure &&
    (prior.activeEnergyCalories ?? null) === (incoming.activeEnergyCalories ?? null) && (prior.basalEnergyCalories ?? null) === (incoming.basalEnergyCalories ?? null);
  const progress = !invalid && temporal && (!priorProgress || temporal > priorProgress);
  const ttl = (anchor: Date) => new Date(Math.min(end.getTime(), anchor.getTime() + 30 * 60000));
  let planningAnchorAt = priorAnchor ?? retrievedAt;
  let planningExpiresAt = priorExpiry ?? ttl(retrievedAt);
  let planningAnchorKind = (prior?.planningAnchorKind ?? (prior?.forecastCoverageAt ? 'verified_coverage' : 'retrieval_assumption')) as PlanningAnchorKind;
  if (invalid) {
    // Reject future/out-of-window metadata without failing authoritative accounting ingestion.
    planningExpiresAt = new Date(Math.min(planningExpiresAt.getTime(), receivedAt.getTime() - 1));
  } else if (progress) {
    planningAnchorAt = temporal;
    planningAnchorKind = kind;
    planningExpiresAt = ttl(temporal);
  } else if (temporal) {
    // Corrections at a known horizon re-evaluate values but cannot extend freshness.
    planningAnchorAt = temporal;
    planningAnchorKind = kind;
    planningExpiresAt = new Date(Math.min(planningExpiresAt.getTime(), ttl(temporal).getTime()));
  } else if (!unchanged && priorAnchor) {
    // Unknown-timing revision: avoid appending rest over newly included expenditure.
    // This is explicitly an assumption; the original expiry still applies.
    planningAnchorAt = retrievedAt;
    planningAnchorKind = 'retrieval_assumption';
  }
  return {
    retrievedAt,
    activeSampleEndAt: incoming.activeSampleEndAt && valid(incoming.activeSampleEndAt) ? incoming.activeSampleEndAt : null,
    basalSampleEndAt: incoming.basalSampleEndAt && valid(incoming.basalSampleEndAt) ? incoming.basalSampleEndAt : null,
    reportedIntervalEndAt: incoming.reportedIntervalEndAt && valid(incoming.reportedIntervalEndAt) ? incoming.reportedIntervalEndAt : null,
    planningAnchorAt, planningExpiresAt, planningAnchorKind,
    planningProgressAt: progress ? temporal : priorProgress,
  };
}
