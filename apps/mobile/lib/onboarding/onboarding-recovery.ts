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
  if (input.action === 'apple' || (input.action === 'preparing' && input.usesAppleHealth)) {
    return 'CalorieBank couldn’t refresh Apple Health. Try again.';
  }
  return 'Something went wrong. Try again.';
}
