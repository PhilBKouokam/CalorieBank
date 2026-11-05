import { z } from 'zod';
import { attributionProvidersSchema } from './attribution';
const integer = z.number().int().safe();
const comparison = z.object({ kind: z.enum(['remaining_today', 'estimated_day_difference']), calories: integer }).strict();
export const eatPlanningRequestSchema = z.discriminatedUnion('direction', [
  z.object({ direction: z.literal('steps_to_intake'), totalSteps: integer.nonnegative() }).strict(),
  z.object({ direction: z.literal('intake_to_steps'), totalIntakeCalories: integer.nonnegative() }).strict(),
]);
export const eatingBudgetResponseSchema = z.object({
  guidanceContextVersion:z.string().regex(/^g1:[a-f0-9]{64}$/).nullable().optional(),
  version: z.literal(1), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1),
  signedGoalAdjustmentCalories: integer.nullable(), dailyBankTargetCalories: integer.min(0).max(2000),
  intake: z.object({ attributionProviders: attributionProvidersSchema.optional(), calories: integer.nonnegative().nullable(), semantic: z.enum(['observed_current_day_intake', 'estimated_total_day_intake', 'unknown']) }).strict(),
  budget: z.discriminatedUnion('status', [
    z.object({ status: z.literal('unavailable'), reason: z.string().min(1) }).strict(),
    z.object({ status: z.enum(['ready', 'non_positive']), estimated: z.literal(true), totalCalories: integer,
      comparison: comparison.nullable(), expiresAt: z.string().datetime(), comparisonExpiresAt: z.string().datetime().nullable() }).strict(),
  ]),
  expenditure: z.object({
    rawCalories: integer.nonnegative().nullable(), adjustedCalories: integer.nonnegative().nullable(),
    source: z.string().min(1).nullable(), lastSyncedAt: z.string().datetime().nullable(),
    status: z.enum(['unavailable', 'not_connected', 'syncing', 'partial', 'stale', 'ready', 'error']),
    coverage: z.enum(['verified', 'unverified']),
  }).strict().optional(),
  planningModel:z.object({basis:z.literal('matched_total_above_selected_quiet'),baselineModelVersion:z.string().min(1),calibrationVersion:z.string().min(1),expiresAt:z.string().datetime(),coverageAt:z.string().datetime(),currentSteps:integer.nonnegative(),rawProviderCaloriesPerAdditionalStep:z.number().positive(),stepsPerMinute:z.number().positive()}).strict().nullable().optional(),
  planningAvailable: z.boolean(),
  planningUnavailableReason:z.string().min(1).nullable().optional(),
}).strict();
export const eatPlanningResponseSchema = z.object({
  snapshot: eatingBudgetResponseSchema,
  version: z.literal(1), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1),
  plan: z.discriminatedUnion('status', [
    z.object({ status: z.literal('unavailable'), reason: z.string().min(1) }).strict(),
    z.object({ status: z.literal('ready'), hypothetical: z.literal(true), totalIntakeCalories: integer.positive(),
      totalSteps: integer.nonnegative(), additionalSteps: integer.nonnegative(), expiresAt: z.string().datetime() }).strict(),
  ]),
}).strict();
export type EatingBudgetResponse = z.infer<typeof eatingBudgetResponseSchema>;
export type EatPlanningRequest = z.infer<typeof eatPlanningRequestSchema>;
export type EatPlanningResponse = z.infer<typeof eatPlanningResponseSchema>;
