const providerDisplayNames: Readonly<Record<string, string>> = {
  apple_health: 'Apple Health',
  development: 'Development Provider',
};

export function getProviderDisplayName(provider: string) {
  return providerDisplayNames[provider] ?? provider;
}

export function isSyntheticProvider(provider: string) {
  return provider === 'development';
}
