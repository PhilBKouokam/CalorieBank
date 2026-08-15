import {
  providerSelectionInputSchema,
  providerSelectionResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { ProviderSelectionRepository } from './provider-selection.repository';

export function createProviderSelectionRouter(
  repository: ProviderSelectionRepository,
  user: DevelopmentUser,
) {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try {
      res.json(providerSelectionResponseSchema.parse(await repository.get(user.id)));
    } catch (error) { next(error); }
  });
  router.put('/', async (req, res, next) => {
    try {
      const input = providerSelectionInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Provider selection is invalid.', 400, input.error.flatten());
      res.json(providerSelectionResponseSchema.parse(await repository.update(user, input.data)));
    } catch (error) { next(error); }
  });
  return router;
}
