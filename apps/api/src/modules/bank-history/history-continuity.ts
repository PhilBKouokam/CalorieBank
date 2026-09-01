export type CompletedDayContinuityStatus =
  | 'waiting_for_data'
  | 'missing_burn_data'
  | 'missing_food_data'
  | 'sync_failed'
  | 'unprocessed';

export type CompletedDayContinuityEvidence = {
  hasCalculatedRecord: boolean;
  hasBurnData: boolean;
  hasFoodData: boolean;
  burnQueried: boolean;
  foodQueried: boolean;
  syncFailed: boolean;
};

function shiftDate(localDate: string, days: number) {
  const value = new Date(`${localDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function completedLocalDates(
  accountingStartsOn: string,
  currentLocalDate: string,
) {
  const dates: string[] = [];
  for (let date = accountingStartsOn; date < currentLocalDate; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function classifyCompletedDayGap(
  evidence: CompletedDayContinuityEvidence,
): CompletedDayContinuityStatus | null {
  if (evidence.hasCalculatedRecord) return null;
  if (evidence.syncFailed) return 'sync_failed';
  if (!evidence.burnQueried && !evidence.foodQueried) return 'unprocessed';
  if (!evidence.hasBurnData && evidence.hasFoodData) return 'missing_burn_data';
  if (evidence.hasBurnData && !evidence.hasFoodData) return 'missing_food_data';
  if (!evidence.hasBurnData || !evidence.hasFoodData) return 'waiting_for_data';
  return 'unprocessed';
}

export function continuityMessage(status: CompletedDayContinuityStatus) {
  if (status === 'missing_burn_data') return 'Calorie-burn data is unavailable.';
  if (status === 'missing_food_data') return 'Food data is unavailable.';
  if (status === 'sync_failed') return 'This day needs attention.';
  if (status === 'unprocessed') return 'CalorieBank is missing data for this day.';
  return 'Waiting for calorie data.';
}
