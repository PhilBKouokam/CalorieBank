import type { HealthConnectionsResponse, OnboardingStatusResponse, OnboardingStage } from '@caloriebank/schemas';

/** Presentation only: retain selected IDs and never silently change server authority. */
export function connectionsForNativeCapability(connections: HealthConnectionsResponse, supported: boolean, supportsNativeIntake = false, nativeIntakePermission = true): HealthConnectionsResponse {
  if (supported) {
    const native = (option: HealthConnectionsResponse['eaten']['alternatives'][number]) => option.transportLabel === 'Health Connect';
    if (!connections.eaten.alternatives.some(native) && !(connections.eaten.selected && native(connections.eaten.selected))) return connections;
    return { ...connections, eaten: { ...connections.eaten, selected: connections.eaten.selected && native(connections.eaten.selected) ? { ...connections.eaten.selected, label: 'Source on another device', transportLabel: null, status: 'needs_attention', primaryAction: null } : connections.eaten.selected, alternatives: connections.eaten.alternatives.filter((option) => !native(option)), canChange: connections.eaten.alternatives.some((option) => !native(option) && option.status === 'connected') } };
  }
  const role = (value: HealthConnectionsResponse['burned'], intake = false) => {
    const available = (option: HealthConnectionsResponse['eaten']['alternatives'][number]) => !option.deviceManaged || (intake && supportsNativeIntake && option.transportLabel === 'Health Connect');
    const alternatives = value.alternatives.filter(available).map((option) => option.transportLabel === 'Health Connect' && !nativeIntakePermission ? { ...option, status: 'needs_attention' as const, primaryAction: 'check_native_health' as const } : option);
    return {
      ...value,
      selected: value.selected && !available(value.selected) ? {
        ...value.selected, label: 'Source on another device', transportLabel: null,
        status: 'needs_attention' as const, primaryAction: null,
      } : value.selected?.transportLabel === 'Health Connect' && !nativeIntakePermission ? { ...value.selected, status: 'needs_attention' as const, primaryAction: 'check_native_health' as const } : value.selected,
      alternatives,
      canChange: alternatives.some((option) => option.status === 'connected'),
      canAddSource: true,
    };
  };
  return { ...connections, burned: role(connections.burned), eaten: role(connections.eaten, true),
    connectedServices: connections.connectedServices.filter((option) => !option.deviceManaged) };
}

export function nativeSourceRecoveryStage(status: OnboardingStatusResponse | null, supported: boolean): OnboardingStage | null {
  if (supported || !status || status.completed || status.stage === 'welcome') return null;
  if (status.expenditure.provider === 'apple_health' && status.expenditure.readiness !== 'not_connected') return 'calories_burned';
  if (status.intake.provider === 'apple_health' && status.intake.readiness !== 'not_connected') return 'calories_eaten';
  return null;
}
