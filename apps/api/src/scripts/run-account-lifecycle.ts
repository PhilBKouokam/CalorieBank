import { prisma } from '../db/client';
import { env } from '../env';
import { PrismaBankHistoryRepository } from '../modules/bank-history/bank-history.repository';
import { FatSecretService } from '../modules/fatsecret/fatsecret.service';
import { FinalizationOrchestrationService } from '../modules/finalization-orchestration/finalization-orchestration.service';
import { GoogleHealthFitbitService } from '../modules/google-health/google-health.service';
import { AccountLifecycleCoordinator } from '../modules/lifecycle/account-lifecycle.service';
import { PrismaTodayAggregateRepository } from '../modules/today/today.repository';

async function run() {
  const bankHistory = new PrismaBankHistoryRepository(prisma, {
    allowSyntheticProviders: env.TODAY_INGESTION_MODE === 'development',
  });
  const finalization = new FinalizationOrchestrationService(prisma, bankHistory);
  const today = new PrismaTodayAggregateRepository(prisma, {
    allowSyntheticProviders: env.TODAY_INGESTION_MODE === 'development',
    onBankingAggregateChanged: (user, date, timezone, sessionId) =>
      bankHistory.reconcileStoredDay(user, date, timezone, sessionId).then(() => undefined),
  });
  const coordinator = new AccountLifecycleCoordinator(
    prisma,
    bankHistory,
    finalization,
    new GoogleHealthFitbitService(prisma, today, env, finalization),
    new FatSecretService(prisma, today, env, fetch, undefined, undefined, finalization),
  );
  await coordinator.runDueAccounts();
}

run()
  .catch((error) => {
    console.error(JSON.stringify({
      component: 'account_lifecycle',
      event: 'lifecycle_run_failed',
      reasonCode: error instanceof Error ? error.name : 'unknown',
    }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
