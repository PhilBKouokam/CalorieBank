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
  fetchProviderSelection,
  fetchToday,
  getApiRequestFailureKind,
  startIngestionSyncSession,
  saveProviderSelection,
  syncCurrentDayExpenditure,
  syncCurrentDayIntake,
  syncCurrentDaySteps,
  syncCurrentDayWorkouts,
  syncRestingBurnEstimate,
} from '@/lib/api/client';
import {
  APPLE_HEALTH_READ_TYPES,
  AppleHealthExpenditureProvider,
  AppleHealthIntakeProvider,
  AppleHealthStepProvider,
  AppleHealthWorkoutProvider,
  estimateAppleHealthRestingBurn,
  type HealthKitNativeClient,
} from './apple-health-provider';
import {
  createHealthKitDiagnosticsSnapshot,
  deriveHealthKitSyncStatus,
  safeHealthKitError,
  type HealthKitDiagnosticsSnapshot,
  type HealthKitQueryDiagnostic,
} from './healthkit-diagnostics';
import {
  createRollingSyncSingleFlight,
  accountScopedRollingSyncKey,
  mergeRollingSyncOutbox,
  sanitizeRollingSyncOutbox,
  type RollingSyncQueuedUpload,
  type RollingSyncUpload,
} from './rolling-sync-policy';
import {
  discoverAppleHealthIntakeWriters,
  sourceForSelectedWriter,
} from './apple-health-intake-writers';

const CONNECTION_KEY = 'caloriebank.apple-health.connected';
const EVER_CONNECTED_KEY = 'caloriebank.apple-health.ever-connected';
const LAST_SYNC_KEY = 'caloriebank.apple-health.last-sync';
const OUTBOX_KEY = 'caloriebank.apple-health.sync-outbox.v1';
const FINGERPRINTS_KEY = 'caloriebank.apple-health.upload-fingerprints.v1';
const DIAGNOSTICS_KEY = 'caloriebank.apple-health.diagnostics.v1';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const DEVICE_USER_ID = 'current-device-user';
const ADAPTER_VERSION = 'apple-health-v2-rolling-window';

let activeAccountScope: string | null = null;
let activeAccountGeneration = 0;

type AppleHealthAccountContext = {
  scope: string;
  generation: number;
};

function captureAccountContext(): AppleHealthAccountContext {
  if (!activeAccountScope) throw new Error('Apple Health requires an authenticated account scope.');
  return { scope: activeAccountScope, generation: activeAccountGeneration };
}

function assertAccountContext(context: AppleHealthAccountContext) {
  if (context.scope !== activeAccountScope || context.generation !== activeAccountGeneration) {
    throw new Error('Apple Health account context changed during synchronization.');
  }
}

export function appleHealthAccountStorageKey(key: string, accountScope = activeAccountScope) {
  return accountScopedRollingSyncKey(key, accountScope);
}

export function setAppleHealthAccountScope(accountScope: string | null) {
  if (accountScope === activeAccountScope) return;
  const previousScope = activeAccountScope;
  activeAccountScope = accountScope;
  activeAccountGeneration += 1;
  rollingSyncSingleFlight.reset();
  console.info(JSON.stringify({
    component: 'apple_health_account',
    event: 'account_context_changed',
    hadPreviousAccount: previousScope !== null,
    hasCurrentAccount: accountScope !== null,
  }));
  console.info(JSON.stringify({
    component: 'apple_health_account',
    event: 'account_owned_state_invalidated',
  }));
}

const UPLOAD_ENDPOINTS = {
  expenditure: '/v1/me/ingestion/expenditure',
  intake: '/v1/me/ingestion/intake',
  steps: '/v1/me/ingestion/steps',
  workouts: '/v1/me/ingestion/workouts',
} as const;

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
  | 'unavailable';

