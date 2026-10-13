/** One explicit daily correction, never a sum of connected providers. Missing is not zero. */
export function adjustedIntakeCalories(base: number | null, adjustment: { mode: 'replace' | 'add'; calories: number } | null): number | null {
  if (!adjustment) return base;
  if (!Number.isSafeInteger(adjustment.calories) || adjustment.calories < 0 || adjustment.calories > 100000) throw new Error('Invalid intake adjustment.');
  if (adjustment.mode === 'replace') return adjustment.calories;
  return base === null ? null : base + adjustment.calories;
}
