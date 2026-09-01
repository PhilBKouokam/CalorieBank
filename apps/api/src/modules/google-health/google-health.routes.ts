import {
  googleHealthAuthorizationResponseSchema,
  googleHealthBurnParityDiagnosticResponseSchema,
  googleHealthSyncResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { getLocalDateForTimezone } from '../today/today.time';
import type { GoogleHealthFitbitService } from './google-health.service';

function timezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) throw new AppError('Timezone is invalid.', 400);
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); } catch { throw new AppError('Timezone is invalid.', 400); }
  return value;
}

export function createGoogleHealthFitbitRouter(service: GoogleHealthFitbitService, userSource: RequestUserSource) {
  const router = Router();
  router.get('/authorize', async (req, res, next) => {
    try {
      const mobileRedirectUri = typeof req.query.mobileRedirectUri === 'string'
        ? req.query.mobileRedirectUri : 'caloriebank://integrations';
      res.json(googleHealthAuthorizationResponseSchema.parse({ authorizationUrl: await service.createAuthorizationUrl(resolveRequestUser(userSource, res), mobileRedirectUri) }));
    } catch (error) { next(error); }
  });
  router.get('/callback', async (req, res, next) => {
    service.logOAuthStage('oauth_callback_received', {
      codePresent: typeof req.query.code === 'string',
      statePresent: typeof req.query.state === 'string',
    });
    try {
      if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') {
        const error = new AppError('Google authorization callback is incomplete.', 400);
        service.logOAuthFailure('callback_validation', error);
        throw error;
      }
      service.logOAuthStage('authorization_code_present');
      const redirect = await service.completeAuthorization(req.query.code, req.query.state);
      res.redirect(`${redirect}${redirect.includes('?') ? '&' : '?'}fitbit=connected`);
      service.logOAuthStage('mobile_redirect_success', { scheme: 'caloriebank' });
    } catch (error) { next(error); }
  });
  router.post('/sync', async (req, res, next) => {
    try {
      const zone = timezone(req.body?.timezone);
      res.json(googleHealthSyncResponseSchema.parse(await service.syncRollingWindow(
        resolveRequestUser(userSource, res), getLocalDateForTimezone(zone), zone,
        req.body?.force === true, req.body?.initialHistory === true ? 8 : 3,
      )));
    } catch (error) { next(error); }
  });
  router.get('/diagnostics/burn-parity', async (req, res, next) => {
    try {
      const zone = timezone(req.query.timezone);
      if (typeof req.query.localDate !== 'string') {
        throw new AppError('Diagnostic date is required.', 400);
      }
      res.json(googleHealthBurnParityDiagnosticResponseSchema.parse(
        await service.inspectBurnParity(resolveRequestUser(userSource, res), req.query.localDate, zone),
      ));
    } catch (error) { next(error); }
  });
  router.delete('/', async (_req, res, next) => {
    try { await service.disconnect(resolveRequestUser(userSource, res)); res.status(204).send(); } catch (error) { next(error); }
  });
  return router;
}
