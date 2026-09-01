import { goalConfigurationInputSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { GoalConfigurationRepository } from './goal-configuration.repository';
import { AppError } from '../../errors';

export function createGoalConfigurationRouter(
  repository: GoalConfigurationRepository,
  userSource: RequestUserSource,
  beforeUpdate?: (user: ReturnType<typeof resolveRequestUser>) => Promise<{ ready: boolean; unresolvedDates: string[] }>,
) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const user = resolveRequestUser(userSource, res);
      const configuration = await repository.findByUserId(user.id);

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
      const user = resolveRequestUser(userSource, res);
      const parsedInput = goalConfigurationInputSchema.safeParse(req.body);

      if (!parsedInput.success) {
        throw new AppError('Goal configuration is invalid.', 400, parsedInput.error.flatten());
      }

      const existing = await repository.findByUserId(user.id);
      if (existing && beforeUpdate) {
        const preparation = await beforeUpdate(user);
        if (!preparation.ready) {
          console.info(JSON.stringify({
            component: 'account_lifecycle',
            event: 'goal_change_blocked_for_pending_days',
            userSuffix: user.id.slice(-8),
            unresolvedCount: preparation.unresolvedDates.length,
          }));
          throw new AppError(
            'CalorieBank is still finishing a recent day. Try again after your data updates.',
            409,
            { code: 'RECENT_DAY_STILL_UPDATING' },
          );
        }
      }

      const configuration = await repository.upsertForUser(user, parsedInput.data);
      res.json(configuration);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
