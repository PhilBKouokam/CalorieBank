import { z } from 'zod';
import { goalConfigurationResponseSchema, goalConfigurationInputSchema, dailyBankTargetResponseSchema,
  dailyBankTargetInputSchema, plannedTreatGetResponseSchema, plannedTreatInputSchema,
  type GoalConfigurationInput, type PlannedTreatInput } from '@caloriebank/schemas';
import { apiRequest } from './client';

export type SettingSnapshot<T> = { value: T; revision: string };
export class SettingsConflictError extends Error {}
const capability = { 'X-CB-Settings-Concurrency': '1' };
async function read<T>(path: string, schema: z.ZodType<T>, absent?: T): Promise<SettingSnapshot<T>> {
  const response = await apiRequest(path, { headers: capability });
  if (!response.ok && !(response.status === 404 && absent !== undefined)) throw new Error('Unable to load this setting.');
  const revision = response.headers.get('X-CB-Settings-Revision');
  // Fail closed on an older backend; never downgrade a protected editor to unconditional writes.
  if (!revision || !/^(0|[1-9][0-9]{0,18})$/.test(revision)) throw new Error('Settings protection is unavailable.');
  return { value: response.status === 404 ? absent! : schema.parse(await response.json()), revision };
}
async function write(path: string, method: string, revision: string, body?: unknown) {
  if (!/^(0|[1-9][0-9]{0,18})$/.test(revision)) throw new Error('Reload this setting before saving.');
  const response = await apiRequest(path, { method,
    headers: { ...capability, 'If-Match': `"${revision}"` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 409) {
    const error = await response.json();
    if (error?.error?.details?.code === 'SETTINGS_CONFLICT') throw new SettingsConflictError('This setting changed elsewhere.');
  }
  if (!response.ok) throw new Error('Unable to save this setting.');
  return response;
}
export const fetchProtectedGoal = () => read('/v1/me/goal-configuration', goalConfigurationResponseSchema.nullable(), null);
export const fetchProtectedTarget = () => read('/v1/me/daily-bank-target', dailyBankTargetResponseSchema);
export const fetchProtectedTreat = () => read('/v1/me/planned-treat', plannedTreatGetResponseSchema);
export async function saveProtectedGoal(input: GoalConfigurationInput, revision: string) {
  return goalConfigurationResponseSchema.parse(await (await write('/v1/me/goal-configuration', 'PUT', revision, goalConfigurationInputSchema.parse(input))).json());
}
export async function saveProtectedTarget(calories: number, revision: string) {
  return dailyBankTargetResponseSchema.parse(await (await write('/v1/me/daily-bank-target', 'PUT', revision, dailyBankTargetInputSchema.parse({ calories }))).json());
}
export async function saveProtectedTreat(input: PlannedTreatInput, revision: string) {
  return plannedTreatGetResponseSchema.parse(await (await write('/v1/me/planned-treat', 'POST', revision, plannedTreatInputSchema.parse(input))).json());
}
export async function deleteProtectedTreat(revision: string) { await write('/v1/me/planned-treat', 'DELETE', revision); }
