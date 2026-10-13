import { sourceLabel } from '../native-health/copy';

const consumerSourceNames: Readonly<Record<string, string>> = {
  manual_estimate: 'Your estimate',
  'CalorieBank estimate': 'Your estimate',
  'Your estimate': 'Your estimate',
  apple_health: 'Apple Health',
  'Apple Health': 'Apple Health',
  apple_watch: 'Apple Watch',
  'Apple Watch': 'Apple Watch',
  google_health_fitbit: 'Fitbit',
  Fitbit: 'Fitbit',
  fatsecret: 'FatSecret',
  FatSecret: 'FatSecret',
  cronometer: 'Cronometer',
  Cronometer: 'Cronometer',
  myfitnesspal: 'MyFitnessPal',
  MyFitnessPal: 'MyFitnessPal',
  lose_it: 'Lose It!',
  'Lose It!': 'Lose It!',
  macrofactor: 'MacroFactor',
  MacroFactor: 'MacroFactor',
};

export function getConsumerSourceName(source: string | null | undefined) {
  if (!source) return 'Connected source';
  return sourceLabel(consumerSourceNames[source] ?? 'Calorie source');
}

/** Current source-choice label only; never use a usual estimate for historical intake. */
export function usualEstimateSourceLabel(calories: number | null | undefined) {
  return calories != null && Number.isFinite(calories) && calories > 0
    ? `${calories.toLocaleString('en-US')} kcal (Your estimate)`
    : 'Your estimate';
}

export function currentIntakeSourceLabel(label: string, usualCalories: number | null | undefined) {
  return label === 'manual_estimate' || label === 'CalorieBank estimate' || label === 'Your estimate'
    ? usualEstimateSourceLabel(usualCalories)
    : sourceLabel(label);
}
