import cors from 'cors';
import { DailyBankTargetRepository } from './modules/daily-bank-target/daily-bank-target.repository';
import { createDailyBankTargetRouter } from './modules/daily-bank-target/daily-bank-target.routes';
import express from 'express';

import {
  createAuthenticationBoundary,
  currentUser,
  resolveRequestUser,
  isProviderCallback,
  type AuthenticationBoundary,
} from './auth/current-user';
import type { ApiEnv } from './env';
import { env } from './env';
import { AppError, errorHandler, notFoundHandler } from './errors';
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
import {
  createTodayRouter,
  type TodayPredictionResolver,
} from './modules/today/today.routes';
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
import {
  PrismaProviderSelectionRepository,
  type ProviderSelectionRepository,
} from './modules/provider-selection/provider-selection.repository';
import { createProviderSelectionRouter } from './modules/provider-selection/provider-selection.routes';
import { createHealthConnectionsRouter } from './modules/provider-selection/health-connections.routes';
import { GoogleHealthFitbitService } from './modules/google-health/google-health.service';
import { createGoogleHealthFitbitRouter } from './modules/google-health/google-health.routes';
import { WhoopService } from './modules/whoop/whoop.service';
import { createWhoopRouter } from './modules/whoop/whoop.routes';
import { FatSecretService } from './modules/fatsecret/fatsecret.service';
import { createFatSecretRouter } from './modules/fatsecret/fatsecret.routes';
import {
  PrismaOnboardingRepository,
  type OnboardingRepository,
} from './modules/onboarding/onboarding.repository';
import { createOnboardingRouter } from './modules/onboarding/onboarding.routes';
import { AccountLifecycleCoordinator } from './modules/lifecycle/account-lifecycle.service';
import { createAccountLifecycleRouter } from './modules/lifecycle/account-lifecycle.routes';
import { AccountSafetyService } from './modules/account-safety/account-safety.service';
import { createAccountSafetyRouter } from './modules/account-safety/account-safety.routes';
import { createRateLimit } from './security/rate-limit';
import { createMorningBankUpdateRouter } from './modules/morning-bank-update/morning-bank-update.routes';
import { ExpoPushTransport, MorningBankUpdateService } from './modules/morning-bank-update/morning-bank-update.service';

