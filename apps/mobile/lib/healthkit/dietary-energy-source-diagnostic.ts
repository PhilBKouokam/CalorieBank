import { getRollingLocalDayWindows } from '@caloriebank/domain';

const DIETARY_ENERGY = 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as const;
const AGREEMENT_TOLERANCE_KCAL = 0.5;

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
type HealthKitSource = Awaited<ReturnType<HealthKitModule['querySources']>>[number];

export type DietaryEnergySourceDiagnosticError = {
  code: string | null;
  message: string;
};

export type DietaryEnergySourceDiagnosticWriter = {
  sourceName: string;
  bundleIdentifier: string;
  sampleCount: number;
  duplicateUuidCount: number;
  rawSumKcal: number | null;
  separateBySourceSumKcal: number | null;
  filteredStatisticsSumKcal: number | null;
  rawMatchesSeparateBySource: boolean | null;
  rawMatchesFilteredStatistics: boolean | null;
  separateBySourceMatchesFilteredStatistics: boolean | null;
  filteredStatisticsError: DietaryEnergySourceDiagnosticError | null;
};

export type DietaryEnergySourceDiagnosticDate = {
  localDate: string;
  allSourceTotalKcal: number | null;
  groupedSourceTotalKcal: number | null;
  allSourceMatchesGroupedTotal: boolean | null;
  querySourcesCount: number | null;
  writers: DietaryEnergySourceDiagnosticWriter[];
  rawSamplesError: DietaryEnergySourceDiagnosticError | null;
  separateBySourceError: DietaryEnergySourceDiagnosticError | null;
  querySourcesError: DietaryEnergySourceDiagnosticError | null;
  allSourceStatisticsError: DietaryEnergySourceDiagnosticError | null;
};

export type DietaryEnergySourceDiagnosticReport = {
  generatedAt: string;
  dates: DietaryEnergySourceDiagnosticDate[];
};

type WriterAccumulator = {
  source: HealthKitSource;
  sourceName: string;
  bundleIdentifier: string;
  sampleCount: number;
  uuids: string[];
  rawSumKcal: number;
};

function safeError(error: unknown): DietaryEnergySourceDiagnosticError {
  if (!(error instanceof Error)) return { code: null, message: 'Unknown HealthKit error' };
  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code.slice(0, 80) : null,
    message: error.message.replace(/\s+/g, ' ').slice(0, 180) || 'HealthKit query failed',
  };
}

function roundKcal(value: number) {
  return Math.round(value * 10) / 10;
}

function agrees(left: number | null, right: number | null) {
  if (left === null || right === null) return null;
  return Math.abs(left - right) <= AGREEMENT_TOLERANCE_KCAL;
}

function duplicateCount(uuids: readonly string[]) {
  return uuids.length - new Set(uuids).size;
}

async function settledValue<T>(operation: () => Promise<T>) {
  try {
    return { value: await operation(), error: null };
  } catch (error) {
    return { value: null, error: safeError(error) };
  }
}

function dateFilter(dayStart: Date, dayEnd: Date) {
  return {
    date: {
      startDate: dayStart,
      endDate: dayEnd,
      strictStartDate: true,
      strictEndDate: true,
    },
  };
}

