import { Platform } from 'react-native';
import { normalizeAuthSystemPath } from '../lib/auth/native-intent';

export function redirectSystemPath(event: { path: string; initial: boolean }) {
  return normalizeAuthSystemPath(event, Platform.OS);
}
