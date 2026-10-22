import type { PrismaClient } from '@prisma/client';
import type { ApiEnv } from '../env';

/** The only trusted non-Clerk bootstrap, shared by local startup and HTTP auth. */
export async function bootstrapLocalDevelopmentAccount(db: Pick<PrismaClient, 'user'>, config: ApiEnv, requestedTimezone: unknown = 'UTC') {
  if (config.APP_ENV !== 'local' || config.AUTH_MODE !== 'development') {
    throw new Error('Development identity is restricted to explicit local development authentication.');
  }
  let timezone = 'UTC';
  if (typeof requestedTimezone === 'string' && requestedTimezone.length <= 100) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: requestedTimezone }).format(); timezone = requestedTimezone; }
    catch { /* The HTTP boundary validates invalid input separately. */ }
  }
  await db.user.upsert({ where: { id: config.DEV_USER_ID }, update: {}, create: {
    id: config.DEV_USER_ID, email: config.DEV_USER_EMAIL, profile: { create: { timezone } },
  } });
}
