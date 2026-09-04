import {
  composeTotalDailyExpenditure,
  getCurrentLocalDayWindow,
  normalizeDailyExpenditureAggregate,
  normalizeDailyIntakeAggregate,
  type ExpenditureProvider,
  type FetchDailyAggregateInput,
  type IntakeProvider,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyIntakeAggregate,
  type NormalizedDailyStepAggregate,
  type NormalizedCurrentDayWorkout,
} from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { prisma } from '../src/db/client';
import type { DevelopmentUser } from '../src/modules/goal-configuration/goal-configuration.repository';
import { localDevelopmentApiEnv } from './support/test-api-env';
import {
  DevelopmentExpenditureProvider,
  DevelopmentIntakeProvider,
} from '../src/modules/today/development-providers';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';
import { PrismaTodayAggregateRepository } from '../src/modules/today/today.repository';
import { TodayIngestionService } from '../src/modules/today/today.service';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const fixedNow = new Date('2026-07-21T14:10:00.000Z');
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'developer@caloriebank.local',
};
const aggregateInput: FetchDailyAggregateInput = {
  userId: user.id,
  localDate: '2026-07-21',
  timezone: 'America/Chicago',
  isCurrentDay: true,
};

class MemoryTodayRepository implements TodayAggregateRepository {
  expenditure: NormalizedDailyExpenditureAggregate | null = null;
  intake: NormalizedDailyIntakeAggregate | null = null;
  steps: NormalizedDailyStepAggregate | null = null;
  workouts: NormalizedCurrentDayWorkout[] = [];
  restProjection: TodayResponse['restOfDayProjection'] | null = null;

  async upsertExpenditureAggregate(
    _user: DevelopmentUser,
    aggregate: NormalizedDailyExpenditureAggregate,
  ): Promise<'created'> {
    this.expenditure = aggregate;
    return 'created';
  }

  async upsertIntakeAggregate(
    _user: DevelopmentUser,
    aggregate: NormalizedDailyIntakeAggregate,
  ): Promise<'created'> {
    this.intake = aggregate;
    return 'created';
  }

  async upsertStepAggregate(
    _user: DevelopmentUser,
    aggregate: NormalizedDailyStepAggregate,
  ): Promise<'created'> {
    this.steps = aggregate;
    return 'created';
  }

  async upsertWorkouts(
    _user: DevelopmentUser,
    workouts: readonly NormalizedCurrentDayWorkout[],
  ): Promise<'created'[]> {
    this.workouts = [...workouts];
    return workouts.map(() => 'created');
  }

  async assertSyncSessionOwnedBy() {}

