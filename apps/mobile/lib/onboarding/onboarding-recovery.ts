import type {
  BankSummaryResponse,
  HealthConnectionsResponse,
  OnboardingStage,
  OnboardingStatusResponse,
  ProviderSelectionResponse,
  TodayResponse,
} from '@caloriebank/schemas';

export function deriveFirstRunBootstrapState(input: {
  onboarding: OnboardingStatusResponse;
  bank: BankSummaryResponse;
  today: TodayResponse;
}) {
  const historyReady = input.onboarding.preparation.history === 'complete' ||
    input.onboarding.preparation.history === 'no_history';
  return {
    currentBurnReady: input.today.burned.adjusted !== null,
    currentIntakeReady: input.today.eaten.calories !== null,
    historyReady,
    bankReady: input.bank.openingBankStatus === 'initialized',
    complete: historyReady,
  };
}

export function appleHealthBurnIsReady(connections: HealthConnectionsResponse) {
  return [connections.burned.selected, ...connections.burned.alternatives]
    .some((option) => option?.label === 'Apple Health' && option.status === 'connected');
}

export function initialImportPlan(providers: ProviderSelectionResponse) {
  return {
    appleHealth:
      (providers.expenditure.selected !== false && providers.expenditure.authoritativeProvider === 'apple_health')
      || (providers.intake.selected !== false && providers.intake.authoritativeProvider === 'apple_health'
        && Boolean(providers.intake.writerBundleIdentifier)),
    fatSecret: providers.intake.selected !== false && providers.intake.authoritativeProvider === 'fatsecret',
    fitbit: providers.expenditure.selected !== false && providers.expenditure.authoritativeProvider === 'google_health_fitbit',
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
  return (source.connected || source.provider === 'manual_estimate')
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

export function setupIsReady(status: Pick<OnboardingStatusResponse, 'stage' | 'completed'> | null) {
  return status?.stage === 'ready' || status?.stage === 'complete' || status?.completed === true;
}

export function preparationRequestNotice(
  status: Pick<OnboardingStatusResponse, 'stage' | 'completed'> | null,
  failureKind: 'timeout' | 'cancelled' | 'network' | 'unknown',
) {
  if (setupIsReady(status)) return null;
  if (failureKind === 'timeout' && status) {
    return { tone: 'attention' as const, message: 'Setup is taking a little longer. We’ll check your progress again shortly.' };
  }
  return { tone: 'error' as const, message: status
    ? "We couldn't refresh all your recent data. Please try again."
    : "We couldn't check your setup. Please try again." };
}

export function createRequestGeneration() {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    begin() { const current = ++generation; return () => current === generation; },
  };
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
