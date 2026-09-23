import { z } from 'zod';

// Technical payload bounds, not recommendations or medical judgments.
export const manualCaloriesSchema = z.number().int().min(0).max(100_000);
export const usualEstimateSchema = manualCaloriesSchema.min(1);
export const manualIntakeMutationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('select'), calories: usualEstimateSchema, expectedRevision: z.number().int().nonnegative(), selectionRevision: z.string().datetime().nullable() }).strict(),
  z.object({ operation: z.literal('usual'), calories: usualEstimateSchema, expectedRevision: z.number().int().nonnegative(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  z.object({ operation: z.literal('today'), calories: manualCaloriesSchema, expectedRevision: z.number().int().nonnegative(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  z.object({ operation: z.literal('reset'), expectedRevision: z.number().int().nonnegative(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
]);
export type ManualIntakeMutation = z.infer<typeof manualIntakeMutationSchema>;

export const authoritativeEatenSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calories: manualCaloriesSchema,
  source: z.string().min(1),
  semanticKind: z.enum(['observed_current_day_intake', 'estimated_total_day_intake']),
  evidenceVersion: z.string().min(1),
  updatedAt: z.string().datetime(),
});
export type AuthoritativeEaten = z.infer<typeof authoritativeEatenSchema>;

export const manualEstimateValueSchema = z.object({
  value: authoritativeEatenSchema,
  usualCalories: usualEstimateSchema,
  overridden: z.boolean(),
});
export const manualIntakeStateSchema = z.object({
  selectionEnabled: z.boolean(), selected: z.boolean(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revision: z.number().int().nonnegative(), selectionRevision: z.string().datetime().nullable(),
  estimate: manualEstimateValueSchema.nullable(),
});
export const manualIntakeSaveSchema = manualEstimateValueSchema.extend({ revision: z.number().int().nonnegative() });
export type ManualIntakeState = z.infer<typeof manualIntakeStateSchema>;
