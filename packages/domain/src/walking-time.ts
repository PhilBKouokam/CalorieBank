export type WalkingTimeSample = {
  id: string;
  provider: string;
  activityType: string;
  startedAt: Date;
  durationMinutes: number;
  steps: number;
};

export type WalkingTimeEstimate = {
  sampleCount: number;
  stepsPerMinute: number;
  totalMinutes: number;
  sessionCount: number;
  minutesPerSession: number;
};

/** Planning only: no calorie or accounting inputs participate in this model. */
export function estimateWalkingTime(
  remainingSteps: number,
  samples: readonly WalkingTimeSample[],
  context: { provider: string; now: Date },
): WalkingTimeEstimate | null {
  if (!Number.isFinite(remainingSteps) || remainingSteps <= 0) return null;
  const now = context.now.getTime();
  if (!Number.isFinite(now)) return null;
  const oldest = now - 30 * 24 * 60 * 60 * 1_000;
  const seen = new Set<string>();
  const valid = samples
    .filter((sample) => {
      const time = sample.startedAt.getTime();
      const pace = sample.steps / sample.durationMinutes;
      return sample.provider === context.provider && sample.activityType === 'walking'
        && sample.id.length > 0 && Number.isFinite(time) && time >= oldest && time <= now
        && Number.isFinite(sample.durationMinutes) && sample.durationMinutes > 0
        && time + sample.durationMinutes * 60_000 <= now
        && Number.isFinite(sample.steps) && sample.steps > 0
        && Number.isFinite(pace) && pace >= 10 && pace <= 250;
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .filter((sample) => {
      if (seen.has(sample.id)) return false;
      seen.add(sample.id);
      return true;
    })
    .slice(0, 5);
  if (valid.length < 2) return null;
  const paces = valid.map((sample) => sample.steps / sample.durationMinutes).sort((a, b) => a - b);
  const middle = Math.floor(paces.length / 2);
  const stepsPerMinute = paces.length % 2 === 0
    ? (paces[middle - 1]! + paces[middle]!) / 2
    : paces[middle]!;
  return walkingTimeFromPace(remainingSteps, stepsPerMinute, valid.length);
}

export function walkingTimeFromPace(remainingSteps: number, stepsPerMinute: number, sampleCount: number): WalkingTimeEstimate | null {
  if (!Number.isFinite(remainingSteps) || remainingSteps <= 0 || !Number.isFinite(stepsPerMinute)
    || stepsPerMinute < 10 || stepsPerMinute > 250 || sampleCount < 2 || sampleCount > 5) return null;
  const totalMinutes = remainingSteps / stepsPerMinute;
  // Omit extreme requests rather than rendering an implausible all-day walking plan.
  if (!Number.isFinite(totalMinutes) || totalMinutes > 24 * 60) return null;
  const sessionCount = Math.ceil(totalMinutes / 25);
  return {
    sampleCount,
    stepsPerMinute,
    totalMinutes,
    sessionCount,
    minutesPerSession: Math.min(25, Math.max(1, Math.ceil(totalMinutes / sessionCount))),
  };
}
