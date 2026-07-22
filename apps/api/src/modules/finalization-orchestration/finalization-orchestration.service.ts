import type { BankDayProcessingStatus, PrismaClient } from '@prisma/client';

import type {
  BankHistoryRepository,
  ReconciliationResult,
} from '../bank-history/bank-history.repository';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

export const WAITING_DAY_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

export type OrchestrationTrigger =
  | 'connection'
  | 'provider_reconnect'
  | 'app_launch'
  | 'screen_focus'
  | 'app_foreground'
  | 'manual_refresh'
  | 'scheduled'
  | 'integration_test';

export type FinalizationOrchestrationInput = {
  user: DevelopmentUser;
  currentLocalDate: string;
  timezone: string;
  dates: string[];
  trigger: OrchestrationTrigger;
  syncSessionId?: string;
};

export type FinalizationOrchestrationResult = {
  datesReconciled: string[];
  datesLocked: string[];
  waitingDates: Array<{ date: string; status: BankDayProcessingStatus }>;
  errors: string[];
};

export interface FinalizationScheduler {
  execute(input: FinalizationOrchestrationInput): Promise<FinalizationOrchestrationResult>;
}

function parseLocalDate(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function statusForResult(result: ReconciliationResult): BankDayProcessingStatus | null {
  if (result.outcome === 'posted' || result.outcome === 'corrected' || result.outcome === 'unchanged') {
    return result.detail?.status === 'locked' ? 'locked' : 'provisional';
  }
  if (result.outcome === 'locked') return 'locked';
  return null;
}

export class FinalizationOrchestrationService implements FinalizationScheduler {
  constructor(
    private readonly db: PrismaClient,
    private readonly bankHistory: BankHistoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async classifyWaiting(
    userId: string,
    logDate: string,
    syncSessionId?: string,
  ): Promise<BankDayProcessingStatus> {
    const date = parseLocalDate(logDate);
    const [expenditure, intake, goal, session] = await Promise.all([
      this.db.dailyExpenditureAggregate.findFirst({ where: { userId, localDate: date } }),
      this.db.dailyIntakeAggregate.findFirst({ where: { userId, localDate: date } }),
      this.db.goalConfiguration.findUnique({ where: { userId } }),
      syncSessionId
        ? this.db.ingestionSyncSession.findFirst({ where: { id: syncSessionId, userId } })
        : this.db.ingestionSyncSession.findFirst({
            where: { userId, datesQueried: { has: logDate } },
            orderBy: { startedAt: 'desc' },
          }),
    ]);

    if (!goal) return 'waiting_for_required_inputs';
    if (!expenditure && intake) return 'waiting_for_expenditure';
    if (expenditure && !intake) return 'waiting_for_intake';
    if (!session) return 'waiting_for_sync';
    if (
      ['unavailable', 'error'].includes(session.expenditureStatus) &&
      ['unavailable', 'error'].includes(session.intakeStatus)
    ) {
      return 'waiting_for_provider';
    }
    return 'waiting_for_required_inputs';
  }

  private async recordState(
    input: FinalizationOrchestrationInput,
    logDate: string,
    timezone: string,
    status: BankDayProcessingStatus,
    errorCode: string | null = null,
  ) {
    const attemptedAt = this.now();
    const waiting = status.startsWith('waiting_');
    await this.db.bankDayProcessingState.upsert({
      where: { userId_logDate: { userId: input.user.id, logDate: parseLocalDate(logDate) } },
      create: {
        userId: input.user.id,
        logDate: parseLocalDate(logDate),
        timezone,
        status,
        attemptCount: 1,
        lastAttemptAt: attemptedAt,
        nextRetryAt: waiting
          ? new Date(attemptedAt.getTime() + WAITING_DAY_RETRY_COOLDOWN_MS)
          : null,
        lastSyncSessionId: input.syncSessionId ?? null,
        lastErrorCode: errorCode,
      },
      update: {
        timezone,
        status,
        attemptCount: { increment: 1 },
        lastAttemptAt: attemptedAt,
        nextRetryAt: waiting
          ? new Date(attemptedAt.getTime() + WAITING_DAY_RETRY_COOLDOWN_MS)
          : null,
        lastSyncSessionId: input.syncSessionId ?? null,
        lastErrorCode: errorCode,
      },
    });
  }

  private async timezoneForDate(userId: string, logDate: string, fallback: string) {
    const date = parseLocalDate(logDate);
    const [record, expenditure, intake] = await Promise.all([
      this.db.finalizedDailyBankRecord.findUnique({
        where: { userId_logDate: { userId, logDate: date } },
        select: { timezone: true },
      }),
      this.db.dailyExpenditureAggregate.findFirst({
        where: { userId, localDate: date },
        orderBy: { updatedAt: 'desc' },
        select: { timezone: true },
      }),
      this.db.dailyIntakeAggregate.findFirst({
        where: { userId, localDate: date },
        orderBy: { updatedAt: 'desc' },
        select: { timezone: true },
      }),
    ]);
    return record?.timezone ?? expenditure?.timezone ?? intake?.timezone ?? fallback;
  }

  async execute(input: FinalizationOrchestrationInput): Promise<FinalizationOrchestrationResult> {
    const dates = [...new Set(input.dates)]
      .filter((date) => date < input.currentLocalDate)
      .sort();
    const result: FinalizationOrchestrationResult = {
      datesReconciled: [],
      datesLocked: [],
      waitingDates: [],
      errors: [],
    };

    for (const date of dates) {
      let dateTimezone = input.timezone;
      try {
        dateTimezone = await this.timezoneForDate(input.user.id, date, input.timezone);
        if (!input.syncSessionId && input.trigger === 'scheduled') {
          const existingState = await this.db.bankDayProcessingState.findUnique({
            where: { userId_logDate: { userId: input.user.id, logDate: parseLocalDate(date) } },
          });
          if (
            existingState?.status.startsWith('waiting_') &&
            existingState.nextRetryAt &&
            existingState.nextRetryAt > this.now()
          ) {
            result.waitingDates.push({ date, status: existingState.status });
            continue;
          }
        }
        const reconciliation = await this.bankHistory.reconcileStoredDay(
          input.user,
          date,
          dateTimezone,
          input.syncSessionId,
        );
        const status = statusForResult(reconciliation);
        if (status) {
          await this.recordState(input, date, dateTimezone, status);
          if (status === 'locked') result.datesLocked.push(date);
          else result.datesReconciled.push(date);
          continue;
        }
        if (reconciliation.outcome === 'not_ready') {
          const waitingStatus = await this.classifyWaiting(input.user.id, date, input.syncSessionId);
          await this.recordState(input, date, dateTimezone, waitingStatus);
          result.waitingDates.push({ date, status: waitingStatus });
        }
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 160) : 'orchestration_failed';
        result.errors.push(`${date}:${code}`);
        await this.recordState(input, date, dateTimezone, 'waiting_for_required_inputs', code);
      }
    }

    const locked = await this.bankHistory.lockExpiredDates(input.user.id, input.syncSessionId);
    for (const date of locked) {
      if (!result.datesLocked.includes(date)) result.datesLocked.push(date);
      const dateTimezone = await this.timezoneForDate(input.user.id, date, input.timezone);
      await this.recordState(input, date, dateTimezone, 'locked');
    }
    return result;
  }
}
