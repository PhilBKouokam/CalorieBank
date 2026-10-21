import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { createAuthenticationBoundary } from '../src/auth/current-user';
import { env } from '../src/env';

const proofPath = '/google0aac822cbde53d15.html';
const proof = 'google-site-verification: google0aac822cbde53d15.html';

function hostedApp() {
  const config = {
    ...env, APP_ENV: 'beta' as const, AUTH_MODE: 'clerk' as const,
    CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: 'sk_test_fixture',
  };
  const verifyCredential = vi.fn(async () => null);
  const app = createApp(config, {
    authenticationBoundary: createAuthenticationBoundary(config, {} as PrismaClient, verifyCredential),
    finalizationScheduler: null,
  });
  return { app, verifyCredential };
}

describe('exact callback-domain ownership proof', () => {
  it('serves the exact downloaded challenge without credentials or a redirect', async () => {
    const { app, verifyCredential } = hostedApp();
    const response = await request(app).get(proofPath).expect(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers.location).toBeUndefined();
    expect(response.text).toBe(proof);
    expect(Buffer.byteLength(response.text)).toBe(53);
    expect(createHash('sha256').update(response.text).digest('hex'))
      .toBe('1ad0cccd434f13ce34773feedd4707cafe00c90850c132cb1d86b0d6cae30904');
    expect(verifyCredential).not.toHaveBeenCalled();
  });

  it.each([
    ['get', '/v1/me/today'],
    ['get', '/v1/me/integrations/fitbit/authorize'],
    ['get', '/google-other.html'],
    ['post', proofPath],
  ] as const)('preserves authentication for %s %s', async (method, path) => {
    const { app } = hostedApp();
    await request(app)[method](path).expect(401);
  });

  it('preserves existing public health and provider-cancellation behavior', async () => {
    const { app } = hostedApp();
    await request(app).get('/health').expect(200);
    const response = await request(app)
      .get('/v1/me/integrations/fitbit/callback?error=access_denied').expect(302);
    expect(response.headers.location).toBe('caloriebank://integrations?fitbit=failed');
  });
});
