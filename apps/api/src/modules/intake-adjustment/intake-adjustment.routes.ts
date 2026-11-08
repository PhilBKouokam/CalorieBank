import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { intakeAdjustmentMutationSchema } from '@caloriebank/schemas';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { AppError } from '../../errors';
import { createRateLimit } from '../../security/rate-limit';
import { requireAdjustmentCapability } from '../../security/intake-capability';
import { HistoricalIntakeAdjustmentRepository } from './historical-intake-adjustment.repository';
import { PrismaBankHistoryRepository } from '../bank-history/bank-history.repository';
import { IntakeAdjustmentRepository } from './intake-adjustment.repository';
export function createIntakeAdjustmentRouter(db: PrismaClient, users: RequestUserSource) {
  const router = Router(), repository = new IntakeAdjustmentRepository(db);
  router.get('/', async (_req, res, next) => { try {
    requireAdjustmentCapability(); res.json(await repository.read(resolveRequestUser(users, res).id));
  } catch (error) { next(error); } });
  router.put('/', createRateLimit({ limit: 120, windowMs: 15 * 60 * 1000, operation: 'intake_adjustment_write' }), async (req, res, next) => { try {
    requireAdjustmentCapability();
    const parsed = intakeAdjustmentMutationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Enter a whole number from 0 to 100,000.', 400);
    res.json(await repository.mutate(resolveRequestUser(users, res).id, parsed.data));
  } catch (error) { next(error); } });
  const history = new HistoricalIntakeAdjustmentRepository(db, new PrismaBankHistoryRepository(db));
  router.get('/history/:localDate', async (req, res, next) => { try {
    res.json(await history.read(resolveRequestUser(users, res).id, String(req.params.localDate)));
  } catch (error) { next(error); } });
  router.put('/history/:localDate', createRateLimit({ limit: 120, windowMs: 15 * 60 * 1000, operation: 'historical_intake_adjustment_write' }), async (req, res, next) => { try {
    requireAdjustmentCapability();
    const parsed = intakeAdjustmentMutationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Enter a whole number from 0 to 100,000.', 400);
    res.json(await history.mutate(resolveRequestUser(users, res), String(req.params.localDate), parsed.data));
  } catch (error) { next(error); } });
  return router;
}
