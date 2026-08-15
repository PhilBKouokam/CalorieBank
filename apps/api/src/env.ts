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
  TODAY_INGESTION_MODE: z.enum(['disabled', 'development', 'device']).default('disabled'),
  FITBIT_CLIENT_ID: z.string().trim().min(1).optional(),
  FITBIT_CLIENT_SECRET: z.string().trim().min(1).optional(),
  FITBIT_REDIRECT_URI: z.string().url().optional(),
  FITBIT_TOKEN_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
  FITBIT_AUTHORIZATION_URL: z.string().url().default('https://www.fitbit.com/oauth2/authorize'),
  FITBIT_TOKEN_URL: z.string().url().default('https://api.fitbit.com/oauth2/token'),
  FITBIT_API_BASE_URL: z.string().url().default('https://api.fitbit.com'),
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