  async getTodayForUser(_userId: string, localDate: string, timezone: string): Promise<TodayResponse> {
    const statuses = [
      this.expenditure?.syncStatus ?? 'not_connected',
      this.intake?.syncStatus ?? 'not_connected',
    ];
    const dataFreshness = statuses.includes('stale')
      ? 'stale'
      : this.expenditure || this.intake
        ? 'partial'
        : 'not_connected';

    return {
      date: localDate,
      timezone,
      isCurrentDay: true,
      dataFreshness,
      burned: {
        adjusted: this.expenditure?.adjustedDailyExpenditure ?? null,
        raw: this.expenditure?.rawTotalDailyExpenditure ?? null,
        adjustmentFactor: this.expenditure?.adjustmentFactor ?? 0.8,
        source: this.expenditure?.provider ?? null,
        lastSyncedAt: this.expenditure?.importedAt.toISOString() ?? null,
        status: this.expenditure?.syncStatus ?? 'not_connected',
      },
      eaten: {
        calories: this.intake?.totalCaloriesConsumed ?? null,
        source: this.intake?.provider ?? null,
        lastSyncedAt: this.intake?.importedAt.toISOString() ?? null,
        status: this.intake?.syncStatus ?? 'not_connected',
      },
      steps: {
        count: this.steps?.totalSteps ?? null,
        source: this.steps?.provider ?? null,
        lastSyncedAt: this.steps?.importedAt.toISOString() ?? null,
        status: this.steps?.syncStatus ?? 'not_connected',
        estimatedContributionCalories: null,
        estimatedCaloriesPer1000Steps: null,
        caloriesPerStep: null,
        calibrationWorkoutCount: 0,
        calibrationTotalSteps: 0,
        calibrationTotalCalories: 0,
        estimationStatus: this.steps ? 'insufficient_data' : 'unavailable',
        providerReportedCaloriesPer1000Steps: null,
        adjustedCaloriesPer1000Steps: null,
        adjustedCaloriesPerStep: null,
        currentAdjustedContributionCalories: null,
        nonStepAdjustedBurnBaselineCalories: null,
      },
      restOfDayProjection: this.restProjection ?? {
        status: 'insufficient_data',
        providerKcalPerHour: null,
        adjustedKcalPerHour: null,
        remainingMinutes: 0,
        projectedProviderBurnCalories: null,
        projectedAdjustedBurnCalories: null,
        source: null,
        evidenceType: null,
        observationCount: 0,
        calculatedAt: null,
      },
      workouts: {
        items: this.workouts.map((workout, index) => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          activityType: workout.activityType,
          displayName: workout.displayName,
          startedAt: workout.startedAt.toISOString(),
          endedAt: workout.endedAt.toISOString(),
          durationMinutes: workout.durationMinutes,
          totalEnergyBurned: workout.totalEnergyBurned,
          source: workout.provider,
        })),
        totalCount: this.workouts.length,
        source: this.workouts[0]?.provider ?? null,
        lastSyncedAt: this.workouts[0]?.importedAt.toISOString() ?? null,
        status: this.workouts.length > 0 ? 'ready' : 'not_connected',
      },
    };
  }
}

