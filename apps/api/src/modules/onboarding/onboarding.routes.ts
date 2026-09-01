import {
  onboardingStatusResponseSchema,
  onboardingWelcomeInputSchema,
} from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { OnboardingRepository } from './onboarding.repository';

export function createOnboardingRouter(repository: OnboardingRepository, userSource: RequestUserSource) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(onboardingStatusResponseSchema.parse(
        await repository.getStatus(resolveRequestUser(userSource, res)),
      ));
    } catch (error) { next(error); }
  });

  router.patch('/welcome', async (req, res, next) => {
    try {
      const input = onboardingWelcomeInputSchema.safeParse(req.body);
      if (!input.success) throw new AppError('Welcome progress is invalid.', 400, input.error.flatten());
      res.json(onboardingStatusResponseSchema.parse(
        await repository.completeWelcome(resolveRequestUser(userSource, res)),
      ));
    } catch (error) { next(error); }
  });

  router.post('/complete', async (_req, res, next) => {
    try {
      res.json(onboardingStatusResponseSchema.parse(
        await repository.completeOnboarding(resolveRequestUser(userSource, res)),
      ));
    } catch (error) { next(error); }
  });

  return router;
}
