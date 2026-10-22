import type { Prisma } from '@prisma/client';
import { AppError } from '../errors';
import type { DevelopmentUser } from '../modules/goal-configuration/goal-configuration.repository';

/** Repositories never provision request-owned IDs. A conditional UPDATE cannot
 * resurrect an account deleted after authentication, and rejects deletion intent.
 * Within a caller's transaction its row lock lasts through dependent writes.
 * Outside a transaction, a later delete still wins or dependent FK writes reject.
 */
export async function requireExistingRequestAccount(db: Pick<Prisma.TransactionClient, 'user'>, user: DevelopmentUser): Promise<void> {
  const result = await db.user.updateMany({ where: { id: user.id, deletionRequestedAt: null }, data: { email: user.email } });
  if (result.count !== 1) throw new AppError('This account is unavailable.', 409, { code: 'ACCOUNT_UNAVAILABLE' });
}
