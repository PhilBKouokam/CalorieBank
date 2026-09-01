import {
  providerAuthorizationResponseSchema,
  providerRollingSyncResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { getLocalDateForTimezone } from '../today/today.time';
import type { WhoopService } from './whoop.service';

function timezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) throw new AppError('Timezone is invalid.', 400);
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); } catch { throw new AppError('Timezone is invalid.', 400); }
  return value;
}

export function createWhoopRouter(service: WhoopService, userSource: RequestUserSource) {
  const router = Router();
  router.get('/authorize', async (req, res, next) => {
    try {
      const mobileRedirectUri = typeof req.query.mobileRedirectUri === 'string'
        ? req.query.mobileRedirectUri
        : 'caloriebank://integrations';
      res.json(providerAuthorizationResponseSchema.parse({
        authorizationUrl: await service.createAuthorizationUrl(resolveRequestUser(userSource, res), mobileRedirectUri),
      }));
    } catch (error) { next(error); }
  });
  router.get('/callback', async (req, res, next) => {
    try {
      if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') {
        throw new AppError('WHOOP authorization callback is incomplete.', 400);
      }
      const redirect = await service.completeAuthorization(req.query.code, req.query.state);
      res.redirect(`${redirect}${redirect.includes('?') ? '&' : '?'}whoop=connected`);
    } catch (error) { next(error); }
  });
  router.post('/sync', async (req, res, next) => {
    try {
      const zone = timezone(req.body?.timezone);
      res.json(providerRollingSyncResponseSchema.parse(await service.syncRollingWindow(
        resolveRequestUser(userSource, res),
        getLocalDateForTimezone(zone),
        zone,
        req.body?.force === true,
      )));
    } catch (error) { next(error); }
  });
  router.delete('/', async (_req, res, next) => {
    try { await service.disconnect(resolveRequestUser(userSource, res)); res.status(204).send(); } catch (error) { next(error); }
  });
  return router;
}
