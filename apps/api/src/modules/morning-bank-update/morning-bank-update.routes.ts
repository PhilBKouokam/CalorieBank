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
  const writes = createRateLimit({ limit: 12, windowMs: 15 * 60 * 1000, operation: 'notification_settings' });
  router.get('/', async (_req, res, next) => {
    try { res.json(morningBankUpdateSettingsResponseSchema.parse(await service.settings(resolveRequestUser(userSource, res).id))); }
    catch (error) { next(error); }
  });
  router.patch('/preference', writes, async (req, res, next) => {
    try {
      const input = morningBankUpdatePreferenceInputSchema.parse(req.body);
      res.json(morningBankUpdateSettingsResponseSchema.parse(await service.setPreference(resolveRequestUser(userSource, res).id, input.enabled)));
    } catch (error) { next(error); }
  });
  router.put('/device', writes, async (req, res, next) => {
    try {
      const input = morningBankUpdateDeviceInputSchema.parse(req.body);
      res.json(morningBankUpdateSettingsResponseSchema.parse(await service.registerDevice(resolveRequestUser(userSource, res).id, input)));
    } catch (error) { next(error); }
  });
  router.delete('/device', writes, async (_req, res, next) => {
    try { await service.unregisterDevice(resolveRequestUser(userSource, res).id); res.status(204).send(); }
    catch (error) { next(error); }
  });
  return router;
}
