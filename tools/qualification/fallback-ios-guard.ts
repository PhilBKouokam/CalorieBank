import type { PrismaClient } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import { currentUser } from '../../apps/api/src/auth/current-user';
import { acceptsIosFixtureBody, iosFixtureRoute, iosRollingDates, type SyntheticIosFixture } from './fallback-ios-policy';

export function createIosFixtureStore(db: PrismaClient) {
  return {
    selection: async (userId: string) => db.providerSelection.findUnique({ where: { userId }, select: {
      intakeSelected: true, authoritativeIntakeProvider: true, appleHealthIntakeWriterBundleId: true,
      appleHealthIntakeWriterDisplayName: true, updatedAt: true,
    } }),
    session: async (userId: string, id: string) => db.ingestionSyncSession.findFirst({ where: { userId, id }, select: {
      provider: true, localDate: true, timezone: true, startedAt: true, completedAt: true,
      providerAdapterVersion: true, datesQueried: true,
    } }),
    evidence: async (userId: string, sessionId: string, fixture: SyntheticIosFixture) => db.dailyIntakeAggregate.count({ where: {
      userId, syncSessionId: sessionId, provider: 'apple_health', localDate: new Date(`${fixture.localDate}T00:00:00Z`),
      timezone: fixture.timezone, writerBundleIdentifier: fixture.writer, writerDisplayName: fixture.writerName,
      totalCaloriesConsumed: fixture.totalCalories, isCurrentDay: true, syncStatus: 'ready',
    } }),
  };
}
export type IosFixtureStore = ReturnType<typeof createIosFixtureStore>;

export function createIosFixturePayloadGuard(fixture: SyntheticIosFixture | null, now: () => number = Date.now): RequestHandler {
  return (request, response, next) => {
    const route = iosFixtureRoute(request.method, request.path);
    if (!route || !fixture) return next();
    express.json({ limit: '32kb' })(request, response, error => {
      if (error || !acceptsIosFixtureBody(route, request.body as unknown, fixture, now())) {
        return response.status(403).json({ error: 'Only the configured synthetic iOS fixture is permitted.' });
      }
      next();
    });
  };
}

/** Runs only after the unchanged Clerk/internal-account boundary. Reads only.
 * Normal API repositories still enforce account lifecycle, source and ownership.
 * This additional admission check is not a new transactional accounting boundary.
 */
export function createIosFixtureGuard(fixture: SyntheticIosFixture | null, store: IosFixtureStore,
  now: () => number = Date.now): RequestHandler {
  return async (request, response, next) => {
    const route = iosFixtureRoute(request.method, request.path);
    if (!route || !fixture) return next();
    const deny = () => response.status(403).json({ error: 'This request is outside the synthetic iOS session.' });
    try {
      const time = now();
      if (!acceptsIosFixtureBody(route, request.body as unknown, fixture, time)) return void deny();
      const userId = currentUser(response).id;
      const selection = await store.selection(userId);
      if (!selection?.intakeSelected || selection.authoritativeIntakeProvider !== 'apple_health'
        || selection.appleHealthIntakeWriterBundleId !== fixture.writer
        || selection.appleHealthIntakeWriterDisplayName !== fixture.writerName) return void deny();
      if (route === 'start') return next();
      // Body was strictly validated above. No client owner ID is accepted.
      const sessionId = route === 'complete' ? request.path.split('/').at(-1)
        : (request.body as { syncSessionId: string }).syncSessionId;
      if (!sessionId) return void deny();
      const session = await store.session(userId, sessionId);
      const dates = iosRollingDates(fixture.localDate);
      if (!session || session.completedAt || session.provider !== 'apple_health'
        || session.localDate.toISOString().slice(0, 10) !== fixture.localDate || session.timezone !== fixture.timezone
        || session.providerAdapterVersion !== 'apple-health-v2-rolling-window'
        || session.startedAt.getTime() < fixture.startedAt || session.startedAt.getTime() > time
        || time - session.startedAt.getTime() > 300000 || selection.updatedAt > session.startedAt
        || session.datesQueried.length !== dates.length || !dates.every(date => session.datesQueried.includes(date))) return void deny();
      // Reject completion without that session's actual accepted synthetic input.
      if (route === 'complete' && await store.evidence(userId, sessionId, fixture) !== 1) return void deny();
      next();
    } catch {
      // Fail closed on database/authentication faults; never serialize raw errors.
      deny();
    }
  };
}
