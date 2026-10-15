import { settingsOptions } from '../settings-concurrency/settings-concurrency';
import { plannedTreatInputSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { PlannedTreatRepository } from './planned-treat.repository';

export function createPlannedTreatRouter(
  repository: PlannedTreatRepository,
  userSource: RequestUserSource,
) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json(await repository.getForUser(resolveRequestUser(userSource, res).id, settingsOptions(req, res)));
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

      res.status(201).json(await repository.createOrReplaceForUser(resolveRequestUser(userSource, res), parsedInput.data, settingsOptions(req, res, true)));
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

      res.json(await repository.updateForUser(resolveRequestUser(userSource, res).id, parsedInput.data, settingsOptions(req, res, true)));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/', async (req, res, next) => {
    try {
      await repository.deleteForUser(resolveRequestUser(userSource, res).id, settingsOptions(req, res, true));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
