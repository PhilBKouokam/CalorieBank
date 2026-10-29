import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { parseApiEnv } from '../src/env';
import { parseGoogleHealthTesterCohort, requireGoogleHealthTester } from '../src/modules/google-health/google-health-admission';
import { GOOGLE_HEALTH_CONNECTION_UNAVAILABLE, googleHealthAuthorizationResult, googleHealthConnectionUnavailable } from '../../mobile/lib/google-health-connection';

const id = randomUUID(); const subject = 'synthetic-clerk-subject'; const healthId = 'synthetic-google-health-identity';
const policy = { version: 1, members: [{ accountId: id, clerkSubject: subject, healthUserIds: [healthId] }] };
const config = { APP_ENV: 'beta' as const, GOOGLE_HEALTH_TESTER_COHORT_JSON: JSON.stringify(policy) };
const owner = { id, authProvider: 'clerk', authSubject: subject, deletionRequestedAt: null };
function database(row: unknown = owner) {
  const findUnique = vi.fn(async () => row);
  return { db: { user: { findUnique } } as unknown as PrismaClient, findUnique };
}
describe('Google tester configuration and exact identity admission', () => {
  it('accepts explicit account/subject/provider pins, including one shared approved provider identity', () => {
    expect(parseGoogleHealthTesterCohort(JSON.stringify(policy))).toEqual(policy);
    expect(parseGoogleHealthTesterCohort(JSON.stringify({ version: 1, members: [] }))).not.toBeNull();
    expect(parseGoogleHealthTesterCohort(JSON.stringify({ version: 1, members: [...policy.members,
      { accountId: randomUUID(), clerkSubject: 'synthetic-other', healthUserIds: [healthId] }] }))).not.toBeNull();
  });
  it.each(['', '{}', 'null', 'broken', JSON.stringify({ ...policy, secret: 'not-allowed' }),
    JSON.stringify({ version: 1, members: [policy.members[0], policy.members[0]] }),
    JSON.stringify({ version: 1, members: [{ ...policy.members[0], healthUserIds: [] }] }),
    JSON.stringify({ version: 1, members: [{ ...policy.members[0], healthUserIds: [healthId, healthId] }] }),
  ])('fails closed for malformed or ambiguous configuration %#', value => {
    expect(parseGoogleHealthTesterCohort(value)).toBeNull();
    expect(() => parseApiEnv({ NODE_ENV: 'test', GOOGLE_HEALTH_TESTER_COHORT_JSON: value })).toThrow();
  });
  it('denies missing hosted configuration and nonmembers before any database/provider operation', async () => {
    const h = database();
    for (const c of [{ APP_ENV: 'beta' as const }, { APP_ENV: 'production' as const }, config]) {
      await expect(requireGoogleHealthTester(h.db, c, randomUUID())).rejects.toMatchObject({ statusCode: 403,
        message: GOOGLE_HEALTH_CONNECTION_UNAVAILABLE, details: { code: 'GOOGLE_HEALTH_NOT_AVAILABLE' } });
    }
    expect(h.findUnique).not.toHaveBeenCalled();
  });
  it('local legacy configuration is unchanged, while explicit empty local policy denies', async () => {
    const h = database();
    await requireGoogleHealthTester(h.db, { APP_ENV: 'local' }, id);
    await expect(requireGoogleHealthTester(h.db, { APP_ENV: 'local', GOOGLE_HEALTH_TESTER_COHORT_JSON: '{"version":1,"members":[]}' }, id)).rejects.toMatchObject({ statusCode: 403 });
    expect(h.findUnique).not.toHaveBeenCalled();
  });
  it('requires the current exact owner and approved returned Google identity', async () => {
    const h = database();
    await requireGoogleHealthTester(h.db, config, id);
    await requireGoogleHealthTester(h.db, config, id, healthId);
    await expect(requireGoogleHealthTester(h.db, config, id, 'unapproved-google')).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each([null, { ...owner, id: randomUUID() }, { ...owner, authSubject: 'fresh-same-email-subject' },
    { ...owner, authProvider: 'development' }, { ...owner, deletionRequestedAt: new Date() },
  ])('rejects stale/recreated/deleting/wrong-provider ownership %#', async row => {
    const h = database(row);
    try { await requireGoogleHealthTester(h.db, config, id, healthId); throw new Error('Expected denial'); }
    catch (error) {
      expect(error).toMatchObject({ statusCode: 403, message: GOOGLE_HEALTH_CONNECTION_UNAVAILABLE });
      const text = String(error) + JSON.stringify(error);
      for (const privateValue of [id, subject, healthId]) expect(text).not.toContain(privateValue);
    }
  });
});
describe('consumer connection outcome', () => {
  it('preserves the typed denial and uses short copy without cohort/security detail', () => {
    expect(googleHealthConnectionUnavailable({ code: 'GOOGLE_HEALTH_NOT_AVAILABLE' })).toBe(true);
    expect(googleHealthConnectionUnavailable(null)).toBe(false);
    expect(googleHealthConnectionUnavailable({ code: 'OTHER' })).toBe(false);
    expect(GOOGLE_HEALTH_CONNECTION_UNAVAILABLE).toBe("Google Health connection isn't available yet.");
  });
  it.each(['connected', 'unavailable'] as const)('accepts the canonical %s callback', state => {
    expect(googleHealthAuthorizationResult(`caloriebank://integrations?fitbit=${state}`)).toBe(state);
  });
  it.each(['broken', 'https://untrusted.invalid/?fitbit=connected', 'caloriebank://other?fitbit=connected',
    'caloriebank://integrations?fitbit=failed', 'caloriebank://integrations'])('never claims a connection from an invalid/failed result %#', url => {
    expect(googleHealthAuthorizationResult(url)).toBe('failed');
  });
});
