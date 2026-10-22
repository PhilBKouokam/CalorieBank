import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthenticationBoundary } from '../src/auth/current-user';
import { boundedIdentityOperation } from '../src/auth/account-lifecycle-lock';
import { AccountSafetyService } from '../src/modules/account-safety/account-safety.service';
import { createAccountSafetyRouter } from '../src/modules/account-safety/account-safety.routes';
import { currentUser } from '../src/auth/current-user';
import { AppError, errorHandler } from '../src/errors';
import { localDevelopmentApiEnv } from './support/test-api-env';

const sdk = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@clerk/express', () => ({
  createClerkClient: () => ({ users: sdk }), getAuth: () => ({ userId: 'synthetic-subject' }),
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
}));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

function fixture(mapped: object | null = null) {
  let locked = false;
  const tx = { $queryRaw: vi.fn(async () => { locked = true; return []; }), user: {
    findUnique: vi.fn(async () => mapped), create: vi.fn(async () => ({ id: 'new-owner', email: 'fresh@example.invalid' })),
  } };
  const db = { user: { findUnique: vi.fn(async () => mapped) },
    $transaction: vi.fn(async (operation: (value: typeof tx) => Promise<unknown>) => { try { return await operation(tx); } finally { locked = false; } }),
  };
  const config = { ...localDevelopmentApiEnv(), AUTH_MODE: 'clerk' as const, APP_ENV: 'beta' as const,
    CLERK_SECRET_KEY: 'sk_test_synthetic', CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic' };
  const boundary = createAuthenticationBoundary(config, db as never);
  const app = express(); app.use(boundary.requireUser);
  app.get('/v1/me/probe', (_req, res) => res.json(res.locals.currentUser)); app.use(errorHandler);
  return { app, db, tx, locked: () => locked };
}

describe('production Clerk adapter serialization', () => {
  it.each([[404, 401, 'AUTHENTICATION_REQUIRED'], [429, 503, 'IDENTITY_SERVICE_UNAVAILABLE'], [503, 503, 'IDENTITY_SERVICE_UNAVAILABLE']])(
    'maps SDK status %s to a static response and never creates', async (status, expected, code) => {
      const f = fixture();
      sdk.getUser.mockImplementation(async () => { expect(f.locked()).toBe(true); throw { status, message: 'private SDK payload', errors: ['secret'] }; });
      const response = await request(f.app).get('/v1/me/probe').expect(expected as number);
      expect(response.body.error.details.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toContain('private SDK'); expect(f.tx.user.create).not.toHaveBeenCalled();
    });
  it('fresh SDK lookup occurs inside the lifecycle lock and provisions only its matching subject', async () => {
    const f = fixture(); sdk.getUser.mockImplementation(async () => {
      expect(f.locked()).toBe(true);
      return { id: 'synthetic-subject', primaryEmailAddressId: 'email', emailAddresses: [{ id: 'email', emailAddress: 'Fresh@example.invalid' }] };
    });
    await request(f.app).get('/v1/me/probe').expect(200);
    expect(f.tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authSubject: 'synthetic-subject', email: 'fresh@example.invalid' }) }));
  });
  it('rejects a mapped deleting account without consulting SDK or creating anything', async () => {
    const f = fixture({ id: 'owner', authProvider: 'clerk', deletionRequestedAt: new Date() });
    await request(f.app).get('/v1/me/probe').expect(409);
    expect(sdk.getUser).not.toHaveBeenCalled(); expect(f.tx.user.create).not.toHaveBeenCalled();
  });
  it('bounds remote work and never resumes its caller after a late completion', async () => {
    vi.useFakeTimers(); let finish!: () => void; let aborted: AbortSignal | undefined;
    const continuation = vi.fn();
    const operation = boundedIdentityOperation(signal => { aborted = signal; return new Promise<void>(resolve => { finish = resolve; }); }).then(continuation);
    const rejected = expect(operation).rejects.toMatchObject({ statusCode: 503, details: { code: 'IDENTITY_SERVICE_TIMEOUT' } });
    await vi.advanceTimersByTimeAsync(8_000); await rejected; expect(aborted?.aborted).toBe(true); finish(); await Promise.resolve();
    expect(continuation).not.toHaveBeenCalled();
  });
});


