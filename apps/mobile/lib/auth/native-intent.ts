let onboardingProviderReturn: { provider: 'fitbit' | 'fatsecret' } | null = null;

/** Scope Router suppression to the live onboarding browser operation only. */
export function beginOnboardingProviderReturn(provider: 'fitbit' | 'fatsecret') {
  const operation = { provider };
  onboardingProviderReturn = operation;
  return () => { if (onboardingProviderReturn === operation) onboardingProviderReturn = null; };
}

const ANDROID_HOSTED_CALLBACK = 'clerk://com.caloriebank.mobile.hosted-callback';

/** Router-only normalization. Clerk must receive and validate the original URL. */
export function normalizeAuthSystemPath(
  { path, initial }: { path: string; initial: boolean },
  platform: string,
): string {
  if (platform !== 'android') return path;
  try {
    const url = new URL(path);
    if (!initial && onboardingProviderReturn && url.protocol === 'caloriebank:' &&
        url.host === 'integrations' && (url.pathname === '' || url.pathname === '/') &&
        !url.username && !url.password && url.searchParams.has(onboardingProviderReturn.provider)) {
      // WebBrowser still receives the original callback and validates its result.
      // Keep setup mounted so its explicit role-selection operation can finish.
      return '';
    }
    if (`${url.protocol}//${url.host}` !== ANDROID_HOSTED_CALLBACK ||
        url.username || url.password || (url.pathname !== '' && url.pathname !== '/')) return path;
    // Warm: do not unmount the screen awaiting Clerk's state/PKCE verification.
    // Cold: use the existing hydrated-session gate; URL parameters never confer auth.
    // No callback/session state is cached, so duplicates cannot switch accounts.
    return initial ? '/' : '';
  } catch {
    return path;
  }
}
