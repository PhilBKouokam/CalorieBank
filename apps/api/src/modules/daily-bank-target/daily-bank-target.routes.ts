import { dailyBankTargetInputSchema, dailyBankTargetResponseSchema } from '@caloriebank/schemas';
import { Router } from 'express';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { AppError } from '../../errors';
import type { DailyBankTargetRepository } from './daily-bank-target.repository';
import { createRateLimit } from '../../security/rate-limit';

export function createDailyBankTargetRouter(repository: DailyBankTargetRepository, userSource: RequestUserSource) {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try { res.json(dailyBankTargetResponseSchema.parse(await repository.get(resolveRequestUser(userSource, res).id))); }
    catch (error) { next(error); }
  });
  router.put('/', createRateLimit({ limit: 60, windowMs: 15 * 60 * 1000, operation: 'daily_bank_target_write' }), async (req, res, next) => {
    try {
      const input = dailyBankTargetInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Choose a target from 0 to 2,000 calories.', 400);
      res.json(dailyBankTargetResponseSchema.parse(await repository.update(resolveRequestUser(userSource, res).id, input.data.calories)));
    } catch (error) { next(error); }
  });
  return router;
}
