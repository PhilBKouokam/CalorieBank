import { describe, expect, it } from 'vitest';

import {
  ingestionSyncSessionCompleteSchema,
  ingestionSyncSessionStartSchema,
  MAX_INGESTION_SYNC_SESSION_DATES,
} from '@caloriebank/schemas';
import {
  openingImportDates,
  readOpeningImportState,
} from '../src/modules/bank-history/opening-bank-import';

function transaction(options: {
  selectionUpdatedAt?: Date;
  sessions?: Array<Record<string, unknown>>;
  expenditureProvider?: string;
  intakeProvider?: string;
} = {}) {
  return {
    providerSelection: {
      findUnique: async () => ({
        authoritativeExpenditureProvider: options.expenditureProvider ?? 'google_health_fitbit',
        authoritativeIntakeProvider: options.intakeProvider ?? 'fatsecret',
        updatedAt: options.selectionUpdatedAt ?? new Date('2026-08-29T12:00:00.000Z'),
      }),
    },
    ingestionSyncSession: {
      findMany: async () => options.sessions ?? [],
    },
  } as never;
}

const completedAt = new Date('2026-08-29T12:05:00.000Z');

describe('Opening Bank initial import contract', () => {
  const sessionDates = openingImportDates('2026-08-29');

  it('accepts one bounded eight-date setup session while retaining the normal three-date contract', () => {
    const base = {
      localDate: '2026-08-29', timezone: 'America/Chicago', provider: 'apple_health' as const,
      trigger: 'provider_reconnect' as const,
    };
    expect(MAX_INGESTION_SYNC_SESSION_DATES).toBe(8);
    expect(ingestionSyncSessionStartSchema.safeParse({ ...base, datesQueried: sessionDates }).success).toBe(true);
    expect(ingestionSyncSessionStartSchema.safeParse({
      ...base, trigger: 'screen_focus', datesQueried: sessionDates.slice(0, 3),
    }).success).toBe(true);
    expect(ingestionSyncSessionStartSchema.safeParse({
      ...base, datesQueried: [...sessionDates, '2026-08-21'],
    }).success).toBe(false);
  });

  it('accepts completion coverage for all eight attempted setup dates', () => {
    expect(ingestionSyncSessionCompleteSchema.safeParse({
      expenditureStatus: 'unavailable', intakeStatus: 'ready', stepsStatus: 'ready',
      workoutsStatus: 'ready', recordsImported: 8, recordsUpdated: 0,
      recordsSkipped: 0, warningCount: 1, datesUploaded: sessionDates,
      datesSkipped: [], errors: [],
    }).success).toBe(true);
  });

  it('requests today plus the seven prior completed local dates', () => {
    expect(openingImportDates('2026-08-29')).toEqual([
      '2026-08-29', '2026-08-28', '2026-08-27', '2026-08-26',
      '2026-08-25', '2026-08-24', '2026-08-23', '2026-08-22',
    ]);
  });

  it('requires completed attempts for both independently selected roles', async () => {
    const state = await readOpeningImportState(transaction({ sessions: [{
      provider: 'google_health_fitbit', completedAt, status: 'completed',
      expenditureStatus: 'ready', intakeStatus: 'skipped',
    }] }), 'user', '2026-08-29');
    expect(state).toMatchObject({ expenditure: 'complete', intake: 'preparing', complete: false });
  });

  it('allows Fitbit burn and writer-specific Apple Health intake to complete independently', async () => {
    const state = await readOpeningImportState(transaction({ intakeProvider: 'apple_health', sessions: [
      { provider: 'google_health_fitbit', completedAt, status: 'completed', expenditureStatus: 'ready' },
      { provider: 'apple_health', completedAt, status: 'partially_completed', expenditureStatus: 'unavailable', intakeStatus: 'ready' },
    ] }), 'user', '2026-08-29');
    expect(state).toMatchObject({ expenditure: 'complete', intake: 'complete', complete: true });
  });

  it('accepts an explicit no-data result as attempted and rejects a failed role', async () => {
    const state = await readOpeningImportState(transaction({ sessions: [
      { provider: 'google_health_fitbit', completedAt, status: 'completed', expenditureStatus: 'unavailable' },
      { provider: 'fatsecret', completedAt, status: 'failed', intakeStatus: 'error' },
    ] }), 'user', '2026-08-29');
    expect(state).toMatchObject({ expenditure: 'complete', intake: 'retry_needed', complete: false });
  });

  it('marks the import complete only after both current authorities finish', async () => {
    const state = await readOpeningImportState(transaction({ sessions: [
      { provider: 'google_health_fitbit', completedAt, status: 'completed', expenditureStatus: 'ready' },
      { provider: 'fatsecret', completedAt, status: 'completed', intakeStatus: 'unavailable' },
    ] }), 'user', '2026-08-29');
    expect(state).toMatchObject({ expenditure: 'complete', intake: 'complete', complete: true });
  });

  it('reads complete-range sessions for the requested internal user only', async () => {
    const queriedUsers: string[] = [];
    const scopedTransaction = {
      providerSelection: {
        findUnique: async ({ where }: { where: { userId: string } }) => ({
          authoritativeExpenditureProvider: 'google_health_fitbit',
          authoritativeIntakeProvider: 'apple_health',
          updatedAt: new Date('2026-08-29T12:00:00.000Z'),
          userId: where.userId,
        }),
      },
      ingestionSyncSession: {
        findMany: async ({ where }: { where: { userId: string } }) => {
          queriedUsers.push(where.userId);
          return where.userId === 'account-b' ? [
            { provider: 'google_health_fitbit', completedAt, status: 'completed', expenditureStatus: 'ready' },
            { provider: 'apple_health', completedAt, status: 'completed', intakeStatus: 'ready' },
          ] : [];
        },
      },
    } as never;
    const state = await readOpeningImportState(scopedTransaction, 'account-b', '2026-08-29');
    expect(queriedUsers).toEqual(['account-b']);
    expect(state.complete).toBe(true);
  });
});
