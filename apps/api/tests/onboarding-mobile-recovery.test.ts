import { describe, expect, it } from 'vitest';

import {
  appleHealthBurnIsReady,
  createOnboardingActionGate,
  initialImportPlan,
  nextStageAfterSource,
  onboardingSourceState,
  onboardingRecoveryMessage,
  preparationEditStage,
  previousSetupStage,
  providerIsConnected,
  selectedAppleHealthWriter,
  sourceActionIsPending,
  sourceSelectionSatisfiesOnboarding,
  sourceNeedsData,
  withOnboardingTimeout,
} from '../../mobile/lib/onboarding/onboarding-recovery';
import type {
  HealthConnectionsResponse,
  OnboardingStatusResponse,
  ProviderSelectionResponse,
} from '@caloriebank/schemas';

describe('mobile onboarding recovery policy', () => {
  it('imports Apple Health for the current account whenever either selected role uses it', () => {
    const providers = {
      expenditure: { authoritativeProvider: 'google_health_fitbit' },
      intake: { authoritativeProvider: 'apple_health' },
    } as ProviderSelectionResponse;

    expect(initialImportPlan(providers)).toEqual({
      appleHealth: true,
      fatSecret: false,
      fitbit: true,
    });
  });

  it('does not treat Apple Health as burn-ready until persisted role evidence is usable', () => {
    const connections = {
      burned: {
        selected: null,
        alternatives: [{
          optionId: 'apple-health-burn', label: 'Apple Health', transportLabel: null,
          status: 'no_data', primaryAction: 'refresh_apple_health', deviceManaged: true,
        }],
        canChange: false,
        canAddSource: true,
      },
    } as HealthConnectionsResponse;

    expect(appleHealthBurnIsReady(connections)).toBe(false);
    connections.burned.alternatives[0]!.status = 'connected';
    expect(appleHealthBurnIsReady(connections)).toBe(true);
  });

  it('supports backward setup navigation without changing persisted setup facts', () => {
    expect(previousSetupStage('calories_burned')).toBe('welcome');
    expect(previousSetupStage('calories_eaten')).toBe('calories_burned');
    expect(previousSetupStage('goal')).toBe('calories_eaten');

    const status = {
      preparation: { expenditure: 'complete', intake: 'preparing', history: 'preparing' },
    } as OnboardingStatusResponse;
    expect(preparationEditStage(status)).toBe('calories_eaten');
  });

  it('uses a single waiting state only after a source is already connected', () => {
    expect(sourceNeedsData({ connected: true, readiness: 'connected_waiting_for_data' } as OnboardingStatusResponse['intake'])).toBe(true);
    expect(sourceNeedsData({ connected: false, readiness: 'not_connected' } as OnboardingStatusResponse['intake'])).toBe(false);
    expect(sourceNeedsData({ connected: true, readiness: 'ready' } as OnboardingStatusResponse['intake'])).toBe(false);
  });

  it('models connected, waiting, refreshing, and attention states without ambiguous booleans', () => {
    const waiting = {
      connected: true,
      readiness: 'connected_waiting_for_data',
    } as OnboardingStatusResponse['intake'];
    expect(onboardingSourceState({ source: waiting, operation: null, recoverableError: false }))
      .toBe('connected_waiting_for_data');
    expect(onboardingSourceState({ source: waiting, operation: 'refreshing', recoverableError: false }))
      .toBe('refresh_in_progress');
    expect(onboardingSourceState({ source: waiting, operation: null, recoverableError: true }))
      .toBe('recoverable_error');
    expect(onboardingSourceState({
      source: { ...waiting, readiness: 'needs_attention' },
      operation: null,
      recoverableError: false,
    })).toBe('needs_attention');
  });

  it('treats a valid saved source as a complete decision even before calorie data arrives', () => {
    const waiting = {
      connected: true,
      readiness: 'connected_waiting_for_data',
    } as OnboardingStatusResponse['intake'];
    expect(sourceSelectionSatisfiesOnboarding(waiting)).toBe(true);
    expect(sourceSelectionSatisfiesOnboarding({ ...waiting, connected: false })).toBe(false);
    expect(sourceSelectionSatisfiesOnboarding({ ...waiting, readiness: 'needs_attention' })).toBe(false);
    expect(nextStageAfterSource('expenditure')).toBe('calories_eaten');
    expect(nextStageAfterSource('intake')).toBe('goal');
  });

  it('isolates loading feedback to the source action that is actually running', () => {
    expect(sourceActionIsPending('apple-intake:cronometer', 'apple-intake:cronometer')).toBe(true);
    expect(sourceActionIsPending('apple-intake:cronometer', 'apple-intake:myfitnesspal')).toBe(false);
    expect(sourceActionIsPending('apple-intake:cronometer', 'apple-intake:lose_it')).toBe(false);
    expect(sourceActionIsPending('apple-intake:cronometer', 'apple-intake:macrofactor')).toBe(false);
  });

  it('single-flights duplicate taps until the active operation ends', () => {
    const gate = createOnboardingActionGate();
    expect(gate.begin('apple-intake:cronometer')).toBe(true);
    expect(gate.begin('apple-intake:cronometer')).toBe(false);
    expect(gate.begin('apple-intake:myfitnesspal')).toBe(false);
    gate.end('apple-intake:cronometer');
    expect(gate.begin('apple-intake:myfitnesspal')).toBe(true);
  });

  it('bounds stalled native onboarding work instead of leaving an infinite spinner', async () => {
    await expect(withOnboardingTimeout(new Promise(() => undefined), 1))
      .rejects.toThrow('ONBOARDING_OPERATION_TIMEOUT');
  });

  it('keeps connected direct providers out of ordinary reconnect presentation', () => {
    const providers = {
      connectedProviders: [
        { provider: 'fatsecret', status: 'connected' },
        { provider: 'google_health_fitbit', status: 'connected' },
      ],
    } as ProviderSelectionResponse;
    expect(providerIsConnected(providers, 'fatsecret')).toBe(true);
    expect(providerIsConnected(providers, 'google_health_fitbit')).toBe(true);
    expect(providerIsConnected(providers, 'apple_health')).toBe(false);
  });

  it('marks only the selected Apple Health food writer as connected', () => {
    const providers = {
      intake: { authoritativeProvider: 'apple_health', writerDisplayName: 'Cronometer' },
    } as ProviderSelectionResponse;
    expect(selectedAppleHealthWriter(providers, 'Cronometer')).toBe(true);
    expect(selectedAppleHealthWriter(providers, 'MyFitnessPal')).toBe(false);
    expect(selectedAppleHealthWriter(null, 'Cronometer')).toBe(false);
  });

  it('uses actionable Apple Health and network errors instead of a generic connection diagnosis', () => {
    expect(onboardingRecoveryMessage({
      action: 'apple', failureKind: 'unknown', usesAppleHealth: true,
    })).toBe('CalorieBank couldn’t refresh Apple Health. Try again.');
    expect(onboardingRecoveryMessage({
      action: 'preparing', failureKind: 'network', usesAppleHealth: true,
    })).toBe('Couldn’t connect to CalorieBank. Check your internet connection and try again.');
    expect(onboardingRecoveryMessage({
      action: 'other', failureKind: 'unknown', usesAppleHealth: false,
    })).toBe('Something went wrong. Try again.');
    expect(onboardingRecoveryMessage({
      action: 'other', failureKind: 'cancelled', usesAppleHealth: false,
    })).toBe('Connection was cancelled. Try again or choose another source.');
  });
});
