export const notificationSettingsName = 'Android Settings';
export const deletionHealthNote = '';
export const nativeRefreshFailure = 'Your saved health source cannot refresh on this phone.';
// Historical provenance is not relabeled as Health Connect.
export function sourceLabel(label: string) {
  return label.replace(/Apple Health|Apple Watch|apple_health|apple_watch/g, 'Source on another device');
}
