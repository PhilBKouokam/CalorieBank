import type { ApiEnv } from '../../env';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import {
  DevelopmentExpenditureProvider,
  DevelopmentIntakeProvider,
} from './development-providers';
import type { TodayAggregateRepository } from './today.repository';
import { TodayIngestionService } from './today.service';
import { getLocalDateForTimezone } from './today.time';

export async function bootstrapDevelopmentTodayAggregates({
  config,
  developmentUser,
  repository,
}: {
  config: ApiEnv;
  developmentUser: DevelopmentUser;
  repository: TodayAggregateRepository;
}) {
  if (config.NODE_ENV === 'production' || config.TODAY_INGESTION_MODE !== 'development') {
    return;
  }

  const timezone = 'America/Chicago';
  const service = new TodayIngestionService({
    expenditureProvider: new DevelopmentExpenditureProvider(),
    intakeProvider: new DevelopmentIntakeProvider(),
    repository,
  });

  await service.syncDailyAggregates(developmentUser, {
    userId: developmentUser.id,
    localDate: getLocalDateForTimezone(timezone),
    timezone,
    isCurrentDay: true,
  });
}