export type AppleHealthSyncOutcome = {
  connectionStatus: AppleHealthConnectionStatus;
  expenditureFound: boolean;
  intakeFound: boolean;
  stepsFound: boolean;
  workoutCount: number;
  skippedForCooldown: boolean;
  syncStatus: 'success' | 'partial' | 'failure';
  intakeWriterStatus?: 'ready' | 'selection_required' | 'missing' | 'not_selected';
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

function logHealthKitDiagnostic(event: string, metadata: Record<string, unknown>) {
  if (!__DEV__) return;
  console.info(`[CalorieBank HealthKit] ${event}`, metadata);
}

function logFirstRunHealthKitOutcome(outcome: AppleHealthSyncOutcome, durationMs: number) {
  console.info(JSON.stringify({
    component: 'first_run_bootstrap',
    event: outcome.syncStatus === 'failure'
      ? 'first_run_current_intake_failed'
      : outcome.intakeFound
        ? 'first_run_current_intake_ready'
        : 'first_run_current_intake_no_data',
    intakeWriterStatus: outcome.intakeWriterStatus ?? 'unknown',
    syncStatus: outcome.syncStatus,
    uploadSucceeded: outcome.syncStatus !== 'failure',
    durationMs,
  }));
}

async function saveHealthKitDiagnostics(snapshot: HealthKitDiagnosticsSnapshot, accountScope = activeAccountScope) {
  await AsyncStorage.setItem(appleHealthAccountStorageKey(DIAGNOSTICS_KEY, accountScope), JSON.stringify(snapshot));
}

export async function getAppleHealthDiagnostics(accountScope = activeAccountScope): Promise<HealthKitDiagnosticsSnapshot | null> {
  const stored = await readJson<HealthKitDiagnosticsSnapshot | null>(appleHealthAccountStorageKey(DIAGNOSTICS_KEY, accountScope), null);
  return stored ? createHealthKitDiagnosticsSnapshot(stored) : null;
}

async function recordGlobalSyncFailure(error: unknown, context: AppleHealthAccountContext) {
  const previous = await getAppleHealthDiagnostics(context.scope);
  const safeError = safeHealthKitError(error);
  const snapshot = createHealthKitDiagnosticsSnapshot({
    ...previous,
    lastSyncAt: new Date().toISOString(),
    syncRunning: false,
    lastSyncCompletedAt: new Date().toISOString(),
    overallSyncResult: 'failure',
    error: safeError,
  });
  await saveHealthKitDiagnostics(snapshot, context.scope);
  logHealthKitDiagnostic('sync_failure', safeError);
}

async function loadOutbox(accountScope: string) {
  const outboxKey = appleHealthAccountStorageKey(OUTBOX_KEY, accountScope);
  const stored = await readJson<unknown>(outboxKey, []);
  const queue = sanitizeRollingSyncOutbox<UploadPayload>(stored);
  if (__DEV__ && JSON.stringify(stored) !== JSON.stringify(queue)) {
    await AsyncStorage.setItem(outboxKey, JSON.stringify(queue));
    logHealthKitDiagnostic('outbox_migrated', {
      queuedCount: queue.length,
      absoluteUrlsRemoved: true,
    });
  }
  return queue;
}

function outboxDiagnostic(queue: readonly QueuedUpload[], lastRetryStatus: 'not_run' | 'success' | 'partial' | 'failure') {
  return {
    queuedCount: queue.length,
    oldestQueuedDate: queue[0]?.localDate ?? null,
    lastRetryStatus,
  };
}

async function enqueueChangedUploads(uploads: UploadPayload[], accountScope: string) {
  const [outbox, fingerprints] = await Promise.all([
    loadOutbox(accountScope),
    readJson<Record<string, string>>(appleHealthAccountStorageKey(FINGERPRINTS_KEY, accountScope), {}),
  ]);
  const merged = mergeRollingSyncOutbox(outbox, uploads, fingerprints, new Date().toISOString());
  const queue = merged.queue;
  await AsyncStorage.setItem(appleHealthAccountStorageKey(OUTBOX_KEY, accountScope), JSON.stringify(queue));
  return { changedDates: merged.changedDates, skippedDates: merged.skippedDates };
}

async function uploadQueuedItem(item: QueuedUpload, syncSessionId: string, context: AppleHealthAccountContext) {
  assertAccountContext(context);
  const endpoint = UPLOAD_ENDPOINTS[item.kind];
  logHealthKitDiagnostic('upload_start', {
    category: item.kind,
    localDate: item.localDate,
    endpoint,
  });
  try {
    const result = item.kind === 'expenditure'
      ? await syncCurrentDayExpenditure({ ...item.body, syncSessionId })
      : item.kind === 'intake'
        ? await syncCurrentDayIntake({ ...item.body, syncSessionId })
        : item.kind === 'steps'
          ? await syncCurrentDaySteps({ ...item.body, syncSessionId })
          : await syncCurrentDayWorkouts({ ...item.body, syncSessionId });
    logHealthKitDiagnostic('upload_success', {
      category: item.kind,
      localDate: item.localDate,
      endpoint,
      status: 200,
    });
    return result;
  } catch (error) {
    logHealthKitDiagnostic('upload_failure', {
      category: item.kind,
      localDate: item.localDate,
      endpoint,
      errorType: getApiRequestFailureKind(error),
    });
    throw error;
  }
}

async function flushOutbox(syncSessionId: string, context: AppleHealthAccountContext) {
  const queue = await loadOutbox(context.scope);
  const attemptedCount = queue.length;
  const fingerprints = await readJson<Record<string, string>>(appleHealthAccountStorageKey(FINGERPRINTS_KEY, context.scope), {});
  let remaining = [...queue];
  const uploadedDates = new Set<string>();
  const counters = { imported: 0, updated: 0, skipped: 0 };
  const errors: string[] = [];
  const items: HealthKitDiagnosticsSnapshot['upload']['items'] = [];

  for (const item of queue) {
    try {
      const result = await uploadQueuedItem(item, syncSessionId, context);
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
      remaining = remaining.filter((queuedItem) => queuedItem.key !== item.key);
      items.push({
        category: item.kind,
        localDate: item.localDate,
        endpoint: UPLOAD_ENDPOINTS[item.kind],
        status: 'success',
        errorType: null,
      });
      await Promise.all([
        AsyncStorage.setItem(appleHealthAccountStorageKey(OUTBOX_KEY, context.scope), JSON.stringify(remaining)),
        AsyncStorage.setItem(appleHealthAccountStorageKey(FINGERPRINTS_KEY, context.scope), JSON.stringify(fingerprints)),
      ]);
    } catch (error) {
      errors.push(`${item.localDate}:${item.kind}`);
      items.push({
        category: item.kind,
        localDate: item.localDate,
        endpoint: UPLOAD_ENDPOINTS[item.kind],
        status: 'failure',
        errorType: getApiRequestFailureKind(error),
      });
    }
  }

  await AsyncStorage.setItem(appleHealthAccountStorageKey(OUTBOX_KEY, context.scope), JSON.stringify(remaining));

  return {
    uploadedDates: [...uploadedDates],
    counters,
    errors,
    pendingCount: remaining.length,
    attemptedCount,
    completedCount: attemptedCount - remaining.length,
    items,
    remaining,
  };
}

export async function getAppleHealthConnectionStatus(accountScope = activeAccountScope): Promise<AppleHealthConnectionStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const healthKit = await loadHealthKit();
    if (!healthKit.isHealthDataAvailable()) return 'unavailable';
    return (await AsyncStorage.getItem(appleHealthAccountStorageKey(CONNECTION_KEY, accountScope))) === 'true' ? 'connected' : 'not_connected';
  } catch {
    return 'unavailable';
  }
}

