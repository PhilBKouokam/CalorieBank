import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../errors';
import type { BankHistoryRepository } from '../bank-history/bank-history.repository';
import type { FinalizationScheduler } from '../finalization-orchestration/finalization-orchestration.service';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { FatSecretService } from '../fatsecret/fatsecret.service';
import type { GoogleHealthFitbitService } from '../google-health/google-health.service';
import { readProviderSelection } from '../provider-selection/provider-selection.repository';
import { getLocalDateForTimezone } from '../today/today.time';

const MAX_CATCH_UP_DAYS = 8;
const NORMAL_SYNC_DAYS = 3;
const HOSTED_CONCURRENCY = 4;
const RETRY_DELAYS_MS = [250, 750] as const;

function shiftDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesThroughToday(currentLocalDate: string, count: number) {
  return Array.from({ length: count }, (_, offset) => shiftDate(currentLocalDate, -offset));
}

function retryable(error: unknown) {
  return !(error instanceof AppError && [400, 401, 403, 404, 409].includes(error.statusCode));
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms + Math.floor(Math.random() * 150)));
}

export type LifecycleUserResult = {
  userIdSuffix: string;
  timezone: string;
  datesRequested: string[];
  unresolvedDates: string[];
  refreshedProviders: string[];
  errors: Array<{ provider: string; code: string }>;
  historyDayCount: number;
};

