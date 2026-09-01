const providerDisplayNames: Readonly<Record<string, string>> = {
  apple_health: 'Apple Health',
  google_health_fitbit: 'Fitbit',
  garmin: 'Garmin',
  whoop: 'WHOOP',
  fatsecret: 'FatSecret',
  development: 'Development Provider',
};

export function getProviderDisplayName(provider: string) {
  return providerDisplayNames[provider] ?? provider;
}

export function isSyntheticProvider(provider: string) {
  return provider === 'development';
}
