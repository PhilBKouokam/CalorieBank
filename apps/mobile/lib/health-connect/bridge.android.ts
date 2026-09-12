import { Linking, Platform } from 'react-native';
import type { EvidenceCategory } from '../native-health/evidence';
import { categories, createHealthQualification, type HealthEvidencePort } from './qualification';
import type { RecordType } from 'react-native-health-connect';

const types: Record<EvidenceCategory, RecordType> = {
  nutrition: 'Nutrition', steps: 'Steps', workouts: 'ExerciseSession', active_energy: 'ActiveCaloriesBurned',
  total_energy: 'TotalCaloriesBurned', resting_rate: 'BasalMetabolicRate', distance: 'Distance',
};
// Lazy loading keeps older binaries safe and never imports this Android SDK on iOS.
const sdk = () => import('react-native-health-connect');
const port: HealthEvidencePort = {
  androidVersion: Number(Platform.Version),
  status: async () => (await sdk()).getSdkStatus(),
  initialize: async () => (await sdk()).initialize(),
  async permissions(request) {
    const native = await sdk();
    const granted = request ? await native.requestPermission(categories.map((c) => ({ accessType: 'read', recordType: types[c] }))) : await native.getGrantedPermissions();
    return categories.filter((c) => granted.some((p) => p.accessType === 'read' && p.recordType === types[c]));
  },
  async read(category, startTime, endTime, pageToken) {
    const response = await (await sdk()).readRecords(types[category], { timeRangeFilter: { operator: 'between', startTime, endTime }, pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
    return { records: response.records, pageToken: response.pageToken };
  },
  async changes(granted, changesToken) {
    const result = await (await sdk()).getChanges({ recordTypes: granted.map((c) => types[c]), ...(changesToken ? { changesToken } : {}) });
    return { token: result.nextChangesToken, changed: result.upsertionChanges.length > 0 || result.deletionChanges.length > 0,
      expired: result.changesTokenExpired, hasMore: result.hasMore };
  },
  async settings() {
    const native = await sdk();
    if (await native.getSdkStatus() === 2) {
      await Linking.openURL('market://details?id=com.google.android.apps.healthdata');
    } else native.openHealthConnectSettings();
    return true;
  },
};
export const nativeHealthQualification = createHealthQualification(port);
