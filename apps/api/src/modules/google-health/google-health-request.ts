import { AppError } from '../../errors';

export type ActivityRequestPolicy = 'authoritative' | 'supplementary';
export type ActivityFailureKind = 'authentication' | 'authorization' | 'rate_limit' | 'timeout' | 'network' | 'outage' | 'http' | 'malformed';

export class GoogleHealthActivityError extends AppError {
  constructor(readonly kind: ActivityFailureKind, readonly providerStatus: number | null, statusCode = 502) {
    super(statusCode === 401 ? 'Fitbit access needs to be reconnected.' : 'Fitbit activity data is temporarily unavailable.', statusCode);
  }
}

/** Only authoritative requests may invalidate this account's connection. Optional
 * evidence never repairs or invalidates authentication, regardless of ordering. */
export function createGoogleHealthActivityRequest(fetcher: typeof fetch, accessToken: string, onAuthenticationFailure: () => Promise<void>) {
  return async (url: string, init: RequestInit, policy: ActivityRequestPolicy = 'authoritative'): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...init.headers },
      });
    } catch (error) {
      const timeout = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name);
      throw new GoogleHealthActivityError(timeout ? 'timeout' : 'network', null);
    }
    if (!response.ok) {
      const status = response.status;
      if (status === 401 && policy === 'authoritative') await onAuthenticationFailure();
      const kind: ActivityFailureKind = status === 401 ? 'authentication'
        : status === 403 ? 'authorization' : status === 429 ? 'rate_limit'
          : status >= 500 ? 'outage' : 'http';
      throw new GoogleHealthActivityError(kind, status, status === 401 && policy === 'authoritative' ? 401 : 502);
    }
    try { return await response.json(); }
    catch { throw new GoogleHealthActivityError('malformed', response.status); }
  };
}
