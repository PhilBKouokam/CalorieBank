import { defaultHostedAuthRedirect } from './hosted-auth-diagnostics';

// Diagnostics only. Clerk itself owns the hosted-auth redirect and session activation.
export function hostedAuthRedirectForPlatform(platform: string, config: { ios?: { bundleIdentifier?: string }; android?: { package?: string } }) {
  if (platform === 'android') {
    const packageName = config.android?.package ?? 'com.caloriebank.mobile';
    return { nativeRedirectUrl: `clerk://${packageName}.hosted-callback`, nativeRedirectScheme: 'clerk' };
  }
  return defaultHostedAuthRedirect(config.ios?.bundleIdentifier ?? 'com.caloriebank.mobile');
}
