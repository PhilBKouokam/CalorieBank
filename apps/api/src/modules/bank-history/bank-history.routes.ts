import { bankHistoryRangeSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { BankHistoryRepository } from './bank-history.repository';

const logDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function createBankHistoryRouter(
  repository: BankHistoryRepository,
  developmentUser: DevelopmentUser,
) {
  const router = Router();

  router.get('/bank-summary', async (_req, res, next) => {
    try {
      res.json(await repository.getSummary(developmentUser.id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bank-history', async (req, res, next) => {
    try {
      const parsedRange = bankHistoryRangeSchema.safeParse(req.query.range ?? 'W');

      if (!parsedRange.success) {
        throw new AppError('Bank history range is invalid.', 400, parsedRange.error.flatten());
      }

      res.json(await repository.getHistory(developmentUser.id, parsedRange.data));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bank-history/:logDate', async (req, res, next) => {
    try {
      const logDate = req.params.logDate;

      if (!logDate || !logDatePattern.test(logDate)) {
        throw new AppError('Bank history date is invalid.', 400);
      }

      const detail = await repository.getDayDetail(developmentUser.id, logDate);

      if (!detail) {
        throw new AppError('Finalized bank day was not found.', 404);
      }

      res.json(detail);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
