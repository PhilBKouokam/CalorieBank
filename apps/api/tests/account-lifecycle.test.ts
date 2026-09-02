import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import { hasCompletedDayQueryEvidence } from '../src/modules/bank-history/day-source-authority';
import { errorHandler } from '../src/errors';
import { createGoalConfigurationRouter } from '../src/modules/goal-configuration/goal-configuration.routes';
import { AccountLifecycleCoordinator } from '../src/modules/lifecycle/account-lifecycle.service';

describe('completed-day query evidence', () => {
  it('requires the exact provider/date query to complete after the local day ends', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'session-1' });
    const result = await hasCompletedDayQueryEvidence({
      ingestionSyncSession: { findFirst },
    } as never, {
      userId: '00000000-0000-4000-8000-000000000001',
      localDate: '2026-03-08',
      timezone: 'America/Chicago',
      provider: 'google_health_fitbit',
      role: 'EXPENDITURE',
    });

    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        provider: 'google_health_fitbit',
        datesQueried: { has: '2026-03-08' },
        completedAt: { gte: new Date('2026-03-09T05:00:00.000Z') },
        expenditureStatus: 'ready',
      }),
    }));
  });

  it('accepts completed unchanged-query evidence without requiring an aggregate mutation', async () => {
    const result = await hasCompletedDayQueryEvidence({
      ingestionSyncSession: { findFirst: vi.fn().mockResolvedValue({ id: 'unchanged-session' }) },
    } as never, {
      userId: '00000000-0000-4000-8000-000000000001',
      localDate: '2026-08-30',
      timezone: 'America/Chicago',
      provider: 'fatsecret',
      role: 'INTAKE',
    });
    expect(result).toBe(true);
  });

  it('rejects a current-day evening aggregate when no post-day query exists', async () => {
    const result = await hasCompletedDayQueryEvidence({
      ingestionSyncSession: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never, {
      userId: '00000000-0000-4000-8000-000000000001',
      localDate: '2026-08-30',
      timezone: 'America/Chicago',
      provider: 'google_health_fitbit',
      role: 'EXPENDITURE',
      aggregateImportedAt: new Date('2026-08-31T01:00:00.000Z'),
      aggregateWasCurrentDay: true,
    });
    expect(result).toBe(false);
  });

  it('accepts a completed-date aggregate imported after local day-end', async () => {
    const findFirst = vi.fn();
    const result = await hasCompletedDayQueryEvidence({
      ingestionSyncSession: { findFirst },
    } as never, {
      userId: '00000000-0000-4000-8000-000000000001',
      localDate: '2026-08-30',
      timezone: 'America/Chicago',
      provider: 'google_health_fitbit',
      role: 'EXPENDITURE',
      aggregateImportedAt: new Date('2026-08-31T05:01:00.000Z'),
      aggregateWasCurrentDay: false,
    });
    expect(result).toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('account lifecycle coordinator', () => {
  function fixture(options: { unresolved?: boolean; intakeProvider?: string; accountingStartsOn?: string | null } = {}) {
    const fitbit = { syncRollingWindow: vi.fn().mockResolvedValue({}) };
    const fatSecret = { syncRollingWindow: vi.fn().mockResolvedValue({}) };
    const finalization = { execute: vi.fn().mockResolvedValue({ datesReconciled: [], datesLocked: [], waitingDates: [], errors: [] }) };
    const db = {
      finalizedDailyBankRecord: {
        findMany: vi.fn()
          .mockResolvedValueOnce(options.unresolved ? [] : [{ logDate: new Date('2026-08-30T00:00:00.000Z') }])
          .mockResolvedValueOnce([]),
      },
      historicalSourceAuthorityOverride: { findMany: vi.fn().mockResolvedValue([]) },
      providerSelection: { findUnique: vi.fn().mockResolvedValue({
        authoritativeExpenditureProvider: 'google_health_fitbit',
        authoritativeIntakeProvider: options.intakeProvider ?? 'apple_health',
        authoritativeActivityProvider: 'google_health_fitbit',
      }) },
    };
    const bankHistory = { getAccountingStartDate: vi.fn().mockResolvedValue(
      options.accountingStartsOn === undefined ? '2026-08-30' : options.accountingStartsOn,
    ) };
    const coordinator = new AccountLifecycleCoordinator(
      db as never,
      bankHistory as never,
      finalization as never,
      fitbit as never,
      fatSecret as never,
      () => new Date('2026-08-31T15:00:00.000Z'),
    );
    return { coordinator, fitbit, fatSecret, finalization };
  }

  it('refreshes only authoritative server-readable providers', async () => {
    const { coordinator, fitbit, fatSecret } = fixture();
    await coordinator.runUser(
      { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' },
      'America/Chicago',
      'scheduled',
    );
    expect(fitbit.syncRollingWindow).toHaveBeenCalledOnce();
    expect(fatSecret.syncRollingWindow).not.toHaveBeenCalled();
  });

  it('expands bounded catch-up to eight dates and refreshes both selected server providers', async () => {
    const { coordinator, fitbit, fatSecret, finalization } = fixture({ unresolved: true, intakeProvider: 'fatsecret' });
    await coordinator.runUser(
      { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' },
      'America/Chicago',
      'scheduled',
    );
    expect(fitbit.syncRollingWindow).toHaveBeenCalledWith(expect.anything(), '2026-08-31', 'America/Chicago', false, 8, 'scheduled');
    expect(fatSecret.syncRollingWindow).toHaveBeenCalledWith(expect.anything(), '2026-08-31', 'America/Chicago', false, 8, 'scheduled');
    expect(finalization.execute.mock.calls[0]![0].dates).toHaveLength(7);
  });

  it('uses the full eight-date bootstrap before a fresh account has an accounting boundary', async () => {
    const { coordinator, fitbit } = fixture({ accountingStartsOn: null });
    const result = await coordinator.runUser(
      { id: '00000000-0000-4000-8000-000000000002', email: 'second@example.com' },
      'America/Chicago',
      'app_foreground',
    );
    expect(result.historyDayCount).toBe(8);
    expect(fitbit.syncRollingWindow).toHaveBeenCalledWith(
      expect.anything(), '2026-08-31', 'America/Chicago', false, 8, 'app_foreground',
    );
  });
});

describe('goal-change lifecycle guard', () => {
  it('blocks an existing goal change while a completed day is unresolved', async () => {
    const repository = {
      findByUserId: vi.fn().mockResolvedValue({
        userId: '00000000-0000-4000-8000-000000000001',
        goalMode: 'maintain', dailyEnergyAdjustment: 0,
        adjustmentSource: 'manual_calories', desiredWeeklyWeightChange: null,
        updatedAt: '2026-08-30T00:00:00.000Z',
      }),
      upsertForUser: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use('/goal', createGoalConfigurationRouter(
      repository as never,
      { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' },
      vi.fn().mockResolvedValue({ ready: false, unresolvedDates: ['2026-08-30'] }),
    ));
    app.use(errorHandler);

    const response = await request(app).put('/goal').send({
      goalMode: 'cut', dailyEnergyAdjustment: -500,
      adjustmentSource: 'manual_calories',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.details.code).toBe('RECENT_DAY_STILL_UPDATING');
    expect(repository.upsertForUser).not.toHaveBeenCalled();
  });
});
