import { describe, expect, it } from 'vitest';
import { acceptsIosFixtureBody, iosFixtureActive, iosFixtureRoute, syntheticIosFixture } from '../../../tools/qualification/fallback-ios-policy';
import { assertFallbackTestEnvironment, blockedFallbackTestRoute } from '../../../tools/qualification/fallback-test-policy';
import { iosComplete, iosFixture, iosIntake, iosNow, iosSessionId, iosStart } from './support/ios-qualification-fixture';

const config = { FALLBACK_TEST_IOS_INTAKE: '1', FALLBACK_TEST_IOS_WRITER: iosFixture.writer,
  FALLBACK_TEST_IOS_WRITER_NAME: iosFixture.writerName, FALLBACK_TEST_IOS_DATE: iosFixture.localDate,
  FALLBACK_TEST_IOS_TIMEZONE: iosFixture.timezone, FALLBACK_TEST_IOS_CALORIES: '123' };

describe('default-off isolated iOS fixture', () => {
  it('requires complete explicit current-day configuration and a pre-midnight expiry', () => {
    expect(syntheticIosFixture({}, iosNow, iosFixture.expiresAt)).toBeNull();
    expect(syntheticIosFixture(config, iosFixture.startedAt, iosFixture.expiresAt)).toEqual(iosFixture);
    for (const change of [{ FALLBACK_TEST_IOS_INTAKE: '0' }, { FALLBACK_TEST_IOS_INTAKE: '' },
      { FALLBACK_TEST_IOS_WRITER: '' }, { FALLBACK_TEST_IOS_WRITER_NAME: '' },
      { FALLBACK_TEST_IOS_DATE: '2026-02-30' }, { FALLBACK_TEST_IOS_TIMEZONE: 'Unknown/Zone' },
      { FALLBACK_TEST_IOS_CALORIES: '10001' }, { FALLBACK_TEST_IOS_CALORIES: '1e2' },
      { FALLBACK_TEST_IOS_CALORIES: '0' }]) {
      expect(() => syntheticIosFixture({ ...config, ...change }, iosNow, iosFixture.expiresAt)).toThrow();
    }
    for (const expiry of [NaN, iosNow, iosNow + 86400000]) expect(() => syntheticIosFixture(config, iosNow, expiry)).toThrow();
  });
  it('never enables both platform mutation paths together', () => {
    const environment = { ...config, DATABASE_URL: 'postgresql://caloriebank_test_phase5a:synthetic@localhost/caloriebank_test_phase5a',
      FALLBACK_TEST_DATABASE_HOST: 'localhost', APP_ENV: 'local', AUTH_MODE: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic',
      CLERK_SECRET_KEY: 'sk_test_synthetic', PUBLIC_INTAKE_MODE: 'without_fatsecret', FATSECRET_PRIVATE_BETA_ACCOUNT_IDS: '',
      GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED: '1', CLERK_TELEMETRY_DISABLED: '1', FALLBACK_TEST_SYNTHETIC_ONLY: '1',
      FALLBACK_TEST_EXPIRES_AT: new Date(iosFixture.expiresAt).toISOString() };
    expect(assertFallbackTestEnvironment(environment, iosNow).iosFixture).not.toBeNull();
    expect(() => assertFallbackTestEnvironment({ ...environment, FALLBACK_TEST_NATIVE_INTAKE: '1',
      FALLBACK_TEST_NATIVE_SOURCE: 'org.synthetic.test', FALLBACK_TEST_NATIVE_DATE: iosFixture.localDate,
      FALLBACK_TEST_NATIVE_CALORIES: '123' }, iosNow)).toThrow();
  });
  it('allows exactly three iOS route shapes and leaves all other ingestion blocked', () => {
    for (const [method, path, route] of [['POST', '/v1/me/ingestion/sync-sessions', 'start'],
      ['POST', '/v1/me/ingestion/intake', 'intake'], ['PATCH', `/v1/me/ingestion/sync-sessions/${iosSessionId}`, 'complete']] as const) {
      expect(iosFixtureRoute(method, path)).toBe(route);
      expect(blockedFallbackTestRoute({ method, path })).toBe(true);
      expect(blockedFallbackTestRoute({ method, path }, null, iosFixture)).toBe(false);
      for (const bad of [`${path}/`, `${path}/other`, `${path}%2fother`]) {
        expect(blockedFallbackTestRoute({ method, path: bad }, null, iosFixture)).toBe(true);
      }
    }
    for (const path of ['steps', 'workouts', 'expenditure', 'resting-burn-estimate', 'native-intake', 'sync-sessions/not-a-uuid']) {
      expect(blockedFallbackTestRoute({ method: 'POST', path: `/v1/me/ingestion/${path}` }, null, iosFixture)).toBe(true);
    }
    expect(iosFixtureRoute('PUT', '/v1/me/ingestion/intake')).toBeNull();
  });
  it('requires an exact unique rolling query window and the actual adapter', () => {
    expect(acceptsIosFixtureBody('start', iosStart(), iosFixture, iosNow)).toBe(true);
    for (const change of [{ datesQueried: [] }, { datesQueried: Array(8).fill(iosFixture.localDate) },
      { datesQueried: [...iosStart().datesQueried.slice(1), '2026-10-17'] }, { timezone: 'UTC' },
      { localDate: '2026-10-24' }, { trigger: 'scheduled' }, { trigger: 'integration_test' },
      { providerAdapterVersion: 'other' }, { userId: 'spoof-owner' }]) {
      expect(acceptsIosFixtureBody('start', { ...iosStart(), ...change }, iosFixture, iosNow)).toBe(false);
    }
  });
  it('requires exact selected-writer payload, current date, total, session and bounded observation time', () => {
    expect(acceptsIosFixtureBody('intake', iosIntake(), iosFixture, iosNow)).toBe(true);
    for (const change of [{ writerBundleIdentifier: 'org.other.writer' }, { writerDisplayName: 'Other' },
      { totalCaloriesConsumed: 124 }, { totalCaloriesConsumed: 123.5 }, { localDate: '2026-10-24' },
      { syncSessionId: undefined }, { syncSessionId: 'invalid' }, { userId: 'spoof-owner' },
      { providerUpdatedAt: new Date(iosNow + 61000).toISOString() },
      { providerUpdatedAt: new Date(iosNow - 301000).toISOString() }]) {
      expect(acceptsIosFixtureBody('intake', { ...iosIntake(), ...change }, iosFixture, iosNow)).toBe(false);
    }
  });
  it('rejects invented non-intake readiness, free-text diagnostics and inflated counts', () => {
    expect(acceptsIosFixtureBody('complete', iosComplete(), iosFixture, iosNow)).toBe(true);
    for (const change of [{ workoutsStatus: 'ready' }, { stepsStatus: 'ready' }, { expenditureStatus: 'ready' },
      { intakeStatus: 'unavailable' }, { recordsUpdated: 1 }, { recordsImported: 2 }, { warningCount: 1000 },
      { errors: ['sensitive-canary'] }, { errorCode: 'sensitive-canary' }, { datesUploaded: ['2026-10-24'] },
      { datesSkipped: [] }, { datesSkipped: Array(7).fill('2026-10-24') }]) {
      expect(acceptsIosFixtureBody('complete', { ...iosComplete(), ...change }, iosFixture, iosNow)).toBe(false);
    }
  });
  it('fails closed at expiry, clock reversal and local midnight', () => {
    for (const time of [iosFixture.startedAt - 1, iosFixture.expiresAt, Date.parse('2026-10-26T05:00:00Z')]) {
      expect(iosFixtureActive(iosFixture, time)).toBe(false);
      for (const [route, body] of [['start', iosStart()], ['intake', iosIntake()], ['complete', iosComplete()]] as const) {
        expect(acceptsIosFixtureBody(route, body, iosFixture, time)).toBe(false);
      }
    }
  });
});
