import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { AccountSafetyService } from '../src/modules/account-safety/account-safety.service';
import { createRateLimit } from '../src/security/rate-limit';
import { redactLogValue } from '../src/logger';
import { localDevelopmentApiEnv } from './support/test-api-env';

const user = { id: '10000000-0000-4000-8000-000000000001', email: 'safe@test.local' };

function fakeDb(overrides: Record<string, unknown> = {}) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ authSubject: 'clerk_subject' }), delete: vi.fn().mockResolvedValue({}) },
    bankDayProcessingState: { count: vi.fn().mockResolvedValue(0) },
    ingestionSyncSession: { findFirst: vi.fn().mockResolvedValue(null) },
    dailyExpenditureAggregate: { count: vi.fn().mockResolvedValue(1) },
    dailyIntakeAggregate: { count: vi.fn().mockResolvedValue(1) },
    ...overrides,
  } as unknown as PrismaClient;
}

describe('PB.2 account safety', () => {
  it('redacts nested credential fields while retaining operational context', () => {
    expect(redactLogValue({ route: '/sync', authorization: 'Bearer secret', nested: { refreshToken: 'secret', provider: 'fitbit' } })).toEqual({
      route: '/sync', authorization: '[REDACTED]', nested: { refreshToken: '[REDACTED]', provider: 'fitbit' },
    });
  });

  it('returns conventional account-scoped 429 responses', async () => {
    const middleware = createRateLimit({ limit: 1, windowMs: 60_000, operation: 'test' });
    const headers = new Map<string, string>();
    const req = { ip: '127.0.0.1' };
    const res = { locals: { currentUser: user }, setHeader: (key: string, value: string) => headers.set(key, value) };
    const firstNext = vi.fn();
    middleware(req as never, res as never, firstNext);
    expect(firstNext).toHaveBeenCalledWith();
    const secondNext = vi.fn();
    middleware(req as never, res as never, secondNext);
    expect(secondNext.mock.calls[0]?.[0]).toMatchObject({ statusCode: 429 });
    expect(headers.get('Retry-After')).toBeDefined();
  });

  it('revokes the direct provider, deletes Clerk identity, then cascades CalorieBank data', async () => {
    const events: string[] = [];
    const db = fakeDb({ user: {
      findUnique: vi.fn().mockResolvedValue({ authSubject: 'clerk_subject' }),
      delete: vi.fn().mockImplementation(async () => { events.push('data'); }),
    } });
    const service = new AccountSafetyService(
      db,
      localDevelopmentApiEnv(),
      { revokeForAccountDeletion: async () => { events.push('provider'); } },
      async () => { events.push('identity'); },
    );
    await expect(service.deleteAccount(user)).resolves.toEqual({ deleted: true });
    expect(events).toEqual(['provider', 'identity', 'data']);
  });

  it('does not delete identity or data when provider revocation fails', async () => {
    const deleteIdentity = vi.fn();
    const db = fakeDb();
    const service = new AccountSafetyService(
      db,
      localDevelopmentApiEnv(),
      { revokeForAccountDeletion: async () => { throw new Error('provider unavailable'); } },
      deleteIdentity,
    );
    await expect(service.deleteAccount(user)).rejects.toThrow('provider unavailable');
    expect(deleteIdentity).not.toHaveBeenCalled();
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it('treats an already absent internal account as deleted', async () => {
    const revoker = vi.fn();
    const db = fakeDb({ user: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() } });
    const service = new AccountSafetyService(db, localDevelopmentApiEnv(), { revokeForAccountDeletion: revoker }, vi.fn());
    await expect(service.deleteAccount(user)).resolves.toEqual({ deleted: true });
    expect(revoker).not.toHaveBeenCalled();
  });

  it('scopes support diagnostics to the authenticated internal account', async () => {
    const db = fakeDb({ user: { findUnique: vi.fn().mockResolvedValue({
      profile: { onboardingWelcomeCompleted: true, onboardingCompletedAt: null },
      providerSelection: null, bankAccountInitialization: null,
      googleHealthConnection: null, externalProviderConnections: [],
    }), delete: vi.fn() } });
    const service = new AccountSafetyService(db, localDevelopmentApiEnv(), { revokeForAccountDeletion: vi.fn() }, vi.fn());
    await service.diagnostics(user);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id } }));
    expect(db.bankDayProcessingState.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: user.id }) }));
    expect(db.ingestionSyncSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: user.id } }));
  });
});
