import type { OnboardingStatusResponse } from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { currentUser } from '../src/auth/current-user';
import { errorHandler } from '../src/errors';
import { PrismaOnboardingRepository } from '../src/modules/onboarding/onboarding.repository';
import { createOnboardingRouter } from '../src/modules/onboarding/onboarding.routes';

const user = { id: '00000000-0000-4000-8000-000000000041', email: 'missing-account@example.invalid' };

const readyStatus: OnboardingStatusResponse = {
  stage: 'ready',
  welcomeCompleted: true,
  completed: false,
  expenditure: {
    provider: 'apple_health',
    displayName: 'Apple Health',
    connected: true,
    status: 'ready',
    readiness: 'ready',
  },
  intake: {
    provider: 'fatsecret',
    displayName: 'FatSecret',
    connected: true,
    status: 'ready',
    readiness: 'ready',
  },
  goalConfigured: true,
  openingBankStatus: 'initialized',
  openingBankCalories: 0,
  preparation: { expenditure: 'complete', intake: 'complete', history: 'complete' },
};

function accountDb(count: number) {
  const upsert = vi.fn(async () => ({
    userId: user.id,
    timezone: 'UTC',
    onboardingWelcomeCompleted: true,
    onboardingCompletedAt: null,
  }));
  const update = vi.fn(async () => ({ userId: user.id }));
  const updateMany = vi.fn(async () => ({ count }));
  const tx = { user: { updateMany }, userProfile: { upsert, update } };
  const db = {
    user: { updateMany },
    userProfile: { upsert, update },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { db, upsert, update, updateMany };
}

function repository(count: number) {
  const doubles = accountDb(count);
  const repo = new PrismaOnboardingRepository(
    doubles.db as unknown as PrismaClient,
    {} as never,
    {} as never,
  );
  return { ...doubles, repo };
}

describe('onboarding writes require an existing account', () => {
  it('rejects status, welcome, and completion when the account is gone and does not upsert a profile', async () => {
    const { repo, upsert, update, updateMany } = repository(0);

    await expect(repo.getStatus(user)).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'ACCOUNT_UNAVAILABLE' },
    });
    await expect(repo.completeWelcome(user)).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'ACCOUNT_UNAVAILABLE' },
    });
    await expect(repo.completeOnboarding(user)).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'ACCOUNT_UNAVAILABLE' },
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: user.id, deletionRequestedAt: null },
      data: { email: user.email },
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('propagates an account-check failure instead of creating profile data', async () => {
    const failure = new Error('synthetic database failure');
    const { repo, upsert, updateMany } = repository(1);
    updateMany.mockRejectedValue(failure);

    await expect(repo.completeWelcome(user)).rejects.toBe(failure);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts welcome progress only after the account is confirmed', async () => {
    const { db, upsert, updateMany } = repository(1);
    class GuardedOnboardingRepository extends PrismaOnboardingRepository {
      override getStatus(): Promise<OnboardingStatusResponse> {
        return Promise.resolve({ ...readyStatus, stage: 'welcome', welcomeCompleted: true });
      }
    }
    const guarded = new GuardedOnboardingRepository(db as unknown as PrismaClient, {} as never, {} as never);

    await expect(guarded.completeWelcome(user)).resolves.toMatchObject({ welcomeCompleted: true });
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(upsert.mock.invocationCallOrder[0]!);
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: user.id },
      update: { onboardingWelcomeCompleted: true },
      create: { userId: user.id, onboardingWelcomeCompleted: true },
    });
  });

  it('does not mark setup complete after the account disappears', async () => {
    const { db, update, updateMany } = repository(0);
    class ReadyStatusRepository extends PrismaOnboardingRepository {
      override getStatus(): Promise<OnboardingStatusResponse> {
        return Promise.resolve(readyStatus);
      }
    }
    const guarded = new ReadyStatusRepository(db as unknown as PrismaClient, {} as never, {} as never);

    await expect(guarded.completeOnboarding(user)).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'ACCOUNT_UNAVAILABLE' },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: user.id, deletionRequestedAt: null },
      data: { email: user.email },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns the existing 409 account shape from onboarding routes', async () => {
    const { repo, upsert } = repository(0);
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.locals.currentUser = user;
      next();
    });
    app.use('/v1/me/onboarding', createOnboardingRouter(repo, currentUser));
    app.use(errorHandler);

    const status = await request(app).get('/v1/me/onboarding').expect(409);
    const welcome = await request(app).patch('/v1/me/onboarding/welcome').send({ completed: true }).expect(409);
    const completion = await request(app).post('/v1/me/onboarding/complete').expect(409);

    for (const response of [status, welcome, completion]) {
      expect(response.body.error).toMatchObject({
        message: 'This account is unavailable.',
        details: { code: 'ACCOUNT_UNAVAILABLE' },
      });
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});
