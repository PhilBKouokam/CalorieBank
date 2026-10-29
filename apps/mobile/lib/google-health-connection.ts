export const GOOGLE_HEALTH_CONNECTION_UNAVAILABLE = "Google Health connection isn't available yet.";
export function googleHealthConnectionUnavailable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === 'GOOGLE_HEALTH_NOT_AVAILABLE';
}
export function googleHealthAuthorizationResult(address: string): 'connected' | 'unavailable' | 'failed' {
  try {
    const url = new URL(address);
    if (url.protocol !== 'caloriebank:' || url.hostname !== 'integrations') return 'failed';
    const status = url.searchParams.get('fitbit');
    return status === 'connected' || status === 'unavailable' ? status : 'failed';
  } catch { return 'failed'; }
}
