import { getLocalDateUtcBounds, V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE } from './index';

const hourMs = 3_600_000;
const finiteTime = (time: Date) => Number.isFinite(time.getTime());
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const stepCount = (value: number) => Number.isSafeInteger(value) && value >= 0;

type Window = { start: Date; end: Date };
type Source = { accountId: string; sourceId: string; timezone: string };
const sameSource = (left: Source, right: Source) =>
  Boolean(left.accountId && left.sourceId) && left.accountId === right.accountId &&
  left.sourceId === right.sourceId && left.timezone === right.timezone;
const validWindow = ({ start, end }: Window) => finiteTime(start) && finiteTime(end) && start < end;
const overlaps = (left: Window, right: Window) => left.start < right.end && right.start < left.end;

/** All inputs describe one authoritative stream. The recorded-session proxy
 * uses matched reported buckets and cannot identify every unrecorded walk. */
export type OrdinaryForecastHistory = Source & {
  retrievedAt: Date;
  basis: 'classified_activity' | 'recorded_sessions_proxy';
  sessionCoverage?: 'overlaps_complete' | 'start_window_only';
  exerciseCoverage: Window;
  exercises: readonly Window[];
  hours: readonly (Window & {
    rawTotalKcal: number;
    steps?: number;
    coverage: 'complete' | 'reported_interval' | 'unknown';
    classification: 'ordinary' | 'walk_run_or_workout' | 'unknown';
  })[];
};

export type OrdinaryForecastObservation = Source & {
  localDate: string;
  cutoff: Date;
  expiresAt: Date;
  rawProviderKcal: number;
  currentSteps: number;
} & (
  | { coverage: 'reported_reference' | 'unknown' }
  | {
      /** Independently supported shared cutoff for cumulative calories and steps. */
      coverage: 'verified';
      stepsAtCutoff: number;
      activityThrough: Date;
      activityCoverage: 'verified' | 'unknown';
      ordinaryStepsAfterCutoff: number;
      activity: readonly (Window & { steps: number } & (
        | { kind: 'walking' }
        | { kind: 'other'; rawGrossKcal: number }
      ))[];
    }
);

export type OrdinaryWalkingCalibration = Source & { expiresAt: Date; stepsPerMinute: number } & (
  | { energyBasis: 'matched_total_interval'; rawGrossWalkingKcalPerStep: number }
  | { energyBasis: 'qualified_basal_plus_active'; rawNetWalkingKcalPerStep: number; rawRestKcalPerHour: number }
);

function previousDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Pools energy and elapsed duration from eligible hours in the five immediately
 * preceding completed civil days. Exercise intersections exclude the whole hour
 * because the hourly calorie total cannot be split safely. */