export async function connectAppleHealth() {
  const context = captureAccountContext();
  if (Platform.OS !== 'ios') return 'unavailable' as const;
  const healthKit = await loadHealthKit();
  if (!healthKit.isHealthDataAvailable()) return 'unavailable' as const;
  const completed = await healthKit.requestAuthorization({ toRead: APPLE_HEALTH_READ_TYPES });
  assertAccountContext(context);
  await saveHealthKitDiagnostics(createHealthKitDiagnosticsSnapshot({
    healthKitAvailable: true,
    authorizationRequest: completed ? 'completed' : 'failed',
  }), context.scope);
  logHealthKitDiagnostic('authorization_request', { completed });
  if (!completed) throw new Error('Apple Health authorization request did not complete.');
  const wasPreviouslyConnected = (await AsyncStorage.getItem(appleHealthAccountStorageKey(EVER_CONNECTED_KEY, context.scope))) === 'true';
  await AsyncStorage.multiSet([
    [appleHealthAccountStorageKey(CONNECTION_KEY, context.scope), 'true'],
    [appleHealthAccountStorageKey(EVER_CONNECTED_KEY, context.scope), 'true'],
  ]);
  assertAccountContext(context);
  try {
    await syncAppleHealthRollingWindow({
      force: true,
      trigger: wasPreviouslyConnected ? 'provider_reconnect' : 'connection',
    });
  } catch {
    // The authorization flow completed. A later query or API failure does not disconnect HealthKit.
  }
  return 'connected' as const;
}

