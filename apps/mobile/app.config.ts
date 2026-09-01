import type { ConfigContext, ExpoConfig } from 'expo/config';

const LOCAL_API_USAGE_DESCRIPTION =
  'CalorieBank connects to the development API running on your Mac while both devices are on your local network.';

function allowsDevelopmentLocalHttp() {
  return (
    process.env.EAS_BUILD_PROFILE === 'development' ||
    process.env.CALORIEBANK_IOS_ALLOW_LOCAL_HTTP === '1'
  );
}

function assertHostedBuildEnvironment() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile !== 'preview' && profile !== 'production') return;
  const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  const authMode = process.env.EXPO_PUBLIC_AUTH_MODE;
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  let apiUrl: URL | null = null;
  try {
    apiUrl = rawApiUrl ? new URL(rawApiUrl) : null;
  } catch {
    // The error below intentionally reports only the variable name, never its value.
  }
  if (
    (profile === 'preview' && appEnvironment !== 'beta') ||
    (profile === 'production' && appEnvironment !== 'production') ||
    authMode !== 'clerk' ||
    !publishableKey ||
    apiUrl?.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname)
  ) {
    throw new Error(
      `${profile} builds require the matching hosted app environment, Clerk authentication, ` +
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, and a non-local HTTPS EXPO_PUBLIC_API_URL.',
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertHostedBuildEnvironment();
  const developmentLocalHttp = allowsDevelopmentLocalHttp();

  return {
    ...config,
    name: config.name ?? 'CalorieBank',
    slug: config.slug ?? 'caloriebank',
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(developmentLocalHttp
          ? {
              NSAppTransportSecurity: {
                NSAllowsArbitraryLoads: false,
                NSAllowsLocalNetworking: true,
              },
              NSLocalNetworkUsageDescription: LOCAL_API_USAGE_DESCRIPTION,
            }
          : {}),
      },
    },
  };
};
