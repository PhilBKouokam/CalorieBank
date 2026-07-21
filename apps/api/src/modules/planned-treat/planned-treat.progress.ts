export type PlannedTreatProgress = {
  progressCalories: number;
  remainingCalories: number;
  progressRatio: number;
  progressPercent: number;
  status: 'saving' | 'ready';
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function derivePlannedTreatProgress(
  availableBankCalories: number,
  requiredCalories: number,
): PlannedTreatProgress {
  if (!Number.isInteger(availableBankCalories)) {
    throw new Error('Available bank calories must be an integer.');
  }
  if (!Number.isInteger(requiredCalories) || requiredCalories <= 0) {
    throw new Error('Required calories must be a positive integer.');
  }

  const progressCalories = Math.max(availableBankCalories, 0);
  const progressRatio = clamp(availableBankCalories / requiredCalories, 0, 1);

  return {
    progressCalories,
    remainingCalories: Math.max(requiredCalories - progressCalories, 0),
    progressRatio,
    progressPercent: Math.round(progressRatio * 100),
    status: availableBankCalories >= requiredCalories ? 'ready' : 'saving',
  };
}
