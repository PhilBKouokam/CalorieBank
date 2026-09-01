import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createAuthenticationBoundary,
  resolveVerifiedClerkIdentity,
  type VerifiedIdentity,
} from '../src/auth/current-user';
import { createApp } from '../src/app';
import { prisma } from '../src/db/client';
import { env } from '../src/env';

const createdUserIds: string[] = [];
const createdSubjects: string[] = [];

function clerkConfig() {
  return {
    ...env,
    APP_ENV: 'local' as const,
    AUTH_MODE: 'clerk' as const,
    CLERK_PUBLISHABLE_KEY: 'pk_test_identity_isolation',
    CLERK_SECRET_KEY: 'sk_test_identity_isolation',
    TODAY_INGESTION_MODE: 'device' as const,
  };
}

function identity(label: string): VerifiedIdentity {
  const nonce = randomUUID();
  const subject = `user_${label}_${nonce}`;
  createdSubjects.push(subject);
  return { subject, email: `${label}-${nonce}@identity.test` };
}

afterEach(async () => {
  if (createdSubjects.length > 0) {
    await prisma.user.deleteMany({ where: { authSubject: { in: createdSubjects.splice(0) } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  }
});

describe('Clerk identity provisioning', () => {
  it('creates isolated users by subject, keeps re-logins stable, and never provisions a new subject as DEV_USER_ID', async () => {
    const config = clerkConfig();
    const identityA = identity('a');
    const identityB = identity('b');

    const userA = await resolveVerifiedClerkIdentity(prisma, config, identityA);
    const userB = await resolveVerifiedClerkIdentity(prisma, config, identityB);
    createdUserIds.push(userA.id, userB.id);

    expect(userA.id).not.toBe(userB.id);
    expect(userB.id).not.toBe(config.DEV_USER_ID);
    await expect(resolveVerifiedClerkIdentity(prisma, config, identityB)).resolves.toEqual(userB);

    const [profileA, profileB, openingB] = await Promise.all([
      prisma.userProfile.findUniqueOrThrow({ where: { userId: userA.id } }),
      prisma.userProfile.findUniqueOrThrow({ where: { userId: userB.id } }),
      prisma.bankAccountInitialization.findUniqueOrThrow({ where: { userId: userB.id } }),
    ]);
    expect(profileA.onboardingCompletedAt).toBeNull();
    expect(profileB.onboardingWelcomeCompleted).toBe(false);
    expect(profileB.onboardingCompletedAt).toBeNull();
    expect(openingB.status).toBe('WAITING_FOR_OPENING_DATA');
  });

  it('makes concurrent first requests for one verified subject converge on one internal user', async () => {
    const config = clerkConfig();
    const unknown = identity('concurrent');
    const resolved = await Promise.all(
      Array.from({ length: 4 }, () => resolveVerifiedClerkIdentity(prisma, config, unknown)),
    );
    createdUserIds.push(resolved[0]!.id);
    expect(new Set(resolved.map((user) => user.id)).size).toBe(1);
    await expect(prisma.user.count({ where: { authSubject: unknown.subject } })).resolves.toBe(1);
  });

  it('keeps A and a newly provisioned B isolated through authenticated /v1/me routes', async () => {
    const config = clerkConfig();
    const identityA = identity('route-a');
    const identityB = identity('route-b');
    const userA = await resolveVerifiedClerkIdentity(prisma, config, identityA);
    createdUserIds.push(userA.id);

    const boundary = createAuthenticationBoundary(config, prisma, async (request) => {
      const token = request.header('authorization')?.replace(/^Bearer /, '');
      if (token === 'A') return identityA;
      if (token === 'B') return identityB;
      return null;
    });
    const app = createApp(config, { authenticationBoundary: boundary });

    await request(app).put('/v1/me/goal-configuration').set('Authorization', 'Bearer A').send({
      goalMode: 'cut', dailyEnergyAdjustment: -350, adjustmentSource: 'manual_calories',
    }).expect(200);
    await request(app).post('/v1/me/planned-treat').set('Authorization', 'Bearer A').send({
      name: 'A only', requiredCalories: 900,
    }).expect(201);

    const [onboardingB, preferencesB, summaryB] = await Promise.all([
      request(app).get('/v1/me/onboarding').set('Authorization', 'Bearer B').expect(200),
      request(app).get('/v1/me/dashboard-preferences').set('Authorization', 'Bearer B').expect(200),
      request(app).get('/v1/me/bank-summary').set('Authorization', 'Bearer B').expect(200),
    ]);
    const userB = await prisma.user.findUniqueOrThrow({ where: { authSubject: identityB.subject } });
    createdUserIds.push(userB.id);

    expect(userB.id).not.toBe(userA.id);
    expect(onboardingB.body).toMatchObject({ stage: 'welcome', completed: false, goalConfigured: false });
    expect(preferencesB.body).toMatchObject({ showPlannedTreat: false, showSteps: false });
    expect(summaryB.body).toMatchObject({ availableBankCalories: 0, recoveryCalories: 0 });
    await expect(prisma.plannedTreat.count({ where: { userId: userB.id } })).resolves.toBe(0);
    await expect(prisma.providerSelection.count({ where: { userId: userB.id } })).resolves.toBe(0);
    await expect(prisma.googleHealthConnection.count({ where: { userId: userB.id } })).resolves.toBe(0);
    await expect(prisma.externalProviderConnection.count({ where: { userId: userB.id } })).resolves.toBe(0);

    await request(app).get('/v1/me/goal-configuration').set('Authorization', 'Bearer A')
      .expect(200)
      .expect((response) => expect(response.body.dailyEnergyAdjustment).toBe(-350));
    await expect(prisma.plannedTreat.findFirstOrThrow({ where: { userId: userA.id } }))
      .resolves.toMatchObject({ name: 'A only' });
  });

  it('rejects a Clerk bearer token when the API is explicitly in development-auth mode', async () => {
    const config = { ...env, APP_ENV: 'local' as const, AUTH_MODE: 'development' as const };
    const boundary = createAuthenticationBoundary(config, prisma);
    const app = createApp(config, { authenticationBoundary: boundary });
    await request(app).get('/v1/me/today').set('Authorization', 'Bearer clerk-token-is-not-accepted')
      .expect(409)
      .expect((response) => expect(response.body.error.details.code).toBe('DEVELOPMENT_AUTH_CONFLICT'));
  });

  it('returns normal first-run onboarding state for an unknown verified subject', async () => {
    const config = clerkConfig();
    const fresh = identity('first-run');
    const boundary = createAuthenticationBoundary(config, prisma, async (request) => {
      return request.header('authorization') === 'Bearer fresh' ? fresh : null;
    });
    const app = createApp(config, { authenticationBoundary: boundary });

    const response = await request(app).get('/v1/me/onboarding').set('Authorization', 'Bearer fresh').expect(200);
    const created = await prisma.user.findUniqueOrThrow({ where: { authSubject: fresh.subject } });
    createdUserIds.push(created.id);

    expect(response.body).toMatchObject({
      stage: 'welcome',
      welcomeCompleted: false,
      completed: false,
      goalConfigured: false,
      openingBankStatus: 'waiting_for_opening_data',
    });
  });

  it('provisions a separate user when a recreated Clerk subject uses an existing email', async () => {
    const config = clerkConfig();
    const original = identity('same-email');
    const first = await resolveVerifiedClerkIdentity(prisma, config, original);
    createdUserIds.push(first.id);
    const recreated = { subject: `user_recreated_${randomUUID()}`, email: original.email };
    createdSubjects.push(recreated.subject);

    const second = await resolveVerifiedClerkIdentity(prisma, config, recreated);
    createdUserIds.push(second.id);
    expect(second.id).not.toBe(first.id);
    await expect(prisma.user.count({ where: { email: original.email } })).resolves.toBe(2);
  });
});
