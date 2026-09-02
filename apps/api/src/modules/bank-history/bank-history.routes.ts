import { bankHistoryRangeSchema, healthHistoryDiagnosticQuerySchema, historicalSourceMutationSchema } from '@caloriebank/schemas';
import { Router } from 'express';

import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import type { BankHistoryRepository } from './bank-history.repository';

const logDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function createBankHistoryRouter(
  repository: BankHistoryRepository,
  userSource: RequestUserSource,
) {
  const router = Router();

  router.get('/bank-summary', async (_req, res, next) => {
    try {
      res.json(await repository.getSummary(resolveRequestUser(userSource, res).id));
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

      res.json(await repository.getHistory(resolveRequestUser(userSource, res).id, parsedRange.data));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bank-opening', async (_req, res, next) => {
    try {
      res.json(await repository.getOpeningBankDetail(resolveRequestUser(userSource, res).id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bank-history-diagnostics', async (req, res, next) => {
    try {
      const parsed = healthHistoryDiagnosticQuerySchema.safeParse({
        dates: typeof req.query.dates === 'string' ? req.query.dates.split(',') : [],
      });
      if (!parsed.success) throw new AppError('Diagnostic dates are invalid.', 400, parsed.error.flatten());
      if (!repository.getHealthHistoryDiagnostics) throw new AppError('Health diagnostics are unavailable.', 501);
      res.json(await repository.getHealthHistoryDiagnostics(
        resolveRequestUser(userSource, res).id,
        parsed.data.dates,
      ));
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

      const detail = await repository.getDayDetail(resolveRequestUser(userSource, res).id, logDate);

      if (!detail) {
        throw new AppError('Finalized bank day was not found.', 404);
      }

      res.json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.get('/bank-history/:logDate/sources', async (req, res, next) => {
    try {
      const logDate = req.params.logDate;
      if (!logDate || !logDatePattern.test(logDate)) throw new AppError('Bank history date is invalid.', 400);
      if (!repository.getHistoricalSourceOptions) throw new AppError('Historical source control is unavailable.', 501);
      res.json(await repository.getHistoricalSourceOptions(resolveRequestUser(userSource, res).id, logDate));
    } catch (error) {
      next(error);
    }
  });

  for (const role of ['expenditure', 'intake'] as const) {
    router.patch(`/bank-history/:logDate/sources/${role}`, async (req, res, next) => {
      try {
        const logDate = req.params.logDate;
        if (!logDate || !logDatePattern.test(logDate)) throw new AppError('Bank history date is invalid.', 400);
        const parsed = historicalSourceMutationSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError('Historical source choice is invalid.', 400, parsed.error.flatten());
        if (!repository.setHistoricalSource) throw new AppError('Historical source control is unavailable.', 501);
        res.json(await repository.setHistoricalSource(resolveRequestUser(userSource, res), logDate, role, parsed.data));
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
