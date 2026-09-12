import type { NativeHealthBridge, NativeHealthCapability } from './types';

export const nativeHealthCapability: NativeHealthCapability = {
  supported: false, provider: null, reason: 'not_implemented',
};
export const setNativeHealthAccountScope: NativeHealthBridge['setAccountScope'] = () => undefined;
export const getNativeHealthConnectionStatus: NativeHealthBridge['getConnectionStatus'] = async () => 'unavailable';
export const connectNativeHealth: NativeHealthBridge['connect'] = async () => 'unavailable';
export const refreshNativeHealthForCurrentAccount: NativeHealthBridge['refresh'] = async () => null;
export const getNativeHealthDiagnostics: NativeHealthBridge['getDiagnostics'] = async () => null;
export const discoverNativeIntakeWriters: NativeHealthBridge['discoverIntakeWriters'] = async () => [];
export const resolveKnownFoodTracker: NativeHealthBridge['resolveKnownFoodTracker'] = () => null;
export const syncNativeHealthToday: NativeHealthBridge['sync'] = async () => {
  // A caller must not mistake a no-op for a successful import or fabricated zero.
  throw new Error('Native health synchronization is not implemented on this platform.');
};
export type { NativeIntakeWriter, KnownFoodTracker } from './types';
