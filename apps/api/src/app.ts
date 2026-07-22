import cors from 'cors';
import express from 'express';

import type { ApiEnv } from './env';
import { env } from './env';
import { errorHandler, notFoundHandler } from './errors';
import { requestLogger } from './logger';
import { prisma } from './db/client';
import {
  PrismaBankHistoryRepository,
  type BankHistoryRepository,
} from './modules/bank-history/bank-history.repository';
import { createBankHistoryRouter } from './modules/bank-history/bank-history.routes';
import {
  PrismaGoalConfigurationRepository,
  type GoalConfigurationRepository,
} from './modules/goal-configuration/goal-configuration.repository';
import { createGoalConfigurationRouter } from './modules/goal-configuration/goal-configuration.routes';
import {
  PrismaPlannedTreatRepository,
  type PlannedTreatRepository,
} from './modules/planned-treat/planned-treat.repository';
import { createPlannedTreatRouter } from './modules/planned-treat/planned-treat.routes';
import {
  PrismaDashboardPreferencesRepository,
  type DashboardPreferencesRepository,
} from './modules/dashboard-preferences/dashboard-preferences.repository';
import { createDashboardPreferencesRouter } from './modules/dashboard-preferences/dashboard-preferences.routes';
import {
  PrismaTodayAggregateRepository,
  type TodayAggregateRepository,
} from './modules/today/today.repository';
import { createTodayRouter } from './modules/today/today.routes';
import { createTodayIngestionRouter } from './modules/today/today-ingestion.routes';
import {
  PrismaSyncSessionRepository,
  type SyncSessionRepository,
} from './modules/today/sync-session.repository';
import { createSyncSessionRouter } from './modules/today/sync-session.routes';
import {
  FinalizationOrchestrationService,
  type FinalizationScheduler,
} from './modules/finalization-orchestration/finalization-orchestration.service';

type AppDependencies = {
  goalConfigurationRepository?: GoalConfigurationRepository;
  bankHistoryRepository?: BankHistoryRepository;
  plannedTreatRepository?: PlannedTreatRepository;
  todayRepository?: TodayAggregateRepository;
  dashboardPreferencesRepository?: DashboardPreferencesRepository;
  syncSessionRepository?: SyncSessionRepository;
  finalizationScheduler?: FinalizationScheduler | null;
};

export function createApp(config: ApiEnv = env, dependencies: AppDependencies = {}) {
  const app = express();
  const goalConfigurationRepository =
    dependencies.goalConfigurationRepository ?? new PrismaGoalConfigurationRepository(prisma);
  const bankHistoryRepository =
    dependencies.bankHistoryRepository ??
    new PrismaBankHistoryRepository(prisma, {
      allowSyntheticProviders: config.TODAY_INGESTION_MODE === 'development',
    });
  const plannedTreatRepository = dependencies.plannedTreatRepository ?? new PrismaPlannedTreatRepository(prisma);
  const todayRepository =
    dependencies.todayRepository ??
    new PrismaTodayAggregateRepository(prisma, {
      allowSyntheticProviders: config.TODAY_INGESTION_MODE === 'development',
      onBankingAggregateChanged: async (user, localDate, timezone, syncSessionId) => {
        await bankHistoryRepository.reconcileStoredDay(
          user,
          localDate,
          timezone,
          syncSessionId,
        );
      },
    });
  const dashboardPreferencesRepository =
    dependencies.dashboardPreferencesRepository ?? new PrismaDashboardPreferencesRepository(prisma);
  const syncSessionRepository =
    dependencies.syncSessionRepository ?? new PrismaSyncSessionRepository(prisma);
  const finalizationScheduler = dependencies.finalizationScheduler === undefined
    ? dependencies.bankHistoryRepository || dependencies.syncSessionRepository
      ? undefined
      : new FinalizationOrchestrationService(prisma, bankHistoryRepository)
    : dependencies.finalizationScheduler ?? undefined;
  const developmentUser = {
    id: config.DEV_USER_ID,
    email: config.DEV_USER_EMAIL,
  };

  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'caloriebank-api',
    });
  });
  app.use(
    '/v1/me/goal-configuration',
    createGoalConfigurationRouter(goalConfigurationRepository, developmentUser),
  );
  app.use('/v1/me', createBankHistoryRouter(bankHistoryRepository, developmentUser));
  app.use('/v1/me/planned-treat', createPlannedTreatRouter(plannedTreatRepository, developmentUser));
  app.use('/v1/me', createTodayRouter(todayRepository, developmentUser));
  app.use(
    '/v1/me/dashboard-preferences',
    createDashboardPreferencesRouter(dashboardPreferencesRepository, developmentUser),
  );
  app.use(
    '/v1/me/ingestion/sync-sessions',
    createSyncSessionRouter(syncSessionRepository, developmentUser, finalizationScheduler),
  );
  app.use(
    '/v1/me/ingestion',
    createTodayIngestionRouter(todayRepository, developmentUser),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
