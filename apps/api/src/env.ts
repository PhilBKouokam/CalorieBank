import 'dotenv/config';

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1).default('*'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://caloriebank:caloriebank@localhost:5432/caloriebank'),
  DEV_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  DEV_USER_EMAIL: z.string().email().default('developer@caloriebank.local'),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Invalid API environment configuration',
      issues: parsedEnv.error.flatten().fieldErrors,
    }),
  );
  process.exit(1);
}

export const env = parsedEnv.data;
export type ApiEnv = typeof env;
