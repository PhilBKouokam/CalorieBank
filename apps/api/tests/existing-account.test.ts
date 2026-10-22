import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireExistingRequestAccount } from '../src/auth/existing-account';
import { createAuthenticationBoundary } from '../src/auth/current-user';
import { AppError, errorHandler } from '../src/errors';
import type { ApiEnv } from '../src/env';

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.invalid' };
describe('existing request account boundary', () => {
  it('requires an existing non-deleting owner and never has a create fallback', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await requireExistingRequestAccount({ user: { updateMany } } as unknown as Parameters<typeof requireExistingRequestAccount>[0], user);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: user.id, deletionRequestedAt: null }, data: { email: user.email } });
    updateMany.mockResolvedValue({ count: 0 });
    await expect(requireExistingRequestAccount({ user: { updateMany } } as unknown as Parameters<typeof requireExistingRequestAccount>[0], user))
      .rejects.toMatchObject({ statusCode: 409, details: { code: 'ACCOUNT_UNAVAILABLE' } });
  });

  it('propagates database failure rather than provisioning a replacement', async () => {
    const failure = new Error('synthetic database failure');
    const updateMany = vi.fn().mockRejectedValue(failure);
    await expect(requireExistingRequestAccount({ user: { updateMany } } as unknown as Parameters<typeof requireExistingRequestAccount>[0], user)).rejects.toBe(failure);
  });

  it('preserves explicit local-development bootstrap at identity resolution, and rejects bearer credentials before provisioning', async () => {
    const upsert = vi.fn().mockResolvedValue(user);
    const config = { APP_ENV: 'local', AUTH_MODE: 'development', DEV_USER_ID: user.id, DEV_USER_EMAIL: user.email } as ApiEnv;
    const boundary = createAuthenticationBoundary(config, { user: { upsert } } as unknown as PrismaClient);
    const app = express(); app.use(boundary.requireUser);
    app.get('/v1/me/probe', (_req, res) => res.json(res.locals.currentUser)); app.use(errorHandler);
    await request(app).get('/v1/me/probe').expect(200, user);
    expect(upsert).toHaveBeenCalledWith({ where: { id: user.id }, update: {}, create: {
      id: user.id, email: user.email, profile: { create: { timezone: 'UTC' } } } });
    upsert.mockClear();
    await request(app).get('/v1/me/probe').set('Authorization', 'Bearer synthetic').expect(409);
    expect(upsert).not.toHaveBeenCalled();
    expect(() => createAuthenticationBoundary({ ...config, APP_ENV: 'beta' }, {} as PrismaClient)).toThrow('restricted');
  });

  it('never falls through after local bootstrap failure', async () => {
    const boundary = createAuthenticationBoundary({ APP_ENV: 'local', AUTH_MODE: 'development', DEV_USER_ID: user.id, DEV_USER_EMAIL: user.email } as ApiEnv,
      { user: { upsert: vi.fn().mockRejectedValue(new AppError('Synthetic bootstrap failure.', 503)) } } as unknown as PrismaClient);
    const reached = vi.fn(); const app = express(); app.use(boundary.requireUser);
    app.get('/v1/me/probe', (_req, res) => { reached(); res.sendStatus(200); }); app.use(errorHandler);
    await request(app).get('/v1/me/probe').expect(503); expect(reached).not.toHaveBeenCalled();
  });

  it('keeps User provisioning out of all runtime modules', () => {
    const root = resolve(__dirname, '../src/modules');
    function files(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : entry.name.endsWith('.ts') ? [resolve(directory, entry.name)] : []);
    }
    const violations = files(root).filter(path => /\.user\s*\.\s*(?:upsert|create|createMany)\s*\(/.test(readFileSync(path, 'utf8')));
    expect(violations).toEqual([]);
  });
});
