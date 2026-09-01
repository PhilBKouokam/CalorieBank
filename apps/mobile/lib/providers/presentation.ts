const consumerSourceNames: Readonly<Record<string, string>> = {
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
  return consumerSourceNames[source] ?? 'Connected source';
}
