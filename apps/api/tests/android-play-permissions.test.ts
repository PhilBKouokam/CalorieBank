import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { healthConnectReleasePolicy, nutritionPermission, qualificationPermissions } from '../../mobile/app.config';

const native = vi.hoisted(() => ({
  getSdkStatus: vi.fn(async () => 3), initialize: vi.fn(async () => true),
  requestPermission: vi.fn(async () => [{ accessType: 'read', recordType: 'Nutrition' }]),
  getGrantedPermissions: vi.fn(async () => ['Nutrition', 'Steps', 'TotalCaloriesBurned'].map(recordType => ({ accessType: 'read', recordType }))),
  readRecords: vi.fn(async (recordType: string) => { void recordType; return { records: [], pageToken: '' }; }),
  getChanges: vi.fn(async () => ({ nextChangesToken: 'test-token', upsertionChanges: [], deletionChanges: [], changesTokenExpired: false, hasMore: false })),
}));
vi.mock('react-native', () => ({ Platform: { Version: 36 }, Linking: {} }));
vi.mock('react-native-health-connect', () => native);
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('Play nutrition-only release boundary', () => {
  it.each([undefined, 'play-testing', 'production', 'testflight', 'preview', 'development'])('defaults %s to minimum permissions', (profile) => {
    expect(healthConnectReleasePolicy(profile, undefined)).toEqual({ qualification: false, permissions: [nutritionPermission], blockedPermissions: qualificationPermissions });
  });
  it.each(['play-testing', 'production', 'testflight', 'unknown-store'])('rejects diagnostic escalation in %s', (profile) => {
    expect(() => healthConnectReleasePolicy(profile, '1')).toThrow('restricted');
  });
  it.each(['preview', 'development'])('preserves explicitly opted-in %s qualification', (profile) => {
    expect(healthConnectReleasePolicy(profile, '1').permissions).toHaveLength(7);
    expect(healthConnectReleasePolicy(profile, '1').blockedPermissions).toEqual([]);
  });
  it('Play profile uses the existing beta environment with explicit AAB and diagnostics off', () => {
    const eas = JSON.parse(readFileSync(resolve(__dirname, '../../mobile/eas.json'), 'utf8'));
    expect(eas.build['play-testing']).toMatchObject({ extends: 'preview', distribution: 'store', environment: 'preview', autoIncrement: true, android: { buildType: 'app-bundle' }, env: { EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION: '0' } });
  });
  it('even a direct diagnostic bridge call requests and reads nutrition only, ignoring old broader OS grants', async () => {
    vi.stubEnv('EXPO_PUBLIC_APP_ENV', 'beta');
    vi.stubEnv('EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION', '0');
    vi.resetModules();
    const { nativeHealthQualification, nativeNutritionQualification } = await import('../../mobile/lib/health-connect/bridge.android');
    nativeHealthQualification.setAccountScope('play-account');
    await nativeHealthQualification.access(true);
    expect(native.requestPermission).toHaveBeenCalledWith([{ accessType: 'read', recordType: 'Nutrition' }]);
    const result = await nativeHealthQualification.inspect('com.cronometer.android.gold');
    expect(result.access.granted).toEqual(['nutrition']);
    expect(native.readRecords.mock.calls.every(([type]) => type === 'Nutrition')).toBe(true);
    expect(result.windows).toHaveLength(8);
    expect(result.authoritative).toBe(false);
    nativeNutritionQualification.setAccountScope('play-account');
    await nativeNutritionQualification.access(true);
    expect(native.requestPermission).toHaveBeenLastCalledWith([{ accessType: 'read', recordType: 'Nutrition' }]);
  });
});
