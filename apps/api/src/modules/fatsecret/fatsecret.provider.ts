import {
  normalizeDailyIntakeAggregate,
  type FetchDailyAggregateInput,
  type IntakeProvider,
  type NormalizedDailyIntakeAggregate,
} from '@caloriebank/domain';
import { z } from 'zod';

export const FATSECRET_PROVIDER_ID = 'fatsecret';

const FatSecretDaySchema = z.object({
  date_int: z.union([z.string(), z.number()]),
  calories: z.union([z.string(), z.number()]),
}).passthrough();

const FatSecretMonthSchema = z.object({
  month: z.object({
    day: z.array(FatSecretDaySchema).optional(),
  }).passthrough(),
}).passthrough();

export interface FatSecretDiaryTransport {
  fetchMonthlyDiary(date: number): Promise<unknown>;
}

function localDateParts(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new Error('FatSecret local date must use YYYY-MM-DD.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() + 1 !== month ||
    value.getUTCDate() !== day
  ) throw new Error('FatSecret local date is invalid.');
  return { year, month, day };
}

export function localDateToFatSecretDateInt(localDate: string) {
  const { year, month, day } = localDateParts(localDate);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function fatSecretDateIntToLocalDate(dateInt: number) {
  if (!Number.isSafeInteger(dateInt)) throw new Error('FatSecret date value is invalid.');
  return new Date(dateInt * 86_400_000).toISOString().slice(0, 10);
}

function calories(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('FatSecret returned invalid daily calories.');
  return Math.round(parsed);
}

export class FatSecretIntakeProvider implements IntakeProvider {
  readonly providerId = FATSECRET_PROVIDER_ID;
  readonly capabilities = {
    dailyAggregate: true,
    rollingWindow: true,
    directConnection: true,
  } as const;

  constructor(
    private readonly transport: FatSecretDiaryTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchRollingDailyCalorieIntakeAggregates(inputs: readonly FetchDailyAggregateInput[]) {
    const payloadByMonth = new Map<string, z.infer<typeof FatSecretMonthSchema>>();
    for (const input of inputs) {
      const monthKey = input.localDate.slice(0, 7);
      if (!payloadByMonth.has(monthKey)) {
        payloadByMonth.set(
          monthKey,
          FatSecretMonthSchema.parse(
            await this.transport.fetchMonthlyDiary(localDateToFatSecretDateInt(input.localDate)),
          ),
        );
      }
    }
    const importedAt = this.now();
    return inputs.map((input): NormalizedDailyIntakeAggregate | null => {
      const dateInt = localDateToFatSecretDateInt(input.localDate);
      const day = payloadByMonth.get(input.localDate.slice(0, 7))?.month.day
        ?.find((candidate) => Number(candidate.date_int) === dateInt);
      if (!day) return null;
      return normalizeDailyIntakeAggregate({
        ...input,
        provider: FATSECRET_PROVIDER_ID,
        providerRecordId: `${FATSECRET_PROVIDER_ID}:${input.localDate}`,
        totalCaloriesConsumed: calories(day.calories),
        importedAt,
        providerUpdatedAt: null,
        syncStatus: 'ready',
      });
    });
  }

  async fetchDailyCalorieIntakeAggregate(input: FetchDailyAggregateInput) {
    return (await this.fetchRollingDailyCalorieIntakeAggregates([input]))[0] ?? null;
  }
}
