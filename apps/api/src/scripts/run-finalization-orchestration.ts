import type { IngestionSyncTrigger } from '@prisma/client';

import { prisma } from '../db/client';
import { env } from '../env';
import { PrismaBankHistoryRepository } from '../modules/bank-history/bank-history.repository';
import { FinalizationOrchestrationService } from '../modules/finalization-orchestration/finalization-orchestration.service';
import { getLocalDateForTimezone } from '../modules/today/today.time';

function previousCalendarDates(localDate: string, count: number) {
  const anchor = new Date(`${localDate}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - index - 1);
    return date.toISOString().slice(0, 10);
  });
}

async function run() {
  const triggerArg = process.argv.find((argument) => argument.startsWith('--trigger='))?.split('=')[1];
  const trigger = (triggerArg ?? 'scheduled') as IngestionSyncTrigger;
  if (!['scheduled', 'manual_refresh', 'integration_test'].includes(trigger)) {
    throw new Error('The orchestration CLI trigger must be scheduled, manual_refresh, or integration_test.');
  }
  const profile = await prisma.userProfile.findUnique({ where: { userId: env.DEV_USER_ID } });
  const timezone = profile?.timezone ?? 'UTC';
  const currentLocalDate = getLocalDateForTimezone(timezone);
  const service = new FinalizationOrchestrationService(
    prisma,
    new PrismaBankHistoryRepository(prisma, {
      allowSyntheticProviders: env.TODAY_INGESTION_MODE === 'development',
    }),
  );
  const result = await service.execute({
    user: { id: env.DEV_USER_ID, email: env.DEV_USER_EMAIL },
    currentLocalDate,
    timezone,
    dates: previousCalendarDates(currentLocalDate, 2),
    trigger,
  });
  console.info(JSON.stringify({ event: 'finalization_orchestration_completed', trigger, ...result }));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
