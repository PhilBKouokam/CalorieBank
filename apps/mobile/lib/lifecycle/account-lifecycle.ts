import { runForegroundLifecycle } from '@/lib/api/client';
import {
  getAppleHealthConnectionStatus,
  syncAppleHealthToday,
} from '@/lib/healthkit/healthkit-connection';

const AUTOMATIC_COOLDOWN_MS = 5 * 60 * 1000;
let accountScope: string | null = null;
let activeRun: Promise<AccountLifecycleResult> | null = null;
let lastAutomaticRunAt = 0;
let scopeGeneration = 0;
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
  lastAutomaticRunAt = 0;
}

export function subscribeToAccountLifecycle(listener: (result: AccountLifecycleResult) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function runAccountLifecycle(options: { force?: boolean } = {}): Promise<AccountLifecycleResult> {
  if (activeRun) return activeRun;
  const force = options.force ?? false;
  const generation = scopeGeneration;
  if (!force && Date.now() - lastAutomaticRunAt < AUTOMATIC_COOLDOWN_MS) {
    return Promise.resolve<AccountLifecycleResult>({ status: 'skipped', detail: null });
  }
  const run: Promise<AccountLifecycleResult> = (async (): Promise<AccountLifecycleResult> => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const server = await runForegroundLifecycle(
        timezone,
        force ? 'manual_refresh' : 'app_foreground',
      );
      if (!server.shouldSyncHealthKit) return { status: 'skipped', detail: null };
      const appleStatus = await getAppleHealthConnectionStatus();
      let appleFailed = false;
      if (appleStatus === 'connected') {
        try {
          await syncAppleHealthToday({
            force,
            trigger: force ? 'manual_refresh' : 'app_foreground',
            dayCount: server.unresolvedDates.length > 0 ? 8 : 3,
          });
        } catch {
          appleFailed = true;
        }
      }
      lastAutomaticRunAt = Date.now();
      const hasServerErrors = server.errors.length > 0;
      const reconnectProvider = server.errors.find((error) => error.code === 'needs_reconnect')?.provider;
      return {
        status: appleFailed || hasServerErrors ? 'partial' : 'success',
        detail: appleFailed
          ? 'Apple Health couldn’t refresh. Try again.'
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
      if (generation === scopeGeneration) activeRun = null;
    }
  })().then((result) => {
    if (generation === scopeGeneration) listeners.forEach((listener) => listener(result));
    return result;
  });
  activeRun = run;
  return run;
}
