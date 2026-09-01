import { describe, expect, it } from 'vitest';

import {
  appleHealthBurnIsReady,
  initialImportPlan,
  onboardingRecoveryMessage,
  preparationEditStage,
  previousSetupStage,
  selectedAppleHealthWriter,
  sourceNeedsData,
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
  });
});
