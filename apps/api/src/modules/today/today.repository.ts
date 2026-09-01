import {
  calculateRestOfDayBurnProjection,
  calculateStepWhatIfProjection,
  getRemainingLocalDayMinutes,
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  resolveAuthoritativeProviderRecord,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyIntakeAggregate,
  type NormalizedDailyStepAggregate,
  type NormalizedCurrentDayWorkout,
} from '@caloriebank/domain';
import type { TodayResponse, TodaySoFarDataFreshnessStatus } from '@caloriebank/schemas';
import type {
  DailyExpenditureAggregate,
  DailyIntakeAggregate,
  DailyStepAggregate,
  IngestionCategoryStatus,
  PrismaClient,
} from '@prisma/client';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { AppError } from '../../errors';
import { getProviderDisplayName, isSyntheticProvider } from './provider-catalog';
import { combineTodayFreshness, currentDayFreshness } from './today.freshness';
import { readProviderSelection } from '../provider-selection/provider-selection.repository';
import { estimateStepContribution } from './steps-intelligence';

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
  markIntakeAggregateUnavailable?(
    user: DevelopmentUser,
    input: {
      localDate: string;
      provider: string;
      syncSessionId?: string;
      isCurrentDay: boolean;
    },
  ): Promise<boolean>;
  upsertStepAggregate(
    user: DevelopmentUser,
    aggregate: NormalizedDailyStepAggregate,
  ): Promise<AggregateUpsertResult>;
  upsertRestingBurnEstimate?(
    user: DevelopmentUser,
    input: {
      provider: string;
      providerKcalPerHour: number;
      evidenceType: string;
      observationCount: number;
      lookbackStartDate: string;
      lookbackEndDate: string;
      calculatedAt: Date;
    },
  ): Promise<void>;
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
      now?: () => Date;
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
    if (aggregate.provider === 'apple_health') {
      const selection = await readProviderSelection(this.db, user.id);
      if (
        !aggregate.writerBundleIdentifier ||
        !aggregate.writerDisplayName ||
        selection.appleHealthIntakeWriterBundleId !== aggregate.writerBundleIdentifier
      ) {
        throw new AppError('Apple Health intake does not match the selected food tracker.', 409, {
          code: 'APPLE_HEALTH_INTAKE_WRITER_MISMATCH',
        });
      }
    }
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

    if (
      existing &&
      existing.providerUpdatedAt &&
      aggregate.providerUpdatedAt &&
      isSameInstant(existing.providerUpdatedAt, aggregate.providerUpdatedAt)
    ) {
      const unchanged = existing.totalCaloriesConsumed === aggregate.totalCaloriesConsumed &&
        existing.syncStatus === aggregate.syncStatus &&
        existing.writerBundleIdentifier === (aggregate.writerBundleIdentifier ?? null) &&
        existing.writerDisplayName === (aggregate.writerDisplayName ?? null);
      if (unchanged) await this.notifyBankingAggregateChanged(user, aggregate);
      return unchanged ? 'unchanged' : 'ignored_stale';
    }

    if (
      existing &&
      !existing.providerUpdatedAt &&
      !aggregate.providerUpdatedAt &&
      existing.totalCaloriesConsumed === aggregate.totalCaloriesConsumed &&
      existing.syncStatus === aggregate.syncStatus &&
      existing.writerBundleIdentifier === (aggregate.writerBundleIdentifier ?? null) &&
      existing.writerDisplayName === (aggregate.writerDisplayName ?? null)
    ) {
      await this.notifyBankingAggregateChanged(user, aggregate);
      return 'unchanged';
    }

    if (existing) {
      await this.db.dailyIntakeAggregate.update({
        where: { id: existing.id },
        data: {
          timezone: aggregate.timezone,
          providerRecordId: aggregate.providerRecordId,
          totalCaloriesConsumed: aggregate.totalCaloriesConsumed,
          writerBundleIdentifier: aggregate.writerBundleIdentifier ?? null,
          writerDisplayName: aggregate.writerDisplayName ?? null,
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
          writerBundleIdentifier: aggregate.writerBundleIdentifier ?? null,
          writerDisplayName: aggregate.writerDisplayName ?? null,
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

  async markIntakeAggregateUnavailable(
    user: DevelopmentUser,
    input: {
      localDate: string;
      provider: string;
      syncSessionId?: string;
      isCurrentDay: boolean;
    },
  ) {
    const existing = await this.db.dailyIntakeAggregate.findUnique({
      where: {
        userId_localDate_provider: {
          userId: user.id,
          localDate: parseLocalDate(input.localDate),
          provider: input.provider,
        },
      },
    });
    if (!existing || existing.syncStatus === 'unavailable') return false;
    await this.db.dailyIntakeAggregate.update({
      where: { id: existing.id },
      data: {
        syncStatus: 'unavailable',
        isCurrentDay: input.isCurrentDay,
        syncSessionId: input.syncSessionId ?? null,
      },
    });
    await this.notifyBankingAggregateChanged(user, {
      localDate: input.localDate,
      timezone: existing.timezone,
      ...(input.syncSessionId ? { syncSessionId: input.syncSessionId } : {}),
    });
    return true;
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

  async upsertRestingBurnEstimate(
    user: DevelopmentUser,
    input: {
      provider: string;
      providerKcalPerHour: number;
      evidenceType: string;
      observationCount: number;
      lookbackStartDate: string;
      lookbackEndDate: string;
      calculatedAt: Date;
    },
  ) {
    await this.ensureUser(user, 'UTC');
    await this.db.restingBurnEstimate.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: input.provider,
        providerKcalPerHour: input.providerKcalPerHour,
        evidenceType: input.evidenceType,
        observationCount: input.observationCount,
        lookbackStartDate: parseLocalDate(input.lookbackStartDate),
        lookbackEndDate: parseLocalDate(input.lookbackEndDate),
        calculatedAt: input.calculatedAt,
      },
      update: {
        provider: input.provider,
        providerKcalPerHour: input.providerKcalPerHour,
        evidenceType: input.evidenceType,
        observationCount: input.observationCount,
        lookbackStartDate: parseLocalDate(input.lookbackStartDate),
        lookbackEndDate: parseLocalDate(input.lookbackEndDate),
        calculatedAt: input.calculatedAt,
      },
    });
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
        const workoutSteps = workout.totalSteps ?? null;
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
          const unchanged = existing.startedAt.getTime() === workout.startedAt.getTime() &&
            existing.endedAt.getTime() === workout.endedAt.getTime() &&
            existing.totalEnergyBurned === workout.totalEnergyBurned &&
            existing.totalSteps === workoutSteps;
          if (!unchanged && existing.totalSteps === null && workoutSteps !== null) {
            await transaction.currentDayWorkout.update({
              where: { id: existing.id },
              data: { totalSteps: workoutSteps },
            });
            results.push('updated');
          } else {
            results.push(unchanged ? 'unchanged' : 'ignored_stale');
          }
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
          totalSteps: workoutSteps,
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
    const [expenditureRecords, intakeRecords, stepRecords, workoutRecords, sessions, selection, restingModel] =
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
      this.db.ingestionSyncSession.findMany({
        where: { userId, localDate: date, ...providerFilter },
        orderBy: { startedAt: 'desc' },
      }),
      readProviderSelection(this.db, userId),
      this.db.restingBurnEstimate.findUnique({ where: { userId } }),
    ]);
    const syntheticExpenditure = this.options.allowSyntheticProviders && expenditureRecords.length > 0 && expenditureRecords.every((record) => isSyntheticProvider(record.provider));
    const syntheticIntake = this.options.allowSyntheticProviders && intakeRecords.length > 0 && intakeRecords.every((record) => isSyntheticProvider(record.provider));
    const expenditure = resolveAuthoritativeProviderRecord(expenditureRecords, {
      authoritativeProvider: syntheticExpenditure ? 'development' : selection.authoritativeExpenditureProvider,
      fallbackProvider: 'apple_health',
      allowFallback: selection.allowExpenditureFallback,
    });
    const usableIntakeRecords = intakeRecords.filter((record) =>
      (record.syncStatus === 'ready' || record.syncStatus === 'stale' || record.syncStatus === 'partial') &&
      (record.provider !== 'apple_health' || (
        selection.appleHealthIntakeWriterBundleId !== null &&
        record.writerBundleIdentifier === selection.appleHealthIntakeWriterBundleId
      )),
    );
    const intake = resolveAuthoritativeProviderRecord(usableIntakeRecords, {
      authoritativeProvider: syntheticIntake ? 'development' : selection.authoritativeIntakeProvider,
      allowFallback: false,
    });
    const syntheticContext = this.options.allowSyntheticProviders &&
      (stepRecords.length > 0 || workoutRecords.length > 0) &&
      [...stepRecords, ...workoutRecords].every((record) => isSyntheticProvider(record.provider));
    const contextProvider = syntheticContext
      ? 'development'
      : selection.authoritativeActivityProvider;
    const steps = resolveAuthoritativeProviderRecord(stepRecords, {
      authoritativeProvider: contextProvider,
      fallbackProvider: 'apple_health',
      allowFallback: selection.allowActivityFallback,
    });
    const resolvedWorkoutProvider = workoutRecords.some((record) => record.provider === contextProvider)
      ? contextProvider
      : selection.allowActivityFallback && workoutRecords.some((record) => record.provider === 'apple_health')
        ? 'apple_health'
        : contextProvider;
    const workouts = workoutRecords.filter((record) => record.provider === resolvedWorkoutProvider);
    const expenditureSession = sessions.find((session) => session.provider === (expenditure?.provider ?? selection.authoritativeExpenditureProvider)) ?? null;
    const intakeSession = sessions.find((session) => session.provider === (intake?.provider ?? selection.authoritativeIntakeProvider)) ?? null;
    const contextSession = sessions.find((session) => session.provider === contextProvider) ?? null;
    const expenditureSyncedAt = expenditureSession?.completedAt ?? expenditureSession?.startedAt ?? null;
    const intakeSyncedAt = intakeSession?.completedAt ?? intakeSession?.startedAt ?? null;
    const contextSyncedAt = contextSession?.completedAt ?? contextSession?.startedAt ?? null;
    const burnedStatus = currentDayFreshness(
      expenditure ? syncStatus(expenditure.syncStatus) : categoryStatus(expenditureSession?.expenditureStatus),
      expenditure?.updatedAt ?? expenditureSyncedAt,
    );
    const eatenStatus = currentDayFreshness(
      intake ? syncStatus(intake.syncStatus) : categoryStatus(intakeSession?.intakeStatus),
      intake?.updatedAt ?? intakeSyncedAt,
    );
    const stepsStatus = currentDayFreshness(
      steps ? syncStatus(steps.syncStatus) : categoryStatus(contextSession?.stepsStatus),
      steps?.updatedAt ?? contextSyncedAt,
    );
    const firstWorkout = workouts[0];
    const workoutsStatus = currentDayFreshness(
      firstWorkout ? syncStatus(firstWorkout.syncStatus) : categoryStatus(contextSession?.workoutsStatus),
      firstWorkout?.updatedAt ?? contextSyncedAt,
    );

    const stepEstimate = await estimateStepContribution(
      this.db,
      userId,
      stepsStatus === 'ready' ? steps : null,
    );
    const adjustmentFactor =
      expenditure?.adjustmentFactor.toNumber() ?? V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE;
    const stepProjection =
      stepsStatus === 'ready' &&
      burnedStatus === 'ready' &&
      steps &&
      expenditure &&
      stepEstimate.caloriesPerStep !== null
        ? calculateStepWhatIfProjection({
          currentSteps: steps.totalSteps,
          hypotheticalSteps: steps.totalSteps,
          providerCaloriesPerStep: stepEstimate.caloriesPerStep,
          adjustedBurnSoFarCalories: expenditure.adjustedDailyExpenditure,
          adjustmentFactor,
        })
        : null;
    const modelMatchesProvider = restingModel && expenditure &&
      (restingModel.provider === expenditure.provider || restingModel.provider === 'apple_health');
    const modelAgeMs = restingModel
      ? (this.options.now?.() ?? new Date()).getTime() - restingModel.calculatedAt.getTime()
      : Number.POSITIVE_INFINITY;
    const remainingMinutes = getRemainingLocalDayMinutes(
      localDate,
      timezone,
      this.options.now?.() ?? new Date(),
    );
    const restProjectionStatus = (burnedStatus === 'stale' || modelAgeMs > 30 * 24 * 60 * 60 * 1000) && modelMatchesProvider
      ? 'stale' as const
      : burnedStatus === 'ready' && expenditure && modelMatchesProvider
        ? 'ready' as const
        : 'insufficient_data' as const;
    const restForecast = restProjectionStatus === 'ready' && expenditure && restingModel
      ? calculateRestOfDayBurnProjection({
        providerBurnSoFarCalories: expenditure.rawTotalDailyExpenditure,
        providerRestCaloriesPerHour: restingModel.providerKcalPerHour,
        remainingMinutes,
        adjustmentFactor,
      })
      : null;
    return {
      date: localDate,
      timezone: expenditure?.timezone ?? intake?.timezone ?? steps?.timezone ?? contextSession?.timezone ?? timezone,
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
        adjustmentFactor,
        source: expenditure ? getProviderDisplayName(expenditure.provider) : null,
        lastSyncedAt: latestSyncedAt(expenditure),
        status: burnedStatus,
      },
      eaten: {
        calories: intake?.totalCaloriesConsumed ?? null,
        source: intake
          ? intake.provider === 'apple_health'
            ? intake.writerDisplayName
            : getProviderDisplayName(intake.provider)
          : null,
        lastSyncedAt: latestSyncedAt(intake),
        status: eatenStatus,
      },
      steps: {
        count: steps?.totalSteps ?? null,
        source: steps || contextSession ? getProviderDisplayName(steps?.provider ?? contextProvider) : null,
        lastSyncedAt: steps ? latestSyncedAt(steps) : contextSyncedAt?.toISOString() ?? null,
        status: stepsStatus,
        ...stepEstimate,
        providerReportedCaloriesPer1000Steps:
          stepProjection?.providerCaloriesPer1000Steps ?? null,
        adjustedCaloriesPer1000Steps:
          stepProjection?.adjustedCaloriesPer1000Steps ?? null,
        adjustedCaloriesPerStep:
          stepEstimate.caloriesPerStep === null
            ? null
            : stepEstimate.caloriesPerStep * adjustmentFactor,
        currentAdjustedContributionCalories:
          stepProjection?.currentAdjustedStepContributionCalories ?? null,
        nonStepAdjustedBurnBaselineCalories:
          stepProjection?.nonStepAdjustedBurnBaselineCalories ?? null,
      },
      restOfDayProjection: {
        status: restProjectionStatus,
        providerKcalPerHour: restingModel?.providerKcalPerHour ?? null,
        adjustedKcalPerHour: restingModel
          ? restingModel.providerKcalPerHour * adjustmentFactor
          : null,
        remainingMinutes,
        projectedProviderBurnCalories: restForecast?.projectedProviderBurnCalories ?? null,
        projectedAdjustedBurnCalories: restForecast?.projectedAdjustedBurnCalories ?? null,
        source: restingModel ? getProviderDisplayName(restingModel.provider) : null,
        evidenceType: restingModel
          ? restingModel.evidenceType as
            | 'provider_resting_energy'
            | 'historical_low_activity_hours'
            | 'historical_daily_basal'
          : null,
        observationCount: restingModel?.observationCount ?? 0,
        calculatedAt: restingModel?.calculatedAt.toISOString() ?? null,
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
          totalSteps: workout.totalSteps,
          source: getProviderDisplayName(workout.provider),
        })),
        totalCount: workouts.length,
        source: workouts.length > 0 || contextSession
          ? getProviderDisplayName(resolvedWorkoutProvider)
          : null,
        lastSyncedAt: workouts[0]?.updatedAt.toISOString() ?? contextSyncedAt?.toISOString() ?? null,
        status: workoutsStatus,
      },
    };
  }
}
