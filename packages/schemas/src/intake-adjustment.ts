import { z } from 'zod';
import { manualCaloriesSchema } from './manual-intake';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const intakeAdjustmentSchema = z.object({
  mode: z.enum(['replace', 'add']), calories: manualCaloriesSchema,
});
export const intakeAdjustmentStateSchema = z.object({
  localDate: date, revision: z.number().int().nonnegative(),
  selectionRevision: z.string().datetime().nullable(), manualRevision: z.number().int().nonnegative(),
  source: z.string(), baseCalories: manualCaloriesSchema.nullable(),
  calories: z.number().int().nonnegative().nullable(),
  adjustment: intakeAdjustmentSchema.nullable(),
});
export type IntakeAdjustmentState = z.infer<typeof intakeAdjustmentStateSchema>;
export const intakeAdjustmentMutationSchema = z.object({
  localDate: date, expectedRevision: z.number().int().nonnegative(),
  selectionRevision: z.string().datetime().nullable(), manualRevision: z.number().int().nonnegative(),
  mode: z.enum(['replace', 'add', 'none']), calories: manualCaloriesSchema,
}).strict();
export type IntakeAdjustmentMutation = z.infer<typeof intakeAdjustmentMutationSchema>;
