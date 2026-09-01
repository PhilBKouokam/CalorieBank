import { Router } from 'express';
import { z } from 'zod';

import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { AccountLifecycleCoordinator } from './account-lifecycle.service';

const inputSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  trigger: z.enum(['app_foreground', 'manual_refresh']).default('app_foreground'),
});

export function createAccountLifecycleRouter(
  coordinator: AccountLifecycleCoordinator,
  userSource: RequestUserSource,
) {
  const router = Router();
  router.post('/foreground', async (req, res, next) => {
    try {
      const user = resolveRequestUser(userSource, res);
      const input = inputSchema.parse(req.body);
      const profile = await coordinator.prepareForegroundUser(user.id, input.timezone);
      if (!profile.onboardingComplete) {
        res.json({ shouldSyncHealthKit: false, unresolvedDates: [], errors: [] });
        return;
      }
      const result = await coordinator.runUser(user, input.timezone, input.trigger);
      res.json({
        shouldSyncHealthKit: true,
        unresolvedDates: result.unresolvedDates,
        errors: result.errors,
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
