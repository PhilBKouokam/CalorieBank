import { Router } from 'express';
import { todayResponseSchema } from '@caloriebank/schemas';

import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { getLocalDateForTimezone } from './today.time';
import type { TodayAggregateRepository } from './today.repository';

export type TodayPredictionResolver = {
  resolveRestingBurnEstimate(
    user: ReturnType<typeof resolveRequestUser>,
    currentLocalDate: string,
    timezone: string,
  ): Promise<boolean>;
};

type TodayDiagnosticLogger = (
  event: string,
  metadata: Readonly<Record<string, unknown>>,
) => void;

function validTimezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch {
    return null;
  }
}

export function createTodayRouter(
  repository: TodayAggregateRepository,
  userSource: RequestUserSource,
  predictionResolver?: TodayPredictionResolver,
  diagnosticLogger?: TodayDiagnosticLogger,
) {
  const router = Router();

  router.get('/today', async (_req, res, next) => {
    try {
      const timezone = validTimezone(_req.query.timezone) ?? 'America/Chicago';
      const localDate = getLocalDateForTimezone(timezone);
      const user = resolveRequestUser(userSource, res);
      if (predictionResolver) {
        await predictionResolver.resolveRestingBurnEstimate(user, localDate, timezone).catch((error) => {
          diagnosticLogger?.('resting_model_resolution_error', {
            errorType: error instanceof Error ? error.name : typeof error,
          });
        });
      }
      const today = await repository.getTodayForUser(user.id, localDate, timezone);

      if (
        today.burned.raw !== null &&
        today.restOfDayProjection.providerKcalPerHour !== null &&
        today.restOfDayProjection.projectedProviderBurnCalories !== null &&
        today.restOfDayProjection.projectedAdjustedBurnCalories !== null
      ) {
        diagnosticLogger?.('rest_forecast_calculated', {
          currentProviderBurn: today.burned.raw,
          restingKcalPerHour: today.restOfDayProjection.providerKcalPerHour,
          remainingHours: today.restOfDayProjection.remainingMinutes / 60,
          remainingRestBurn:
            today.restOfDayProjection.projectedProviderBurnCalories - today.burned.raw,
          projectedProviderBurn: today.restOfDayProjection.projectedProviderBurnCalories,
          projectedEstimatedActualBurn:
            today.restOfDayProjection.projectedAdjustedBurnCalories,
        });
      }
      diagnosticLogger?.('today_detail_response', {
        restingRatePresent: today.restOfDayProjection.providerKcalPerHour !== null,
        projectedProviderBurnPresent:
          today.restOfDayProjection.projectedProviderBurnCalories !== null,
        projectedEstimatedActualBurnPresent:
          today.restOfDayProjection.projectedAdjustedBurnCalories !== null,
      });

      res.json(todayResponseSchema.parse(today));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
