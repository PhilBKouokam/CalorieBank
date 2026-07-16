import { z } from 'zod';

export const goalModeSchema = z.enum(['cut', 'maintain', 'bulk']);

export const dailyTargetSchema = z.object({
  goalMode: goalModeSchema,
  calories: z.number().int().positive(),
  timezone: z.string().min(1),
});

export type DailyTargetInput = z.infer<typeof dailyTargetSchema>;
