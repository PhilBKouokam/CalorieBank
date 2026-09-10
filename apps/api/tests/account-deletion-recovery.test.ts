import { describe, expect, it, vi } from 'vitest';
import { AccountSafetyService } from '../src/modules/account-safety/account-safety.service';
import { GoogleHealthFitbitService } from '../src/modules/google-health/google-health.service';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import { localDevelopmentApiEnv } from './support/test-api-env';
const user = { id: '10000000-0000-4000-8000-000000000001', email: 'deletion@test.local' };
const key = Buffer.alloc(32, 17).toString('base64');
function revocationFixture(responses: Response[]) {
  const db = {
    googleHealthConnection: { findUnique: vi.fn().mockResolvedValue({ encryptedRefreshToken: encryptGoogleHealthSecret('disposable-fixture', key) }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    googleHealthOAuthAttempt: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const fetcher = vi.fn(async () => responses.shift()!);
  const service = new GoogleHealthFitbitService(db as never, {} as never, {
    ...localDevelopmentApiEnv(), GOOGLE_HEALTH_CLIENT_ID: 'test', GOOGLE_HEALTH_CLIENT_SECRET: 'test',
    GOOGLE_HEALTH_REDIRECT_URI: 'https://example.com/callback', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key,
  }, undefined, fetcher);
  return { db, fetcher, service };
}
describe('deletion provider cleanup', () => {
  it('accepts confirmed already-expired/revoked authorization instead of stranding deletion', async () => {
    const f = revocationFixture([Response.json({ error: 'invalid_token' }, { status: 400 })]);
    await f.service.revokeForAccountDeletion(user);
    expect(f.db.googleHealthConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not confuse other 400 errors with confirmed revocation', async () => {
    const f = revocationFixture([Response.json({ error: 'invalid_request' }, { status: 400 })]);
    await expect(f.service.revokeForAccountDeletion(user)).rejects.toMatchObject({ statusCode: 502 });
    expect(f.db.googleHealthConnection.deleteMany).not.toHaveBeenCalled();
  });
  it('also revokes cached access when the refresh credential has already expired', async () => {
    const f = revocationFixture([Response.json({ error: 'invalid_token' }, { status: 400 }), new Response(null, { status: 200 })]);
    f.db.googleHealthConnection.findUnique.mockResolvedValue({
      encryptedRefreshToken: encryptGoogleHealthSecret('expired', key),
      encryptedAccessToken: encryptGoogleHealthSecret('still-active', key),
    });
    await f.service.revokeForAccountDeletion(user);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.db.googleHealthConnection.deleteMany).toHaveBeenCalledTimes(1);
  });
  it('retries a transient provider failure and preserves cleanup ordering', async () => {
    const f = revocationFixture([Response.json({}, { status: 503 }), new Response(null, { status: 200 })]);
    await f.service.revokeForAccountDeletion(user);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.db.googleHealthConnection.deleteMany).toHaveBeenCalledTimes(1);
  });
});
describe('durable deletion recovery', () => {
  it('resumes after identity is already deleted and retries the final cascade', async () => {
    const identity = vi.fn().mockRejectedValue({ status: 404 });
    const provider = { revokeForAccountDeletion: vi.fn().mockResolvedValue(undefined) };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ authSubject: 'gone' }), update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([user]), deleteMany: vi.fn().mockRejectedValueOnce(new Error('db transient')).mockResolvedValue({ count: 1 }) },
      pushDeviceRegistration: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new AccountSafetyService(db as never, localDevelopmentApiEnv(), provider, identity);
    await service.resumePendingDeletions();
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { deletionRequestedAt: expect.any(Date) } }));
    expect(db.pushDeviceRegistration.updateMany).toHaveBeenCalledWith({ where: { userId: user.id }, data: { active: false } });
    expect(db.user.deleteMany).toHaveBeenCalledTimes(2);
    expect(identity).toHaveBeenCalledTimes(1);
  });
  it('keeps durable intent and does not cascade when Clerk rejects deletion', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue({ authSubject: 'present' }), update: vi.fn(), deleteMany: vi.fn() }, pushDeviceRegistration: { updateMany: vi.fn() } };
    const service = new AccountSafetyService(db as never, localDevelopmentApiEnv(), { revokeForAccountDeletion: vi.fn() }, async () => { throw { status: 403 }; });
    await expect(service.deleteAccount(user)).rejects.toMatchObject({ statusCode: 502 });
    expect(db.user.update).toHaveBeenCalled(); expect(db.user.deleteMany).not.toHaveBeenCalled();
  });
});
