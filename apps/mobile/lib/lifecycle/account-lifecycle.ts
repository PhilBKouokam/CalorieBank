import { nativeRefreshFailure } from '@/lib/native-health/copy';
import { fetchBankSummary, runForegroundLifecycle } from '@/lib/api/client';
import {
  nativeIntake,
  getNativeHealthConnectionStatus,
  syncNativeHealthToday,
} from '@/lib/native-health';

let accountScope: string | null = null;
let activeRun: Promise<AccountLifecycleResult> | null = null;
let queuedForcedRun: Promise<AccountLifecycleResult> | null = null;
let suspended = false;
let appState = 'inactive';
let scopeGeneration = 0;
let runId = 0;
const activityListeners = new Set<(running: boolean) => void>();
const listeners = new Set<(result: AccountLifecycleResult) => void>();

export type AccountLifecycleResult = {
  status: 'success' | 'partial' | 'skipped';
  detail: string | null;
};

export function resetAccountLifecycle(scope: string | null) {
  if (scope === accountScope) return;
  accountScope = scope;
  scopeGeneration += 1;
  activeRun = null;
  queuedForcedRun = null;
  suspended = false;
  appState = 'inactive';
  activityListeners.forEach((listener) => listener(false));
}

export function pauseAccountLifecycle() { suspended = true; scopeGeneration += 1; queuedForcedRun = null; }
export function resumeAccountLifecycle() { suspended = false; }

// The root owns this transition; screen mounts only read cached/server models.
export function refreshOnAppState(next: string) {
  if (next !== 'active' && nativeIntake.supported) nativeIntake.cancel();
  const entering = next === 'active' && appState !== 'active';
  appState = next;
  return entering ? runAccountLifecycle({ foreground: true }) : Promise.resolve<AccountLifecycleResult>({ status: 'skipped', detail: null });
}

export function subscribeToAccountLifecycle(listener: (result: AccountLifecycleResult) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function subscribeToAccountLifecycleActivity(listener: (running: boolean) => void) {
  activityListeners.add(listener);
  listener(isAccountLifecycleRunning());
  return () => { activityListeners.delete(listener); };
}

export function runAccountLifecycle(options: { force?: boolean; foreground?: boolean } = {}): Promise<AccountLifecycleResult> {
  if (!accountScope || suspended) return Promise.resolve({ status: 'skipped', detail: null });
  const force = options.force ?? false;
  if (activeRun) {
    if (!force && !options.foreground) return activeRun;
    if (!queuedForcedRun) {
      const generation = scopeGeneration;
      queuedForcedRun = activeRun.catch(() => undefined).then(() => {
        if (generation !== scopeGeneration) {
          return { status: 'skipped' as const, detail: null };
        }
        return runAccountLifecycle(options);
      }).finally(() => {
        if (generation === scopeGeneration) {
          queuedForcedRun = null;
          activityListeners.forEach((listener) => listener(isAccountLifecycleRunning()));
        }
      });
    }
    return queuedForcedRun;
  }
  const generation = scopeGeneration;
  const currentRunId = ++runId;
  const run: Promise<AccountLifecycleResult> = (async (): Promise<AccountLifecycleResult> => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const server = await runForegroundLifecycle(
        timezone,
        force ? 'manual_refresh' : 'app_foreground',
      );
      if (generation !== scopeGeneration || suspended) return { status: 'skipped', detail: null };
      if (nativeIntake.supported) {
        const intake = await nativeIntake.refresh();
        if (generation !== scopeGeneration || suspended) return { status: 'skipped', detail: null };
        return { status: ['access_required', 'retry_required'].includes(intake) ? 'partial' : 'success', detail: intake === 'access_required' ? 'Allow food access in Health Connect to refresh your tracker.' : intake === 'retry_required' ? 'Your food tracker could not refresh. Try again.' : null };
      }
      if (generation !== scopeGeneration || !server.shouldSyncHealthKit) {
        return { status: 'skipped', detail: null };
      }
      const appleStatus = await getNativeHealthConnectionStatus();
      if (generation !== scopeGeneration || suspended) return { status: 'skipped', detail: null };
      let appleFailed = false;
      if (appleStatus === 'connected') {
        try {
          await syncNativeHealthToday({
            force: force || options.foreground === true,
            trigger: force ? 'manual_refresh' : 'app_foreground',
            dayCount: server.historyDayCount,
          });
        } catch {
          appleFailed = true;
        }
      }
      if (generation !== scopeGeneration) return { status: 'skipped', detail: null };
      const hasServerErrors = server.errors.length > 0;
      const reconnectProvider = server.errors.find((error) => error.code === 'needs_reconnect')?.provider;
      return {
        status: appleFailed || hasServerErrors ? 'partial' : 'success',
        detail: appleFailed
          ? nativeRefreshFailure
          : reconnectProvider === 'google_health_fitbit'
            ? 'Fitbit needs attention. Reconnect it in Health Connections.'
            : reconnectProvider === 'fatsecret'
              ? 'FatSecret needs attention. Reconnect it in Health Connections.'
          : hasServerErrors
            ? 'Some connected data couldn’t refresh. Try again.'
            : null,
      };
    } catch {
      return { status: 'partial', detail: 'CalorieBank couldn’t update. Try again.' };
    } finally {
      if (currentRunId === runId) activeRun = null;
    }
  })().then((result) => {
    if (generation === scopeGeneration) {
      activityListeners.forEach((listener) => listener(isAccountLifecycleRunning()));
      listeners.forEach((listener) => listener(result));
    }
    return result;
  });
  activeRun = run;
  activityListeners.forEach((listener) => listener(true));
  return run;
}

export function isAccountLifecycleRunning() {
  return activeRun !== null || queuedForcedRun !== null;
}

export async function retryIncompleteOpeningAfterSourceChange() {
  const generation = scopeGeneration;
  try {
    const bank = await fetchBankSummary();
    if (generation !== scopeGeneration || bank.openingBankStatus !== 'waiting_for_opening_data') return;
    await runAccountLifecycle({ force: true });
  } catch {
    // The normal foreground lifecycle retries; source selection itself already succeeded.
  }
}
