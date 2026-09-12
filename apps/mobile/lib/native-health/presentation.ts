import type { HealthConnectionsResponse, OnboardingStatusResponse, OnboardingStage } from '@caloriebank/schemas';

/** Presentation only: retain selected IDs and never silently change server authority. */
export function connectionsForNativeCapability(connections: HealthConnectionsResponse, supported: boolean): HealthConnectionsResponse {
  if (supported) return connections;
  const role = (value: HealthConnectionsResponse['burned']) => {
    const alternatives = value.alternatives.filter((option) => !option.deviceManaged);
    return {
      ...value,
      selected: value.selected?.deviceManaged ? {
        ...value.selected, label: 'Source on another device', transportLabel: null,
        status: 'needs_attention' as const, primaryAction: null,
      } : value.selected,
      alternatives,
      canChange: alternatives.some((option) => option.status === 'connected'),
      canAddSource: true,
    };
  };
  return { ...connections, burned: role(connections.burned), eaten: role(connections.eaten),
    connectedServices: connections.connectedServices.filter((option) => !option.deviceManaged) };
}

export function nativeSourceRecoveryStage(status: OnboardingStatusResponse | null, supported: boolean): OnboardingStage | null {
  if (supported || !status || status.completed || status.stage === 'welcome') return null;
  if (status.expenditure.provider === 'apple_health' && status.expenditure.readiness !== 'not_connected') return 'calories_burned';
  if (status.intake.provider === 'apple_health' && status.intake.readiness !== 'not_connected') return 'calories_eaten';
  return null;
}
