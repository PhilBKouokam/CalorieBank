import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { env } from '../src/env';
import { decryptProviderSecret } from '../src/modules/provider-oauth/token-crypto';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';
import { WhoopService } from '../src/modules/whoop/whoop.service';

describe('WHOOP OAuth connection', () => {
  it('uses the documented OAuth endpoints and scopes, persists encrypted tokens, and consumes state once', async () => {
    const db = new PrismaClient();
    const id = randomUUID();
    const encryptionKey = Buffer.alloc(32, 19).toString('base64');
    const config = {
      ...env,
      WHOOP_CLIENT_ID: 'whoop-client-id',
      WHOOP_CLIENT_SECRET: 'whoop-client-secret',
      WHOOP_REDIRECT_URI: 'https://api.example.test/v1/me/integrations/whoop/callback',
      WHOOP_TOKEN_ENCRYPTION_KEY: encryptionKey,
    };
    const service = new WhoopService(
      db,
      {} as TodayAggregateRepository,
      config,
      async () => new Response(JSON.stringify({
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        expires_in: 3600,
        scope: 'read:workout offline',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      () => new Date('2026-08-17T18:00:00.000Z'),
    );
    try {
      const authorizationUrl = await service.createAuthorizationUrl(
        { id, email: `${id}@test.local` },
        'caloriebank://integrations',
      );
      const url = new URL(authorizationUrl);
      const state = url.searchParams.get('state');
      expect(url.origin).toBe('https://api.prod.whoop.com');
      expect(url.pathname).toBe('/oauth/oauth2/auth');
      expect(url.searchParams.get('scope')).toBe('read:workout offline');
      expect(state).toHaveLength(8);

      await expect(service.completeAuthorization('authorization-code', state!))
        .resolves.toBe('caloriebank://integrations');
      const connection = await db.externalProviderConnection.findUniqueOrThrow({
        where: { userId_provider: { userId: id, provider: 'whoop' } },
      });
      expect(connection.encryptedAccessToken).not.toContain('access-secret');
      expect(connection.encryptedRefreshToken).not.toContain('refresh-secret');
      expect(decryptProviderSecret(connection.encryptedRefreshToken!, encryptionKey)).toBe('refresh-secret');
      await expect(service.completeAuthorization('authorization-code', state!))
        .rejects.toThrow('invalid or expired');
    } finally {
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    }
  });
});
