import {
  providerSelectionInputSchema,
  providerSelectionResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { ProviderSelectionRepository } from './provider-selection.repository';

export function createProviderSelectionRouter(
  repository: ProviderSelectionRepository,
  userSource: RequestUserSource,
) {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try {
      res.json(providerSelectionResponseSchema.parse(await repository.get(resolveRequestUser(userSource, res).id)));
    } catch (error) { next(error); }
  });
  router.put('/', async (req, res, next) => {
    try {
      const input = providerSelectionInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Provider selection is invalid.', 400, input.error.flatten());
      res.json(providerSelectionResponseSchema.parse(await repository.update(resolveRequestUser(userSource, res), input.data)));
    } catch (error) { next(error); }
  });
  return router;
}