type AppDependencies = {
  goalConfigurationRepository?: GoalConfigurationRepository;
  bankHistoryRepository?: BankHistoryRepository;
  plannedTreatRepository?: PlannedTreatRepository;
  todayRepository?: TodayAggregateRepository;
  dashboardPreferencesRepository?: DashboardPreferencesRepository;
  syncSessionRepository?: SyncSessionRepository;
  finalizationScheduler?: FinalizationScheduler | null;
  providerSelectionRepository?: ProviderSelectionRepository;
  authenticationBoundary?: AuthenticationBoundary;
  onboardingRepository?: OnboardingRepository;
  todayPredictionResolver?: TodayPredictionResolver | null;
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
  const authentication = dependencies.authenticationBoundary ??
    createAuthenticationBoundary(config, prisma);
  const providerSelectionRepository = dependencies.providerSelectionRepository ??
    new PrismaProviderSelectionRepository(prisma, bankHistoryRepository);
  const onboardingRepository = dependencies.onboardingRepository ??
    new PrismaOnboardingRepository(prisma, providerSelectionRepository, bankHistoryRepository);
  const googleHealthFitbitService = new GoogleHealthFitbitService(
    prisma,
    todayRepository,
    config,
    finalizationScheduler,
  );
  const todayPredictionResolver = dependencies.todayPredictionResolver === undefined
    ? dependencies.todayRepository
      ? undefined
      : googleHealthFitbitService
    : dependencies.todayPredictionResolver ?? undefined;
  const whoopService = new WhoopService(prisma, todayRepository, config);
  const fatSecretService = new FatSecretService(prisma, todayRepository, config, fetch, undefined, undefined, finalizationScheduler);
  const morningBankUpdateService = new MorningBankUpdateService(
    prisma,
    bankHistoryRepository,
    new ExpoPushTransport(config.EXPO_ACCESS_TOKEN ? { accessToken: config.EXPO_ACCESS_TOKEN } : {}),
  );
  const lifecycleCoordinator = finalizationScheduler
    ? new AccountLifecycleCoordinator(
        prisma,
        bankHistoryRepository,
        finalizationScheduler,
        googleHealthFitbitService,
        fatSecretService,
      )
    : null;

  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(requestLogger);
  app.use(authentication.verify);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'caloriebank-api',
    });
  });
  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', service: 'caloriebank-api', database: 'ready' });
    } catch {
      console.error(JSON.stringify({ component: 'api_health', event: 'database_unavailable' }));
      res.status(503).json({ status: 'unavailable', service: 'caloriebank-api' });
    }
  });
  app.use(authentication.requireUser);
  const accountSafetyService = new AccountSafetyService(prisma, config, googleHealthFitbitService);
  app.use('/v1/me/integrations', createRateLimit({ limit: 60, windowMs: 15 * 60 * 1000, operation: 'provider_operations' }));
  app.use('/v1/me/ingestion', createRateLimit({ limit: 60, windowMs: 15 * 60 * 1000, operation: 'provider_ingestion' }));
  app.use('/v1/me/lifecycle', createRateLimit({ limit: 60, windowMs: 15 * 60 * 1000, operation: 'lifecycle_refresh' }));
  app.use('/v1/me', createAccountSafetyRouter(accountSafetyService, currentUser));
  app.use('/v1/me', async (_req, res, next) => {
    try {
      // Security cleanup must remain reachable while deletion is pending.
      if (isProviderCallback(_req.method, `${_req.baseUrl}${_req.path}`)) return next();
      if (_req.method === 'DELETE' && _req.path === '/morning-bank-update/device') return next();
      const user = resolveRequestUser(currentUser, res);
      const account = await prisma.user.findUnique({ where: { id: user.id }, select: { deletionRequestedAt: true } });
      if (account?.deletionRequestedAt) throw new AppError('Your account deletion is in progress. Please try again shortly.', 409, { code: 'ACCOUNT_DELETION_PENDING' });
      next();
    } catch (error) { next(error); }
  });
  app.use('/v1/me/morning-bank-update', createMorningBankUpdateRouter(morningBankUpdateService, currentUser));
  app.use(
    '/v1/me/goal-configuration',
    createGoalConfigurationRouter(
      goalConfigurationRepository,
      currentUser,
      bankHistoryRepository.prepareForGoalChange
        ? (user) => bankHistoryRepository.prepareForGoalChange!(user)
        : undefined,
    ),
  );
  app.use('/v1/me', createBankHistoryRouter(bankHistoryRepository, currentUser));
  app.use('/v1/me/planned-treat', createPlannedTreatRouter(plannedTreatRepository, currentUser));
  app.use('/v1/me/onboarding', createOnboardingRouter(onboardingRepository, currentUser));
  if (lifecycleCoordinator) {
    app.use('/v1/me/lifecycle', createAccountLifecycleRouter(lifecycleCoordinator, currentUser));
  }
  app.use('/v1/me', createTodayRouter(
    todayRepository,
    currentUser,
    todayPredictionResolver,
    config.APP_ENV === 'local'
      ? (event, metadata) => console.info(JSON.stringify({
          level: 'info',
          component: 'today_detail',
          event,
          ...metadata,
        }))
      : undefined,
  ));
  app.use(
    '/v1/me/provider-selection',
    createProviderSelectionRouter(providerSelectionRepository, currentUser),
  );
  app.use(
    '/v1/me/health-connections',
    createHealthConnectionsRouter(providerSelectionRepository, currentUser),
  );
  app.use(
    '/v1/me/integrations/fitbit',
    createGoogleHealthFitbitRouter(googleHealthFitbitService, currentUser),
  );
  app.use('/v1/me/integrations/whoop', createWhoopRouter(whoopService, currentUser));
  app.use('/v1/me/integrations/fatsecret', createFatSecretRouter(fatSecretService, currentUser));
  app.use(
    '/v1/me/dashboard-preferences',
    createDashboardPreferencesRouter(dashboardPreferencesRepository, currentUser),
  );
  app.use('/v1/me/daily-bank-target', createDailyBankTargetRouter(new DailyBankTargetRepository(prisma), currentUser));
  app.use(
    '/v1/me/ingestion/sync-sessions',
    createSyncSessionRouter(syncSessionRepository, currentUser, finalizationScheduler),
  );
  app.use(
    '/v1/me/ingestion',
    createTodayIngestionRouter(todayRepository, currentUser),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