describe('provider-neutral Today ingestion', () => {
  it('composes active and basal energy before applying one adjustment', () => {
    const composition = composeTotalDailyExpenditure(600.4, 1399.6);
    expect(composition).toEqual({
      activeEnergyCalories: 600,
      basalEnergyCalories: 1400,
      rawTotalDailyExpenditure: 2000,
    });

    const aggregate = normalizeDailyExpenditureAggregate({
      ...aggregateInput,
      provider: 'apple_health',
      providerRecordId: 'apple_health:expenditure:2026-07-21',
      ...composition,
      importedAt: fixedNow,
      providerUpdatedAt: fixedNow,
      syncStatus: 'ready',
    });

    expect(aggregate.adjustedDailyExpenditure).toBe(1600);
  });

  it('uses local calendar boundaries across daylight-saving changes', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      const window = getCurrentLocalDayWindow(new Date('2026-03-08T12:00:00-05:00'));
      expect(window.localDate).toBe('2026-03-08');
      expect(window.timezone).toBe('America/Chicago');
      expect(window.dayEnd.getTime() - window.dayStart.getTime()).toBe(23 * 60 * 60 * 1000);
    } finally {
      process.env.TZ = previousTimezone;
    }
  });
  it('normalizes expenditure with the configurable adjustment factor', () => {
    const aggregate = normalizeDailyExpenditureAggregate({
      ...aggregateInput,
      provider: 'Test Provider',
      providerRecordId: 'test-expenditure',
      rawTotalDailyExpenditure: 2000,
      adjustmentFactor: 0.75,
      importedAt: fixedNow,
      providerUpdatedAt: fixedNow,
      syncStatus: 'ready',
    });

    expect(aggregate.adjustedDailyExpenditure).toBe(1500);
    expect(aggregate.adjustmentFactor).toBe(0.75);
  });

  it('normalizes daily intake without food-entry details', () => {
    const aggregate = normalizeDailyIntakeAggregate({
      ...aggregateInput,
      provider: 'Test Provider',
      providerRecordId: 'test-intake',
      totalCaloriesConsumed: 1500,
      importedAt: fixedNow,
      providerUpdatedAt: fixedNow,
      syncStatus: 'ready',
    });

    expect(aggregate.totalCaloriesConsumed).toBe(1500);
    expect(aggregate).not.toHaveProperty('foodEntries');
  });

  it('uses development adapters through provider interfaces', async () => {
    const expenditureProvider: ExpenditureProvider = new DevelopmentExpenditureProvider(() => fixedNow);
    const intakeProvider: IntakeProvider = new DevelopmentIntakeProvider(() => fixedNow);

    const [expenditure, intake] = await Promise.all([
      expenditureProvider.fetchDailyExpenditureAggregate(aggregateInput),
      intakeProvider.fetchDailyCalorieIntakeAggregate(aggregateInput),
    ]);

    expect(expenditure?.provider).toBe('development');
    expect(expenditure?.rawTotalDailyExpenditure).toBe(2000);
    expect(expenditure?.adjustedDailyExpenditure).toBe(1600);
    expect(intake?.totalCaloriesConsumed).toBe(1500);
  });

  it('syncs through dependency injection without concrete provider coupling', async () => {
    const repository = new MemoryTodayRepository();
    const service = new TodayIngestionService({
      expenditureProvider: new DevelopmentExpenditureProvider(() => fixedNow),
      intakeProvider: new DevelopmentIntakeProvider(() => fixedNow),
      repository,
    });

    await service.syncDailyAggregates(user, aggregateInput);

    expect(repository.expenditure?.adjustedDailyExpenditure).toBe(1600);
    expect(repository.intake?.totalCaloriesConsumed).toBe(1500);
  });

  it('exposes the read-only Today API contract without bank forecast fields', async () => {
    const repository = new MemoryTodayRepository();
    await new TodayIngestionService({
      expenditureProvider: new DevelopmentExpenditureProvider(() => fixedNow),
      intakeProvider: new DevelopmentIntakeProvider(() => fixedNow),
      repository,
    }).syncDailyAggregates(user, aggregateInput);

    const response = await request(createApp(localDevelopmentApiEnv(), { todayRepository: repository }))
      .get('/v1/me/today')
      .expect(200);

    expect(response.body.burned).toMatchObject({
      adjusted: 1600,
      raw: 2000,
      adjustmentFactor: 0.8,
      source: 'development',
      status: 'ready',
    });
    expect(response.body.eaten).toMatchObject({
      calories: 1500,
      source: 'development',
      status: 'ready',
    });
    expect(response.body).not.toHaveProperty('projectedBankChange');
    expect(response.body).not.toHaveProperty('caloriesRemaining');
    expect(response.body).not.toHaveProperty('availableBankCalories');
  });

  it('returns an on-demand resting model in the same Today request without requiring persistence', async () => {
    const repository = new MemoryTodayRepository();
    await new TodayIngestionService({
      expenditureProvider: new DevelopmentExpenditureProvider(() => fixedNow),
      intakeProvider: new DevelopmentIntakeProvider(() => fixedNow),
      repository,
    }).syncDailyAggregates(user, aggregateInput);
    const before = { expenditure: repository.expenditure, intake: repository.intake };
    const response = await request(createApp(localDevelopmentApiEnv(), {
      todayRepository: repository,
      todayPredictionResolver: {
        resolveRestingBurnEstimate: async () => {
          repository.restProjection = {
            status: 'ready',
            providerKcalPerHour: 79.246776,
            adjustedKcalPerHour: 63.3974208,
            remainingMinutes: 450,
            projectedProviderBurnCalories: 2_590,
            projectedAdjustedBurnCalories: 2_070,
            source: 'development',
            evidenceType: 'historical_low_activity_hours',
            observationCount: 57,
            calculatedAt: fixedNow.toISOString(),
          };
          return true;
        },
      },
    })).get('/v1/me/today').expect(200);

    expect(response.body.restOfDayProjection).toMatchObject({
      status: 'ready',
      providerKcalPerHour: 79.246776,
      projectedProviderBurnCalories: 2590,
      projectedAdjustedBurnCalories: 2070,
    });
    expect({ expenditure: repository.expenditure, intake: repository.intake }).toEqual(before);
  });

  it('represents missing expenditure and stale intake without fabricating values', async () => {
    const repository = new MemoryTodayRepository();
    repository.intake = normalizeDailyIntakeAggregate({
      ...aggregateInput,
      provider: 'Development Provider',
      providerRecordId: 'stale-intake',
      totalCaloriesConsumed: 1500,
      importedAt: fixedNow,
      providerUpdatedAt: fixedNow,
      syncStatus: 'stale',
    });

    const today = await repository.getTodayForUser(user.id, aggregateInput.localDate, aggregateInput.timezone);

    expect(today.dataFreshness).toBe('stale');
    expect(today.burned.adjusted).toBeNull();
    expect(today.burned.status).toBe('not_connected');
    expect(today.eaten.calories).toBe(1500);
    expect(today.eaten.status).toBe('stale');
  });

  it('persists development aggregates without creating ledger transactions', async () => {
    const persistenceUser = {
      id: '00000000-0000-4000-8000-000000000777',
      email: 'today-ingestion@caloriebank.local',
    };
    const repository = new PrismaTodayAggregateRepository(prisma);
    const service = new TodayIngestionService({
      expenditureProvider: new DevelopmentExpenditureProvider(() => fixedNow),
      intakeProvider: new DevelopmentIntakeProvider(() => fixedNow),
      repository,
    });

    await prisma.dailyExpenditureAggregate.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.dailyIntakeAggregate.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.calorieLedgerTransaction.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.user.deleteMany({ where: { id: persistenceUser.id } });

    await service.syncDailyAggregates(persistenceUser, {
      ...aggregateInput,
      userId: persistenceUser.id,
    });
    await service.syncDailyAggregates(persistenceUser, {
      ...aggregateInput,
      userId: persistenceUser.id,
    });

    const [expenditureCount, intakeCount, ledgerCount, today] = await Promise.all([
      prisma.dailyExpenditureAggregate.count({ where: { userId: persistenceUser.id } }),
      prisma.dailyIntakeAggregate.count({ where: { userId: persistenceUser.id } }),
      prisma.calorieLedgerTransaction.count({ where: { userId: persistenceUser.id } }),
      repository.getTodayForUser(persistenceUser.id, aggregateInput.localDate, aggregateInput.timezone),
    ]);

    expect(expenditureCount).toBe(1);
    expect(intakeCount).toBe(1);
    expect(ledgerCount).toBe(0);
    expect(today.burned.adjusted).toBe(1600);
    expect(today.eaten.calories).toBe(1500);
  });

  it('reads Fitbit expenditure and selected FatSecret intake without summing providers', async () => {
    const persistenceUser = {
      id: '00000000-0000-4000-8000-000000000776',
      email: 'multi-provider-today@caloriebank.local',
    };
    await prisma.user.deleteMany({ where: { id: persistenceUser.id } });
    await prisma.user.create({
      data: {
        id: persistenceUser.id,
        email: persistenceUser.email,
        providerSelection: {
          create: {
            authoritativeExpenditureProvider: 'google_health_fitbit',
            authoritativeActivityProvider: 'google_health_fitbit',
            authoritativeIntakeProvider: 'fatsecret',
            appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD',
            appleHealthIntakeWriterDisplayName: 'Cronometer',
          },
        },
      },
    });
    const repository = new PrismaTodayAggregateRepository(prisma, { allowSyntheticProviders: false });
    await repository.upsertExpenditureAggregate(persistenceUser, normalizeDailyExpenditureAggregate({
      ...aggregateInput, userId: persistenceUser.id, provider: 'apple_health',
      providerRecordId: 'apple_health:expenditure:2026-07-21', rawTotalDailyExpenditure: 2000,
      importedAt: fixedNow, providerUpdatedAt: fixedNow, syncStatus: 'ready',
    }));
    await repository.upsertExpenditureAggregate(persistenceUser, normalizeDailyExpenditureAggregate({
      ...aggregateInput, userId: persistenceUser.id, provider: 'google_health_fitbit',
      providerRecordId: 'google_health_fitbit:expenditure:2026-07-21', rawTotalDailyExpenditure: 3000,
      importedAt: fixedNow, providerUpdatedAt: fixedNow, syncStatus: 'ready',
    }));
    await repository.upsertIntakeAggregate(persistenceUser, normalizeDailyIntakeAggregate({
      ...aggregateInput, userId: persistenceUser.id, provider: 'apple_health',
      providerRecordId: 'apple_health:intake:2026-07-21', totalCaloriesConsumed: 1500,
      writerBundleIdentifier: 'CRONOMETER-GOLD', writerDisplayName: 'Cronometer',
      importedAt: fixedNow, providerUpdatedAt: fixedNow, syncStatus: 'ready',
    }));
    await repository.upsertIntakeAggregate(persistenceUser, normalizeDailyIntakeAggregate({
      ...aggregateInput, userId: persistenceUser.id, provider: 'fatsecret',
      providerRecordId: 'fatsecret:2026-07-21', totalCaloriesConsumed: 1731,
      importedAt: fixedNow, providerUpdatedAt: null, syncStatus: 'ready',
    }));
    for (const [provider, totalSteps] of [['apple_health', 7000], ['google_health_fitbit', 9000]] as const) {
      await repository.upsertStepAggregate(persistenceUser, {
        ...aggregateInput, userId: persistenceUser.id, provider,
        providerRecordId: `${provider}:steps:2026-07-21`, totalSteps,
        importedAt: fixedNow, providerUpdatedAt: fixedNow, syncStatus: 'ready',
      });
      await repository.upsertWorkouts(persistenceUser, [{
        ...aggregateInput, userId: persistenceUser.id, provider,
        providerWorkoutId: `${provider}:workout:1`, activityType: 'walking',
        displayName: provider === 'google_health_fitbit' ? 'Fitbit walk' : 'Apple walk',
        startedAt: new Date('2026-07-21T12:00:00.000Z'),
        endedAt: new Date('2026-07-21T12:30:00.000Z'), durationMinutes: 30,
        totalEnergyBurned: 200, totalDistance: null, distanceUnit: null,
        importedAt: fixedNow, providerUpdatedAt: fixedNow, syncStatus: 'ready',
      }]);
    }
    const today = await repository.getTodayForUser(
      persistenceUser.id, aggregateInput.localDate, aggregateInput.timezone,
    );
    expect(today.burned).toMatchObject({ raw: 3000, adjusted: 2400, source: 'Fitbit' });
    expect(today.eaten).toMatchObject({ calories: 1731, source: 'FatSecret' });
    expect(today.steps).toMatchObject({ count: 9000, source: 'Fitbit' });
    expect(today.workouts).toMatchObject({
      totalCount: 1, source: 'Fitbit', items: [{ displayName: 'Fitbit walk', source: 'Fitbit' }],
    });
    expect(await prisma.dailyExpenditureAggregate.count({ where: { userId: persistenceUser.id } })).toBe(2);
    expect(await prisma.dailyIntakeAggregate.count({ where: { userId: persistenceUser.id } })).toBe(2);
    expect(await prisma.calorieLedgerTransaction.count({ where: { userId: persistenceUser.id } })).toBe(0);
    await prisma.user.delete({ where: { id: persistenceUser.id } });
  });

  it('validates Apple Health sync commands and calculates adjusted expenditure on the server', async () => {
    const repository = new MemoryTodayRepository();
    const timezone = 'America/Chicago';
    const localDate = getLocalDateForTimezone(timezone);
    const app = createApp(
      localDevelopmentApiEnv({ DEV_USER_ID: user.id, DEV_USER_EMAIL: user.email }),
      { todayRepository: repository },
    );

    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        localDate,
        timezone,
        provider: 'apple_health',
        rawTotalDailyExpenditure: 2000,
        providerUpdatedAt: new Date().toISOString(),
        sourceMetadata: { activeEnergyCalories: 600, basalEnergyCalories: 1400 },
      })
      .expect(200, { result: 'created' });

    expect(repository.expenditure).toMatchObject({
      userId: user.id,
      provider: 'apple_health',
      rawTotalDailyExpenditure: 2000,
      adjustedDailyExpenditure: 1600,
    });

    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        userId: user.id,
        localDate,
        timezone,
        provider: 'apple_health',
        rawTotalDailyExpenditure: 2000,
        adjustedDailyExpenditure: 1999,
        adjustmentFactor: 1,
        providerUpdatedAt: new Date().toISOString(),
      })
      .expect(400);

    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        localDate,
        timezone,
        provider: 'apple_health',
        rawTotalDailyExpenditure: -1,
        providerUpdatedAt: new Date().toISOString(),
      })
      .expect(400);

    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        localDate,
        timezone,
        provider: 'apple_health',
        rawTotalDailyExpenditure: 2000,
        providerUpdatedAt: new Date().toISOString(),
        sourceMetadata: { activeEnergyCalories: 500, basalEnergyCalories: 1400 },
      })
      .expect(400);
  });

  it('replaces cumulative Apple Health totals, ignores stale snapshots, and leaves the ledger unchanged', async () => {
    const persistenceUser = {
      id: '00000000-0000-4000-8000-000000000778',
      email: 'apple-health-ingestion@caloriebank.local',
    };
    const timezone = 'America/Chicago';
    const localDate = getLocalDateForTimezone(timezone);
    const repository = new PrismaTodayAggregateRepository(prisma, {
      allowSyntheticProviders: false,
    });
    const app = createApp(
      localDevelopmentApiEnv({
        DEV_USER_ID: persistenceUser.id,
        DEV_USER_EMAIL: persistenceUser.email,
        TODAY_INGESTION_MODE: 'device',
      }),
      { todayRepository: repository },
    );
    const firstUpdatedAt = new Date();
    const secondUpdatedAt = new Date(firstUpdatedAt.getTime() + 60_000);

    await prisma.dailyExpenditureAggregate.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.dailyIntakeAggregate.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.calorieLedgerTransaction.deleteMany({ where: { userId: persistenceUser.id } });
    await prisma.user.deleteMany({ where: { id: persistenceUser.id } });

    const expenditurePayload = {
      localDate,
      timezone,
      provider: 'apple_health',
      rawTotalDailyExpenditure: 1000,
      providerUpdatedAt: firstUpdatedAt.toISOString(),
      sourceMetadata: { activeEnergyCalories: 300, basalEnergyCalories: 700 },
    };

    await request(app).post('/v1/me/ingestion/expenditure').send(expenditurePayload).expect(200, {
      result: 'created',
    });
    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        ...expenditurePayload,
        rawTotalDailyExpenditure: 1700,
        providerUpdatedAt: secondUpdatedAt.toISOString(),
        sourceMetadata: { activeEnergyCalories: 700, basalEnergyCalories: 1000 },
      })
      .expect(200, { result: 'updated' });
    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        ...expenditurePayload,
        rawTotalDailyExpenditure: 1200,
        sourceMetadata: { activeEnergyCalories: 400, basalEnergyCalories: 800 },
      })
      .expect(200, { result: 'ignored_stale' });
    await request(app)
      .post('/v1/me/ingestion/expenditure')
      .send({
        ...expenditurePayload,
        rawTotalDailyExpenditure: 1700,
        providerUpdatedAt: secondUpdatedAt.toISOString(),
        sourceMetadata: { activeEnergyCalories: 700, basalEnergyCalories: 1000 },
      })
      .expect(200, { result: 'unchanged' });

    await prisma.dailyIntakeAggregate.create({
      data: {
        userId: persistenceUser.id,
        localDate: new Date(`${localDate}T00:00:00.000Z`),
        timezone,
        provider: 'apple_health',
        providerRecordId: `apple_health:intake:${localDate}`,
        totalCaloriesConsumed: 3966,
        importedAt: firstUpdatedAt,
        providerUpdatedAt: firstUpdatedAt,
        syncStatus: 'ready',
        isCurrentDay: true,
      },
    });

    const partialToday = await request(app)
      .get(`/v1/me/today?timezone=${encodeURIComponent(timezone)}`)
      .expect(200);
    expect(partialToday.body).toMatchObject({
      dataFreshness: 'partial',
      burned: { raw: 1700, adjusted: 1360, source: 'Apple Health' },
      eaten: { calories: null, source: null },
    });

    await prisma.providerSelection.upsert({
      where: { userId: persistenceUser.id },
      create: {
        userId: persistenceUser.id,
        authoritativeExpenditureProvider: 'apple_health',
        authoritativeActivityProvider: 'apple_health',
        authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD',
        appleHealthIntakeWriterDisplayName: 'Cronometer',
      },
      update: {
        authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriterBundleId: 'CRONOMETER-GOLD',
        appleHealthIntakeWriterDisplayName: 'Cronometer',
      },
    });

    await request(app)
      .post('/v1/me/ingestion/intake')
      .send({
        localDate,
        timezone,
        provider: 'apple_health',
        totalCaloriesConsumed: 3966,
        writerBundleIdentifier: 'com.fatsecret.caloriecounter',
        writerDisplayName: 'FatSecret',
        providerUpdatedAt: secondUpdatedAt.toISOString(),
      })
      .expect(409);

    await request(app)
      .post('/v1/me/ingestion/intake')
      .send({
        localDate,
        timezone,
        provider: 'apple_health',
        totalCaloriesConsumed: 2354,
        writerBundleIdentifier: 'CRONOMETER-GOLD',
        writerDisplayName: 'Cronometer',
        providerUpdatedAt: secondUpdatedAt.toISOString(),
      })
      .expect(200, { result: 'updated' });

    const syntheticRepository = new PrismaTodayAggregateRepository(prisma);
    await new TodayIngestionService({
      expenditureProvider: new DevelopmentExpenditureProvider(
        () => new Date(secondUpdatedAt.getTime() + 60_000),
      ),
      intakeProvider: new DevelopmentIntakeProvider(
        () => new Date(secondUpdatedAt.getTime() + 60_000),
      ),
      repository: syntheticRepository,
    }).syncDailyAggregates(persistenceUser, {
      userId: persistenceUser.id,
      localDate,
      timezone,
      isCurrentDay: true,
    });

    const [today, bankSummary, plannedTreat, expenditureCount, intakeCount, ledgerCount] =
      await Promise.all([
        request(app).get(`/v1/me/today?timezone=${encodeURIComponent(timezone)}`).expect(200),
        request(app).get('/v1/me/bank-summary').expect(200),
        request(app).get('/v1/me/planned-treat').expect(200),
        prisma.dailyExpenditureAggregate.count({
          where: { userId: persistenceUser.id, provider: 'apple_health' },
        }),
        prisma.dailyIntakeAggregate.count({
          where: { userId: persistenceUser.id, provider: 'apple_health' },
        }),
        prisma.calorieLedgerTransaction.count({ where: { userId: persistenceUser.id } }),
      ]);

    expect(today.body).toMatchObject({
      dataFreshness: 'partial',
      burned: { raw: 1700, adjusted: 1360, source: 'Apple Health' },
      eaten: { calories: 2354, source: 'Cronometer' },
    });
    expect(bankSummary.body.availableBankCalories).toBe(0);
    expect(plannedTreat.body).toMatchObject({ status: 'no_plan', availableBankCalories: 0 });
    expect(expenditureCount).toBe(1);
    expect(intakeCount).toBe(1);
    expect(ledgerCount).toBe(0);
  });
});
