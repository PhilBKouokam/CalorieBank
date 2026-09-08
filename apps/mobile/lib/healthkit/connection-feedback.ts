export type FoodConnectionState = 'not_connected' | 'ready' | 'no_data' | 'refresh_failed' | 'reauthentication_required';

export function foodConnectionState(connection: string | undefined, hasData: boolean, refreshFailed: boolean): FoodConnectionState {
  if (connection === 'needs_attention') return 'reauthentication_required';
  if (connection !== 'connected') return 'not_connected';
  if (refreshFailed) return 'refresh_failed';
  return hasData ? 'ready' : 'no_data';
}

export function foodConnectionMessage(name: string, state: FoodConnectionState, duringSetup = false) {
  switch (state) {
    case 'ready': return `${name} is connected. Your food data has been refreshed.`;
    case 'no_data': return `${name} is connected, but we couldn't find recent food entries. ${duringSetup ? 'You can continue setup and check again after logging food.' : `Log food in ${name}, then check again.`}`;
    case 'refresh_failed': return `${name} is connected, but we couldn't refresh your food data. Try again.`;
    case 'reauthentication_required': return `Reconnect ${name} to refresh your food data.`;
    case 'not_connected': return `We couldn't connect to ${name}. Try again.`;
  }
}

export function appleHealthEmptyMessage(role: 'burned' | 'eaten', hasSelectedTracker = false) {
  if (role === 'burned') return 'Apple Health refreshed. No calorie-burn data was found.';
  return hasSelectedTracker
    ? "Apple Health refreshed, but we couldn't find recent food data from your selected tracker."
    : "Choose a food tracker in Apple Health to refresh your calories eaten.";
}

export function appleHealthIntakeRefreshMessage(snapshot: HealthKitDiagnosticsSnapshot | null, hasSelectedTracker: boolean) {
  if (!hasSelectedTracker) return appleHealthEmptyMessage('eaten');
  if (!snapshot) return 'Your food data has not been checked yet. Choose your tracker and try again.';
  if (snapshot.intakeWriterChecks.some((check) => check.status === 'failed') ||
      snapshot.queries.some((query) => query.category === 'dietary_energy' && query.status === 'error') ||
      snapshot.upload.items.some((item) => item.category === 'intake' && item.status === 'failure')) {
    return "We couldn't refresh your Apple Health food data. Try again.";
  }
  if (snapshot.upload.items.some((item) => item.category === 'intake' && item.status === 'queued')) {
    return 'Your food data is still uploading. Check again shortly.';
  }
  if (snapshot.intakeWriterChecks.some((check) => check.status === 'succeeded' && (check.sampleCount ?? 0) > 0)) {
    return 'Your Apple Health food data has been refreshed.';
  }
  if (snapshot.intakeWriterChecks.length > 0) return appleHealthEmptyMessage('eaten', true);
  return 'Your food data has not been checked yet. Choose your tracker and try again.';
}
import type { HealthKitDiagnosticsSnapshot } from './healthkit-diagnostics';
