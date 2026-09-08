export type SourceState = 'unselected' | 'selected_not_connected' | 'connected_no_data' | 'connected_data_ready' | 'refreshing' | 'transient_refresh_failure' | 'reconnect_required' | 'unavailable';

export type SourceFacts = {
  selected?: boolean | undefined;
  authoritativeProvider: string;
  displayName: string;
  status: string;
  writerBundleIdentifier?: string | null;
  writerDisplayName?: string | null;
};

export function concreteSourceSelected(role: 'burned' | 'eaten', source: SourceFacts) {
  if (source.selected === false) return false;
  if (role !== 'eaten' || source.authoritativeProvider !== 'apple_health') return true;
  return Boolean(source.writerBundleIdentifier && source.writerDisplayName &&
    !['choose a food tracker', 'apple health food tracker'].includes(source.writerDisplayName.trim().toLowerCase()) &&
    !['choose a food tracker', 'apple health food tracker'].includes(source.writerBundleIdentifier.trim().toLowerCase()));
}

export function deriveSourceState(role: 'burned' | 'eaten', source: SourceFacts, connection: string | undefined, operation?: 'refreshing' | 'failed'): SourceState {
  if (!concreteSourceSelected(role, source)) return 'unselected';
  if (connection === 'needs_attention') return 'reconnect_required';
  if (connection === 'unavailable') return 'unavailable';
  if (connection !== 'connected') return 'selected_not_connected';
  if (operation === 'refreshing') return 'refreshing';
  if (operation === 'failed') return 'transient_refresh_failure';
  return source.status === 'ready' ? 'connected_data_ready' : 'connected_no_data';
}

export function sourceStateAllowsContinue(state: SourceState) {
  return state === 'connected_data_ready' || state === 'connected_no_data' || state === 'transient_refresh_failure';
}
