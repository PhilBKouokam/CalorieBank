import 'dotenv/config';

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1).default('*'),
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
