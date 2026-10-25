import { describe, expect, it } from 'vitest';
import { assertFallbackTestEnvironment, blockedFallbackTestRoute, classifySyntheticNativeFixture, matchesSyntheticNativeFixture, syntheticNativeFixture } from '../../../tools/qualification/fallback-test-policy';

const now = Date.parse('2026-10-25T03:00:00Z');
const valid = { DATABASE_URL: 'postgresql://caloriebank_test_phase5a:synthetic@localhost:5432/caloriebank_test_phase5a',
  FALLBACK_TEST_DATABASE_HOST: 'localhost', APP_ENV: 'local', AUTH_MODE: 'clerk',
  CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic', CLERK_SECRET_KEY: 'sk_test_synthetic',
  PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: '',
  GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED: '1', FALLBACK_TEST_SYNTHETIC_ONLY: '1',
  CLERK_TELEMETRY_DISABLED: '1',
  FALLBACK_TEST_EXPIRES_AT: '2026-10-26T03:00:00Z' };

describe('isolated HTTPS fallback service admission', () => {
  const fixture = { sourceId: 'org.caloriebank.synthetic', localDate: '2026-10-25', totalCalories: 123 };
  const batch = () => ({
    source: { namespace: 'android_package', id: fixture.sourceId },
    selectionRevision: '2026-10-25T02:00:00Z', queryStartedAt: '2026-10-25T03:00:00Z',
    observedAt: '2026-10-25T03:00:01Z', timezone: 'America/Chicago',
    days: Array.from({ length: 8 }, (_, index) => ({
      localDate: `2026-10-${String(25 - index).padStart(2, '0')}`,
      quality: index === 0 ? 'usable_evidence' : 'empty',
      totalCaloriesConsumed: index === 0 ? 123 : null, providerUpdatedAt: null,
    })),
  });
  it('keeps native upload disabled unless the complete bounded fixture is explicitly configured', () => {
    expect(assertFallbackTestEnvironment(valid, now).nativeFixture).toBeNull();
    const configured = { ...valid, FALLBACK_TEST_NATIVE_INTAKE: '1',
      FALLBACK_TEST_NATIVE_SOURCE: fixture.sourceId, FALLBACK_TEST_NATIVE_DATE: fixture.localDate,
      FALLBACK_TEST_NATIVE_CALORIES: '123' };
    expect(assertFallbackTestEnvironment(configured, now).nativeFixture).toEqual(fixture);
    for (const change of [{ FALLBACK_TEST_NATIVE_INTAKE: '0' }, { FALLBACK_TEST_NATIVE_INTAKE: '' },
      { FALLBACK_TEST_NATIVE_SOURCE: '' }, { FALLBACK_TEST_NATIVE_DATE: '2026-02-30' },
      { FALLBACK_TEST_NATIVE_CALORIES: '0' }, { FALLBACK_TEST_NATIVE_CALORIES: '10001' },
      { FALLBACK_TEST_NATIVE_CALORIES: '123.5' }, { FALLBACK_TEST_NATIVE_CALORIES: '1e2' }]) {
      expect(() => syntheticNativeFixture({ ...configured, ...change })).toThrow();
    }
  });
  it('admits only the exact POST native route; all other remote flows stay blocked', () => {
    const path = '/v1/me/ingestion/native-intake';
    expect(blockedFallbackTestRoute({ method: 'POST', path })).toBe(true);
    expect(blockedFallbackTestRoute({ method: 'POST', path }, fixture)).toBe(false);
    for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      expect(blockedFallbackTestRoute({ method, path }, fixture)).toBe(true);
    }
    for (const other of [`${path}/`, `${path}/other`, '/v1/me/ingestion/today',
      '/v1/me/integrations/fitbit/callback', '/v1/me/lifecycle/refresh', '/v1/me/account']) {
      expect(blockedFallbackTestRoute({ method: 'DELETE', path: other }, fixture)).toBe(true);
    }
  });
  it('rejects unexpected source, totals, dates, extra values and unknown data fields before storage', () => {
    expect(matchesSyntheticNativeFixture(batch(), fixture)).toBe(true);
    const differentSource = batch(); differentSource.source.id = 'org.other.tracker';
    const differentValue = batch(); differentValue.days[0]!.totalCaloriesConsumed = 124;
    const differentDate = batch(); differentDate.days[0]!.localDate = '2026-10-26';
    const additionalDay = batch(); additionalDay.days[1]!.quality = 'usable_evidence'; additionalDay.days[1]!.totalCaloriesConsumed = 100;
    const absent = batch(); absent.days[0]!.quality = 'empty'; absent.days[0]!.totalCaloriesConsumed = null;
    for (const body of [null, {}, differentSource, differentValue, differentDate, additionalDay, absent,
      { ...batch(), privateNote: 'Not an accepted field' }]) {
      expect(matchesSyntheticNativeFixture(body, fixture)).toBe(false);
    }
  });
  it('distinguishes fixture failures using fixed codes without changing admission', () => {
    const source = batch(); source.source.id = 'org.other.tracker';
    const total = batch(); total.days[0]!.totalCaloriesConsumed = 124;
    const date = batch(); date.days[0]!.localDate = '2026-10-26';
    const additional = batch(); additional.days[1]!.quality = 'usable_evidence'; additional.days[1]!.totalCaloriesConsumed = 100;
    const absent = batch(); absent.days[0]!.quality = 'empty'; absent.days[0]!.totalCaloriesConsumed = null;
    const cases = [[batch(), 'accepted'], [null, 'schema_invalid'], [source, 'source_mismatch'],
      [total, 'total_mismatch'], [date, 'date_mismatch'], [additional, 'usable_day_count_mismatch'],
      [absent, 'usable_day_count_mismatch']] as const;
    for (const [body, decision] of cases) {
      expect(classifySyntheticNativeFixture(body, fixture)).toBe(decision);
      expect(matchesSyntheticNativeFixture(body, fixture)).toBe(decision === 'accepted');
    }
  });
  it('never returns rejected payload content or validation details in diagnostic codes', () => {
    const body = { ...batch(), privateNote: 'synthetic-canary-do-not-log', token: 'synthetic-credential-canary' };
    expect(classifySyntheticNativeFixture(body, fixture)).toBe('schema_invalid');
    const result = JSON.stringify({ event: 'fallback_native_upload_rejected', reason: classifySyntheticNativeFixture(body, fixture) });
    for (const forbidden of ['synthetic-canary', 'synthetic-credential', fixture.sourceId, fixture.localDate, '123', 'privateNote', 'token']) {
      expect(result).not.toContain(forbidden);
    }
  });
  it('permits only authenticated device detachment for ordinary sign-out; push remains blocked', () => {
    expect(blockedFallbackTestRoute({ method: 'DELETE', path: '/v1/me/morning-bank-update/device' })).toBe(false);
    for (const method of ['GET', 'PUT', 'POST', 'PATCH']) {
      expect(blockedFallbackTestRoute({ method, path: '/v1/me/morning-bank-update/device' })).toBe(true);
    }
    for (const path of ['/v1/me/morning-bank-update', '/v1/me/morning-bank-update/device/other', '/v1/me/morning-bank-update/deliver']) {
      expect(blockedFallbackTestRoute({ method: 'DELETE', path })).toBe(true);
    }
  });

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
      '/v1/me/ingestion/native-intake', '/v1/me/morning-bank-update', '/v1/me/lifecycle/refresh', '/v1/me/account']) {
      expect(blockedFallbackTestRoute({ method: 'DELETE', path })).toBe(true);
    }
    for (const path of ['/v1/me/manual-intake', '/v1/me/intake-adjustment', '/v1/me/provider-selection', '/v1/me/health-connections', '/v1/me/onboarding', '/v1/me/today', '/v1/me/bank-history']) {
      expect(blockedFallbackTestRoute({ method: 'GET', path })).toBe(false);
    }
  });
});