export class AccountLifecycleCoordinator {
  constructor(
    private readonly db: PrismaClient,
    private readonly bankHistory: BankHistoryRepository,
    private readonly finalization: FinalizationScheduler,
    private readonly fitbit: GoogleHealthFitbitService,
    private readonly fatSecret: FatSecretService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private log(event: string, metadata: Record<string, unknown> = {}) {
    console.info(JSON.stringify({ component: 'account_lifecycle', event, ...metadata }));
  }

  async prepareForegroundUser(userId: string, timezone: string) {
    const profile = await this.db.userProfile.update({
      where: { userId },
      data: { timezone },
      select: { onboardingCompletedAt: true },
    });
    return { onboardingComplete: Boolean(profile.onboardingCompletedAt) };
  }

  private async withRetry(provider: string, operation: (attempt: number) => Promise<unknown>) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === RETRY_DELAYS_MS.length) throw error;
        await wait(RETRY_DELAYS_MS[attempt]!);
      }
    }
    throw lastError;
  }

  async runUser(user: DevelopmentUser, timezone: string, trigger: 'scheduled' | 'app_foreground' | 'manual_refresh') {
    const startedAt = this.now();
    const currentLocalDate = getLocalDateForTimezone(timezone, startedAt);
    const accountingStartsOn = await this.bankHistory.getAccountingStartDate(user.id);
    const recentDates = datesThroughToday(currentLocalDate, MAX_CATCH_UP_DAYS);
    const existingRecords = accountingStartsOn
      ? await this.db.finalizedDailyBankRecord.findMany({
          where: {
            userId: user.id,
            logDate: {
              gte: new Date(`${recentDates.at(-1)}T00:00:00.000Z`),
              lt: new Date(`${currentLocalDate}T00:00:00.000Z`),
            },
          },
          select: { logDate: true },
        })
      : [];
    const completed = new Set(existingRecords.map((record) => record.logDate.toISOString().slice(0, 10)));
    const unresolvedDates = accountingStartsOn
      ? recentDates.slice(1).filter((date) => date >= accountingStartsOn && !completed.has(date))
      : [];
    const dayCount = !accountingStartsOn || unresolvedDates.length > 0
      ? MAX_CATCH_UP_DAYS
      : NORMAL_SYNC_DAYS;
    const datesRequested = datesThroughToday(currentLocalDate, dayCount);
    const selection = await readProviderSelection(this.db, user.id);
    const provisionalDates = await this.db.finalizedDailyBankRecord.findMany({
      where: { userId: user.id, status: 'PROVISIONAL' },
      select: { logDate: true },
    });
    const overrides = provisionalDates.length > 0
      ? await this.db.historicalSourceAuthorityOverride.findMany({
          where: { userId: user.id, localDate: { in: provisionalDates.map((record) => record.logDate) } },
          select: { provider: true },
        })
      : [];
    const providers = new Set([
      selection.authoritativeExpenditureProvider,
      selection.authoritativeIntakeProvider,
      ...overrides.map((override) => override.provider),
    ]);
    const refreshedProviders: string[] = [];
    const errors: LifecycleUserResult['errors'] = [];

    this.log('lifecycle_user_started', { userSuffix: user.id.slice(-8), trigger, unresolvedCount: unresolvedDates.length });
    if (dayCount === MAX_CATCH_UP_DAYS) {
      this.log('historical_bootstrap_started', {
        userSuffix: user.id.slice(-8),
        trigger,
        dateCount: datesRequested.length,
        reason: accountingStartsOn ? 'continuity_recovery' : 'account_initialization',
      });
    }
    for (const provider of ['google_health_fitbit', 'fatsecret'] as const) {
      if (!providers.has(provider)) continue;
      this.log('provider_refresh_started', { userSuffix: user.id.slice(-8), provider, trigger });
      try {
        await this.withRetry(provider, async (attempt) => {
          if (provider === 'google_health_fitbit') {
            const result = await this.fitbit.syncRollingWindow(user, currentLocalDate, timezone, attempt > 0, dayCount, trigger);
            if (result.retryableFailure) throw new AppError('Fitbit burn refresh was incomplete.', 502);
            return result;
          }
          return this.fatSecret.syncRollingWindow(user, currentLocalDate, timezone, attempt > 0, dayCount, trigger);
        });
        refreshedProviders.push(provider);
        this.log('provider_refresh_completed', { userSuffix: user.id.slice(-8), provider, trigger });
      } catch (error) {
        const code = error instanceof AppError
          ? error.statusCode === 401 ? 'needs_reconnect' : `http_${error.statusCode}`
          : 'unexpected_provider_failure';
        errors.push({ provider, code });
        this.log('provider_refresh_failed', { userSuffix: user.id.slice(-8), provider, trigger, reasonCode: code });
      }
    }

    const orchestration = await this.finalization.execute({
      user,
      currentLocalDate,
      timezone,
      dates: datesRequested.slice(1),
      trigger,
    });
    const result: LifecycleUserResult = {
      userIdSuffix: user.id.slice(-8),
      timezone,
      datesRequested,
      unresolvedDates,
      refreshedProviders,
      errors: [...errors, ...orchestration.errors.map((code) => ({ provider: 'accounting', code }))],
      historyDayCount: dayCount,
    };
    this.log('lifecycle_user_completed', {
      userSuffix: user.id.slice(-8), trigger,
      durationMs: this.now().getTime() - startedAt.getTime(),
      unresolvedCount: unresolvedDates.length,
      errorCount: result.errors.length,
    });
    if (dayCount === MAX_CATCH_UP_DAYS) {
      this.log(result.errors.length === 0 ? 'historical_bootstrap_completed' : 'historical_bootstrap_partial', {
        userSuffix: user.id.slice(-8),
        trigger,
        dateCount: datesRequested.length,
        unresolvedCount: unresolvedDates.length,
        errorCount: result.errors.length,
      });
    }
    return result;
  }

  async runDueAccounts() {
    const startedAt = this.now();
    this.log('lifecycle_run_started', { trigger: 'scheduled' });
    const profiles = await this.db.userProfile.findMany({
      where: { onboardingCompletedAt: { not: null } },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { updatedAt: 'asc' },
    });
    const results: LifecycleUserResult[] = [];
    for (let index = 0; index < profiles.length; index += HOSTED_CONCURRENCY) {
      const batch = profiles.slice(index, index + HOSTED_CONCURRENCY);
      const settled = await Promise.allSettled(batch.map((profile) =>
        this.runUser(profile.user, profile.timezone, 'scheduled')));
      settled.forEach((result, offset) => {
        if (result.status === 'fulfilled') results.push(result.value);
        else this.log('lifecycle_user_failed', {
          userSuffix: batch[offset]!.user.id.slice(-8),
          reasonCode: result.reason instanceof Error ? result.reason.name : 'unknown',
        });
      });
    }
    const summary = {
      userCount: profiles.length,
      completedCount: results.length,
      failedCount: profiles.length - results.length,
      providerErrorCount: results.reduce((sum, result) => sum + result.errors.length, 0),
      durationMs: this.now().getTime() - startedAt.getTime(),
    };
    this.log('lifecycle_run_completed', summary);
    return summary;
  }
}
