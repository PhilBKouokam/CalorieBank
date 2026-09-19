import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  getSdkStatus: vi.fn(async () => 3), initialize: vi.fn(async () => true),
  requestPermission: vi.fn(async () => [{ accessType: 'read', recordType: 'Nutrition' }]),
  getGrantedPermissions: vi.fn(async () => [{ accessType: 'read', recordType: 'Nutrition' }]),
  readRecords: vi.fn(async () => {
    const start = new Date(); start.setDate(start.getDate() - 1); start.setHours(12, 0, 0, 0);
    return { records: [{ metadata: { id: 'id', dataOrigin: 'com.example.food', lastModifiedTime: new Date().toISOString() }, startTime: start.toISOString(), endTime: new Date(start.getTime() + 60000).toISOString(), energy: null }], pageToken: '' };
  }),
  getChanges: vi.fn(async () => ({ nextChangesToken: 'opaque', upsertionChanges: [], deletionChanges: [], changesTokenExpired: false, hasMore: false })),
  openHealthConnectSettings: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { Version: 34 }, Linking: { openURL: vi.fn() } }));
vi.mock('react-native-health-connect', () => native);
vi.mock('../../mobile/lib/health-connect/capabilities', () => ({ healthConnectQualificationEnabled: () => true }));
import { nativeHealthQualification, nativeNutritionQualification } from '../../mobile/lib/health-connect/bridge.android';

beforeEach(() => { vi.clearAllMocks(); nativeHealthQualification.setAccountScope(null); nativeHealthQualification.setAccountScope('test'); });
describe('pinned native integration contract', () => {
  it('requests only nutrition for the food qualification path', async () => {
    nativeNutritionQualification.setAccountScope('test');
    await nativeNutritionQualification.access(true);
    expect(native.requestPermission).toHaveBeenCalledWith([{ accessType: 'read', recordType: 'Nutrition' }]);
    nativeNutritionQualification.setAccountScope(null);
  });
  it('requests exactly the seven read categories, never write/history/background', async () => {
    await nativeHealthQualification.access(true);
    expect(native.requestPermission).toHaveBeenCalledWith([
      { accessType: 'read', recordType: 'Nutrition' }, { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ExerciseSession' }, { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' }, { accessType: 'read', recordType: 'BasalMetabolicRate' },
      { accessType: 'read', recordType: 'Distance' },
    ]);
  });
  it('reads only granted native categories, handles empty page tokens, retains exact source and null energy', async () => {
    const report = await nativeHealthQualification.inspect('com.example.food');
    expect(native.readRecords).toHaveBeenCalledTimes(1);
    expect(native.readRecords).toHaveBeenCalledWith('Nutrition', expect.objectContaining({ pageSize: 1000, timeRangeFilter: expect.objectContaining({ operator: 'between' }) }));
    expect(native.getChanges).toHaveBeenLastCalledWith({ recordTypes: ['Nutrition'], changesToken: 'opaque' });
    expect(report.origins).toEqual([{ namespace: 'android_package', id: 'com.example.food' }]);
    expect(report.days.some((d) => d.intake.quality === 'no_calorie_records')).toBe(true);
    expect(report.days.every((d) => d.intake.value === null)).toBe(true);
  });
  it('pins and applies the native nullable-nutrition fix', () => {
    const root = dirname(require.resolve('react-native-health-connect/package.json'));
    expect(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version).toBe('4.1.3');
    const kotlin = readFileSync(resolve(root, 'android/src/main/java/dev/matinzd/healthconnect/records/ReactNutritionRecord.kt'), 'utf8');
    expect(kotlin).toContain('putMap("energy", record.energy?.let { energyToJsMap(it) })');
    expect(kotlin).not.toContain('putMap("energy", energyToJsMap(record.energy))');
  });
});
