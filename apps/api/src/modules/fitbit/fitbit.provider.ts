import {
  normalizeDailyExpenditureAggregate,
  type ExpenditureProvider,
  type FetchDailyAggregateInput,
  type NormalizedDailyExpenditureAggregate,
} from '@caloriebank/domain';
import { z } from 'zod';

const FitbitDailyActivitySchema = z.object({
  summary: z.object({ caloriesOut: z.number().nonnegative() }),
});

export interface FitbitActivityTransport {
  fetchDailyActivity(localDate: string): Promise<unknown>;
}

export class FitbitExpenditureProvider implements ExpenditureProvider {
  constructor(
    private readonly transport: FitbitActivityTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchDailyExpenditureAggregate(
    input: FetchDailyAggregateInput,
  ): Promise<NormalizedDailyExpenditureAggregate> {
    const payload = FitbitDailyActivitySchema.parse(
      await this.transport.fetchDailyActivity(input.localDate),
    );
    const importedAt = this.now();
    return normalizeDailyExpenditureAggregate({
      ...input,
      provider: 'fitbit',
      providerRecordId: `fitbit:expenditure:${input.localDate}`,
      rawTotalDailyExpenditure: Math.round(payload.summary.caloriesOut),
      importedAt,
      providerUpdatedAt: importedAt,
      syncStatus: 'ready',
    });
  }
}
