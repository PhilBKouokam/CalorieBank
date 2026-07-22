import type {
  CurrentDayExpenditureSync,
  CurrentDayIntakeSync,
  CurrentDayStepSync,
  CurrentDayWorkoutSync,
  IngestionCategoryStatus,
  IngestionSyncTrigger,
} from '@caloriebank/schemas';
import { getRollingLocalDayWindows } from '@caloriebank/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  completeIngestionSyncSession,
  fetchToday,
  startIngestionSyncSession,
  syncCurrentDayExpenditure,
  syncCurrentDayIntake,
  syncCurrentDaySteps,
  syncCurrentDayWorkouts,
} from '@/lib/api/client';
import {
  APPLE_HEALTH_READ_TYPES,
  AppleHealthExpenditureProvider,
  AppleHealthIntakeProvider,
  AppleHealthStepProvider,
  AppleHealthWorkoutProvider,
  type HealthKitNativeClient,
} from './apple-health-provider';
import {
  mergeRollingSyncOutbox,
  type RollingSyncQueuedUpload,
  type RollingSyncUpload,
} from './rolling-sync-policy';

const CONNECTION_KEY = 'caloriebank.apple-health.connected';
const EVER_CONNECTED_KEY = 'caloriebank.apple-health.ever-connected';
const LAST_SYNC_KEY = 'caloriebank.apple-health.last-sync';
const OUTBOX_KEY = 'caloriebank.apple-health.sync-outbox.v1';
const FINGERPRINTS_KEY = 'caloriebank.apple-health.upload-fingerprints.v1';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const DEVICE_USER_ID = 'current-device-user';
const ADAPTER_VERSION = 'apple-health-v2-rolling-window';

type UploadPayload = (
  | { kind: 'expenditure'; localDate: string; body: Omit<CurrentDayExpenditureSync, 'syncSessionId'> }
  | { kind: 'intake'; localDate: string; body: Omit<CurrentDayIntakeSync, 'syncSessionId'> }
  | { kind: 'steps'; localDate: string; body: Omit<CurrentDayStepSync, 'syncSessionId'> }
  | { kind: 'workouts'; localDate: string; body: Omit<CurrentDayWorkoutSync, 'syncSessionId'> }
) & RollingSyncUpload;

type QueuedUpload = RollingSyncQueuedUpload<UploadPayload>;

export type AppleHealthConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'unavailable'
  | 'needs_attention';

export type AppleHealthSyncOutcome = {
  connectionStatus: AppleHealthConnectionStatus;
  expenditureFound: boolean;
  intakeFound: boolean;
  stepsFound: boolean;
  workoutCount: number;
  skippedForCooldown: boolean;
};

type CategoryResult<T> = { value: T | null; status: IngestionCategoryStatus };

async function categoryResult<T>(promise: Promise<T | null>): Promise<CategoryResult<T>> {
  try {
    const value = await promise;
    return { value, status: value === null ? 'unavailable' : 'ready' };
  } catch {
    return { value: null, status: 'error' };
  }
}

async function loadHealthKit() {
  return import('@kingstinct/react-native-healthkit');
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

async function enqueueChangedUploads(uploads: UploadPayload[]) {
  const [outbox, fingerprints] = await Promise.all([
    readJson<QueuedUpload[]>(OUTBOX_KEY, []),
    readJson<Record<string, string>>(FINGERPRINTS_KEY, {}),
  ]);
  const merged = mergeRollingSyncOutbox(outbox, uploads, fingerprints, new Date().toISOString());
  const queue = merged.queue;
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
  return { changedDates: merged.changedDates, skippedDates: merged.skippedDates };
}

async function uploadQueuedItem(item: QueuedUpload, syncSessionId: string) {
  if (item.kind === 'expenditure') {
    return syncCurrentDayExpenditure({ ...item.body, syncSessionId });
  }
  if (item.kind === 'intake') return syncCurrentDayIntake({ ...item.body, syncSessionId });
  if (item.kind === 'steps') return syncCurrentDaySteps({ ...item.body, syncSessionId });
  return syncCurrentDayWorkouts({ ...item.body, syncSessionId });
}

async function flushOutbox(syncSessionId: string) {
  const queue = await readJson<QueuedUpload[]>(OUTBOX_KEY, []);
  const fingerprints = await readJson<Record<string, string>>(FINGERPRINTS_KEY, {});
  const remaining = [...queue];
  const uploadedDates = new Set<string>();
  const counters = { imported: 0, updated: 0, skipped: 0 };
  const errors: string[] = [];

  while (remaining.length > 0) {
    const item = remaining[0];
    if (!item) break;
    try {
      const result = await uploadQueuedItem(item, syncSessionId);
      if ('result' in result) {
        if (result.result === 'created') counters.imported += 1;
        else if (result.result === 'updated') counters.updated += 1;
        else counters.skipped += 1;
      } else {
        counters.imported += result.created;
        counters.updated += result.updated;
        counters.skipped += result.skipped;
      }
      fingerprints[item.key] = item.fingerprint;
      uploadedDates.add(item.localDate);
      remaining.shift();
      await Promise.all([
        AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining)),
        AsyncStorage.setItem(FINGERPRINTS_KEY, JSON.stringify(fingerprints)),
      ]);
    } catch {
      errors.push(`${item.localDate}:${item.kind}`);
      break;
    }
  }

  return { uploadedDates: [...uploadedDates], counters, errors, pendingCount: remaining.length };
}

