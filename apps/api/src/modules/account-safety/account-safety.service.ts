import { createHash } from 'node:crypto';
import { createClerkClient } from '@clerk/express';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import { structuredLog } from '../../logger';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { remoteStatus, retryDeletionOperation } from './deletion-retry';

type ProviderRevoker = { revokeForAccountDeletion(user: DevelopmentUser): Promise<void> };
type IdentityDeleter = (subject: string) => Promise<void>;

function safeUserReference(userId: string) {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

export class AccountSafetyService {
  private readonly deleteIdentity: IdentityDeleter;
  private readonly deletions = new Map<string, Promise<{ deleted: true }>>();

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

  deleteAccount(user: DevelopmentUser) {
    const existing = this.deletions.get(user.id);
    if (existing) return existing;
    const operation = this.performDeletion(user).finally(() => this.deletions.delete(user.id));
    this.deletions.set(user.id, operation);
    return operation;
  }

  private async performDeletion(user: DevelopmentUser) {
    const stored = await this.db.user.findUnique({ where: { id: user.id }, select: { authSubject: true } });
    if (!stored) return { deleted: true as const };

    // Persist intent before irreversible external work. The hosted worker resumes
    // this same ordered operation even if Clerk deletion ends the client session.
    try { await this.db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return { deleted: true as const };
      throw error;
    }
    await this.db.pushDeviceRegistration.updateMany({ where: { userId: user.id }, data: { active: false } });
    try { await this.providerRevoker.revokeForAccountDeletion(user); }
    catch (error) {
      structuredLog('error', 'account_deletion_failed', {
        accountReference: safeUserReference(user.id), phase: 'provider_revocation',
        failureCategory: error instanceof AppError ? 'provider_rejected' : 'unexpected',
      });
      throw error;
    }

    if (stored.authSubject) {
      try {
        await retryDeletionOperation(async () => {
          try { await this.deleteIdentity(stored.authSubject!); }
          catch (error) { if (remoteStatus(error) !== 404) throw error; }
        }, (error) => remoteStatus(error) === undefined || remoteStatus(error) === 429 || (remoteStatus(error) ?? 0) >= 500);
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
      await retryDeletionOperation(async () => {
        // deleteMany is idempotent when another retry already finished the cascade.
        await this.db.user.deleteMany({ where: { id: user.id } });
      }, () => true);
    } catch (error) {
      structuredLog('error', 'account_deletion_failed', {
        accountReference: safeUserReference(user.id), phase: 'caloriebank_data_deletion',
      });
      throw error;
    }
    structuredLog('info', 'account_deleted', { accountReference: safeUserReference(user.id) });
    return { deleted: true as const };
  }

  async resumePendingDeletions() {
    const users = await this.db.user.findMany({
      where: { deletionRequestedAt: { not: null } },
      orderBy: { deletionRequestedAt: 'asc' }, take: 50,
      select: { id: true, email: true },
    });
    for (const user of users) {
      await this.deleteAccount(user).catch(() => undefined);
    }
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
        morningBankUpdatePreference: { select: { enabled: true, updatedAt: true } },
        pushDeviceRegistration: { select: { active: true, lastRegisteredAt: true, invalidatedAt: true } },
        morningBankUpdateDeliveries: { orderBy: { completedLocalDate: 'desc' }, take: 1, select: { completedLocalDate: true, status: true, attemptCount: true, deliveredAt: true, failureCode: true } },
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
      morningBankUpdate: {
        preference: account.morningBankUpdatePreference,
        device: account.pushDeviceRegistration,
        latestDelivery: account.morningBankUpdateDeliveries?.[0] ?? null,
      },
    };
  }
}
