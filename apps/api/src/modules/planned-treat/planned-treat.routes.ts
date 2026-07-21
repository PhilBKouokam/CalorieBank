import { plannedTreatInputSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { PlannedTreatRepository } from './planned-treat.repository';

export function createPlannedTreatRouter(
  repository: PlannedTreatRepository,
  developmentUser: DevelopmentUser,
) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(await repository.getForUser(developmentUser.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const parsedInput = plannedTreatInputSchema.safeParse(req.body);

      if (!parsedInput.success) {
        throw new AppError('Planned Treat is invalid.', 400, parsedInput.error.flatten());
      }

      res.status(201).json(await repository.createOrReplaceForUser(developmentUser, parsedInput.data));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/', async (req, res, next) => {
    try {
      const parsedInput = plannedTreatInputSchema.safeParse(req.body);

      if (!parsedInput.success) {
        throw new AppError('Planned Treat is invalid.', 400, parsedInput.error.flatten());
      }

      res.json(await repository.updateForUser(developmentUser.id, parsedInput.data));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/', async (_req, res, next) => {
    try {
      await repository.deleteForUser(developmentUser.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
