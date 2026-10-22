import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors';
import { GoogleHealthFitbitService } from '../src/modules/google-health/google-health.service';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';
import { localDevelopmentApiEnv } from './support/test-api-env';

function fixture(db: unknown = {}) {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const fetcher: typeof fetch = vi.fn(async () => { throw new Error('No network permitted'); });
  const service = new GoogleHealthFitbitService(
    db as PrismaClient, {} as TodayAggregateRepository, localDevelopmentApiEnv(),
    undefined, fetcher, () => new Date('2026-10-21T12:00:00Z'),
  );
  return { service, fetcher, logs: () => output.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>) };
}

afterEach(() => vi.restoreAllMocks());

describe('Google Health default diagnostic output — synthetic only', () => {
  it('keeps the cached model result unchanged while excluding its health evidence', async () => {
    const f = fixture({
      providerSelection: { findUnique: vi.fn().mockResolvedValue({ authoritativeExpenditureProvider: 'google_health_fitbit' }) },
      googleHealthConnection: { findUnique: vi.fn().mockResolvedValue({ status: 'connected' }) },
      restingBurnEstimate: { findUnique: vi.fn().mockResolvedValue({
        provider: 'google_health_fitbit', providerKcalPerHour: 123.45,
        evidenceType: 'synthetic_private_evidence', observationCount: 42,
        calculatedAt: new Date('2026-10-21T11:00:00Z'),
        lookbackStartDate: new Date('2026-10-01'), lookbackEndDate: new Date('2026-10-20'),
      }) },
    });
    await expect(f.service.resolveRestingBurnEstimate(
      { id: '10000000-0000-4000-8000-000000000001', email: 'synthetic@test.local' }, '2026-10-21', 'UTC',
    )).resolves.toBe(true);
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.logs()).toEqual([{ level: 'info', component: 'google_health_oauth', event: 'resting_model_resolved' }]);
  });

  it.each(['resting_model_resolved', 'resting_burn_estimate_failed'])('logs only the static %s event', (event) => {
    const f = fixture();
    f.service.logOAuthStage(event, {
      provider: 'fitbit', restingKcalPerHour: 123.45, source: 'synthetic_private_source',
      qualifyingObservations: 42, lookbackDays: 20, cache: 'derived', rejectionReason: 'synthetic_private_reason',
      hourlyCaloriesAvailable: true, qualifyingRestHours: 3, attemptedWindows: [1, 3],
      stage: 'state_validated', httpStatus: 200, codePresent: true,
    });
    expect(f.logs()).toEqual([{ level: 'info', component: 'google_health_oauth', event }]);
    expect(f.fetcher).not.toHaveBeenCalled();
  });

  it('preserves only enumerated operational stage, status, code and boolean fields', () => {
    const f = fixture();
    f.service.logOAuthStage('oauth_callback_failure', {
      stage: 'token_exchange_started', errorType: 'GoogleHealthRemoteError',
      googleHttpStatus: 401, googleErrorCode: 'invalid_grant', prismaCode: null,
      codePresent: true, statePresent: false, safeMessage: 'synthetic private message',
      internalUserSuffix: 'private-id', provider: 'fitbit', rawPayload: { calories: 123 },
    });
    expect(f.logs()).toEqual([{
      level: 'error', component: 'google_health_oauth', event: 'oauth_callback_failure',
      stage: 'token_exchange_started', errorType: 'GoogleHealthRemoteError', googleHttpStatus: 401,
      googleErrorCode: 'invalid_grant', prismaCode: null, codePresent: true, statePresent: false,
    }]);
  });

  it('never forwards arbitrary messages, unknown event/code text, nested values or invalid statuses', () => {
    const f = fixture();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    f.service.logOAuthStage('synthetic private event', {
      stage: 'synthetic private stage', googleErrorCode: 'synthetic private code',
      errorType: 'synthetic private type', parsedScheme: 'synthetic-private-scheme',
      httpStatus: 12345, googleHttpStatus: Number.NaN, codePresent: 'synthetic private string',
      safeMessage: 'synthetic private message', level: 'private', event: 'private', rawPayload: circular,
    });
    expect(f.logs()).toEqual([{
      level: 'info', component: 'google_health_oauth', event: 'oauth_diagnostic',
      stage: 'other', googleErrorCode: 'other', errorType: 'other', parsedScheme: 'other',
    }]);
  });

  it('keeps callback failure classification without serializing an error message', () => {
    const f = fixture();
    f.service.logOAuthFailure('callback_validation', new AppError('synthetic private text', 400));
    expect(f.logs()).toEqual([{
      level: 'error', component: 'google_health_oauth', event: 'oauth_callback_failure',
      stage: 'callback_validation', errorType: 'AppError', googleHttpStatus: null,
      googleErrorCode: null, prismaCode: null,
    }]);
  });
});
