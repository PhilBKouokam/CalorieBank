import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';

export const GOOGLE_HEALTH_UNAVAILABLE_MESSAGE = "Google Health connection isn't available yet.";
export const GOOGLE_HEALTH_ADMISSION_CODE = 'GOOGLE_HEALTH_NOT_AVAILABLE';

const member = z.object({
  accountId: z.string().uuid(),
  clerkSubject: z.string().min(1).max(256),
  healthUserIds: z.array(z.string().min(1).max(512)).min(1).max(20),
}).strict();
const cohort = z.object({ version: z.literal(1), members: z.array(member).max(100) }).strict();

/** Configuration is server-only. Never include its contents in validation errors. */
export function parseGoogleHealthTesterCohort(raw: string) {
  try {
    if (raw.length > 100000) return null;
    const parsed = cohort.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const rows = parsed.data.members;
    if (new Set(rows.map(row => row.accountId)).size !== rows.length
      || new Set(rows.map(row => row.clerkSubject)).size !== rows.length
      || rows.some(row => new Set(row.healthUserIds).size !== row.healthUserIds.length)) return null;
    return parsed.data;
  } catch { return null; }
}

function unavailable(): never {
  throw new AppError(GOOGLE_HEALTH_UNAVAILABLE_MESSAGE, 403, { code: GOOGLE_HEALTH_ADMISSION_CODE });
}

/** Enrollment/reconnection only. Existing token refresh and ingestion do not call
 * this guard and never derive authority from cohort membership. Deletion cleanup
 * stays available. Missing hosted configuration denies all new authorization.
 * Exact account + Clerk subject prevents same-email signup/stale-ID admission.
 */
export async function requireGoogleHealthTester(
  db: Pick<Prisma.TransactionClient, 'user'>,
  config: Pick<ApiEnv, 'APP_ENV' | 'GOOGLE_HEALTH_TESTER_COHORT_JSON'>,
  accountId: string,
  healthUserId?: string,
) {
  if (config.APP_ENV === 'local' && config.GOOGLE_HEALTH_TESTER_COHORT_JSON === undefined) return;
  const policy = config.GOOGLE_HEALTH_TESTER_COHORT_JSON === undefined
    ? null : parseGoogleHealthTesterCohort(config.GOOGLE_HEALTH_TESTER_COHORT_JSON);
  const approved = policy?.members.find(row => row.accountId === accountId);
  if (!approved) unavailable();
  const owner = await db.user.findUnique({ where: { id: accountId },
    select: { id: true, authProvider: true, authSubject: true, deletionRequestedAt: true } });
  if (!owner || owner.id !== accountId || owner.deletionRequestedAt || owner.authProvider !== 'clerk'
    || owner.authSubject !== approved.clerkSubject
    || (healthUserId !== undefined && !approved.healthUserIds.includes(healthUserId))) unavailable();
}