export function estimateFiveDayOrdinaryRate(input: Source & {
  localDate: string;
  now: Date;
  history: OrdinaryForecastHistory;
}) {
  const { history, localDate, timezone, now } = input;
  const today = getLocalDateUtcBounds(localDate, timezone);
  if (!sameSource(input, history) || !finiteTime(now) || now < today.start || now >= today.end ||
    !finiteTime(history.retrievedAt) || history.retrievedAt < today.start || history.retrievedAt > now) return null;

  const firstDay = previousDate(localDate, 5);
  const start = getLocalDateUtcBounds(firstDay, timezone).start;
  if (!validWindow(history.exerciseCoverage) || history.exerciseCoverage.start > start ||
    history.exerciseCoverage.end < today.start || history.exercises.some(exercise => !validWindow(exercise))) return null;

  const hours = new Map(history.hours.map(hour => [hour.start.getTime(), hour]));
  if (hours.size !== history.hours.length) return null;
  let totalMs = 0;
  let matchedMs = 0;
  let includedMs = 0;
  let rawKcal = 0;
  for (let offset = 5; offset > 0; offset--) {
    const bounds = getLocalDateUtcBounds(previousDate(localDate, offset), timezone);
    const midpoint = (bounds.start.getTime() + bounds.end.getTime()) / 2;
    let dayIncludedMs = 0;
    let firstHalf = false;
    let secondHalf = false;
    for (let from = bounds.start.getTime(); from < bounds.end.getTime(); from += hourMs) {
      const to = Math.min(from + hourMs, bounds.end.getTime());
      const elapsed = to - from;
      totalMs += elapsed;
      const hour = hours.get(from);
      if (!hour) continue;
      hours.delete(from);
      if (hour.end.getTime() !== to || !nonnegative(hour.rawTotalKcal)) return null;
      if (hour.coverage === 'unknown' ||
        (history.basis === 'classified_activity' && hour.coverage !== 'complete')) continue;
      const nonactivityExcluded = history.basis === 'recorded_sessions_proxy' &&
        (!Number.isSafeInteger(hour.steps) || hour.steps! < 0 || hour.steps! > 100 * elapsed / hourMs);
      const excluded = nonactivityExcluded || hour.classification === 'walk_run_or_workout' ||
        history.exercises.some(exercise => overlaps(exercise, hour));
      if (!excluded && hour.classification === 'unknown' && history.basis === 'classified_activity') continue;
      matchedMs += elapsed;
      if (excluded) continue;
      dayIncludedMs += elapsed;
      firstHalf ||= from < midpoint;
      secondHalf ||= to > midpoint;
      rawKcal += hour.rawTotalKcal;
    }
    // Initial representativeness rule. Missing hours never count as zero.
    if (dayIncludedMs < (bounds.end.getTime() - bounds.start.getTime()) / 2 || !firstHalf || !secondHalf) return null;
    includedMs += dayIncludedMs;
  }
  if (hours.size || !Number.isFinite(rawKcal) || rawKcal <= 0) return null;
  const includedHours = includedMs / hourMs;
  return {
    rawOrdinaryKcalPerHour: rawKcal / includedHours, rawKcal, includedHours,
    excludedHours: (matchedMs - includedMs) / hourMs, missingHours: (totalMs - matchedMs) / hourMs,
    basis: history.basis, sessionCoverage: history.sessionCoverage ?? 'overlaps_complete', firstDay, through: today.start,
  };
}

