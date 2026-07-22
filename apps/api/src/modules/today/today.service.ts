import type {
  ExpenditureProvider,
  FetchDailyAggregateInput,
  IntakeProvider,
} from '@caloriebank/domain';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { TodayAggregateRepository } from './today.repository';

export type TodayIngestionServiceDependencies = {
  expenditureProvider: ExpenditureProvider;
  intakeProvider: IntakeProvider;
  repository: TodayAggregateRepository;
};

export class TodayIngestionService {
  constructor(private readonly dependencies: TodayIngestionServiceDependencies) {}

  async syncDailyAggregates(user: DevelopmentUser, input: FetchDailyAggregateInput) {
    const [expenditureAggregate, intakeAggregate] = await Promise.all([
      this.dependencies.expenditureProvider.fetchDailyExpenditureAggregate(input),
      this.dependencies.intakeProvider.fetchDailyCalorieIntakeAggregate(input),
    ]);

    if (expenditureAggregate) {
      await this.dependencies.repository.upsertExpenditureAggregate(user, expenditureAggregate);
    }

    if (intakeAggregate) {
      await this.dependencies.repository.upsertIntakeAggregate(user, intakeAggregate);
    }
  }
}
