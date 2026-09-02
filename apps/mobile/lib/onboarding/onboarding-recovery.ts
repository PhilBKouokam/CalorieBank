import type {
  HealthConnectionsResponse,
  OnboardingStage,
  OnboardingStatusResponse,
  ProviderSelectionResponse,
} from '@caloriebank/schemas';

export function appleHealthBurnIsReady(connections: HealthConnectionsResponse) {
  return [connections.burned.selected, ...connections.burned.alternatives]
    .some((option) => option?.label === 'Apple Health' && option.status === 'connected');
}

export function initialImportPlan(providers: ProviderSelectionResponse) {
  return {
    appleHealth:
      providers.expenditure.authoritativeProvider === 'apple_health'
      || providers.intake.authoritativeProvider === 'apple_health',
    fatSecret: providers.intake.authoritativeProvider === 'fatsecret',
    fitbit: providers.expenditure.authoritativeProvider === 'google_health_fitbit',
  };
}

export function previousSetupStage(stage: OnboardingStage): OnboardingStage | null {
  if (stage === 'calories_burned') return 'welcome';
  if (stage === 'calories_eaten') return 'calories_burned';
  if (stage === 'goal') return 'calories_eaten';
  return null;
}

export function sourceNeedsData(
  source: OnboardingStatusResponse['expenditure'] | OnboardingStatusResponse['intake'],
) {
  return source.connected && source.readiness === 'connected_waiting_for_data';
}

export type OnboardingSourceState =
  | 'not_selected'
  | 'connection_in_progress'
  | 'connected_ready'
  | 'connected_waiting_for_data'
  | 'refresh_in_progress'
  | 'recoverable_error'
  | 'needs_attention';

export function onboardingSourceState(input: {
  source: OnboardingStatusResponse['expenditure'] | OnboardingStatusResponse['intake'];
  operation: 'connecting' | 'refreshing' | null;
  recoverableError: boolean;
}): OnboardingSourceState {
  if (input.operation === 'connecting') return 'connection_in_progress';
  if (input.operation === 'refreshing') return 'refresh_in_progress';
  if (input.recoverableError) return 'recoverable_error';
  if (input.source.readiness === 'needs_attention') return 'needs_attention';
  if (input.source.connected && input.source.readiness === 'ready') return 'connected_ready';
  if (sourceNeedsData(input.source)) return 'connected_waiting_for_data';
  return 'not_selected';
}

export function sourceSelectionSatisfiesOnboarding(
  source: OnboardingStatusResponse['expenditure'] | OnboardingStatusResponse['intake'],
) {
  return source.connected
    && (source.readiness === 'ready' || source.readiness === 'connected_waiting_for_data');
}

export function sourceActionIsPending(activeAction: string | null, sourceAction: string) {
  return activeAction === sourceAction;
}

export function createOnboardingActionGate() {
  let active: string | null = null;
  return {
    begin(action: string) {
      if (active !== null) return false;
      active = action;
      return true;
    },
    end(action: string) {
      if (active === action) active = null;
    },
    isActive() {
      return active !== null;
    },
  };
}

export function providerIsConnected(
  providers: ProviderSelectionResponse | null,
  provider: string,
) {
  return providers?.connectedProviders.some(
    (connection) => connection.provider === provider && connection.status === 'connected',
  ) ?? false;
}

export function nextStageAfterSource(role: 'expenditure' | 'intake'): OnboardingStage {
  return role === 'expenditure' ? 'calories_eaten' : 'goal';
}

export function withOnboardingTimeout<T>(
  operation: Promise<T>,
  timeoutMs = 45_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ONBOARDING_OPERATION_TIMEOUT')), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function selectedAppleHealthWriter(
  providers: ProviderSelectionResponse | null,
  displayName: string,
) {
  return providers?.intake.authoritativeProvider === 'apple_health'
    && providers.intake.writerDisplayName === displayName;
}

export function preparationEditStage(status: OnboardingStatusResponse): OnboardingStage {
  if (status.preparation.intake !== 'complete') return 'calories_eaten';
  if (status.preparation.expenditure !== 'complete') return 'calories_burned';
  return 'goal';
}

export function onboardingRecoveryMessage(input: {
  action: 'apple' | 'preparing' | 'other';
  failureKind: 'timeout' | 'cancelled' | 'network' | 'unknown';
  usesAppleHealth: boolean;
}) {
  if (input.failureKind === 'network') {
    return 'Couldn’t connect to CalorieBank. Check your internet connection and try again.';
  }
  if (input.failureKind === 'timeout') {
    return 'CalorieBank took too long to respond. Try again.';
  }
  if (input.failureKind === 'cancelled') {
    return 'Connection was cancelled. Try again or choose another source.';
  }
  if (input.action === 'apple' || (input.action === 'preparing' && input.usesAppleHealth)) {
    return 'CalorieBank couldn’t refresh Apple Health. Try again.';
  }
  return 'Something went wrong. Try again.';
}
