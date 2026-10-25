import type { PrismaClient } from '@prisma/client';
import { env, type ApiEnv } from '../env';
import { AppError } from '../errors';

export type PublicIntakeConfig = Pick<ApiEnv, 'PUBLIC_INTAKE_MODE' | 'FATSECRET_PRIVATE_BETA_ACCOUNT_IDS'>;
export const FATSECRET_APPLE_WRITER = 'com.fatsecret.caloriecounter';
export const FATSECRET_ANDROID_WRITER = 'com.fatsecret.android';

/** Admission only. Never changes authority, credentials, accounting or past data. */
export async function publicIntakeAvailability(db: Pick<PrismaClient, 'user'>, userId: string, config: PublicIntakeConfig = env) {
  if (config.PUBLIC_INTAKE_MODE !== 'without_fatsecret') return undefined;
  const raw = config.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS;
  if (raw === undefined) throw new AppError('Food source configuration is unavailable.', 503);
  // Stable internal ownership, never email, device state or a historical cutoff.
  const allowed = new Set(raw === '' ? [] : raw.split(','));
  if (!allowed.has(userId)) return { fatSecret: false };
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, deletionRequestedAt: true } });
  return { fatSecret: Boolean(user && !user.deletionRequestedAt) };
}

export async function requirePublicIntakeSource(db: Pick<PrismaClient, 'user'>, userId: string,
  identity: { provider: string; writerId?: string | null; sourceId?: string | null }, config: PublicIntakeConfig = env) {
  const fatSecret = identity.provider === 'fatsecret' ||
    (identity.provider === 'apple_health' && identity.writerId === FATSECRET_APPLE_WRITER) ||
    (identity.provider === 'health_connect' && identity.sourceId === FATSECRET_ANDROID_WRITER);
  if (fatSecret && (await publicIntakeAvailability(db, userId, config))?.fatSecret === false) {
    throw new AppError('This food source is unavailable. Choose another food tracker or a daily estimate.', 403,
      { code: 'PUBLIC_INTAKE_SOURCE_UNAVAILABLE' });
  }
}
