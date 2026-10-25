import type { Request } from 'express';
import { nativeIntakeBatchSchema, nativeIntakeSourceSchema } from '@caloriebank/schemas';
import { iosFixtureRoute, syntheticIosFixture, type SyntheticIosFixture } from './fallback-ios-policy';

export type SyntheticNativeFixture = { sourceId: string; localDate: string; totalCalories: number };

/** Exact, owner-approved synthetic signal only. No production API imports this policy. */
export function syntheticNativeFixture(input: Readonly<Record<string, string | undefined>>): SyntheticNativeFixture | null {
  const keys = ['FALLBACK_TEST_NATIVE_SOURCE', 'FALLBACK_TEST_NATIVE_DATE', 'FALLBACK_TEST_NATIVE_CALORIES'] as const;
  if (input.FALLBACK_TEST_NATIVE_INTAKE !== '1') {
    if (input.FALLBACK_TEST_NATIVE_INTAKE || keys.some(key => input[key])) throw new Error('Native fixture configuration must be explicit.');
    return null;
  }
  const sourceId = input.FALLBACK_TEST_NATIVE_SOURCE ?? '';
  const localDate = input.FALLBACK_TEST_NATIVE_DATE ?? '';
  const amount = input.FALLBACK_TEST_NATIVE_CALORIES ?? '';
  const totalCalories = Number(amount);
  if (!nativeIntakeSourceSchema.safeParse({ namespace: 'android_package', id: sourceId }).success
    || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
    || !Number.isFinite(Date.parse(`${localDate}T00:00:00Z`))
    || new Date(`${localDate}T00:00:00Z`).toISOString().slice(0, 10) !== localDate
    || !/^[1-9]\d*$/.test(amount) || !Number.isSafeInteger(totalCalories) || totalCalories > 10000) {
    throw new Error('An exact synthetic source, valid date and bounded positive total are required.');
  }
  return { sourceId, localDate, totalCalories };
}

export type NativeFixtureDecision = 'accepted' | 'schema_invalid' | 'source_mismatch'
  | 'usable_day_count_mismatch' | 'date_mismatch' | 'total_mismatch';

/** Fixed operational codes only: never return fields, values, dates or identities. */
export function classifySyntheticNativeFixture(body: unknown, fixture: SyntheticNativeFixture): NativeFixtureDecision {
  const parsed = nativeIntakeBatchSchema.safeParse(body);
  if (!parsed.success) return 'schema_invalid';
  if (parsed.data.source.id !== fixture.sourceId) return 'source_mismatch';
  const values = parsed.data.days.filter(day => day.totalCaloriesConsumed !== null);
  if (values.length !== 1) return 'usable_day_count_mismatch';
  if (values[0]?.localDate !== fixture.localDate) return 'date_mismatch';
  if (values[0]?.totalCaloriesConsumed !== fixture.totalCalories) return 'total_mismatch';
  return 'accepted';
}

export function matchesSyntheticNativeFixture(body: unknown, fixture: SyntheticNativeFixture): boolean {
  return classifySyntheticNativeFixture(body, fixture) === 'accepted';
}

const forbiddenCredentials = [
  'GOOGLE_HEALTH_CLIENT_ID', 'GOOGLE_HEALTH_CLIENT_SECRET',
  'GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY', 'GOOGLE_HEALTH_REDIRECT_URI',
  'FATSECRET_CONSUMER_KEY', 'FATSECRET_CONSUMER_SECRET', 'FATSECRET_REDIRECT_URI',
  'EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY', 'WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET',
  'EXPO_ACCESS_TOKEN',
] as const;

/** Test harness only; never imported by the application or lifecycle entrypoint. */
export function assertFallbackTestEnvironment(input: Readonly<Record<string, string | undefined>>, now = Date.now()) {
  const url = new URL(input.DATABASE_URL ?? 'invalid:');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.pathname !== '/caloriebank_test_phase5a'
    || decodeURIComponent(url.username) !== 'caloriebank_test_phase5a'
    || !input.FALLBACK_TEST_DATABASE_HOST
    || url.hostname !== input.FALLBACK_TEST_DATABASE_HOST
    || url.searchParams.has('schema') || url.hash) {
    throw new Error('The separate named Phase 5A test database and explicit host are required.');
  }
  if (input.APP_ENV !== 'local' || input.AUTH_MODE !== 'clerk'
    || !input.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
    || !input.CLERK_SECRET_KEY?.startsWith('sk_test_')
    || input.PUBLIC_INTAKE_MODE !== 'without_fatsecret'
    || input.FATSECRET_PRIVATE_BETA_ACCOUNT_IDS === undefined
    || Boolean(input.FATSECRET_PRIVATE_BETA_CREATED_BEFORE)
    || input.GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED !== '1'
    || input.CLERK_TELEMETRY_DISABLED !== '1'
    || input.FALLBACK_TEST_SYNTHETIC_ONLY !== '1') {
    throw new Error('Isolated test authentication, synthetic fixtures and the fixture-only cutoff are required.');
  }
  if (forbiddenCredentials.some(key => Boolean(input[key]))) {
    throw new Error('Provider, delivery or production credentials must not enter this test service.');
  }
  const expiry = Date.parse(input.FALLBACK_TEST_EXPIRES_AT ?? '');
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 36 * 60 * 60 * 1000) {
    throw new Error('A future test expiry within 36 hours is required.');
  }
  const subjects = new Set((input.FALLBACK_TEST_ALLOWED_SUBJECTS ?? '').split(',').map(v => v.trim()).filter(Boolean));
  if (subjects.size > 2 || [...subjects].some(subject => !/^user_[A-Za-z0-9]+$/.test(subject))) {
    throw new Error('At most two dedicated test subjects may be admitted.');
  }
  const nativeFixture = syntheticNativeFixture(input);
  const iosFixture = syntheticIosFixture(input, now, expiry);
  if (nativeFixture && iosFixture) throw new Error('Only one native platform fixture may be enabled.');
  return { expiry, subjects, nativeFixture, iosFixture };
}

/** No remote grants, ingestion, account deletion, push registration/delivery or worker. */
export function blockedFallbackTestRoute(request: Pick<Request, 'method' | 'path'>, nativeFixture: SyntheticNativeFixture | null = null, iosFixture: SyntheticIosFixture | null = null) {
  if (iosFixture && iosFixtureRoute(request.method, request.path)) return false;
  if (nativeFixture && request.method === 'POST' && request.path === '/v1/me/ingestion/native-intake') return false;
  // Preserve the real authenticated sign-out cleanup without enabling push.
  if (request.method === 'DELETE' && request.path === '/v1/me/morning-bank-update/device') return false;
  return request.path.startsWith('/v1/me/integrations')
    || request.path.startsWith('/v1/me/ingestion')
    || request.path.startsWith('/v1/me/morning-bank-update')
    || request.path.startsWith('/v1/me/lifecycle')
    || request.path === '/v1/me/support-diagnostics'
    || (request.method === 'DELETE' && request.path === '/v1/me/account');
}
