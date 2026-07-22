import type {
  IngestionSyncSessionComplete,
  IngestionSyncSessionResponse,
  IngestionSyncSessionStart,
} from '@caloriebank/schemas';
import type { IngestionSyncSessionStatus, PrismaClient } from '@prisma/client';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

export interface SyncSessionRepository {
  start(
    user: DevelopmentUser,
    input: IngestionSyncSessionStart,
    now: Date,
  ): Promise<IngestionSyncSessionResponse>;
  complete(
    userId: string,
    sessionId: string,
    input: IngestionSyncSessionComplete,
    now: Date,
  ): Promise<IngestionSyncSessionResponse>;
  recordOrchestrationOutcome(
    userId: string,
    sessionId: string,
    outcome: {
      datesReconciled: string[];
      datesLocked: string[];
      waitingDates: IngestionSyncSessionResponse['waitingDates'];
      errors: string[];
    },
  ): Promise<IngestionSyncSessionResponse>;
}

function parseLocalDate(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function response(session: {
  id: string;
  timezone: string;
  trigger: IngestionSyncSessionResponse['trigger'];
  status: IngestionSyncSessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  datesQueried: string[];
  datesUploaded: string[];
  datesSkipped: string[];
  datesReconciled: string[];
  datesLocked: string[];
  waitingDates: unknown;
  durationMs: number | null;
}): IngestionSyncSessionResponse {
  return {
    id: session.id,
    timezone: session.timezone,
    trigger: session.trigger,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    datesQueried: session.datesQueried,
    datesUploaded: session.datesUploaded,
    datesSkipped: session.datesSkipped,
    datesReconciled: session.datesReconciled,
    datesLocked: session.datesLocked,
    waitingDates: Array.isArray(session.waitingDates)
      ? session.waitingDates as IngestionSyncSessionResponse['waitingDates']
      : [],
    durationMs: session.durationMs,
  };
}

function completedStatus(
  input: IngestionSyncSessionComplete,
): IngestionSyncSessionStatus {
  const categories = [
    input.expenditureStatus,
    input.intakeStatus,
    input.stepsStatus,
    input.workoutsStatus,
  ];
  if (categories.every((status) => status === 'error')) return 'failed';
  if (categories.every((status) => status === 'ready' || status === 'skipped')) {
    return 'completed';
  }
  return 'partially_completed';
}

export class PrismaSyncSessionRepository implements SyncSessionRepository {
  constructor(private readonly db: PrismaClient) {}

  async start(user: DevelopmentUser, input: IngestionSyncSessionStart, now: Date) {
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: {
        id: user.id,
        email: user.email,
        profile: { create: { timezone: input.timezone } },
      },
    });
    const session = await this.db.ingestionSyncSession.create({
      data: {
        userId: user.id,
        provider: input.provider,
        localDate: parseLocalDate(input.localDate),
        timezone: input.timezone,
        trigger: input.trigger,
        startedAt: now,
        ...(input.appVersion ? { appVersion: input.appVersion } : {}),
        ...(input.providerAdapterVersion
          ? { providerAdapterVersion: input.providerAdapterVersion }
          : {}),
        datesQueried: input.datesQueried.length > 0 ? input.datesQueried : [input.localDate],
      },
    });
    return response(session);
  }

  async complete(
    userId: string,
    sessionId: string,
    input: IngestionSyncSessionComplete,
    now: Date,
  ) {
    const existing = await this.db.ingestionSyncSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!existing) throw new AppError('Sync session was not found.', 404);

    const session = await this.db.ingestionSyncSession.update({
      where: { id: sessionId },
      data: {
        status: completedStatus(input),
        completedAt: now,
        expenditureStatus: input.expenditureStatus,
        intakeStatus: input.intakeStatus,
        stepsStatus: input.stepsStatus,
        workoutsStatus: input.workoutsStatus,
        recordsImported: input.recordsImported,
        recordsUpdated: input.recordsUpdated,
        recordsSkipped: input.recordsSkipped,
        warningCount: input.warningCount,
        errorCode: input.errorCode ?? null,
        datesUploaded: input.datesUploaded,
        datesSkipped: input.datesSkipped,
        errors: input.errors,
        durationMs: Math.max(0, now.getTime() - existing.startedAt.getTime()),
      },
    });
    return response(session);
  }

  async recordOrchestrationOutcome(
    userId: string,
    sessionId: string,
    outcome: {
      datesReconciled: string[];
      datesLocked: string[];
      waitingDates: IngestionSyncSessionResponse['waitingDates'];
      errors: string[];
    },
  ) {
    const existing = await this.db.ingestionSyncSession.findFirst({ where: { id: sessionId, userId } });
    if (!existing) throw new AppError('Sync session was not found.', 404);
    const session = await this.db.ingestionSyncSession.update({
      where: { id: sessionId },
      data: {
        datesReconciled: outcome.datesReconciled,
        datesLocked: outcome.datesLocked,
        waitingDates: outcome.waitingDates,
        errors: [...existing.errors, ...outcome.errors].slice(0, 12),
      },
    });
    return response(session);
  }
}
