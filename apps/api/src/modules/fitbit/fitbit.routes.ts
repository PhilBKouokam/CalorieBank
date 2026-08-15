import {
  fitbitAuthorizationResponseSchema,
  fitbitSyncResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { getLocalDateForTimezone } from '../today/today.time';
import type { FitbitService } from './fitbit.service';

function timezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) throw new AppError('Timezone is invalid.', 400);
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); } catch { throw new AppError('Timezone is invalid.', 400); }
  return value;
}

export function createFitbitRouter(service: FitbitService, user: DevelopmentUser) {
  const router = Router();
  router.get('/authorize', async (req, res, next) => {
    try {
      const mobileRedirectUri = typeof req.query.mobileRedirectUri === 'string'
        ? req.query.mobileRedirectUri : 'caloriebank://integrations';
      res.json(fitbitAuthorizationResponseSchema.parse({ authorizationUrl: await service.createAuthorizationUrl(user, mobileRedirectUri) }));
    } catch (error) { next(error); }
  });
  router.get('/callback', async (req, res, next) => {
    try {
      if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') throw new AppError('Fitbit callback is incomplete.', 400);
      const redirect = await service.completeAuthorization(req.query.code, req.query.state);
      res.redirect(`${redirect}${redirect.includes('?') ? '&' : '?'}fitbit=connected`);
    } catch (error) { next(error); }
  });
  router.post('/sync', async (req, res, next) => {
    try {
      const zone = timezone(req.body?.timezone);
      res.json(fitbitSyncResponseSchema.parse(await service.syncRollingWindow(
        user, getLocalDateForTimezone(zone), zone, req.body?.force === true,
      )));
    } catch (error) { next(error); }
  });
  router.delete('/', async (_req, res, next) => {
    try { await service.disconnect(user); res.status(204).send(); } catch (error) { next(error); }
  });
  return router;
}
