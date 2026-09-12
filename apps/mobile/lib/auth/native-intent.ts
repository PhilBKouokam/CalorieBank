const ANDROID_HOSTED_CALLBACK = 'clerk://com.caloriebank.mobile.hosted-callback';

/** Router-only normalization. Clerk must receive and validate the original URL. */
export function normalizeAuthSystemPath(
  { path, initial }: { path: string; initial: boolean },
  platform: string,
): string {
  if (platform !== 'android') return path;
  try {
    const url = new URL(path);
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
