import {
  ingestionSyncSessionCompleteSchema,
  ingestionSyncSessionResponseSchema,
  ingestionSyncSessionStartSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { FinalizationScheduler } from '../finalization-orchestration/finalization-orchestration.service';
import type { SyncSessionRepository } from './sync-session.repository';
import { getLocalDateForTimezone } from './today.time';

function rollingDates(localDate: string) {
  const anchor = new Date(`${localDate}T12:00:00.000Z`);
  return Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  });
}

export function createSyncSessionRouter(
  repository: SyncSessionRepository,
  developmentUser: DevelopmentUser,
  scheduler?: FinalizationScheduler,
  now: () => Date = () => new Date(),
) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const parsed = ingestionSyncSessionStartSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError('Sync session is invalid.', 400, parsed.error.flatten());
      const startedAt = now();
      if (getLocalDateForTimezone(parsed.data.timezone, startedAt) !== parsed.data.localDate) {
        throw new AppError('Sync date does not match the supplied timezone.', 400);
      }
      const allowedDates = new Set(rollingDates(parsed.data.localDate));
      if (parsed.data.datesQueried.some((date) => !allowedDates.has(date))) {
        throw new AppError('Sync dates must stay within the rolling three-day window.', 400);
      }
      const session = await repository.start(developmentUser, parsed.data, startedAt);
      res.status(201).json(ingestionSyncSessionResponseSchema.parse(session));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:sessionId', async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId;
      if (!sessionId) throw new AppError('Sync session is required.', 400);
      const parsed = ingestionSyncSessionCompleteSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError('Sync result is invalid.', 400, parsed.error.flatten());
      let session = await repository.complete(developmentUser.id, sessionId, parsed.data, now());
      if (scheduler) {
        const outcome = await scheduler.execute({
          user: developmentUser,
          currentLocalDate: getLocalDateForTimezone(session.timezone ?? '', now()),
          timezone: session.timezone ?? 'UTC',
          dates: session.datesQueried,
          trigger: session.trigger ?? 'integration_test',
          syncSessionId: session.id,
        });
        session = await repository.recordOrchestrationOutcome(
          developmentUser.id,
          session.id,
          outcome,
        );
      }
      res.json(ingestionSyncSessionResponseSchema.parse(session));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