describe('pending deletion HTTP cleanup compatibility', () => {
  it.each(['production', 'injected'])('permits only the two existing cleanup paths using %s authentication, without provisioning', async mode => {
    let owner: { id: string; email: string; authSubject: string; authProvider: string; deletionRequestedAt: Date | null } | null = {
      id: 'synthetic-owner', email: 'synthetic@example.invalid', authSubject: 'synthetic-subject', authProvider: 'clerk', deletionRequestedAt: null,
    };
    const original = { id: owner.id, email: owner.email };
    const user = {
      findUnique: vi.fn(async () => owner),
      update: vi.fn(async () => { if (owner) owner.deletionRequestedAt = new Date(); return owner; }),
      deleteMany: vi.fn(async () => { owner = null; return { count: 1 }; }),
      create: vi.fn(),
    };
    const db = { user, pushDeviceRegistration: { updateMany: vi.fn() }, $queryRaw: vi.fn(),
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(db) };
    const config = { ...localDevelopmentApiEnv(), AUTH_MODE: 'clerk' as const, APP_ENV: 'beta' as const,
      CLERK_SECRET_KEY: 'sk_test_synthetic', CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic' };
    const revocation = vi.fn().mockRejectedValueOnce(new AppError('Temporary provider failure.', 502)).mockResolvedValue(undefined);
    const identityDeletion = vi.fn(async () => undefined);
    const service = new AccountSafetyService(db as never, config, { revokeForAccountDeletion: revocation }, identityDeletion);
    const boundary = createAuthenticationBoundary(config, db as never, mode === 'injected'
      ? async () => owner ? { subject: owner.authSubject, email: owner.email } : null : undefined);
    const app = express(); app.use(express.json()); app.use(boundary.requireUser);
    app.use('/v1/me', createAccountSafetyRouter(service, currentUser));
    const cleanup = vi.fn(); app.delete('/v1/me/morning-bank-update/device', (_req, res) => { cleanup(); res.sendStatus(204); });
    app.use((_req, res) => res.sendStatus(204)); app.use(errorHandler);
    await request(app).delete('/v1/me/account').send({ confirmation: 'DELETE' }).expect(502);
    expect(owner?.deletionRequestedAt).toBeInstanceOf(Date);
    for (const path of ['/v1/me/profile', '/v1/me/integrations/fitbit', '/v1/me/support-diagnostics', '/v1/me/account', '/v1/me/morning-bank-update/device']) {
      await request(app).get(path).expect(409); await request(app).post(path).send({}).expect(409);
    }
    await request(app).delete('/v1/me/account/extra').expect(409);
    await request(app).delete('/v1/me/morning-bank-update/device/extra').expect(409);
    await request(app).delete('/v1/me/morning-bank-update/device').expect(204); expect(cleanup).toHaveBeenCalledTimes(1);
    await request(app).delete('/v1/me/account').send({ confirmation: 'wrong' }).expect(400);
    await request(app).delete('/v1/me/account').send({ confirmation: 'DELETE' }).expect(204);
    expect(revocation).toHaveBeenCalledTimes(2); expect(identityDeletion).toHaveBeenCalledTimes(1);
    expect(user.deleteMany).toHaveBeenCalledWith({ where: { id: original.id } });
    expect(user.create).not.toHaveBeenCalled(); expect(owner).toBeNull();
    sdk.getUser.mockRejectedValue({ status: 404 });
    await request(app).delete('/v1/me/account').send({ confirmation: 'DELETE' }).expect(401);
    expect(user.create).not.toHaveBeenCalled();
  });
});