export async function getAppleHealthConnectionStatus(): Promise<AppleHealthConnectionStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const healthKit = await loadHealthKit();
    if (!healthKit.isHealthDataAvailable()) return 'unavailable';
    return (await AsyncStorage.getItem(CONNECTION_KEY)) === 'true' ? 'connected' : 'not_connected';
  } catch {
    return 'unavailable';
  }
}

export async function connectAppleHealth() {
  if (Platform.OS !== 'ios') return 'unavailable' as const;
  const healthKit = await loadHealthKit();
  if (!healthKit.isHealthDataAvailable()) return 'unavailable' as const;
  const completed = await healthKit.requestAuthorization({ toRead: APPLE_HEALTH_READ_TYPES });
  if (!completed) return 'needs_attention' as const;
  const wasPreviouslyConnected = (await AsyncStorage.getItem(EVER_CONNECTED_KEY)) === 'true';
  await AsyncStorage.multiSet([
    [CONNECTION_KEY, 'true'],
    [EVER_CONNECTED_KEY, 'true'],
  ]);
  await syncAppleHealthRollingWindow({
    force: true,
    trigger: wasPreviouslyConnected ? 'provider_reconnect' : 'connection',
  });
  return 'connected' as const;
}

export async function disconnectAppleHealthLocally() {
  await AsyncStorage.multiRemove([CONNECTION_KEY, LAST_SYNC_KEY, OUTBOX_KEY, FINGERPRINTS_KEY]);
}

function combinedStatus(statuses: IngestionCategoryStatus[]): IngestionCategoryStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('ready')) return 'ready';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'skipped';
}

