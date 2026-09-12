export { nativeIntake } from './intake.android';
import { setNativeIntakeScope } from './intake.android';
// Qualification never enables provider selection or the production ingestion path.
export { getNativeHealthConnectionStatus, connectNativeHealth,
  refreshNativeHealthForCurrentAccount, getNativeHealthDiagnostics, discoverNativeIntakeWriters,
  resolveKnownFoodTracker, syncNativeHealthToday } from './unavailable';
export type { NativeIntakeWriter, KnownFoodTracker } from './types';
export { nativeHealthQualification, nativeNutritionQualification } from '../health-connect/bridge.android';
import { nativeHealthQualification, nativeNutritionQualification } from '../health-connect/bridge.android';
export const setNativeHealthAccountScope = (scope: string | null) => {
  setNativeIntakeScope(scope);
  nativeHealthQualification.setAccountScope(scope);
  nativeNutritionQualification.setAccountScope(scope);
};

import type { NativeHealthCapability } from './types';
export const nativeHealthCapability: NativeHealthCapability = { supported: false, provider: null, reason: 'not_qualified' };
