import {
  V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  normalizeDailyExpenditureAggregate,
  normalizeDailyIntakeAggregate,
  type ExpenditureProvider,
  type FetchDailyAggregateInput,
  type IntakeProvider,
  type NormalizedDailyExpenditureAggregate,
  type NormalizedDailyIntakeAggregate,
} from '@caloriebank/domain';

const DEVELOPMENT_PROVIDER_NAME = 'development';
const DEVELOPMENT_SYNC_OFFSET_MS = 2 * 60 * 1000;

export class DevelopmentExpenditureProvider implements ExpenditureProvider {
  constructor(
    private readonly now: () => Date = () => new Date(Date.now() - DEVELOPMENT_SYNC_OFFSET_MS),
    private readonly adjustmentFactor = V1_TOTAL_EXPENDITURE_ADJUSTMENT_RATE,
  ) {}

  async fetchDailyExpenditureAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyExpenditureAggregate> {
    const importedAt = this.now();

    return normalizeDailyExpenditureAggregate({
      userId: input.userId,
      localDate: input.localDate,
      timezone: input.timezone,
      provider: DEVELOPMENT_PROVIDER_NAME,
      providerRecordId: `development-expenditure:${input.userId}:${input.localDate}`,
      rawTotalDailyExpenditure: 2000,
      adjustmentFactor: this.adjustmentFactor,
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
      isCurrentDay: input.isCurrentDay,
    });
  }
}

export class DevelopmentIntakeProvider implements IntakeProvider {
  constructor(private readonly now: () => Date = () => new Date(Date.now() - DEVELOPMENT_SYNC_OFFSET_MS)) {}

  async fetchDailyCalorieIntakeAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyIntakeAggregate> {
    const importedAt = this.now();

    return normalizeDailyIntakeAggregate({
      userId: input.userId,
      localDate: input.localDate,
      timezone: input.timezone,
      provider: DEVELOPMENT_PROVIDER_NAME,
      providerRecordId: `development-intake:${input.userId}:${input.localDate}`,
      totalCaloriesConsumed: 1500,
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
      isCurrentDay: input.isCurrentDay,
    });
  }
}
