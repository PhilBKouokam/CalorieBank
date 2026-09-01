import 'dotenv/config';

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'beta', 'production']).default('local'),
  AUTH_MODE: z.enum(['development', 'clerk']).default('development'),
  CLERK_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  CLERK_SECRET_KEY: z.string().trim().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1).default('*'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://caloriebank:caloriebank@localhost:5432/caloriebank'),
  DEV_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  DEV_USER_EMAIL: z.string().email().default('developer@caloriebank.local'),
  TODAY_INGESTION_MODE: z.enum(['disabled', 'development', 'device']).default('disabled'),
  GOOGLE_HEALTH_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_HEALTH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GOOGLE_HEALTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
  GOOGLE_HEALTH_AUTHORIZATION_URL: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
  GOOGLE_HEALTH_TOKEN_URL: z.string().url().default('https://oauth2.googleapis.com/token'),
  GOOGLE_HEALTH_REVOKE_URL: z.string().url().default('https://oauth2.googleapis.com/revoke'),
  GOOGLE_HEALTH_API_BASE_URL: z.string().url().default('https://health.googleapis.com/v4'),
  WHOOP_CLIENT_ID: z.string().trim().min(1).optional(),
  WHOOP_CLIENT_SECRET: z.string().trim().min(1).optional(),
  WHOOP_REDIRECT_URI: z.string().url().optional(),
  WHOOP_TOKEN_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
  WHOOP_AUTHORIZATION_URL: z.string().url().default('https://api.prod.whoop.com/oauth/oauth2/auth'),
  WHOOP_TOKEN_URL: z.string().url().default('https://api.prod.whoop.com/oauth/oauth2/token'),
  WHOOP_API_BASE_URL: z.string().url().default('https://api.prod.whoop.com/developer/v2'),
  EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
  FATSECRET_CONSUMER_KEY: z.string().trim().min(1).optional(),
  FATSECRET_CONSUMER_SECRET: z.string().trim().min(1).optional(),
  FATSECRET_REDIRECT_URI: z.string().url().optional(),
  FATSECRET_REQUEST_TOKEN_URL: z.string().url().default('https://authentication.fatsecret.com/oauth/request_token'),
  FATSECRET_AUTHORIZE_URL: z.string().url().default('https://authentication.fatsecret.com/oauth/authorize'),
  FATSECRET_ACCESS_TOKEN_URL: z.string().url().default('https://authentication.fatsecret.com/oauth/access_token'),
  FATSECRET_API_BASE_URL: z.string().url().default('https://platform.fatsecret.com/rest'),
}).superRefine((value, context) => {
  if (value.APP_ENV !== 'local' && value.AUTH_MODE !== 'clerk') {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_MODE'],
      message: 'Beta and production environments require Clerk authentication.',
    });
  }
  if (value.APP_ENV !== 'local' && value.CORS_ORIGIN === '*') {
    context.addIssue({
      code: 'custom',
      path: ['CORS_ORIGIN'],
      message: 'Beta and production environments require an explicit CORS origin.',
    });
  }
  if (value.AUTH_MODE === 'clerk' && (!value.CLERK_PUBLISHABLE_KEY || !value.CLERK_SECRET_KEY)) {
    context.addIssue({
      code: 'custom',
      path: ['CLERK_SECRET_KEY'],
      message: 'Clerk publishable and secret keys are required when AUTH_MODE=clerk.',
    });
  }
  if (
    value.AUTH_MODE === 'clerk' &&
    value.CLERK_PUBLISHABLE_KEY &&
    value.CLERK_SECRET_KEY &&
    !(
      (value.CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') && value.CLERK_SECRET_KEY.startsWith('sk_test_')) ||
      (value.CLERK_PUBLISHABLE_KEY.startsWith('pk_live_') && value.CLERK_SECRET_KEY.startsWith('sk_live_'))
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['CLERK_SECRET_KEY'],
      message: 'Clerk publishable and secret keys must belong to the same environment.',
    });
  }
  if (value.APP_ENV !== 'local' && value.TODAY_INGESTION_MODE === 'development') {
    context.addIssue({
      code: 'custom',
      path: ['TODAY_INGESTION_MODE'],
      message: 'Synthetic development ingestion is not allowed outside local development.',
    });
  }
  if (value.APP_ENV !== 'local') {
    for (const key of ['GOOGLE_HEALTH_REDIRECT_URI', 'WHOOP_REDIRECT_URI', 'FATSECRET_REDIRECT_URI'] as const) {
      const redirect = value[key];
      if (redirect && new URL(redirect).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'External provider callbacks require HTTPS outside local development.',
        });
      }
    }
    const requiredProviderValues = [
      'GOOGLE_HEALTH_CLIENT_ID',
      'GOOGLE_HEALTH_CLIENT_SECRET',
      'GOOGLE_HEALTH_REDIRECT_URI',
      'GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY',
      'EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY',
      'FATSECRET_CONSUMER_KEY',
      'FATSECRET_CONSUMER_SECRET',
      'FATSECRET_REDIRECT_URI',
    ] as const;
    for (const key of requiredProviderValues) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required outside local development.`,
        });
      }
    }
    for (const key of ['GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY', 'EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY'] as const) {
      const encoded = value[key];
      if (encoded && Buffer.from(encoded, 'base64').length !== 32) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} must be a base64-encoded 32-byte key.`,
        });
      }
    }
  }
});

export function parseApiEnv(input: NodeJS.ProcessEnv) {
  return EnvSchema.parse(input);
}

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