/**
 * Re-establishes Apple Health for the active CalorieBank account without
 * claiming that iOS permissions are missing. HealthKit authorization belongs
 * to the app/device; this account marker only scopes uploads and readiness.
 */
export async function refreshAppleHealthForCurrentAccount(
  options: AppleHealthSyncOptions = {},
) {
  const context = captureAccountContext();
  if (Platform.OS !== 'ios') return null;
  const healthKit = await loadHealthKit();
  if (!healthKit.isHealthDataAvailable()) return null;
  assertAccountContext(context);
  await AsyncStorage.setItem(appleHealthAccountStorageKey(CONNECTION_KEY, context.scope), 'true');
  assertAccountContext(context);
  return syncAppleHealthRollingWindow({ ...options, force: true });
}

export async function disconnectAppleHealthLocally() {
  const context = captureAccountContext();
  await AsyncStorage.multiRemove([
    appleHealthAccountStorageKey(CONNECTION_KEY, context.scope),
    appleHealthAccountStorageKey(LAST_SYNC_KEY, context.scope),
    appleHealthAccountStorageKey(OUTBOX_KEY, context.scope),
    appleHealthAccountStorageKey(FINGERPRINTS_KEY, context.scope),
    appleHealthAccountStorageKey(DIAGNOSTICS_KEY, context.scope),
  ]);
}

function combinedStatus(statuses: IngestionCategoryStatus[]): IngestionCategoryStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('ready')) return 'ready';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'skipped';
}

