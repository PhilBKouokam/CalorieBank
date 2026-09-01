import {
  dashboardPreferencesPatchSchema,
  dashboardPreferencesResponseSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { DashboardPreferencesRepository } from './dashboard-preferences.repository';

export function createDashboardPreferencesRouter(
  repository: DashboardPreferencesRepository,
  userSource: RequestUserSource,
) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(dashboardPreferencesResponseSchema.parse(await repository.get(resolveRequestUser(userSource, res))));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/', async (req, res, next) => {
    try {
      const parsed = dashboardPreferencesPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Dashboard preferences are invalid.', 400, parsed.error.flatten());
      }
      res.json(
        dashboardPreferencesResponseSchema.parse(
          await repository.update(resolveRequestUser(userSource, res), parsed.data),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
