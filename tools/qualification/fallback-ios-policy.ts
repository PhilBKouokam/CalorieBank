import {
  appleHealthIntakeWriterSchema, currentDayIntakeSyncSchema,
  ingestionSyncSessionCompleteSchema, ingestionSyncSessionStartSchema,
} from '@caloriebank/schemas';

/** Test-only admission; never imported by production API/mobile entrypoints. */
export type SyntheticIosFixture = {
  writer: string; writerName: string; localDate: string; timezone: string;
  totalCalories: number; startedAt: number; expiresAt: number;
};
const prefix = '/v1/me/ingestion/';
const sessionPath = /^\/v1\/me\/ingestion\/sync-sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type IosRoute = 'start' | 'intake' | 'complete';
export function iosFixtureRoute(method: string, path: string): IosRoute | null {
  if (method === 'POST' && path === `${prefix}sync-sessions`) return 'start';
  if (method === 'POST' && path === `${prefix}intake`) return 'intake';
  if (method === 'PATCH' && sessionPath.test(path)) return 'complete';
  return null;
}
function localDate(timezone: string, now: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function iosRollingDates(date: string) {
  return Array.from({ length: 8 }, (_, offset) => new Date(Date.parse(`${date}T12:00:00Z`) - offset * 86400000).toISOString().slice(0, 10));
}
function sameDates(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && new Set(actual).size === actual.length
    && expected.every(date => actual.includes(date));
}
export function syntheticIosFixture(input: Readonly<Record<string, string | undefined>>, now: number, expiry: number): SyntheticIosFixture | null {
  const keys = ['WRITER', 'WRITER_NAME', 'DATE', 'TIMEZONE', 'CALORIES'].map(key => `FALLBACK_TEST_IOS_${key}`);
  if (input.FALLBACK_TEST_IOS_INTAKE !== '1') {
    if (input.FALLBACK_TEST_IOS_INTAKE || keys.some(key => input[key])) throw new Error('iOS fixture configuration must be explicit.');
    return null;
  }
  const writer = input.FALLBACK_TEST_IOS_WRITER ?? '';
  const writerName = input.FALLBACK_TEST_IOS_WRITER_NAME ?? '';
  const date = input.FALLBACK_TEST_IOS_DATE ?? '';
  const timezone = input.FALLBACK_TEST_IOS_TIMEZONE ?? '';
  const amount = input.FALLBACK_TEST_IOS_CALORIES ?? '';
  let sameDay = false;
  try { sameDay = localDate(timezone, now) === date && localDate(timezone, expiry) === date; } catch { /* deny unknown timezone */ }
  if (!appleHealthIntakeWriterSchema.safeParse({ bundleIdentifier: writer, displayName: writerName }).success
    || writer.trim() !== writer || writerName.trim() !== writerName
    || !sameDay || !Number.isFinite(expiry) || expiry <= now || expiry > now + 36 * 3600000
    || !/^[1-9]\d*$/.test(amount) || !Number.isSafeInteger(Number(amount)) || Number(amount) > 10000) {
    throw new Error('An exact current-day iOS fixture and expiry before local midnight are required.');
  }
  return { writer, writerName, localDate: date, timezone, totalCalories: Number(amount), startedAt: now, expiresAt: expiry };
}
export function iosFixtureActive(fixture: SyntheticIosFixture, now: number) {
  return now >= fixture.startedAt && now < fixture.expiresAt && localDate(fixture.timezone, now) === fixture.localDate;
}

/** No raw schema errors or rejected payload content leave this boundary. */
export function acceptsIosFixtureBody(route: IosRoute, body: unknown, fixture: SyntheticIosFixture, now: number): boolean {
  if (!iosFixtureActive(fixture, now)) return false;
  const dates = iosRollingDates(fixture.localDate);
  if (route === 'start') {
    const parsed = ingestionSyncSessionStartSchema.safeParse(body);
    if (!parsed.success) return false;
    const value = parsed.data;
    return value.localDate === fixture.localDate && value.timezone === fixture.timezone
      && value.providerAdapterVersion === 'apple-health-v2-rolling-window' && value.appVersion === '1.0.0'
      && !['scheduled', 'integration_test'].includes(value.trigger) && sameDates(value.datesQueried, dates);
  }
  if (route === 'intake') {
    const parsed = currentDayIntakeSyncSchema.safeParse(body);
    if (!parsed.success) return false;
    const value = parsed.data;
    const observed = Date.parse(value.providerUpdatedAt);
    // Native queries precede session creation. Do not require observed >= session.startedAt.
    return Boolean(value.syncSessionId) && value.localDate === fixture.localDate && value.timezone === fixture.timezone
      && value.writerBundleIdentifier === fixture.writer && value.writerDisplayName === fixture.writerName
      && value.totalCaloriesConsumed === fixture.totalCalories
      && observed >= fixture.startedAt - 60000 && observed >= now - 300000 && observed <= now + 60000;
  }
  const parsed = ingestionSyncSessionCompleteSchema.safeParse(body);
  if (!parsed.success) return false;
  const value = parsed.data;
  return value.intakeStatus === 'ready'
    && [value.expenditureStatus, value.stepsStatus, value.workoutsStatus].every(status => ['unavailable', 'skipped', 'not_attempted'].includes(status))
    && value.recordsImported + value.recordsUpdated + value.recordsSkipped === 1
    && value.warningCount <= 32 && !value.errorCode && value.errors.length === 0
    && sameDates(value.datesUploaded, [fixture.localDate]) && sameDates(value.datesSkipped, dates.slice(1));
}
