// Expo statically inlines this explicit build flag. Beta account/API environment
// alone never authorizes diagnostic health reads. Play builds force it off.
export function healthConnectQualificationEnabled() {
  return process.env.EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION === '1';
}
