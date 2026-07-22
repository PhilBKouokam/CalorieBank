import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyIntakeAggregate,
  type NormalizedDailyStepAggregate,
  type NormalizedCurrentDayWorkout,
} from '@caloriebank/domain';
import type { TodayResponse, TodaySoFarDataFreshnessStatus } from '@caloriebank/schemas';
import type {
  CurrentDayWorkout,
  DailyExpenditureAggregate,
  DailyIntakeAggregate,
  DailyStepAggregate,
  IngestionCategoryStatus,
  IngestionSyncSession,
  PrismaClient,
} from '@prisma/client';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { AppError } from '../../errors';
import { getProviderDisplayName, isSyntheticProvider } from './provider-catalog';
import { combineTodayFreshness, currentDayFreshness } from './today.freshness';

export type AggregateUpsertResult = 'created' | 'updated' | 'unchanged' | 'ignored_stale';

export interface TodayAggregateRepository {
  upsertExpenditureAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyExpenditureAggregate,
  ): Promise<AggregateUpsertResult>;
  upsertIntakeAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyIntakeAggregate,
  ): Promise<AggregateUpsertResult>;
  upsertStepAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyStepAggregate,
  ): Promise<AggregateUpsertResult>;
  upsertWorkouts(
    user: DevelopmentUser,
    workouts: readonly NormalizedCurrentDayWorkout[],
  ): Promise<AggregateUpsertResult[]>;
  deleteMissingWorkoutsForDay?(
    userId: string,
    localDate: string,
    provider: string,
    retainedProviderWorkoutIds: readonly string[],
    providerUpdatedAt: Date,
  ): Promise<number>;
  getTodayForUser(userId: string, localDate: string, timezone: string): Promise<TodayResponse>;
  assertSyncSessionOwnedBy(sessionId: string, userId: string): Promise<void>;
}