export function qualifyOrdinaryStepForecast(input: Source & {
  localDate: string;
  now: Date;
  history: OrdinaryForecastHistory;
  observation: OrdinaryForecastObservation;
  calibration: OrdinaryWalkingCalibration;
}) {
  const { observation: observed, calibration, localDate, timezone, now } = input;
  const { start, end } = getLocalDateUtcBounds(localDate, timezone);
  const history = estimateFiveDayOrdinaryRate(input);
  if (!history) return { status: 'unavailable', reason: 'unqualified_history' } as const;

  if (!sameSource(input, observed) || observed.localDate !== localDate ||
    observed.coverage === 'unknown' ||
    !finiteTime(observed.cutoff) || observed.cutoff < start || observed.cutoff > now ||
    !finiteTime(observed.expiresAt) || observed.expiresAt <= now ||
    now.getTime() - observed.cutoff.getTime() >= 30 * 60_000 ||
    !nonnegative(observed.rawProviderKcal) || !stepCount(observed.currentSteps)) {
    return { status: 'unavailable', reason: 'unqualified_current_coverage' } as const;
  }

  const pace = calibration.stepsPerMinute;
  const qualifiedBasal = calibration.energyBasis === 'qualified_basal_plus_active'
    && Number.isFinite(calibration.rawRestKcalPerHour) && calibration.rawRestKcalPerHour > 0
    && Number.isFinite(calibration.rawNetWalkingKcalPerStep) && calibration.rawNetWalkingKcalPerStep > 0;
  const grossPerStep = calibration.energyBasis === 'matched_total_interval' ? calibration.rawGrossWalkingKcalPerStep
    : qualifiedBasal ? calibration.rawNetWalkingKcalPerStep + calibration.rawRestKcalPerHour / (pace * 60) : NaN;
  if (!sameSource(input, calibration) || !finiteTime(calibration.expiresAt) || calibration.expiresAt <= now ||
    !Number.isFinite(grossPerStep) || grossPerStep <= 0 || !Number.isFinite(pace) || pace < 10 || pace > 250) {
    return { status: 'unavailable', reason: 'unqualified_calibration' } as const;
  }
  const ordinary = history.rawOrdinaryKcalPerHour;
  const rawIncrementalKcalPerStep = grossPerStep - ordinary / (pace * 60);
  if (rawIncrementalKcalPerStep <= 0 || !Number.isFinite(rawIncrementalKcalPerStep)) {
    return { status: 'unavailable', reason: 'walking_does_not_support_target' } as const;
  }

  let incurredActivityReplacementKcal = 0;
  if (observed.coverage === 'verified') {
    if (observed.activityCoverage !== 'verified' || !finiteTime(observed.activityThrough) ||
      observed.activityThrough < observed.cutoff || observed.activityThrough > now ||
      !stepCount(observed.stepsAtCutoff) || !stepCount(observed.ordinaryStepsAfterCutoff)) {
      return { status: 'unavailable', reason: 'unqualified_current_coverage' } as const;
    }
    let uncoveredSteps = observed.ordinaryStepsAfterCutoff;
    let lastEnd = observed.cutoff;
    for (const activity of [...observed.activity].sort((left, right) => left.start.getTime() - right.start.getTime())) {
      if (!validWindow(activity) || activity.start < start || activity.end > observed.activityThrough || !stepCount(activity.steps)) {
        return { status: 'unavailable', reason: 'unqualified_activity_intervals' } as const;
      }
      if (activity.end <= observed.cutoff) continue;
      if (activity.start < lastEnd) return { status: 'unavailable', reason: 'unqualified_activity_intervals' } as const;
      const hours = (activity.end.getTime() - activity.start.getTime()) / hourMs;
      const gross = activity.kind === 'walking' ? grossPerStep * activity.steps : activity.rawGrossKcal;
      if (!nonnegative(gross)) return { status: 'unavailable', reason: 'unqualified_activity_intervals' } as const;
      // Replace the ordinary estimate for those minutes, rather than adding gross
      // activity or treating walking net above rest as net above ordinary activity.
      incurredActivityReplacementKcal += gross - ordinary * hours;
      uncoveredSteps += activity.steps;
      lastEnd = activity.end;
    }
    if (uncoveredSteps !== observed.currentSteps - observed.stepsAtCutoff) {
      return { status: 'unavailable', reason: 'unqualified_current_coverage' } as const;
    }
  }

  const elapsedOrdinaryKcal = ordinary * (now.getTime() - observed.cutoff.getTime()) / hourMs;
  const futureOrdinaryKcal = ordinary * (end.getTime() - now.getTime()) / hourMs;
  const projectedRaw = observed.rawProviderKcal + ordinary * (end.getTime() - observed.cutoff.getTime()) / hourMs +
    incurredActivityReplacementKcal;
  if (!nonnegative(projectedRaw)) return { status: 'unavailable', reason: 'unqualified_activity_intervals' } as const;
  return {
    status: 'ready', history, observationBasis: observed.coverage, elapsedOrdinaryKcal, futureOrdinaryKcal, incurredActivityReplacementKcal,
    stepsPerMinute: pace,
    expiresAt: new Date(Math.min(end.getTime(), observed.expiresAt.getTime(), observed.cutoff.getTime() + 30 * 60_000, calibration.expiresAt.getTime())),
    plannerInput: {
      currentSteps: observed.currentSteps,
      // The legacy calculator's baseline field is planning-only. Here it includes ordinary activity.
      projectedProviderBurnAtRest: projectedRaw,
      providerCaloriesPerStep: rawIncrementalKcalPerStep,
      adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
    },
  } as const;
}
