import { getRollingLocalDayWindows } from '@caloriebank/domain';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { BankHistoryRepository } from '../src/modules/bank-history/bank-history.repository';
import { FinalizationOrchestrationService } from '../src/modules/finalization-orchestration/finalization-orchestration.service';
import {
  mergeRollingSyncOutbox,
  rollingUploadFingerprint,
  type RollingSyncUpload,
} from '../../mobile/lib/healthkit/rolling-sync-policy';

const user = { id: '00000000-0000-4000-8000-000000000991', email: 'orchestrator@test.local' };

describe('rolling historical synchronization policy', () => {
  it('returns current day, yesterday, and the day before using local calendar boundaries', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      const windows = getRollingLocalDayWindows(new Date('2026-03-09T12:00:00-05:00'));
      expect(windows.map((window) => window.localDate)).toEqual([
        '2026-03-09',
        '2026-03-08',
        '2026-03-07',
      ]);
      expect(windows[1]!.dayEnd.getTime() - windows[1]!.dayStart.getTime()).toBe(23 * 60 * 60 * 1000);
    } finally {
      process.env.TZ = previousTimezone;
    }
  });

  it('skips accepted unchanged values and orders changed uploads oldest first', () => {
    const oldIntake: RollingSyncUpload = {
      kind: 'intake', localDate: '2026-07-20', body: { totalCaloriesConsumed: 1800, providerUpdatedAt: 'old' },
    };
    const today: RollingSyncUpload = {
      kind: 'expenditure', localDate: '2026-07-22', body: { rawTotalDailyExpenditure: 2000, providerUpdatedAt: 'new' },
    };
    const merged = mergeRollingSyncOutbox(
      [],
      [today, oldIntake],
      { 'apple_health:intake:2026-07-20': rollingUploadFingerprint(oldIntake) },
      '2026-07-22T12:00:00.000Z',
    );
    expect(merged.skippedDates).toEqual(['2026-07-20']);
    expect(merged.queue.map((item) => item.localDate)).toEqual(['2026-07-22']);
  });

  it('replaces a queued cumulative snapshot instead of adding it', () => {
    const first: RollingSyncUpload = {
      kind: 'expenditure', localDate: '2026-07-22', body: { rawTotalDailyExpenditure: 1000 },
    };
    const initial = mergeRollingSyncOutbox([], [first], {}, '2026-07-22T10:00:00.000Z');
    const replacement = mergeRollingSyncOutbox(
      initial.queue,
      [{ ...first, body: { rawTotalDailyExpenditure: 1700 } }],
      {},
      '2026-07-22T14:00:00.000Z',
    );
    expect(replacement.queue).toHaveLength(1);
    expect(replacement.queue[0]?.body.rawTotalDailyExpenditure).toBe(1700);
  });
});

function createOrchestrationHarness(options: {
  reconcileOutcome?: 'posted' | 'corrected' | 'unchanged' | 'not_ready';
  expenditure?: object | null;
  intake?: object | null;
  lockedDates?: string[];
  processingState?: { status: 'waiting_for_sync'; nextRetryAt: Date } | null;
} = {}) {
  const attempts: Array<{ status: string; date: Date }> = [];
  const reconciled: string[] = [];
  const db = {
    finalizedDailyBankRecord: { findUnique: async () => null },
    dailyExpenditureAggregate: { findFirst: async () => options.expenditure ?? { id: 'exp' } },
    dailyIntakeAggregate: { findFirst: async () => options.intake === undefined ? { id: 'intake' } : options.intake },
    goalConfiguration: { findUnique: async () => ({ goalMode: 'maintain' }) },
    ingestionSyncSession: { findFirst: async () => ({ expenditureStatus: 'ready', intakeStatus: 'ready' }) },
    bankDayProcessingState: {
      findUnique: async () => options.processingState ?? null,
      upsert: async ({ create }: { create: { status: string; logDate: Date } }) => {
        attempts.push({ status: create.status, date: create.logDate });
        return create;
      },
    },
  } as unknown as PrismaClient;
  const bankHistory = {
    reconcileStoredDay: async (_user: unknown, date: string) => {
      reconciled.push(date);
      const outcome = options.reconcileOutcome ?? 'posted';
      if (outcome === 'not_ready') return { outcome, detail: null };
      return { outcome, detail: { status: 'provisional' } };
    },
    lockExpiredDates: async () => options.lockedDates ?? [],
  } as unknown as BankHistoryRepository;
  return {
    service: new FinalizationOrchestrationService(db, bankHistory, () => new Date('2026-07-22T18:00:00Z')),
    attempts,
    reconciled,
  };
}

describe('finalization orchestration', () => {
  it('keeps current day open and sends only completed rolling dates to accounting', async () => {
    const harness = createOrchestrationHarness({ lockedDates: ['2026-07-19'] });
    const result = await harness.service.execute({
      user,
      currentLocalDate: '2026-07-22',
      timezone: 'America/Chicago',
      dates: ['2026-07-22', '2026-07-21', '2026-07-20'],
      trigger: 'app_foreground',
      syncSessionId: '00000000-0000-4000-8000-000000000992',
    });
    expect(harness.reconciled).toEqual(['2026-07-20', '2026-07-21']);
    expect(result.datesReconciled).toEqual(['2026-07-20', '2026-07-21']);
    expect(result.datesLocked).toEqual(['2026-07-19']);
  });

  it('records an explicit waiting state instead of guessing missing intake', async () => {
    const harness = createOrchestrationHarness({ reconcileOutcome: 'not_ready', intake: null });
    const result = await harness.service.execute({
      user,
      currentLocalDate: '2026-07-22',
      timezone: 'America/Chicago',
      dates: ['2026-07-21'],
      trigger: 'scheduled',
    });
    expect(result.waitingDates).toEqual([{ date: '2026-07-21', status: 'waiting_for_intake' }]);
    expect(harness.attempts[0]?.status).toBe('waiting_for_intake');
  });

  it('respects the waiting-day cooldown for scheduled retries', async () => {
    const harness = createOrchestrationHarness({
      processingState: {
        status: 'waiting_for_sync',
        nextRetryAt: new Date('2026-07-22T18:15:00.000Z'),
      },
    });
    const result = await harness.service.execute({
      user,
      currentLocalDate: '2026-07-22',
      timezone: 'America/Chicago',
      dates: ['2026-07-21'],
      trigger: 'scheduled',
    });
    expect(harness.reconciled).toEqual([]);
    expect(result.waitingDates).toEqual([{ date: '2026-07-21', status: 'waiting_for_sync' }]);
  });
});
