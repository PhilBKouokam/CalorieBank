import { createHash } from 'node:crypto';
import { createClerkClient } from '@clerk/express';
import type { PrismaClient } from '@prisma/client';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import { structuredLog } from '../../logger';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

type ProviderRevoker = { revokeForAccountDeletion(user: DevelopmentUser): Promise<void> };
type IdentityDeleter = (subject: string) => Promise<void>;

function safeUserReference(userId: string) {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

export class AccountSafetyService {
  private readonly deleteIdentity: IdentityDeleter;

  constructor(
    private readonly db: PrismaClient,
    config: ApiEnv,
    private readonly providerRevoker: ProviderRevoker,
    identityDeleter?: IdentityDeleter,
  ) {
    this.deleteIdentity = identityDeleter ?? (async (subject) => {
      if (config.AUTH_MODE !== 'clerk' || !config.CLERK_SECRET_KEY || !config.CLERK_PUBLISHABLE_KEY) return;
      const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY, publishableKey: config.CLERK_PUBLISHABLE_KEY });
      await clerk.users.deleteUser(subject);
    });
  }

  async deleteAccount(user: DevelopmentUser) {
    const stored = await this.db.user.findUnique({ where: { id: user.id }, select: { authSubject: true } });
    if (!stored) return { deleted: true as const };

    await this.providerRevoker.revokeForAccountDeletion(user);

    if (stored.authSubject) {
      try {
        await this.deleteIdentity(stored.authSubject);
      } catch {
        structuredLog('error', 'account_deletion_failed', {
          accountReference: safeUserReference(user.id), phase: 'identity_deletion',
        });
        throw new AppError('Account deletion could not be completed. Try again.', 502, {
          code: 'IDENTITY_DELETION_FAILED',
        });
      }
    }

    try {
      await this.db.user.delete({ where: { id: user.id } });
    } catch (error) {
      structuredLog('error', 'account_deletion_failed', {
        accountReference: safeUserReference(user.id), phase: 'caloriebank_data_deletion',
      });
      throw error;
    }
    structuredLog('info', 'account_deleted', { accountReference: safeUserReference(user.id) });
    return { deleted: true as const };
  }

  async diagnostics(user: DevelopmentUser) {
    const [account, unresolvedCount, latestSync, expenditureCount, intakeCount] = await Promise.all([
      this.db.user.findUnique({ where: { id: user.id }, select: {
        createdAt: true,
        profile: { select: { onboardingWelcomeCompleted: true, onboardingCompletedAt: true } },
        providerSelection: { select: { authoritativeExpenditureProvider: true, authoritativeIntakeProvider: true } },
        bankAccountInitialization: { select: { status: true, accountingStartsOn: true, initializedAt: true } },
        googleHealthConnection: { select: { status: true, lastSyncedAt: true, lastErrorCode: true } },
        externalProviderConnections: { select: { provider: true, status: true, lastSyncedAt: true, lastErrorCode: true } },
      } }),
      this.db.bankDayProcessingState.count({ where: { userId: user.id, status: { notIn: ['provisional', 'locked'] } } }),
      this.db.ingestionSyncSession.findFirst({ where: { userId: user.id }, orderBy: { startedAt: 'desc' }, select: { status: true, trigger: true, startedAt: true, completedAt: true, errorCode: true } }),
      this.db.dailyExpenditureAggregate.count({ where: { userId: user.id } }),
      this.db.dailyIntakeAggregate.count({ where: { userId: user.id } }),
    ]);
    if (!account) throw new AppError('Account was not found.', 404);
    return {
      accountReference: safeUserReference(user.id),
      onboarding: account.profile,
      providers: account.providerSelection,
      providerConnections: {
        fitbit: account.googleHealthConnection,
        direct: account.externalProviderConnections,
      },
      openingBank: account.bankAccountInitialization,
      unresolvedCompletedDayCount: unresolvedCount,
      latestSync,
      aggregatePresence: { expenditure: expenditureCount > 0, intake: intakeCount > 0 },
    };
  }
}
