/** Deliberate transport boundary: this module never imports the real API client. */
import type { IntakeAdjustmentMutation } from '@caloriebank/schemas';
export class SettingsConflictError extends Error {}
export class ApiHttpError extends Error { kind = 'synthetic'; }
const scenario = new URLSearchParams(location.search).get('state');
async function response<T>(value: T): Promise<T> {
  if (scenario === 'error') throw new ApiHttpError('Synthetic provider error');
  if (scenario === 'loading') return new Promise<T>(() => {});
  return value;
}
export const fetchProtectedTarget = () => response({ value: { calories: scenario === 'large' ? 2000 : 200 }, revision: 'synthetic-r1' });
export const saveProtectedTarget = (_calories: number, _revision: string) => response(undefined);
export const saveIntakeAdjustment = (_input: IntakeAdjustmentMutation) => response(undefined);
