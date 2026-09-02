const DIETARY_ENERGY = 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as const;
const DISCOVERY_LOOKBACK_DAYS = 30;

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
export type AppleHealthSource = Awaited<ReturnType<HealthKitModule['querySources']>>[number];

export type AppleHealthIntakeWriter = {
  bundleIdentifier: string;
  displayName: string;
  sourceName: string;
  totalCalories: number;
  source: AppleHealthSource;
};

export type KnownFoodTracker = 'cronometer' | 'myfitnesspal' | 'lose_it' | 'macrofactor';

const VERIFIED_BUNDLE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'CRONOMETER-GOLD': 'Cronometer',
  'com.fatsecret.caloriecounter': 'FatSecret',
};

const TRACKER_DISPLAY_NAMES: Readonly<Record<KnownFoodTracker, string>> = {
  cronometer: 'Cronometer',
  myfitnesspal: 'MyFitnessPal',
  lose_it: 'Lose It!',
  macrofactor: 'MacroFactor',
};

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function displayNameForSource(source: AppleHealthSource) {
  const verified = VERIFIED_BUNDLE_DISPLAY_NAMES[source.bundleIdentifier];
  if (verified) return verified;
  const name = source.name.trim();
  return name && normalizedName(name) !== 'sourceproxy' ? name : 'Apple Health app';
}

export async function discoverAppleHealthIntakeWriters(
  now = new Date(),
): Promise<AppleHealthIntakeWriter[]> {
  const healthKit = await import('@kingstinct/react-native-healthkit');
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DISCOVERY_LOOKBACK_DAYS);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const filter = { date: { startDate, endDate, strictStartDate: true, strictEndDate: true } };
  const sources = await healthKit.querySources(DIETARY_ENERGY, filter);
  const writers = await Promise.all(sources.map(async (source) => {
    const statistics = await healthKit.queryStatisticsForQuantity(
      DIETARY_ENERGY,
      ['cumulativeSum'],
      { filter: { ...filter, sources: [source] }, unit: 'kcal' },
    );
    return {
      bundleIdentifier: source.bundleIdentifier,
      displayName: displayNameForSource(source),
      sourceName: source.name,
      totalCalories: statistics.sumQuantity?.quantity ?? 0,
      source,
    };
  }));
  return writers
    .filter((writer) => writer.totalCalories > 0)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function resolveKnownFoodTracker(
  tracker: KnownFoodTracker,
  writers: readonly AppleHealthIntakeWriter[],
) {
  const displayName = TRACKER_DISPLAY_NAMES[tracker];
  if (tracker === 'cronometer') {
    return writers.find((writer) => writer.bundleIdentifier === 'CRONOMETER-GOLD') ?? null;
  }
  const target = normalizedName(displayName);
  const matches = writers.filter((writer) => normalizedName(writer.sourceName) === target);
  return matches.length === 1 ? matches[0]! : null;
}

export async function sourceForSelectedWriter(bundleIdentifier: string) {
  const healthKit = await import('@kingstinct/react-native-healthkit');
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DISCOVERY_LOOKBACK_DAYS);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const filter = { date: { startDate, endDate, strictStartDate: true, strictEndDate: true } };
  const sources = await healthKit.querySources(DIETARY_ENERGY, filter);
  const source = sources.find((candidate) => candidate.bundleIdentifier === bundleIdentifier);
  if (!source) return null;
  const statistics = await healthKit.queryStatisticsForQuantity(
    DIETARY_ENERGY,
    ['cumulativeSum'],
    { filter: { ...filter, sources: [source] }, unit: 'kcal' },
  );
  return {
    bundleIdentifier: source.bundleIdentifier,
    displayName: displayNameForSource(source),
    sourceName: source.name,
    totalCalories: statistics.sumQuantity?.quantity ?? 0,
    source,
  };
}
