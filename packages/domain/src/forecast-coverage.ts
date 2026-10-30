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

/** A reported interval is partial temporal evidence, never complete synchronization.
 * Retrieval alone cannot support a numeric rest projection. Keep its legacy metadata
 * for wire/storage compatibility, but expire it immediately.
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
  const repeatedReportedTotal = kind === 'reported_interval' && unchanged && priorAnchor &&
    prior?.planningAnchorKind !== 'retrieval_assumption';
  const ttl = (anchor: Date) => new Date(Math.min(end.getTime(), anchor.getTime() + 30 * 60000));
  let planningAnchorAt = priorAnchor ?? retrievedAt;
  let planningExpiresAt = priorExpiry ?? ttl(retrievedAt);
  let planningAnchorKind = (prior?.planningAnchorKind ?? (prior?.forecastCoverageAt ? 'verified_coverage' : 'retrieval_assumption')) as PlanningAnchorKind;
  if (invalid) {
    // Reject future/out-of-window metadata without failing authoritative accounting ingestion.
    planningExpiresAt = new Date(Math.min(planningExpiresAt.getTime(), receivedAt.getTime() - 1));
  } else if (repeatedReportedTotal) {
    // A later aggregation bucket with the same cumulative total is not evidence
    // that more resting burn is represented. Keep the value/reference pair and
    // deadline together; do not manufacture a shortfall or renew stale data.
  } else if (kind === 'reported_interval' && temporal && priorProgress && temporal < priorProgress) {
    // An older reported bucket cannot date a revised cumulative total safely.
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
  } else if (unchanged && priorAnchor && prior?.planningAnchorKind !== 'retrieval_assumption') {
    // An optional metadata failure need not discard the same previously dated
    // value. It cannot advance its reference or its original deadline either.
  } else {
    // No measurement/interval reference: neither receipt time nor a changed
    // calorie value tells us how much elapsed rest is already in this total.
    planningAnchorKind = 'retrieval_assumption';
    planningExpiresAt = new Date(Math.min(planningExpiresAt.getTime(), receivedAt.getTime() - 1));
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

/** Planning only. Never feed estimated expenditure back into provider aggregates
 * or accounting. Keeping elapsed and future rest at the same reference proves
 * that clock advancement alone cannot change the full-day baseline.
 */
export function calculateAnchoredRestProjection(input: {
  observedProviderCalories: number; providerRestCaloriesPerHour: number;
  anchor: Date; now: Date; localDate: string; timezone: string;
}) {
  const { start, end } = getLocalDateUtcBounds(input.localDate, input.timezone);
  if (!Number.isInteger(input.observedProviderCalories) || input.observedProviderCalories < 0 ||
    !Number.isFinite(input.providerRestCaloriesPerHour) || input.providerRestCaloriesPerHour <= 0 ||
    !Number.isFinite(input.anchor.getTime()) || !Number.isFinite(input.now.getTime()) ||
    input.anchor < start || input.anchor >= end || input.now < input.anchor || input.now >= end) return null;
  const elapsedRestCalories = input.providerRestCaloriesPerHour * (input.now.getTime() - input.anchor.getTime()) / 3600000;
  const remainingRestCalories = input.providerRestCaloriesPerHour * (end.getTime() - input.now.getTime()) / 3600000;
  return {
    estimatedProviderCaloriesNow: input.observedProviderCalories + elapsedRestCalories,
    elapsedRestCalories, remainingRestCalories,
    // Calculate directly from the anchor to avoid cancellation/rounding drift.
    unroundedProjectedProviderBurnCalories: input.observedProviderCalories +
      input.providerRestCaloriesPerHour * (end.getTime() - input.anchor.getTime()) / 3600000,
  };
}