async function performAppleHealthRollingWindowSync({
  force = false,
  trigger = 'screen_focus',
  dayCount = 3,
  accountContext,
}: {
  force?: boolean;
  trigger?: IngestionSyncTrigger;
  dayCount?: number;
  accountContext: AppleHealthAccountContext;
}): Promise<AppleHealthSyncOutcome> {
  const context = accountContext;
  assertAccountContext(context);
  const connectionStatus = await getAppleHealthConnectionStatus(context.scope);
  if (connectionStatus !== 'connected') {
    return { connectionStatus, expenditureFound: false, intakeFound: false, stepsFound: false, workoutCount: 0, skippedForCooldown: false, syncStatus: 'failure' as const };
  }

  const previousSync = Number(await AsyncStorage.getItem(appleHealthAccountStorageKey(LAST_SYNC_KEY, context.scope)));
  if (!force && Number.isFinite(previousSync) && Date.now() - previousSync < SYNC_COOLDOWN_MS) {
    assertAccountContext(context);
    const today = await fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone).catch((error) => {
      logHealthKitDiagnostic('today_refresh_failure', {
        endpoint: '/v1/me/today',
        errorType: getApiRequestFailureKind(error),
      });
      return null;
    });
    return {
      connectionStatus,
      expenditureFound: today?.burned.adjusted !== null && today?.burned.adjusted !== undefined,
      intakeFound: today?.eaten.calories !== null && today?.eaten.calories !== undefined,
      stepsFound: today?.steps.count !== null && today?.steps.count !== undefined,
      workoutCount: today?.workouts.totalCount ?? 0,
      skippedForCooldown: true,
      syncStatus: 'success',
    };
  }

  const healthKit = await loadHealthKit();
  const nativeClient: HealthKitNativeClient = {
    queryStatisticsForQuantity: healthKit.queryStatisticsForQuantity,
    queryStatisticsCollectionForQuantity: healthKit.queryStatisticsCollectionForQuantity,
    queryWorkoutSamples: healthKit.queryWorkoutSamples,
  };
  const windows = getRollingLocalDayWindows(new Date(), dayCount);
  assertAccountContext(context);
  let providerSelection = await fetchProviderSelection();
  let intakeWriter = providerSelection.intake.writerBundleIdentifier
    ? await sourceForSelectedWriter(providerSelection.intake.writerBundleIdentifier)
    : null;
  let intakeWriterStatus: AppleHealthSyncOutcome['intakeWriterStatus'] =
    providerSelection.intake.authoritativeProvider !== 'apple_health'
      ? 'not_selected'
      : intakeWriter
        ? 'ready'
        : providerSelection.intake.writerBundleIdentifier
          ? 'missing'
          : 'selection_required';
  if (
    providerSelection.intake.authoritativeProvider === 'apple_health' &&
    !providerSelection.intake.writerBundleIdentifier
  ) {
    const discoveredWriters = await discoverAppleHealthIntakeWriters();
    if (discoveredWriters.length === 1) {
      const onlyWriter = discoveredWriters[0]!;
      assertAccountContext(context);
      providerSelection = await saveProviderSelection({
        authoritativeExpenditureProvider: providerSelection.expenditure.authoritativeProvider,
        authoritativeActivityProvider: providerSelection.activityContext.authoritativeProvider,
        authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriter: {
          bundleIdentifier: onlyWriter.bundleIdentifier,
          displayName: onlyWriter.displayName,
        },
      });
      intakeWriter = onlyWriter;
      intakeWriterStatus = 'ready';
    }
  }
  const previousDiagnostics = await getAppleHealthDiagnostics(context.scope);
  const diagnostics = createHealthKitDiagnosticsSnapshot({
    ...previousDiagnostics,
    healthKitAvailable: true,
    authorizationRequest: previousDiagnostics?.authorizationRequest === 'completed'
      ? 'completed'
      : 'not_completed',
    lastSyncAt: new Date().toISOString(),
    overallSyncResult: 'not_run',
    rollingDates: windows.map((window) => ({
      localDate: window.localDate,
      queryStart: window.dayStart.toISOString(),
      queryEnd: window.dayEnd.toISOString(),
    })),
    queries: [],
    upload: {
      status: 'not_attempted',
      attemptedCount: 0,
      completedCount: 0,
      pendingCount: 0,
      failedCategories: [],
      items: [],
    },
    error: null,
  });
  const uploads: UploadPayload[] = [];
  const statuses = { expenditure: [] as IngestionCategoryStatus[], intake: [] as IngestionCategoryStatus[], steps: [] as IngestionCategoryStatus[], workouts: [] as IngestionCategoryStatus[] };
  let expenditureFound = false;
  let intakeFound = false;
  let stepsFound = false;
  let workoutCount = 0;

  for (const [index, window] of windows.entries()) {
    assertAccountContext(context);
    if (index > 0) console.info(JSON.stringify({ component: 'historical_bootstrap', event: 'historical_date_requested', localDate: window.localDate }));
    const input = { userId: DEVICE_USER_ID, localDate: window.localDate, timezone: window.timezone, isCurrentDay: index === 0 };
    const dependencies = {
      healthKit: nativeClient,
      dayStart: window.dayStart,
      dayEnd: window.dayEnd,
      ...(intakeWriter ? { intakeWriter: {
        source: intakeWriter.source,
        bundleIdentifier: intakeWriter.bundleIdentifier,
        displayName: intakeWriter.displayName,
      } } : {}),
      onDiagnostic: (nativeDiagnostic: Omit<HealthKitQueryDiagnostic, 'localDate' | 'queryStart' | 'queryEnd' | 'error'> & { queryStart: Date; queryEnd: Date; error: unknown | null }) => {
        const queryDiagnostic: HealthKitQueryDiagnostic = {
          ...nativeDiagnostic,
          localDate: window.localDate,
          queryStart: nativeDiagnostic.queryStart.toISOString(),
          queryEnd: nativeDiagnostic.queryEnd.toISOString(),
          error: nativeDiagnostic.error === null ? null : safeHealthKitError(nativeDiagnostic.error),
        };
        diagnostics.queries.push(queryDiagnostic);
        logHealthKitDiagnostic('query', {
          category: queryDiagnostic.category,
          localDate: queryDiagnostic.localDate,
          queryStart: queryDiagnostic.queryStart,
          queryEnd: queryDiagnostic.queryEnd,
          status: queryDiagnostic.status,
          sampleCount: queryDiagnostic.sampleCount,
          normalizedAggregate: queryDiagnostic.normalizedAggregate,
          error: queryDiagnostic.error,
        });
      },
    };
    const [expenditure, intake, steps, workouts] = await Promise.all([
      categoryResult(new AppleHealthExpenditureProvider(dependencies).fetchDailyExpenditureAggregate(input)),
      categoryResult(new AppleHealthIntakeProvider(dependencies).fetchDailyCalorieIntakeAggregate(input)),
      categoryResult(new AppleHealthStepProvider(dependencies).fetchDailyStepAggregate(input)),
      categoryResult(new AppleHealthWorkoutProvider(dependencies).fetchDailyWorkouts(input)),
    ]);
    if (index > 0) console.info(JSON.stringify({
      component: 'historical_bootstrap',
      event: 'historical_intake_query_completed',
      localDate: window.localDate,
      result: intake.status === 'error' ? 'failed' : intake.value ? 'ready' : 'no_data',
    }));
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
      syncStatus: 'ready',
      providerUpdatedAt: expenditure.value.providerUpdatedAt?.toISOString() ?? new Date().toISOString(),
      sourceMetadata: { activeEnergyCalories: expenditure.value.activeEnergyCalories ?? 0, basalEnergyCalories: expenditure.value.basalEnergyCalories ?? 0 },
    } });
    if (intake.value) uploads.push({ kind: 'intake', localDate: window.localDate, body: {
      localDate: window.localDate, timezone: window.timezone, provider: 'apple_health',
      totalCaloriesConsumed: intake.value.totalCaloriesConsumed,
      writerBundleIdentifier: intake.value.writerBundleIdentifier!,
      writerDisplayName: intake.value.writerDisplayName!,
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
        totalSteps: workout.totalSteps ?? null,
        totalDistance: workout.totalDistance, distanceUnit: workout.distanceUnit,
      })),
    } });
  }

  diagnostics.overallSyncResult = deriveHealthKitSyncStatus(diagnostics.queries, diagnostics.upload);
  await saveHealthKitDiagnostics(diagnostics, context.scope);

  const queued = await enqueueChangedUploads(uploads, context.scope);
  const pendingBeforeFlush = await loadOutbox(context.scope);
  diagnostics.outbox = outboxDiagnostic(pendingBeforeFlush, 'not_run');
  await saveHealthKitDiagnostics(diagnostics, context.scope);
  const anchor = windows[0];
  if (!anchor) throw new Error('A current local day is required.');
  logHealthKitDiagnostic('sync_session_start', {
    endpoint: '/v1/me/ingestion/sync-sessions',
    trigger,
    dates: windows.map((window) => window.localDate),
  });
  let session: Awaited<ReturnType<typeof startIngestionSyncSession>>;
  try {
    assertAccountContext(context);
    session = await startIngestionSyncSession({
      localDate: anchor.localDate,
      timezone: anchor.timezone,
      provider: 'apple_health',
      trigger,
      appVersion: Constants.expoConfig?.version,
      providerAdapterVersion: ADAPTER_VERSION,
      datesQueried: windows.map((window) => window.localDate),
    });
  } catch (error) {
    logHealthKitDiagnostic('sync_session_failure', {
      endpoint: '/v1/me/ingestion/sync-sessions',
      errorType: getApiRequestFailureKind(error),
    });
    throw error;
  }
  const flushed = await flushOutbox(session.id, context);
  diagnostics.upload = {
    status: flushed.errors.length === 0
      ? 'success'
      : flushed.completedCount > 0
        ? 'partial'
        : 'failure',
    attemptedCount: flushed.attemptedCount,
    completedCount: flushed.completedCount,
    pendingCount: flushed.pendingCount,
    failedCategories: flushed.errors,
    items: flushed.items,
  };
  diagnostics.outbox = outboxDiagnostic(
    flushed.remaining,
    flushed.errors.length === 0
      ? 'success'
      : flushed.completedCount > 0
        ? 'partial'
        : 'failure',
  );
  diagnostics.overallSyncResult = deriveHealthKitSyncStatus(diagnostics.queries, diagnostics.upload);
  diagnostics.error = flushed.errors.length > 0
    ? { code: 'upload_incomplete', message: 'One or more normalized aggregate uploads failed.' }
    : null;
  await saveHealthKitDiagnostics(diagnostics, context.scope);
  logHealthKitDiagnostic('upload', diagnostics.upload);
  const uploaded = new Set([...queued.changedDates, ...flushed.uploadedDates]);
  const skippedDates = windows.map((window) => window.localDate).filter((date) => !uploaded.has(date));
  const allStatuses = [...statuses.expenditure, ...statuses.intake, ...statuses.steps, ...statuses.workouts];

  try {
    assertAccountContext(context);
    const existingToday = await fetchToday(anchor.timezone).catch(() => null);
    const restingModelIsFresh = existingToday?.restOfDayProjection.source === 'Apple Health' &&
      existingToday.restOfDayProjection.calculatedAt !== null &&
      Date.now() - new Date(existingToday.restOfDayProjection.calculatedAt).getTime() <
        7 * 24 * 60 * 60 * 1000;
    if (!restingModelIsFresh) {
      await estimateAppleHealthRestingBurn(nativeClient, anchor.timezone).then((restEstimate) =>
        restEstimate ? syncRestingBurnEstimate({
        provider: 'apple_health',
        providerKcalPerHour: restEstimate.providerKcalPerHour,
        evidenceType: restEstimate.evidenceType,
        observationCount: restEstimate.observationCount,
        lookbackStartDate: restEstimate.lookbackStartDate,
        lookbackEndDate: restEstimate.lookbackEndDate,
        calculatedAt: new Date().toISOString(),
        }) : undefined,
      ).catch((error) => {
        logHealthKitDiagnostic('resting_burn_estimate_unavailable', {
          errorType: getApiRequestFailureKind(error),
        });
      });
    }
    assertAccountContext(context);
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
  } catch (error) {
    logHealthKitDiagnostic('sync_session_complete_failure', {
      endpoint: `/v1/me/ingestion/sync-sessions/${session.id}`,
      errorType: getApiRequestFailureKind(error),
    });
    diagnostics.overallSyncResult = diagnostics.overallSyncResult === 'failure' ? 'failure' : 'partial';
    diagnostics.error = {
      code: 'sync_session_completion_failed',
      message: 'Aggregate uploads completed, but the synchronization audit session could not close.',
    };
    await saveHealthKitDiagnostics(diagnostics, context.scope);
    throw error;
  }

  assertAccountContext(context);
  if (flushed.pendingCount === 0) await AsyncStorage.setItem(appleHealthAccountStorageKey(LAST_SYNC_KEY, context.scope), String(Date.now()));
  await fetchToday(anchor.timezone).catch((error) => {
    logHealthKitDiagnostic('today_refresh_failure', {
      endpoint: '/v1/me/today',
      errorType: getApiRequestFailureKind(error),
    });
  });
  return {
    connectionStatus,
    expenditureFound,
    intakeFound,
    stepsFound,
    workoutCount,
    skippedForCooldown: false,
    syncStatus: diagnostics.overallSyncResult === 'failure'
      ? 'failure'
      : diagnostics.overallSyncResult === 'partial'
        ? 'partial'
      : 'success',
    intakeWriterStatus,
  };
}

