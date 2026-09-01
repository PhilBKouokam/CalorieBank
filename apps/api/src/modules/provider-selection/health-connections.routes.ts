import {
  healthConnectionSelectionInputSchema,
  healthConnectionsResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { AppError } from '../../errors';
import type { ProviderSelectionRepository } from './provider-selection.repository';

export function createHealthConnectionsRouter(
  repository: ProviderSelectionRepository,
  userSource: RequestUserSource,
) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(healthConnectionsResponseSchema.parse(
        await repository.getHealthConnections(resolveRequestUser(userSource, res).id),
      ));
    } catch (error) { next(error); }
  });

  router.put('/burned', async (req, res, next) => {
    try {
      const input = healthConnectionSelectionInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Calories burned source is invalid.', 400, input.error.flatten());
      res.json(healthConnectionsResponseSchema.parse(
        await repository.selectBurned(resolveRequestUser(userSource, res), input.data.optionId),
      ));
    } catch (error) { next(error); }
  });

  router.put('/eaten', async (req, res, next) => {
    try {
      const input = healthConnectionSelectionInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Calories eaten source is invalid.', 400, input.error.flatten());
      res.json(healthConnectionsResponseSchema.parse(
        await repository.selectEaten(resolveRequestUser(userSource, res), input.data.optionId),
      ));
    } catch (error) { next(error); }
  });

  return router;
}
