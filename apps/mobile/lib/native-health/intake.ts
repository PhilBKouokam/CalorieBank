import type { NativeAccess, SourceIdentity } from './evidence';
export type NativeFoodSource = { source: SourceIdentity; displayName: string };
export type NativeIntakeResult = 'ready' | 'empty' | 'access_required' | 'retry_required' | 'skipped';
export interface NativeIntakeService {
  supported: boolean;
  access(): Promise<NativeAccess>;
  discover(requestPermissions?: boolean): Promise<{ access: NativeAccess; sources: NativeFoodSource[]; queryState?: 'complete' | 'empty' | 'failed' }>;
  select(source: SourceIdentity): Promise<NativeIntakeResult>;
  refresh(): Promise<NativeIntakeResult>;
  openSettings(): Promise<boolean>;
  cancel(): void;
}
const unavailable: NativeAccess = { state: 'unavailable', granted: [], missing: ['nutrition'] };
export const nativeIntake: NativeIntakeService = {
  supported: false, access: async () => unavailable, cancel: () => undefined,
  discover: async () => ({ access: unavailable, sources: [] }),
  select: async () => 'skipped', refresh: async () => 'skipped', openSettings: async () => false,
};