export async function syncAppleHealthRollingWindow({
  force = false,
  trigger = 'screen_focus',
}: {
  force?: boolean;
  trigger?: IngestionSyncTrigger;
} = {}): Promise<AppleHealthSyncOutcome> {
  const connectionStatus = await getAppleHealthConnectionStatus();
  if (connectionStatus !== 'connected') {
    return { connectionStatus, expenditureFound: false, intakeFound: false, stepsFound: false, workoutCount: 0, skippedForCooldown: false };
  }

  const previousSync = Number(await AsyncStorage.getItem(LAST_SYNC_KEY));
  if (!force && Number.isFinite(previousSync) && Date.now() - previousSync < SYNC_COOLDOWN_MS) {
    const today = await fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return {
      connectionStatus,
      expenditureFound: today.burned.adjusted !== null,
      intakeFound: today.eaten.calories !== null,
      stepsFound: today.steps.count !== null,
      workoutCount: today.workouts.totalCount,
      skippedForCooldown: true,
    };
  }

  const healthKit = await loadHealthKit();
  const nativeClient: HealthKitNativeClient = {
    queryStatisticsForQuantity: healthKit.queryStatisticsForQuantity,
    queryWorkoutSamples: healthKit.queryWorkoutSamples,
  };
  const windows = getRollingLocalDayWindows();
  const uploads: UploadPayload[] = [];
  const statuses = { expenditure: [] as IngestionCategoryStatus[], intake: [] as IngestionCategoryStatus[], steps: [] as IngestionCategoryStatus[], workouts: [] as IngestionCategoryStatus[] };
  let expenditureFound = false;
  let intakeFound = false;
  let stepsFound = false;
  let workoutCount = 0;

  for (const [index, window] of windows.entries()) {
    const input = { userId: DEVICE_USER_ID, localDate: window.localDate, timezone: window.timezone, isCurrentDay: index === 0 };
    const dependencies = { healthKit: nativeClient, dayStart: window.dayStart, dayEnd: window.dayEnd };
    const [expenditure, intake, steps, workouts] = await Promise.all([
      categoryResult(new AppleHealthExpenditureProvider(dependencies).fetchDailyExpenditureAggregate(input)),
      categoryResult(new AppleHealthIntakeProvider(dependencies).fetchDailyCalorieIntakeAggregate(input)),
      categoryResult(new AppleHealthStepProvider(dependencies).fetchDailyStepAggregate(input)),
      categoryResult(new AppleHealthWorkoutProvider(dependencies).fetchDailyWorkouts(input)),
    ]);
    statuses.expenditure.push(expenditure.status);
    statuses.intake.push(intake.status);
    statuses.steps.push(steps.status);
    statuses.workouts.push(workouts.status);
    if (index === 0) {
      expenditureFound = expenditure.value !== null;
      intakeFound = intake.value !== null;
      stepsFound = steps.value !== null;
      workoutCount = workouts.value?.length ?? 0;
    }
    if (expenditure.value) uploads.push({ kind: 'expenditure', localDate: window.localDate, body: {
      localDate: window.localDate, timezone: window.timezone, provider: 'apple_health',
      rawTotalDailyExpenditure: expenditure.value.rawTotalDailyExpenditure,
      syncStatus: expenditure.value.syncStatus === 'partial' ? 'partial' : 'ready',
      providerUpdatedAt: expenditure.value.providerUpdatedAt?.toISOString() ?? new Date().toISOString(),
      sourceMetadata: { activeEnergyCalories: expenditure.value.activeEnergyCalories ?? 0, basalEnergyCalories: expenditure.value.basalEnergyCalories ?? 0 },
    } });
    if (intake.value) uploads.push({ kind: 'intake', localDate: window.localDate, body: {
      localDate: window.localDate, timezone: window.timezone, provider: 'apple_health',
      totalCaloriesConsumed: intake.value.totalCaloriesConsumed,
      providerUpdatedAt: intake.value.providerUpdatedAt?.toISOString() ?? new Date().toISOString(),
    } });
    if (steps.value) uploads.push({ kind: 'steps', localDate: window.localDate, body: {
      localDate: window.localDate, timezone: window.timezone, provider: 'apple_health',
      totalSteps: steps.value.totalSteps,
      providerUpdatedAt: steps.value.providerUpdatedAt?.toISOString() ?? new Date().toISOString(),
    } });
    if (workouts.value) uploads.push({ kind: 'workouts', localDate: window.localDate, body: {
      localDate: window.localDate, timezone: window.timezone, provider: 'apple_health',
      providerUpdatedAt: new Date().toISOString(),
      workouts: workouts.value.map((workout) => ({
        providerWorkoutId: workout.providerWorkoutId, activityType: workout.activityType,
        displayName: workout.displayName, startedAt: workout.startedAt.toISOString(), endedAt: workout.endedAt.toISOString(),
        durationMinutes: workout.durationMinutes, totalEnergyBurned: workout.totalEnergyBurned,
        totalDistance: workout.totalDistance, distanceUnit: workout.distanceUnit,
      })),
    } });
  }

  const queued = await enqueueChangedUploads(uploads);
  const anchor = windows[0];
  if (!anchor) throw new Error('A current local day is required.');
  const session = await startIngestionSyncSession({
    localDate: anchor.localDate,
    timezone: anchor.timezone,
    provider: 'apple_health',
    trigger,
    appVersion: Constants.expoConfig?.version,
    providerAdapterVersion: ADAPTER_VERSION,
    datesQueried: windows.map((window) => window.localDate),
  });
  const flushed = await flushOutbox(session.id);
  const uploaded = new Set([...queued.changedDates, ...flushed.uploadedDates]);
  const skippedDates = windows.map((window) => window.localDate).filter((date) => !uploaded.has(date));
  const allStatuses = [...statuses.expenditure, ...statuses.intake, ...statuses.steps, ...statuses.workouts];

  await completeIngestionSyncSession(session.id, {
    expenditureStatus: combinedStatus(statuses.expenditure),
    intakeStatus: combinedStatus(statuses.intake),
    stepsStatus: combinedStatus(statuses.steps),
    workoutsStatus: combinedStatus(statuses.workouts),
    recordsImported: flushed.counters.imported,
    recordsUpdated: flushed.counters.updated,
    recordsSkipped: flushed.counters.skipped,
    warningCount: allStatuses.filter((status) => status === 'unavailable').length,
    errorCode: flushed.errors.length > 0 || allStatuses.includes('error') ? 'historical_health_sync_incomplete' : null,
    datesUploaded: flushed.uploadedDates,
    datesSkipped: skippedDates,
    errors: flushed.errors,
  });

  if (flushed.pendingCount === 0) await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  await fetchToday(anchor.timezone);
  return { connectionStatus, expenditureFound, intakeFound, stepsFound, workoutCount, skippedForCooldown: false };
}

// Kept as a compatibility name for existing screens; it now synchronizes the rolling window.
export const syncAppleHealthToday = syncAppleHealthRollingWindow;
