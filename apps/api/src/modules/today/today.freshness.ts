import type { TodaySoFarDataFreshnessStatus } from '@caloriebank/schemas';

export const CURRENT_DAY_STALE_AFTER_MS = 30 * 60 * 1000;

export function currentDayFreshness(
  status: TodaySoFarDataFreshnessStatus,
  lastSyncedAt: Date | null,
  now = new Date(),
): TodaySoFarDataFreshnessStatus {
  if (
    status === 'ready' &&
    lastSyncedAt &&
    now.getTime() - lastSyncedAt.getTime() > CURRENT_DAY_STALE_AFTER_MS
  ) {
    return 'stale';
  }
  return status;
}

export function combineTodayFreshness(
  statuses: TodaySoFarDataFreshnessStatus[],
): TodaySoFarDataFreshnessStatus {
  if (statuses.every((status) => status === 'not_connected')) return 'not_connected';
  if (statuses.every((status) => status === 'ready')) return 'ready';
  if (statuses.includes('syncing')) return 'syncing';
  if (statuses.includes('stale')) return 'stale';
  if (statuses.every((status) => status === 'error')) return 'error';
  return 'partial';
}