function parseLocalDate(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function syncStatus(value: string | undefined): TodaySoFarDataFreshnessStatus {
  return (value ?? 'not_connected') as TodaySoFarDataFreshnessStatus;
}

function latestSyncedAt(
  record: Pick<DailyExpenditureAggregate | DailyIntakeAggregate | DailyStepAggregate, 'updatedAt'> | null,
) {
  return record?.updatedAt.toISOString() ?? null;
}

function shouldIgnoreIncoming(existingUpdatedAt: Date | null, incomingUpdatedAt: Date | null) {
  return Boolean(
    existingUpdatedAt &&
      incomingUpdatedAt &&
      incomingUpdatedAt.getTime() < existingUpdatedAt.getTime(),
  );
}

function isSameInstant(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function selectedProvider(
  expenditureRecords: DailyExpenditureAggregate[],
  intakeRecords: DailyIntakeAggregate[],
  stepRecords: DailyStepAggregate[],
  workouts: CurrentDayWorkout[],
  session: IngestionSyncSession | null,
) {
  return (
    [...expenditureRecords, ...intakeRecords, ...stepRecords, ...workouts].find(
      (record) => !isSyntheticProvider(record.provider),
    )
      ?.provider ??
    session?.provider ??
    expenditureRecords[0]?.provider ??
    intakeRecords[0]?.provider ??
    stepRecords[0]?.provider ??
    workouts[0]?.provider
  );
}

function categoryStatus(value: IngestionCategoryStatus | undefined): TodaySoFarDataFreshnessStatus {
  if (value === 'ready') return 'ready';
  if (value === 'error') return 'error';
  if (value === 'unavailable' || value === 'skipped') return 'unavailable';
  return 'not_connected';
}


export class PrismaTodayAggregateRepository implements TodayAggregateRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly options: {
      allowSyntheticProviders: boolean;
      onBankingAggregateChanged?: (
        user: DevelopmentUser,
        localDate: string,
        timezone: string,
        syncSessionId?: string,
      ) => Promise<void>;
    } = {
      allowSyntheticProviders: true,
    },
  ) {}

  private async notifyBankingAggregateChanged(
    user: DevelopmentUser,
    aggregate: { localDate: string; timezone: string; syncSessionId?: string },
  ) {
    await this.options.onBankingAggregateChanged?.(
      user,
      aggregate.localDate,
      aggregate.timezone,
      aggregate.syncSessionId,
    );
  }

  async assertSyncSessionOwnedBy(sessionId: string, userId: string) {
    const session = await this.db.ingestionSyncSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new AppError('Sync session was not found.', 404);
  }

  private async ensureUser(user: DevelopmentUser, timezone: string) {
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: {
        id: user.id,
        email: user.email,
        profile: { create: { timezone } },
      },
    });
  }

  async upsertExpenditureAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyExpenditureAggregate,
  ): Promise<AggregateUpsertResult> {
    await this.ensureUser(user, aggregate.timezone);
    const identity = {
      userId: user.id,
      localDate: parseLocalDate(aggregate.localDate),
      provider: aggregate.provider,
    };
    const existing = await this.db.dailyExpenditureAggregate.findUnique({
      where: { userId_localDate_provider: identity },
    });

    if (existing && shouldIgnoreIncoming(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      return 'ignored_stale';
    }

    if (existing && isSameInstant(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      const unchanged = existing.rawTotalDailyExpenditure === aggregate.rawTotalDailyExpenditure &&
        existing.activeEnergyCalories === (aggregate.activeEnergyCalories ?? null) &&
        existing.basalEnergyCalories === (aggregate.basalEnergyCalories ?? null);
      if (unchanged) await this.notifyBankingAggregateChanged(user, aggregate);
      return unchanged ? 'unchanged' : 'ignored_stale';
    }

    if (existing) {
      await this.db.dailyExpenditureAggregate.update({
        where: { id: existing.id },
        data: {
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          activeEnergyCalories: aggregate.activeEnergyCalories ?? null,
          basalEnergyCalories: aggregate.basalEnergyCalories ?? null,
          rawTotalDailyExpenditure: aggregate.rawTotalDailyExpenditure,
          adjustedDailyExpenditure: aggregate.adjustedDailyExpenditure,
          adjustmentFactor: aggregate.adjustmentFactor,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
      await this.notifyBankingAggregateChanged(user, aggregate);
      return 'updated';
    }

    try {
      await this.db.dailyExpenditureAggregate.create({
        data: {
          ...identity,
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          activeEnergyCalories: aggregate.activeEnergyCalories ?? null,
          basalEnergyCalories: aggregate.basalEnergyCalories ?? null,
          rawTotalDailyExpenditure: aggregate.rawTotalDailyExpenditure,
          adjustedDailyExpenditure: aggregate.adjustedDailyExpenditure,
          adjustmentFactor: aggregate.adjustmentFactor,
          importedAt: aggregate.importedAt,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return this.upsertExpenditureAggregate(user, aggregate);
      throw error;
    }
    await this.notifyBankingAggregateChanged(user, aggregate);
    return 'created';
  }

  async upsertIntakeAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyIntakeAggregate,
  ): Promise<AggregateUpsertResult> {
    await this.ensureUser(user, aggregate.timezone);
    const identity = {
      userId: user.id,
      localDate: parseLocalDate(aggregate.localDate),
      provider: aggregate.provider,
    };
    const existing = await this.db.dailyIntakeAggregate.findUnique({
      where: { userId_localDate_provider: identity },
    });

    if (existing && shouldIgnoreIncoming(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      return 'ignored_stale';
    }

    if (existing && isSameInstant(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      const unchanged = existing.totalCaloriesConsumed === aggregate.totalCaloriesConsumed;
      if (unchanged) await this.notifyBankingAggregateChanged(user, aggregate);
      return unchanged ? 'unchanged' : 'ignored_stale';
    }

    if (existing) {
      await this.db.dailyIntakeAggregate.update({
        where: { id: existing.id },
        data: {
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          totalCaloriesConsumed: aggregate.totalCaloriesConsumed,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
      await this.notifyBankingAggregateChanged(user, aggregate);
      return 'updated';
    }

    try {
      await this.db.dailyIntakeAggregate.create({
        data: {
          ...identity,
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          totalCaloriesConsumed: aggregate.totalCaloriesConsumed,
          importedAt: aggregate.importedAt,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return this.upsertIntakeAggregate(user, aggregate);
      throw error;
    }
    await this.notifyBankingAggregateChanged(user, aggregate);
    return 'created';
  }

  async upsertStepAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyStepAggregate,
  ): Promise<AggregateUpsertResult> {
    await this.ensureUser(user, aggregate.timezone);
    const identity = {
      userId: user.id,
      localDate: parseLocalDate(aggregate.localDate),
      provider: aggregate.provider,
    };
    const existing = await this.db.dailyStepAggregate.findUnique({
      where: { userId_localDate_provider: identity },
    });

    if (existing && shouldIgnoreIncoming(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      return 'ignored_stale';
    }
    if (existing && isSameInstant(existing.providerUpdatedAt, aggregate.providerUpdatedAt)) {
      return existing.totalSteps === aggregate.totalSteps ? 'unchanged' : 'ignored_stale';
    }

    if (existing) {
      await this.db.dailyStepAggregate.update({
        where: { id: existing.id },
        data: {
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          totalSteps: aggregate.totalSteps,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
      return 'updated';
    }

    try {
      await this.db.dailyStepAggregate.create({
        data: {
          ...identity,
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          totalSteps: aggregate.totalSteps,
          importedAt: aggregate.importedAt,
          providerUpdatedAt: aggregate.providerUpdatedAt,
          syncStatus: aggregate.syncStatus,
          isCurrentDay: aggregate.isCurrentDay,
          syncSessionId: aggregate.syncSessionId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return this.upsertStepAggregate(user, aggregate);
      throw error;
    }
    return 'created';
  }

  async upsertWorkouts(
    user: DevelopmentUser,
    workouts: readonly NormalizedCurrentDayWorkout[],
  ): Promise<AggregateUpsertResult[]> {
    if (workouts.length === 0) return [];
    const firstWorkout = workouts[0];
    if (!firstWorkout) return [];
    await this.ensureUser(user, firstWorkout.timezone);

    return this.db.$transaction(async (transaction) => {
      const results: AggregateUpsertResult[] = [];
      for (const workout of workouts) {
        const identity = {
          userId_provider_providerWorkoutId: {
            userId: user.id,
            provider: workout.provider,
            providerWorkoutId: workout.providerWorkoutId,
          },
        };
        const existing = await transaction.currentDayWorkout.findUnique({ where: identity });
        if (existing && shouldIgnoreIncoming(existing.providerUpdatedAt, workout.providerUpdatedAt)) {
          results.push('ignored_stale');
          continue;
        }
        if (existing && isSameInstant(existing.providerUpdatedAt, workout.providerUpdatedAt)) {
          results.push(existing.startedAt.getTime() === workout.startedAt.getTime() &&
            existing.endedAt.getTime() === workout.endedAt.getTime() &&
            existing.totalEnergyBurned === workout.totalEnergyBurned
            ? 'unchanged'
            : 'ignored_stale');
          continue;
        }

        const data = {
          localDate: parseLocalDate(workout.localDate),
          timezone: workout.timezone,
          activityType: workout.activityType,
          displayName: workout.displayName,
          startedAt: workout.startedAt,
          endedAt: workout.endedAt,
          durationMinutes: workout.durationMinutes,
          totalEnergyBurned: workout.totalEnergyBurned,
          totalDistance: workout.totalDistance,
          distanceUnit: workout.distanceUnit,
          providerUpdatedAt: workout.providerUpdatedAt,
          syncStatus: workout.syncStatus,
          isCurrentDay: workout.isCurrentDay,
          syncSessionId: workout.syncSessionId ?? null,
        };

        if (existing) {
          await transaction.currentDayWorkout.update({ where: { id: existing.id }, data });
          results.push('updated');
          continue;
        }

        await transaction.currentDayWorkout.create({
          data: {
            ...data,
            userId: user.id,
            provider: workout.provider,
            providerWorkoutId: workout.providerWorkoutId,
            importedAt: workout.importedAt,
          },
        });
        results.push('created');
      }
      return results;
    });
  }

  async deleteMissingWorkoutsForDay(
    userId: string,
    localDate: string,
    provider: string,
    retainedProviderWorkoutIds: readonly string[],
    providerUpdatedAt: Date,
  ) {
    const latest = await this.db.currentDayWorkout.findFirst({
      where: { userId, localDate: parseLocalDate(localDate), provider },
      orderBy: { providerUpdatedAt: 'desc' },
      select: { providerUpdatedAt: true },
    });
    if (shouldIgnoreIncoming(latest?.providerUpdatedAt ?? null, providerUpdatedAt)) return 0;
    const result = await this.db.currentDayWorkout.deleteMany({
      where: {
        userId,
        localDate: parseLocalDate(localDate),
        provider,
        ...(retainedProviderWorkoutIds.length > 0
          ? { providerWorkoutId: { notIn: [...retainedProviderWorkoutIds] } }
          : {}),
      },
    });
    return result.count;
  }

  async getTodayForUser(userId: string, localDate: string, timezone: string): Promise<TodayResponse> {
    const providerFilter = this.options.allowSyntheticProviders
      ? {}
      : { provider: { not: 'development' } };
    const date = parseLocalDate(localDate);
    const [expenditureRecords, intakeRecords, stepRecords, workoutRecords, latestSession] =
      await Promise.all([
      this.db.dailyExpenditureAggregate.findMany({
        where: {
          userId,
          localDate: date,
          isCurrentDay: true,
          ...providerFilter,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.dailyIntakeAggregate.findMany({
        where: {
          userId,
          localDate: date,
          isCurrentDay: true,
          ...providerFilter,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.dailyStepAggregate.findMany({
        where: { userId, localDate: date, isCurrentDay: true, ...providerFilter },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.currentDayWorkout.findMany({
        where: { userId, localDate: date, isCurrentDay: true, ...providerFilter },
        orderBy: { startedAt: 'desc' },
      }),
      this.db.ingestionSyncSession.findFirst({
        where: { userId, localDate: date, ...providerFilter },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    const provider = selectedProvider(
      expenditureRecords,
      intakeRecords,
      stepRecords,
      workoutRecords,
      latestSession,
    );
    const expenditure = expenditureRecords.find((record) => record.provider === provider) ?? null;
    const intake = intakeRecords.find((record) => record.provider === provider) ?? null;
    const steps = stepRecords.find((record) => record.provider === provider) ?? null;
    const workouts = workoutRecords.filter((record) => record.provider === provider);
    const session = latestSession?.provider === provider ? latestSession : null;
    const sessionSyncedAt = session?.completedAt ?? session?.startedAt ?? null;
    const burnedStatus = currentDayFreshness(
      expenditure ? syncStatus(expenditure.syncStatus) : categoryStatus(session?.expenditureStatus),
      expenditure?.updatedAt ?? sessionSyncedAt,
    );
    const eatenStatus = currentDayFreshness(
      intake ? syncStatus(intake.syncStatus) : categoryStatus(session?.intakeStatus),
      intake?.updatedAt ?? sessionSyncedAt,
    );
    const stepsStatus = currentDayFreshness(
      steps ? syncStatus(steps.syncStatus) : categoryStatus(session?.stepsStatus),
      steps?.updatedAt ?? sessionSyncedAt,
    );
    const firstWorkout = workouts[0];
    const workoutsStatus = currentDayFreshness(
      firstWorkout ? syncStatus(firstWorkout.syncStatus) : categoryStatus(session?.workoutsStatus),
      firstWorkout?.updatedAt ?? sessionSyncedAt,
    );

    return {
      date: localDate,
      timezone: expenditure?.timezone ?? intake?.timezone ?? steps?.timezone ?? session?.timezone ?? timezone,
      isCurrentDay: true,
      dataFreshness: combineTodayFreshness([
        burnedStatus,
        eatenStatus,
        stepsStatus,
        workoutsStatus,
      ]),
      burned: {
        adjusted: expenditure?.adjustedDailyExpenditure ?? null,
        raw: expenditure?.rawTotalDailyExpenditure ?? null,
        adjustmentFactor:
          expenditure?.adjustmentFactor.toNumber() ?? V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
        source: expenditure ? getProviderDisplayName(expenditure.provider) : null,
        lastSyncedAt: latestSyncedAt(expenditure),
        status: burnedStatus,
      },
      eaten: {
        calories: intake?.totalCaloriesConsumed ?? null,
        source: intake ? getProviderDisplayName(intake.provider) : null,
        lastSyncedAt: latestSyncedAt(intake),
        status: eatenStatus,
      },
      steps: {
        count: steps?.totalSteps ?? null,
        source: steps || session ? getProviderDisplayName(provider ?? session?.provider ?? '') : null,
        lastSyncedAt: steps ? latestSyncedAt(steps) : sessionSyncedAt?.toISOString() ?? null,
        status: stepsStatus,
      },
      workouts: {
        items: workouts.map((workout) => ({
          id: workout.id,
          activityType: workout.activityType,
          displayName: workout.displayName,
          startedAt: workout.startedAt.toISOString(),
          endedAt: workout.endedAt.toISOString(),
          durationMinutes: workout.durationMinutes,
          totalEnergyBurned: workout.totalEnergyBurned,
          source: getProviderDisplayName(workout.provider),
        })),
        totalCount: workouts.length,
        source: workouts.length > 0 || session
          ? getProviderDisplayName(provider ?? session?.provider ?? '')
          : null,
        lastSyncedAt: workouts[0]?.updatedAt.toISOString() ?? sessionSyncedAt?.toISOString() ?? null,
        status: workoutsStatus,
      },
    };
  }
}
