import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../../errors';
import { createRateLimit } from '../../security/rate-limit';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { AccountSafetyService } from './account-safety.service';

const deleteSchema = z.object({ confirmation: z.literal('DELETE') });

export function createAccountSafetyRouter(service: AccountSafetyService, userSource: RequestUserSource) {
  const router = Router();
  router.get('/support-diagnostics', async (_req, res, next) => {
    try { res.json(await service.diagnostics(resolveRequestUser(userSource, res))); } catch (error) { next(error); }
  });
  router.delete('/account', createRateLimit({ limit: 3, windowMs: 60 * 60 * 1000, operation: 'account_deletion' }), async (req, res, next) => {
    try {
      const parsed = deleteSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError('Type DELETE to confirm account deletion.', 400, { code: 'DELETION_CONFIRMATION_REQUIRED' });
      await service.deleteAccount(resolveRequestUser(userSource, res));
      res.status(204).send();
    } catch (error) { next(error); }
  });
  return router;
}
