export { nativeIntake } from './intake';
import type { NativeHealthCapability } from './types';

export const nativeHealthCapability: NativeHealthCapability = { supported: true, provider: 'apple_health' };
// Direct aliases deliberately preserve query, storage, scope and retry behavior.
export {
  setAppleHealthAccountScope as setNativeHealthAccountScope,
  getAppleHealthConnectionStatus as getNativeHealthConnectionStatus,
  connectAppleHealth as connectNativeHealth,
  refreshAppleHealthForCurrentAccount as refreshNativeHealthForCurrentAccount,
  syncAppleHealthToday as syncNativeHealthToday,
  getAppleHealthDiagnostics as getNativeHealthDiagnostics,
} from '../healthkit/healthkit-connection';
export {
  discoverAppleHealthIntakeWriters as discoverNativeIntakeWriters,
  resolveKnownFoodTracker,
} from '../healthkit/apple-health-intake-writers';
export type { NativeIntakeWriter, KnownFoodTracker } from './types';
