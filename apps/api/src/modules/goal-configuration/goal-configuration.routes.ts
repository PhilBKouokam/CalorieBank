import { goalConfigurationInputSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import type {
  DevelopmentUser,
  GoalConfigurationRepository,
} from './goal-configuration.repository';
import { AppError } from '../../errors';

export function createGoalConfigurationRouter(
  repository: GoalConfigurationRepository,
  developmentUser: DevelopmentUser,
) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const configuration = await repository.findByUserId(developmentUser.id);

      if (!configuration) {
        throw new AppError('Goal configuration has not been configured.', 404);
      }

      res.json(configuration);
    } catch (error) {
      next(error);
    }
  });

  router.put('/', async (req, res, next) => {
    try {
      const parsedInput = goalConfigurationInputSchema.safeParse(req.body);

      if (!parsedInput.success) {
        throw new AppError('Goal configuration is invalid.', 400, parsedInput.error.flatten());
      }

      const configuration = await repository.upsertForUser(developmentUser, parsedInput.data);
      res.json(configuration);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
