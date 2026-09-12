import type * as Apple from '../healthkit/healthkit-connection';
import type * as Writers from '../healthkit/apple-health-intake-writers';

// B1 reuses the existing adapter contract; no new provider or accounting model.
// These type-only references never load HealthKit in an Android bundle.
export type NativeHealthBridge = {
  qualification?: import('./evidence').NativeHealthQualification;
  setAccountScope: typeof Apple.setAppleHealthAccountScope;
  getConnectionStatus: typeof Apple.getAppleHealthConnectionStatus;
  connect: typeof Apple.connectAppleHealth;
  refresh: typeof Apple.refreshAppleHealthForCurrentAccount;
  sync: typeof Apple.syncAppleHealthToday;
  getDiagnostics: typeof Apple.getAppleHealthDiagnostics;
  discoverIntakeWriters: typeof Writers.discoverAppleHealthIntakeWriters;
  resolveKnownFoodTracker: typeof Writers.resolveKnownFoodTracker;
};
export type NativeHealthCapability =
  | { supported: true; provider: 'apple_health' }
  | { supported: false; provider: null; reason: 'not_implemented' | 'not_qualified' };
export type { AppleHealthIntakeWriter as NativeIntakeWriter, KnownFoodTracker } from '../healthkit/apple-health-intake-writers';
