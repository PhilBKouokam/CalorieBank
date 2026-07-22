import { Router } from 'express';
import { todayResponseSchema } from '@caloriebank/schemas';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { getLocalDateForTimezone } from './today.time';
import type { TodayAggregateRepository } from './today.repository';

function validTimezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch {
    return null;
  }
}

export function createTodayRouter(
  repository: TodayAggregateRepository,
  developmentUser: DevelopmentUser,
) {
  const router = Router();

  router.get('/today', async (_req, res, next) => {
    try {
      const timezone = validTimezone(_req.query.timezone) ?? 'America/Chicago';
      const localDate = getLocalDateForTimezone(timezone);
      const today = await repository.getTodayForUser(developmentUser.id, localDate, timezone);

      res.json(todayResponseSchema.parse(today));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
