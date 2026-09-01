import { describe, expect, it } from 'vitest';

import {
  defaultHostedAuthRedirect,
  hostedAuthErrorMetadata,
  hostedAuthResultMetadata,
} from '../../mobile/lib/auth/hosted-auth-diagnostics';

describe('hosted authentication diagnostics', () => {
  it('reports result state without exposing a session identifier', () => {
    expect(hostedAuthResultMetadata({
      createdSessionId: 'sess_secret',
      authSessionResult: { type: 'success' },
    })).toEqual({
      authSessionResultExists: true,
      authSessionResultType: 'success',
      createdSessionIdExists: true,
    });
  });

  it('does not contain the created session identifier in result metadata', () => {
    const metadata = hostedAuthResultMetadata({
      createdSessionId: 'sess_private_value',
      authSessionResult: { type: 'success' },
    });
    expect(JSON.stringify(metadata)).not.toContain('sess_private_value');
  });

  it('keeps a Clerk error code while redacting callback credentials', () => {
    const error = Object.assign(
      new Error('Failed at https://example.test/callback?code=secret&token=secret authorization code: secret; email me@private.invalid; password=hunter2; key sk_test_abc session=secret'),
      { errors: [{ code: 'oauth_callback_error' }] },
    );
    const metadata = hostedAuthErrorMetadata(error);
    expect(metadata).toEqual({
      errorType: 'Error',
      clerkErrorCode: 'oauth_callback_error',
      safeMessage: 'Failed at https://example.test/callback authorization code=[redacted]; email [redacted-email]; password=[redacted]; key [redacted-key] session=[redacted]',
    });
    expect(JSON.stringify(metadata)).not.toContain('secret');
    expect(JSON.stringify(metadata)).not.toContain('private.invalid');
    expect(JSON.stringify(metadata)).not.toContain('hunter2');
  });

  it('derives Clerk default iOS callback metadata from the bundle identifier', () => {
    expect(defaultHostedAuthRedirect('com.caloriebank.mobile')).toEqual({
      nativeRedirectUrl: 'com.caloriebank.mobile://callback',
      nativeRedirectScheme: 'com.caloriebank.mobile',
    });
  });
});
