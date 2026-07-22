import {
  currentDayExpenditureSyncSchema,
  currentDayIntakeSyncSchema,
  currentDayStepSyncSchema,
  currentDayWorkoutSyncSchema,
  ingestionSyncResultSchema,
  workoutSyncResultSchema,
} from '@caloriebank/schemas';
import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  normalizeDailyExpenditureAggregate,
  normalizeDailyIntakeAggregate,
  normalizeDailyStepAggregate,
  normalizeCurrentDayWorkout,
} from '@caloriebank/domain';
import { Router } from 'express';

import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { getLocalDateForTimezone } from './today.time';
import type { TodayAggregateRepository } from './today.repository';

const APPLE_HEALTH_PROVIDER = 'apple_health';

async function assertSessionOwnership(
  repository: TodayAggregateRepository,
  sessionId: string | undefined,
  userId: string,
) {
  if (sessionId) await repository.assertSyncSessionOwnedBy(sessionId, userId);
}

function assertNotFutureLocalDate(localDate: string, timezone: string, now: Date) {
  if (localDate > getLocalDateForTimezone(timezone, now)) {
    throw new AppError('Ingestion date cannot be in the future.', 400);
  }
}

export function createTodayIngestionRouter(
  repository: TodayAggregateRepository,
  developmentUser: DevelopmentUser,
  now: () => Date = () => new Date(),
) {
  const router = Router();

  router.post('/expenditure', async (req, res, next) => {
    try {
      const parsed = currentDayExpenditureSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Current-day expenditure is invalid.', 400, parsed.error.flatten());
      }

      const receivedAt = now();
      assertNotFutureLocalDate(parsed.data.localDate, parsed.data.timezone, receivedAt);
      const isCurrentDay =
        getLocalDateForTimezone(parsed.data.timezone, receivedAt) === parsed.data.localDate;
      await assertSessionOwnership(repository, parsed.data.syncSessionId, developmentUser.id);
      const result = await repository.upsertExpenditureAggregate(
        developmentUser,
        normalizeDailyExpenditureAggregate({
          userId: developmentUser.id,
          localDate: parsed.data.localDate,
          timezone: parsed.data.timezone,
          provider: APPLE_HEALTH_PROVIDER,
          providerRecordId: `${APPLE_HEALTH_PROVIDER}:expenditure:${parsed.data.localDate}`,
          ...(parsed.data.sourceMetadata
            ? {
                activeEnergyCalories: parsed.data.sourceMetadata.activeEnergyCalories,
                basalEnergyCalories: parsed.data.sourceMetadata.basalEnergyCalories,
              }
            : {}),
          rawTotalDailyExpenditure: parsed.data.rawTotalDailyExpenditure,
          adjustmentFactor: V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
          importedAt: receivedAt,
          providerUpdatedAt: new Date(parsed.data.providerUpdatedAt),
          syncStatus: parsed.data.syncStatus,
          isCurrentDay,
          ...(parsed.data.syncSessionId ? { syncSessionId: parsed.data.syncSessionId } : {}),
        }),
      );

      res.json(ingestionSyncResultSchema.parse({ result }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/intake', async (req, res, next) => {
    try {
      const parsed = currentDayIntakeSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Current-day intake is invalid.', 400, parsed.error.flatten());
      }

      const receivedAt = now();
      assertNotFutureLocalDate(parsed.data.localDate, parsed.data.timezone, receivedAt);
      const isCurrentDay =
        getLocalDateForTimezone(parsed.data.timezone, receivedAt) === parsed.data.localDate;
      await assertSessionOwnership(repository, parsed.data.syncSessionId, developmentUser.id);
      const result = await repository.upsertIntakeAggregate(
        developmentUser,
        normalizeDailyIntakeAggregate({
          userId: developmentUser.id,
          localDate: parsed.data.localDate,
          timezone: parsed.data.timezone,
          provider: APPLE_HEALTH_PROVIDER,
          providerRecordId: `${APPLE_HEALTH_PROVIDER}:intake:${parsed.data.localDate}`,
          totalCaloriesConsumed: parsed.data.totalCaloriesConsumed,
          importedAt: receivedAt,
          providerUpdatedAt: new Date(parsed.data.providerUpdatedAt),
          syncStatus: 'ready',
          isCurrentDay,
          ...(parsed.data.syncSessionId ? { syncSessionId: parsed.data.syncSessionId } : {}),
        }),
      );

      res.json(ingestionSyncResultSchema.parse({ result }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/steps', async (req, res, next) => {
    try {
      const parsed = currentDayStepSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Current-day steps are invalid.', 400, parsed.error.flatten());
      }
      const receivedAt = now();
      assertNotFutureLocalDate(parsed.data.localDate, parsed.data.timezone, receivedAt);
      const isCurrentDay =
        getLocalDateForTimezone(parsed.data.timezone, receivedAt) === parsed.data.localDate;
      await assertSessionOwnership(repository, parsed.data.syncSessionId, developmentUser.id);
      const result = await repository.upsertStepAggregate(
        developmentUser,
        normalizeDailyStepAggregate({
          userId: developmentUser.id,
          localDate: parsed.data.localDate,
          timezone: parsed.data.timezone,
          provider: APPLE_HEALTH_PROVIDER,
          providerRecordId: `${APPLE_HEALTH_PROVIDER}:steps:${parsed.data.localDate}`,
          totalSteps: parsed.data.totalSteps,
          importedAt: receivedAt,
          providerUpdatedAt: new Date(parsed.data.providerUpdatedAt),
          syncStatus: 'ready',
          isCurrentDay,
          ...(parsed.data.syncSessionId ? { syncSessionId: parsed.data.syncSessionId } : {}),
        }),
      );
      res.json(ingestionSyncResultSchema.parse({ result }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/workouts', async (req, res, next) => {
    try {
      const parsed = currentDayWorkoutSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Current-day workouts are invalid.', 400, parsed.error.flatten());
      }
      const receivedAt = now();
      assertNotFutureLocalDate(parsed.data.localDate, parsed.data.timezone, receivedAt);
      const isCurrentDay =
        getLocalDateForTimezone(parsed.data.timezone, receivedAt) === parsed.data.localDate;
      await assertSessionOwnership(repository, parsed.data.syncSessionId, developmentUser.id);
      if (
        parsed.data.workouts.some(
          (workout) =>
            getLocalDateForTimezone(parsed.data.timezone, new Date(workout.startedAt)) !==
              parsed.data.localDate ||
            getLocalDateForTimezone(parsed.data.timezone, new Date(workout.endedAt)) !==
              parsed.data.localDate,
        )
      ) {
        throw new AppError('Workout timestamps must belong to the supplied local day.', 400);
      }
      const results = await repository.upsertWorkouts(
        developmentUser,
        parsed.data.workouts.map((workout) =>
          normalizeCurrentDayWorkout({
            userId: developmentUser.id,
            localDate: parsed.data.localDate,
            timezone: parsed.data.timezone,
            provider: APPLE_HEALTH_PROVIDER,
            providerWorkoutId: workout.providerWorkoutId,
            activityType: workout.activityType,
            displayName: workout.displayName,
            startedAt: new Date(workout.startedAt),
            endedAt: new Date(workout.endedAt),
            durationMinutes: workout.durationMinutes,
            totalEnergyBurned: workout.totalEnergyBurned,
            totalDistance: workout.totalDistance,
            distanceUnit: workout.distanceUnit,
            importedAt: receivedAt,
            providerUpdatedAt: new Date(parsed.data.providerUpdatedAt),
            syncStatus: 'ready',
            isCurrentDay,
            ...(parsed.data.syncSessionId ? { syncSessionId: parsed.data.syncSessionId } : {}),
          }),
        ),
      );
      const deleted = await repository.deleteMissingWorkoutsForDay?.(
        developmentUser.id,
        parsed.data.localDate,
        APPLE_HEALTH_PROVIDER,
        parsed.data.workouts.map((workout) => workout.providerWorkoutId),
        new Date(parsed.data.providerUpdatedAt),
      ) ?? 0;
      res.json(
        workoutSyncResultSchema.parse({
          created: results.filter((result) => result === 'created').length,
          updated: results.filter((result) => result === 'updated').length,
          skipped: results.filter(
            (result) => result === 'unchanged' || result === 'ignored_stale',
          ).length,
          deleted,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
