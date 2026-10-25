import { describe, expect, it } from 'vitest';
import { assertFallbackTestEnvironment, blockedFallbackTestRoute } from '../../../tools/qualification/fallback-test-policy';

const now = Date.parse('2026-10-25T03:00:00Z');
const valid = { DATABASE_URL: 'postgresql://caloriebank_test_phase5a:synthetic@localhost:5432/caloriebank_test_phase5a',
  FALLBACK_TEST_DATABASE_HOST: 'localhost', APP_ENV: 'local', AUTH_MODE: 'clerk',
  CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic', CLERK_SECRET_KEY: 'sk_test_synthetic',
  PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: '',
  GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED: '1', FALLBACK_TEST_SYNTHETIC_ONLY: '1',
  CLERK_TELEMETRY_DISABLED: '1',
  FALLBACK_TEST_EXPIRES_AT: '2026-10-26T03:00:00Z' };

describe('isolated HTTPS fallback service admission', () => {
  it('starts with no admitted accounts and permits at most two explicit test subjects', () => {
    expect(assertFallbackTestEnvironment(valid, now).subjects.size).toBe(0);
    expect(assertFallbackTestEnvironment({ ...valid, FALLBACK_TEST_ALLOWED_SUBJECTS: 'user_old,user_new' }, now).subjects.size).toBe(2);
    expect(() => assertFallbackTestEnvironment({ ...valid, FALLBACK_TEST_ALLOWED_SUBJECTS: 'user_a,user_b,user_c' }, now)).toThrow();
  });
  it('rejects application databases, wrong hosts, users and schema substitution', () => {
    for (const url of ['postgresql://caloriebank_beta@localhost/caloriebank_beta',
      valid.DATABASE_URL.replace('localhost', 'production.example'),
      valid.DATABASE_URL.replace('caloriebank_test_phase5a:synthetic', 'production:synthetic'),
      `${valid.DATABASE_URL}?schema=production`]) {
      expect(() => assertFallbackTestEnvironment({ ...valid, DATABASE_URL: url }, now)).toThrow();
    }
  });
  it('rejects live Clerk bindings, development-auth bypass and a missing session expiry', () => {
    for (const change of [{ CLERK_SECRET_KEY: 'sk_live_synthetic' }, { CLERK_PUBLISHABLE_KEY: 'pk_live_synthetic' },
      { AUTH_MODE: 'development' }, { FALLBACK_TEST_EXPIRES_AT: '' }, { FALLBACK_TEST_EXPIRES_AT: '2026-10-28T03:00:00Z' }]) {
      expect(() => assertFallbackTestEnvironment({ ...valid, ...change }, now)).toThrow();
    }
  });
  it('rejects any shared external-provider or remote-push credential', () => {
    for (const key of ['GOOGLE_HEALTH_CLIENT_SECRET', 'FATSECRET_CONSUMER_SECRET', 'EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY', 'EXPO_ACCESS_TOKEN']) {
      expect(() => assertFallbackTestEnvironment({ ...valid, [key]: 'synthetic' }, now)).toThrow();
    }
  });
  it('blocks provider callbacks, ingestion, deletion and scheduled processing but preserves core routes', () => {
    for (const path of ['/v1/me/integrations/fitbit/callback', '/v1/me/integrations/fatsecret/authorize',
      '/v1/me/ingestion/native-intake', '/v1/me/morning-bank-update/device', '/v1/me/lifecycle/refresh', '/v1/me/account']) {
      expect(blockedFallbackTestRoute({ method: 'DELETE', path })).toBe(true);
    }
    for (const path of ['/v1/me/manual-intake', '/v1/me/intake-adjustment', '/v1/me/provider-selection', '/v1/me/health-connections', '/v1/me/onboarding', '/v1/me/today', '/v1/me/bank-history']) {
      expect(blockedFallbackTestRoute({ method: 'GET', path })).toBe(false);
    }
  });
});
