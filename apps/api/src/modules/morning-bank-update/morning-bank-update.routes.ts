import {
  morningBankUpdateDeviceInputSchema,
  morningBankUpdatePreferenceInputSchema,
  morningBankUpdateSettingsResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { createRateLimit } from '../../security/rate-limit';
import type { MorningBankUpdateService } from './morning-bank-update.service';

export function createMorningBankUpdateRouter(service: MorningBankUpdateService, userSource: RequestUserSource) {
  const router = Router();
  const preferences = createRateLimit({ limit: 60, windowMs: 60 * 1000, operation: 'notification_preference' });
  const registrations = createRateLimit({ limit: 60, windowMs: 60 * 1000, operation: 'notification_registration' });
  // Privacy cleanup remains available even after other notification writes are throttled.
  const releases = createRateLimit({ limit: 30, windowMs: 60 * 1000, operation: 'notification_device_release' });
  router.get('/', async (_req, res, next) => {
    try { res.json(morningBankUpdateSettingsResponseSchema.parse(await service.settings(resolveRequestUser(userSource, res).id))); }
    catch (error) { next(error); }
  });
  router.patch('/preference', preferences, async (req, res, next) => {
    try {
      const input = morningBankUpdatePreferenceInputSchema.parse(req.body);
      res.json(morningBankUpdateSettingsResponseSchema.parse(await service.setPreference(resolveRequestUser(userSource, res).id, input.enabled)));
    } catch (error) { next(error); }
  });
  router.put('/device', registrations, async (req, res, next) => {
    try {
      const input = morningBankUpdateDeviceInputSchema.parse(req.body);
      res.json(morningBankUpdateSettingsResponseSchema.parse(await service.registerDevice(resolveRequestUser(userSource, res).id, input)));
    } catch (error) { next(error); }
  });
  router.delete('/device', releases, async (_req, res, next) => {
    try { await service.unregisterDevice(resolveRequestUser(userSource, res).id); res.status(204).send(); }
    catch (error) { next(error); }
  });
  return router;
}
