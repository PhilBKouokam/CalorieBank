import { iosRollingDates, type SyntheticIosFixture } from '../../../../tools/qualification/fallback-ios-policy';

export const iosNow = Date.parse('2026-10-25T15:00:00Z');
export const iosFixture: SyntheticIosFixture = {
  writer: 'CRONOMETER-GOLD', writerName: 'Cronometer', localDate: '2026-10-25', timezone: 'America/Chicago',
  totalCalories: 123, startedAt: iosNow - 60000, expiresAt: iosNow + 3600000,
};
export const iosSessionId = '10000000-0000-4000-8000-000000000001';
export const iosStart = () => ({ localDate: iosFixture.localDate, timezone: iosFixture.timezone,
  provider: 'apple_health', trigger: 'manual_refresh', appVersion: '1.0.0',
  providerAdapterVersion: 'apple-health-v2-rolling-window', datesQueried: iosRollingDates(iosFixture.localDate) });
export const iosIntake = (id = iosSessionId) => ({ localDate: iosFixture.localDate, timezone: iosFixture.timezone,
  provider: 'apple_health', totalCaloriesConsumed: 123, writerBundleIdentifier: iosFixture.writer,
  writerDisplayName: iosFixture.writerName, providerUpdatedAt: new Date(iosNow - 2000).toISOString(), syncSessionId: id });
export const iosComplete = () => ({ expenditureStatus: 'unavailable', intakeStatus: 'ready', stepsStatus: 'unavailable',
  workoutsStatus: 'unavailable', recordsImported: 1, recordsUpdated: 0, recordsSkipped: 0, warningCount: 3,
  errorCode: null, datesUploaded: [iosFixture.localDate], datesSkipped: iosRollingDates(iosFixture.localDate).slice(1), errors: [] });
