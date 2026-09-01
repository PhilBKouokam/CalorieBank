import type { HealthConnectionOption, HealthConnectionsResponse } from '@caloriebank/schemas';
import type { AppleHealthBurnState } from './healthkit-diagnostics';

export type AppleHealthLocalState =
  | 'loading'
  | 'requesting'
  | 'syncing'
  | 'not_connected'
  | 'unavailable'
  | 'connected'
  | 'connected_partial'
  | 'sync_error';

function refreshable(option: HealthConnectionOption): HealthConnectionOption {
  return {
    ...option,
    status: option.status === 'connected' ? 'no_data' : option.status,
    primaryAction: 'refresh_apple_health',
  };
}

/** Composes device-local HealthKit state with account-scoped server evidence. */
export function composeAppleHealthConnections(
  connections: HealthConnectionsResponse,
  localState: AppleHealthLocalState,
  burnState: AppleHealthBurnState = localState === 'sync_error'
    ? 'refresh_failed'
    : localState === 'unavailable'
      ? 'needs_attention'
      : localState === 'not_connected'
        ? 'needs_refresh'
        : 'ready',
): HealthConnectionsResponse {
  const composeBurnOption = (option: HealthConnectionOption) => {
    if (!option.deviceManaged || burnState === 'ready') return option;
    if (burnState === 'no_burn_data') return { ...option, status: 'no_data' as const, primaryAction: null };
    if (burnState === 'needs_attention') return { ...option, status: 'needs_attention' as const, primaryAction: 'check_apple_health' as const };
    if (burnState === 'refresh_failed') return { ...option, status: 'needs_attention' as const, primaryAction: 'refresh_apple_health' as const };
    return refreshable(option);
  };

  const composeRole = (role: HealthConnectionsResponse['burned'], roleName: 'burned' | 'eaten') => ({
    ...role,
    selected: role.selected?.deviceManaged
      ? roleName === 'burned'
        ? composeBurnOption(role.selected)
        : localState === 'connected' || localState === 'connected_partial' || localState === 'syncing'
          ? role.selected
          : refreshable(role.selected)
      : role.selected,
    alternatives: role.alternatives.map((option) => option.deviceManaged
      ? roleName === 'burned'
        ? composeBurnOption(option)
        : localState === 'connected' || localState === 'connected_partial' || localState === 'syncing'
          ? option
          : refreshable(option)
      : option),
    canChange: role.alternatives.some(
      (option) => (roleName !== 'burned' || !option.deviceManaged || burnState === 'ready') && option.status === 'connected',
    ),
  });

  return {
    ...connections,
    burned: composeRole(connections.burned, 'burned'),
    eaten: composeRole(connections.eaten, 'eaten'),
    connectedServices: connections.connectedServices.map((option) =>
      option.deviceManaged && localState !== 'connected' && localState !== 'connected_partial' && localState !== 'syncing'
        ? refreshable(option)
        : option),
  };
}
