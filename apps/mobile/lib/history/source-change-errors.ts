export function historicalSourceChangeMessage(
  code: string | null,
  sourceLabel: string,
) {
  if (code === 'SOURCE_NO_DATA_FOR_DATE' || code === 'HISTORICAL_SOURCE_UNAVAILABLE') {
    return `${sourceLabel} doesn’t have calorie data for this day.`;
  }
  if (code === 'SOURCE_DATA_NOT_USABLE') {
    return `${sourceLabel}’s data for this day isn’t complete enough to use.`;
  }
  if (code === 'TIMEZONE_MISMATCH') {
    return `${sourceLabel}’s data belongs to a different local day.`;
  }
  if (code === 'APPLE_HEALTH_WRITER_UNAVAILABLE') {
    return `${sourceLabel} data is no longer available from Apple Health.`;
  }
  if (code === 'DAY_NO_LONGER_CHANGEABLE' || code === 'BANK_DAY_LOCKED' || code === 'OPENING_BANK_IMMUTABLE') {
    return 'This day can no longer be changed.';
  }
  if (code === 'STALE_SELECTION' || code === 'HISTORICAL_SOURCE_REVISION_CONFLICT' || code === 'OPTION_STATE_CHANGED') {
    return 'This source changed. Try again.';
  }
  if (code === 'SOURCE_NO_LONGER_AVAILABLE' || code === 'UNKNOWN_SOURCE_OPTION') {
    return `${sourceLabel} is no longer available for this day.`;
  }
  return 'Couldn’t change the source. Try again.';
}
