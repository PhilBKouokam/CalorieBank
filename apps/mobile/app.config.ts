import type { ConfigContext, ExpoConfig } from 'expo/config';
export const nutritionPermission = 'android.permission.health.READ_NUTRITION';
export const qualificationPermissions = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_BASAL_METABOLIC_RATE',
  'android.permission.health.READ_DISTANCE',
];

export function healthConnectReleasePolicy(profile: string | undefined, flag: string | undefined) {
  const qualification = flag === '1';
  if (qualification && profile && !['development', 'preview'].includes(profile)) {
    throw new Error('Health Connect qualification is restricted to development/preview builds.');
  }
  return {
    qualification,
    permissions: [nutritionPermission, ...(qualification ? qualificationPermissions : [])],
    blockedPermissions: qualification ? [] : qualificationPermissions,
  };
}


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
  if (profile !== 'preview' && profile !== 'production' && profile !== 'testflight' && profile !== 'play-testing') return;
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
    ((profile === 'preview' || profile === 'testflight' || profile === 'play-testing') && appEnvironment !== 'beta') ||
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
  const health = healthConnectReleasePolicy(process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION);

  return {
    ...config,
    name: config.name ?? 'CalorieBank',
    slug: config.slug ?? 'caloriebank',
    android: {
      ...config.android,
      permissions: [...(config.android?.permissions ?? []).filter((p) => !p.startsWith('android.permission.health.')), ...health.permissions],
      blockedPermissions: [...new Set([...(config.android?.blockedPermissions ?? []), ...health.blockedPermissions])],
    },
    extra: { ...config.extra, healthConnectQualification: health.qualification },
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