async function diagnoseDate(
  healthKit: HealthKitModule,
  window: ReturnType<typeof getRollingLocalDayWindows>[number],
): Promise<DietaryEnergySourceDiagnosticDate> {
  const filter = dateFilter(window.dayStart, window.dayEnd);
  const [allSourceResult, rawResult, separateResult, sourcesResult] = await Promise.all([
    settledValue(() => healthKit.queryStatisticsForQuantity(
      DIETARY_ENERGY,
      ['cumulativeSum'],
      { filter, unit: 'kcal' },
    )),
    settledValue(() => healthKit.queryQuantitySamples(
      DIETARY_ENERGY,
      { filter, limit: 0, ascending: true, unit: 'kcal' },
    )),
    settledValue(() => healthKit.queryStatisticsForQuantitySeparateBySource(
      DIETARY_ENERGY,
      ['cumulativeSum'],
      { filter, unit: 'kcal' },
    )),
    settledValue(() => healthKit.querySources(DIETARY_ENERGY, filter)),
  ]);

  const writers = new Map<string, WriterAccumulator>();
  for (const sample of rawResult.value ?? []) {
    const source = sample.sourceRevision.source;
    const existing = writers.get(source.bundleIdentifier);
    if (existing) {
      existing.sampleCount += 1;
      existing.uuids.push(sample.uuid);
      existing.rawSumKcal += sample.quantity;
    } else {
      writers.set(source.bundleIdentifier, {
        source,
        sourceName: source.name,
        bundleIdentifier: source.bundleIdentifier,
        sampleCount: 1,
        uuids: [sample.uuid],
        rawSumKcal: sample.quantity,
      });
    }
  }

  const sourceByBundle = new Map<string, HealthKitSource>();
  for (const source of sourcesResult.value ?? []) sourceByBundle.set(source.bundleIdentifier, source);
  for (const item of separateResult.value ?? []) sourceByBundle.set(item.source.bundleIdentifier, item.source);
  for (const writer of writers.values()) sourceByBundle.set(writer.bundleIdentifier, writer.source);

  const separateByBundle = new Map(
    (separateResult.value ?? []).map((item) => [
      item.source.bundleIdentifier,
      item.sumQuantity?.quantity ?? null,
    ]),
  );

  const writerResults = await Promise.all([...sourceByBundle.entries()].map(async ([bundleIdentifier, source]) => {
    const raw = writers.get(bundleIdentifier);
    const filteredResult = await settledValue(() => healthKit.queryStatisticsForQuantity(
      DIETARY_ENERGY,
      ['cumulativeSum'],
      { filter: { ...filter, sources: [source] }, unit: 'kcal' },
    ));
    const rawSumKcal = raw ? roundKcal(raw.rawSumKcal) : null;
    const separateBySourceSumKcal = separateByBundle.get(bundleIdentifier) ?? null;
    const filteredStatisticsSumKcal = filteredResult.value?.sumQuantity?.quantity ?? null;
    const result: DietaryEnergySourceDiagnosticWriter = {
      sourceName: source.name,
      bundleIdentifier,
      sampleCount: raw?.sampleCount ?? 0,
      duplicateUuidCount: raw ? duplicateCount(raw.uuids) : 0,
      rawSumKcal,
      separateBySourceSumKcal: separateBySourceSumKcal === null
        ? null
        : roundKcal(separateBySourceSumKcal),
      filteredStatisticsSumKcal: filteredStatisticsSumKcal === null
        ? null
        : roundKcal(filteredStatisticsSumKcal),
      rawMatchesSeparateBySource: agrees(rawSumKcal, separateBySourceSumKcal),
      rawMatchesFilteredStatistics: agrees(rawSumKcal, filteredStatisticsSumKcal),
      separateBySourceMatchesFilteredStatistics: agrees(
        separateBySourceSumKcal,
        filteredStatisticsSumKcal,
      ),
      filteredStatisticsError: filteredResult.error,
    };

    if (__DEV__) {
      console.info('[CalorieBank HealthKit Source Diagnostic]', {
        date: window.localDate,
        sourceName: result.sourceName,
        bundleIdentifier: result.bundleIdentifier,
        sampleCount: result.sampleCount,
        summedKcal: result.rawSumKcal,
        rawMatchesSeparateBySource: result.rawMatchesSeparateBySource,
        rawMatchesFilteredStatistics: result.rawMatchesFilteredStatistics,
        separateBySourceMatchesFilteredStatistics:
          result.separateBySourceMatchesFilteredStatistics,
      });
    }
    return result;
  }));

  const groupedSourceTotalKcal = rawResult.value === null
    ? null
    : roundKcal([...writers.values()].reduce((total, writer) => total + writer.rawSumKcal, 0));
  const allSourceTotal = allSourceResult.value?.sumQuantity?.quantity ?? null;

  return {
    localDate: window.localDate,
    allSourceTotalKcal: allSourceTotal === null ? null : roundKcal(allSourceTotal),
    groupedSourceTotalKcal,
    allSourceMatchesGroupedTotal: agrees(allSourceTotal, groupedSourceTotalKcal),
    querySourcesCount: sourcesResult.value?.length ?? null,
    writers: writerResults.sort((left, right) =>
      left.sourceName.localeCompare(right.sourceName) ||
      left.bundleIdentifier.localeCompare(right.bundleIdentifier)),
    rawSamplesError: rawResult.error,
    separateBySourceError: separateResult.error,
    querySourcesError: sourcesResult.error,
    allSourceStatisticsError: allSourceResult.error,
  };
}

export async function runDietaryEnergySourceDiagnostic(
  now = new Date(),
): Promise<DietaryEnergySourceDiagnosticReport> {
  if (!__DEV__) throw new Error('Dietary Energy source diagnostics are development-only.');

  const healthKit = await import('@kingstinct/react-native-healthkit');
  if (!healthKit.isHealthDataAvailable()) {
    throw new Error('HealthKit is unavailable on this device.');
  }

  const completedDates = getRollingLocalDayWindows(now, 4).slice(1);
  return {
    generatedAt: new Date().toISOString(),
    dates: await Promise.all(completedDates.map((window) => diagnoseDate(healthKit, window))),
  };
}