type AppleHealthSyncOptions = { force?: boolean; trigger?: IngestionSyncTrigger; dayCount?: number };
type AppleHealthSyncExecutionOptions = AppleHealthSyncOptions & { accountContext: AppleHealthAccountContext };

async function executeAppleHealthRollingWindowSync(
  options: AppleHealthSyncExecutionOptions,
): Promise<AppleHealthSyncOutcome> {
  const startedAt = new Date().toISOString();
  const context = options.accountContext;
  const previous = await getAppleHealthDiagnostics(context.scope);
  await saveHealthKitDiagnostics(createHealthKitDiagnosticsSnapshot({
    ...previous,
    syncRunning: true,
    lastSyncTrigger: options.trigger ?? 'screen_focus',
    lastSyncStartedAt: startedAt,
    lastSyncCompletedAt: null,
  }), context.scope);
  logHealthKitDiagnostic('sync_start', {
    trigger: options.trigger ?? 'screen_focus',
    force: options.force ?? false,
  });

  try {
    const outcome = await performAppleHealthRollingWindowSync(options);
    const completedAt = new Date().toISOString();
    const latest = await getAppleHealthDiagnostics(context.scope);
    await saveHealthKitDiagnostics(createHealthKitDiagnosticsSnapshot({
      ...latest,
      syncRunning: false,
      lastSyncCompletedAt: completedAt,
    }), context.scope);
    logHealthKitDiagnostic('sync_complete', {
      trigger: options.trigger ?? 'screen_focus',
      result: outcome.syncStatus,
    });
    if (options.trigger === 'connection' || options.trigger === 'provider_reconnect') {
      logFirstRunHealthKitOutcome(outcome, Date.now() - new Date(startedAt).getTime());
    }
    return outcome;
  } catch (error) {
    await recordGlobalSyncFailure(error, context);
    throw error;
  }
}

const rollingSyncSingleFlight = createRollingSyncSingleFlight(executeAppleHealthRollingWindowSync);

export function isAppleHealthSyncRunning() {
  return rollingSyncSingleFlight.isRunning();
}

export function syncAppleHealthRollingWindow(
  options: AppleHealthSyncOptions = {},
): Promise<AppleHealthSyncOutcome> {
  if (rollingSyncSingleFlight.isRunning()) {
    logHealthKitDiagnostic('sync_trigger_coalesced', {
      trigger: options.trigger ?? 'screen_focus',
      queuedFreshRun: options.force ?? false,
    });
  }
  return rollingSyncSingleFlight.run({ ...options, accountContext: captureAccountContext() });
}

// Kept as a compatibility name for existing screens; it now synchronizes the rolling window.
export const syncAppleHealthToday = syncAppleHealthRollingWindow;
