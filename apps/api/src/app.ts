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

type AppDependencies = {
  goalConfigurationRepository?: GoalConfigurationRepository;
  bankHistoryRepository?: BankHistoryRepository;
  plannedTreatRepository?: PlannedTreatRepository;
};

export function createApp(config: ApiEnv = env, dependencies: AppDependencies = {}) {
  const app = express();
  const goalConfigurationRepository =
    dependencies.goalConfigurationRepository ?? new PrismaGoalConfigurationRepository(prisma);
  const bankHistoryRepository = dependencies.bankHistoryRepository ?? new PrismaBankHistoryRepository(prisma);
  const plannedTreatRepository = dependencies.plannedTreatRepository ?? new PrismaPlannedTreatRepository(prisma);
  const developmentUser = {
    id: config.DEV_USER_ID,
    email: config.DEV_USER_EMAIL,
  };

  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    }),
  );
  app.use(express.json());
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
