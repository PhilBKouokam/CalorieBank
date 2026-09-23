import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { manualIntakeMutationSchema } from '@caloriebank/schemas';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { AppError } from '../../errors';
import { requireIntakeCapability } from '../../security/intake-capability';
import { createRateLimit } from '../../security/rate-limit';
import { getLocalDateForTimezone } from '../today/today.time';
import { ManualIntakeRepository, resolveManualIntake } from './manual-intake.repository';

export function createManualIntakeRouter(db: PrismaClient, users: RequestUserSource, selectionEnabled: boolean) {
  const router = Router(), repository = new ManualIntakeRepository(db, selectionEnabled);
  router.get('/', async (_req, res, next) => {
    try {
      requireIntakeCapability('manual_estimate');
      const userId = resolveRequestUser(users, res).id;
      const result = await db.$transaction(async (tx) => {
        const [profile, selection, state] = await Promise.all([
          tx.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
          tx.providerSelection.findUnique({ where: { userId }, select: { authoritativeIntakeProvider: true, updatedAt: true } }),
          tx.manualIntakeState.findUnique({ where: { userId } }),
        ]);
        const localDate = getLocalDateForTimezone(profile?.timezone ?? 'UTC');
        return { selectionEnabled, selected: selection?.authoritativeIntakeProvider === 'manual_estimate',
          localDate, revision: state?.revision ?? 0, selectionRevision: selection?.updatedAt.toISOString() ?? null,
          estimate: await resolveManualIntake(tx, userId, new Date(`${localDate}T00:00:00Z`)) };
      }, { isolationLevel: 'RepeatableRead' });
      res.json(result);
    } catch (error) { next(error); }
  });
  router.put('/', createRateLimit({ limit: 120, windowMs: 15 * 60 * 1000, operation: 'manual_intake_write' }), async (req, res, next) => {
    try {
      requireIntakeCapability('manual_estimate');
      const parsed = manualIntakeMutationSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError('Enter a valid whole-calorie amount.', 400, { code: 'INVALID_MANUAL_INTAKE' });
      res.json(await repository.mutate(resolveRequestUser(users, res).id, parsed.data));
    } catch (error) { next(error); }
  });
  return router;
}
